import { Composer } from 'grammy';
import { renderDirectoryFilterInputKeyboard, renderDirectoryFilterInputPrompt } from '../../lib/telegram/render.js';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import {
  beginDirectoryFilterInputForTelegramUser,
  cancelDirectoryFilterInputForTelegramUser,
  clearDirectoryFiltersForTelegramUser,
  clearSingleDirectoryFilterForTelegramUser,
  toggleDirectoryIndustryFilterForTelegramUser,
  toggleDirectorySkillFilterForTelegramUser
} from '../../lib/storage/directoryFilterStore.js';
import { cancelProfileFieldEdit } from '../../lib/storage/profileEditStore.js';
import { sendIntroRequestForTelegramUser } from '../../lib/storage/introRequestStore.js';
import { deliverIntroNotificationReceipt } from '../../lib/storage/notificationStore.js';
import { formatUserFacingError } from '../utils/notices.js';
import { localizeMemberKeyboard, localizeMemberText } from '../../lib/telegram/memberLocalization.js';
import { recordLinkedInShareAttributionEventForTelegramUser } from '../../lib/storage/linkedinShareAttributionStore.js';

export function createDirectoryComposer({
  clearAllPendingInputs,
  buildDirectoryListSurface,
  buildDirectoryCardSurface,
  buildContactRequestSurface,
  buildContactInboxSurface,
  buildDirectoryFiltersSurface,
  buildIntroInboxSurface,
  formatIntroRequestReason
}) {
  const composer = new Composer();

  const renderDirectoryList = async (ctx, page = 0, method = 'edit', notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildDirectoryListSurface(ctx, page, notice);
    if (method === 'reply') {
      await ctx.reply(surface.text, { reply_markup: surface.reply_markup });
      return;
    }
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };

  composer.command('browse', async (ctx) => {
    await renderDirectoryList(ctx, 0, 'reply');
  });

  composer.command('contact', async (ctx) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildContactInboxSurface(ctx);
    await ctx.reply(surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^dir:list:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = Number.parseInt(ctx.match?.[1] || '0', 10);
    await renderDirectoryList(ctx, page, 'edit');
  });

  composer.callbackQuery(/^dir:open:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const profileId = Number.parseInt(ctx.match?.[1] || '0', 10);
    const page = Number.parseInt(ctx.match?.[2] || '0', 10);
    const surface = await buildDirectoryCardSurface(ctx, profileId, page);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^dir:contact:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const profileId = Number.parseInt(ctx.match?.[1] || '0', 10);
    const page = Number.parseInt(ctx.match?.[2] || '0', 10);
    const surface = await buildContactRequestSurface(ctx, profileId, page);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery('contact:inbox', async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildContactInboxSurface(ctx);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^dir:intro:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const profileId = Number.parseInt(ctx.match?.[1] || '0', 10);

    await recordLinkedInShareAttributionEventForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      targetProfileId: profileId,
      eventType: 'contact_request_started',
      telegramUpdateId: ctx.update?.update_id || null,
      detail: { contactKind: 'intro_request' }
    }).catch(() => null);

    const result = await sendIntroRequestForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      targetProfileId: profileId
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      created: false,
      duplicate: false,
      blocked: false,
      reason: String(error?.message || error),
      inbox: null
    }));

    let notice = 'Intro inbox updated.';
    let receiptResult = null;
    if (!result.persistenceEnabled) {
      notice = '⚠️ This feature is temporarily unavailable. Try again later.';
    } else if (result.created) {
      await recordLinkedInShareAttributionEventForTelegramUser({
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username || null,
        targetProfileId: profileId,
        eventType: 'request_submitted',
        telegramUpdateId: ctx.update?.update_id || null,
        entityType: 'intro_request',
        entityId: result.introRequest?.intro_request_id,
        detail: { contactKind: 'intro_request' }
      }).catch(() => null);
      receiptResult = await deliverIntroNotificationReceipt({
        eventType: 'intro_request_created',
        introRequestId: result.introRequest?.intro_request_id
      }).catch((error) => ({
        sent: false,
        duplicate: false,
        skipped: false,
        failed: true,
        reason: String(error?.message || error)
      }));

      notice = `✅ Intro request saved for ${result.target?.display_name || 'this profile'}.`;
      if (receiptResult?.sent) {
        notice += ' Recipient received a Telegram notice.';
      } else if (receiptResult?.duplicate) {
        notice += ' Recipient notice was already recorded.';
      } else if (receiptResult?.skipped) {
        notice += ' Recipient notice was skipped.';
      } else if (receiptResult?.failed) {
        notice += ' Recipient notice delivery failed, but the intro request is saved.';
      }
    } else if (result.duplicate) {
      notice = `ℹ️ ${formatIntroRequestReason(result.reason, ctx.interfaceLanguage)}`;
    } else if (result.throttled) {
      notice = `⏳ ${formatIntroRequestReason(result.reason, ctx.interfaceLanguage)}`;
    } else if (result.blocked) {
      notice = `⚠️ ${formatIntroRequestReason(result.reason, ctx.interfaceLanguage)}`;
    } else {
      notice = `⚠️ ${formatIntroRequestReason(result.reason, ctx.interfaceLanguage)}`;
    }

    const surface = await buildIntroInboxSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery('dir:flt', async (ctx) => {
    await ctx.answerCallbackQuery();
    await cancelProfileFieldEdit({ telegramUserId: ctx.from.id }).catch(() => null);
    const surface = await buildDirectoryFiltersSurface(ctx);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^dir:ft:([qc])$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const kind = ctx.match?.[1];

    try {
      await cancelProfileFieldEdit({ telegramUserId: ctx.from.id }).catch(() => null);
      const result = await beginDirectoryFilterInputForTelegramUser({
        telegramUserId: ctx.from.id,
        kind
      });

      await ctx.reply(localizeMemberText(renderDirectoryFilterInputPrompt({
        kind,
        filterSummary: result.filterSummary
      }), ctx.interfaceLanguage), {
        reply_markup: localizeMemberKeyboard(renderDirectoryFilterInputKeyboard(), ctx.interfaceLanguage)
      });
    } catch (error) {
      const surface = await buildDirectoryFiltersSurface(ctx, `⚠️ ${formatUserFacingError(error?.message || error, 'Could not open filters right now.', ctx.interfaceLanguage)}`);
      await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
    }
  });

  composer.callbackQuery(/^dir:fx:([qc])$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const kind = ctx.match?.[1];
    await cancelDirectoryFilterInputForTelegramUser({ telegramUserId: ctx.from.id }).catch(() => null);

    const result = await clearSingleDirectoryFilterForTelegramUser({
      telegramUserId: ctx.from.id,
      kind
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      reason: String(error?.message || error)
    }));

    let notice = 'Filter cleared.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ This feature is temporarily unavailable. Try again later.';
    } else if (!result.changed) {
      notice = `⚠️ ${formatUserFacingError(result.reason, 'Could not clear this filter right now.', ctx.interfaceLanguage)}`;
    } else {
      notice = `✅ ${result.inputMeta?.label || 'Filter'} cleared.`;
    }

    const surface = await buildDirectoryFiltersSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^dir:fi:([a-z]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await cancelDirectoryFilterInputForTelegramUser({ telegramUserId: ctx.from.id }).catch(() => null);
    const industrySlug = ctx.match?.[1];

    const result = await toggleDirectoryIndustryFilterForTelegramUser({
      telegramUserId: ctx.from.id,
      industrySlug
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      reason: String(error?.message || error)
    }));

    let notice = 'Industry filter updated.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ This feature is temporarily unavailable. Try again later.';
    } else if (!result.changed) {
      notice = `⚠️ ${formatUserFacingError(result.reason, 'Could not update the industry filter right now.', ctx.interfaceLanguage)}`;
    } else {
      notice = result.filterSummary.selectedIndustrySlug
        ? `✅ Industry filter: ${result.filterSummary.industryLabel}`
        : '✅ Industry filter cleared.';
    }

    const surface = await buildDirectoryFiltersSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^dir:fs:([a-z]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await cancelDirectoryFilterInputForTelegramUser({ telegramUserId: ctx.from.id }).catch(() => null);
    const skillSlug = ctx.match?.[1];

    const result = await toggleDirectorySkillFilterForTelegramUser({
      telegramUserId: ctx.from.id,
      skillSlug
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      reason: String(error?.message || error)
    }));

    let notice = 'Skill filter updated.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ This feature is temporarily unavailable. Try again later.';
    } else if (!result.changed) {
      notice = `⚠️ ${formatUserFacingError(result.reason, 'Could not update the skill filter right now.', ctx.interfaceLanguage)}`;
    } else {
      notice = result.toggledOn
        ? `✅ Added skill filter: ${result.skillMeta.label}`
        : `✅ Removed skill filter: ${result.skillMeta.label}`;
    }

    const surface = await buildDirectoryFiltersSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery('dir:fc', async (ctx) => {
    await ctx.answerCallbackQuery();
    await cancelDirectoryFilterInputForTelegramUser({ telegramUserId: ctx.from.id }).catch(() => null);

    const result = await clearDirectoryFiltersForTelegramUser({
      telegramUserId: ctx.from.id
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      reason: String(error?.message || error)
    }));

    let notice = 'Filters cleared.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ This feature is temporarily unavailable. Try again later.';
    } else if (!result.changed) {
      notice = `⚠️ ${formatUserFacingError(result.reason, 'Could not clear directory filters right now.', ctx.interfaceLanguage)}`;
    } else {
      notice = '✅ Directory filters cleared.';
    }

    const surface = await buildDirectoryFiltersSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  return composer;
}
