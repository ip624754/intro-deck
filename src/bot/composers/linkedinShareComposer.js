import { Composer } from 'grammy';
import { getLinkedInConfig, getLinkedInShareConfig, getTelegramConfig } from '../../config/env.js';
import { buildSignedLinkedInLaunchTicket } from '../../lib/linkedin/oidc.js';
import {
  buildLinkedInStartUrl,
  renderLinkedInSharePreviewKeyboard,
  renderLinkedInSharePreviewText
} from '../../lib/telegram/render.js';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import { memberReasonText } from '../../lib/telegram/memberCopy.js';
import {
  cancelLinkedInShareForTelegramUser,
  createProfileShareDraftForTelegramUser
} from '../../lib/storage/linkedinShareStore.js';

function shareStartFailureNotice(reason) {
  switch (reason) {
    case 'share_profile_not_listed':
      return '⚠️ Publish your profile in the Intro Deck directory before sharing it on LinkedIn.';
    case 'linkedin_share_previous_outcome_unknown':
      return '⚠️ A previous LinkedIn share has an uncertain provider result. Check your LinkedIn feed before asking an operator to reconcile it; a new share is blocked to prevent duplicates.';
    case 'linkedin_share_publish_in_progress':
      return '⏳ A LinkedIn share is already publishing. Wait for the receipt before creating another share.';
    case 'migration_029_required':
      return '⚠️ LinkedIn sharing is temporarily unavailable.';
    case 'linkedin_not_connected':
    case 'linkedin_account_missing':
      return '⚠️ Connect LinkedIn before creating a profile share.';
    default:
      return `⚠️ ${memberReasonText(reason, 'LinkedIn sharing is temporarily unavailable. Try again later.')}`;
  }
}

export function createLinkedInShareComposer({
  clearAllPendingInputs,
  appBaseUrl,
  buildProfilePreviewSurface
}) {
  const composer = new Composer();

  const renderProfilePreview = async (ctx, notice = null) => {
    const surface = await buildProfilePreviewSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };

  const openSharePreview = async (ctx) => {
    await clearAllPendingInputs(ctx.from.id);
    const shareConfig = getLinkedInShareConfig();
    if (!shareConfig.enabled || shareConfig.configurationValid === false) {
      await renderProfilePreview(ctx, '⚠️ Share on LinkedIn is not enabled correctly in this environment.');
      return;
    }

    const { botUsername } = getTelegramConfig();
    const draft = await createProfileShareDraftForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      botUsername,
      visibility: shareConfig.visibility,
      ttlSeconds: shareConfig.intentTtlSeconds
    }).catch((error) => ({
      persistenceEnabled: true,
      created: false,
      reason: error?.message || String(error)
    }));

    if (!draft.persistenceEnabled || !draft.created) {
      await renderProfilePreview(ctx, shareStartFailureNotice(draft.reason));
      return;
    }

    const linkedinConfig = getLinkedInConfig();
    const launchTicket = buildSignedLinkedInLaunchTicket({
      telegramUserId: ctx.from.id,
      purpose: 'share_profile',
      shareIntentToken: draft.intent.public_token,
      ttlSeconds: Math.min(shareConfig.intentTtlSeconds, linkedinConfig.stateTtlSeconds),
      secret: linkedinConfig.stateSecret
    });
    const publishUrl = buildLinkedInStartUrl({
      appBaseUrl,
      telegramUserId: ctx.from.id,
      returnTo: '/profile',
      purpose: 'share_profile',
      launchTicket
    });

    await safeEditOrReply(ctx, renderLinkedInSharePreviewText({ intent: draft.intent }), {
      reply_markup: renderLinkedInSharePreviewKeyboard({
        publishUrl,
        publicToken: draft.intent.public_token
      }),
      disable_web_page_preview: true
    });
  };

  composer.command('share', async (ctx) => {
    await openSharePreview(ctx);
  });

  composer.callbackQuery('li:share:start', async (ctx) => {
    await ctx.answerCallbackQuery();
    await openSharePreview(ctx);
  });

  composer.callbackQuery(/^li:share:cancel:([0-9a-f-]{36})$/i, async (ctx) => {
    await ctx.answerCallbackQuery();
    const publicToken = ctx.match?.[1];
    const result = await cancelLinkedInShareForTelegramUser({
      publicToken,
      telegramUserId: ctx.from.id
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      reason: error?.message || String(error)
    }));

    const notice = result.changed
      ? '✅ LinkedIn share cancelled. Nothing was published.'
      : `ℹ️ ${memberReasonText(result.reason, 'The share could not be cancelled. Open the latest profile preview and try again.')}`;
    await renderProfilePreview(ctx, notice);
  });

  return composer;
}
