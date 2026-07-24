import { Composer } from 'grammy';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import {
  attemptInviteAttributionForTelegramUser,
  beginInviteRewardRedemptionForTelegramUser,
  confirmInviteRewardRedemptionForTelegramUser,
  loadInviteRedeemReadModel,
  loadInviteRewardsSummaryState
} from '../../lib/storage/inviteStore.js';
import {
  buildInlineInviteResult,
  renderInviteRedeemConfirmKeyboard,
  renderInviteRedeemConfirmText,
  renderInviteRedeemKeyboard,
  renderInviteRedeemText
} from '../../lib/telegram/render.js';

function parseStartParam(ctx) {
  const text = String(ctx.message?.text || '').trim();
  const parts = text.split(/\s+/, 2);
  return parts.length > 1 ? parts[1].trim() : null;
}

function formatInviteStartNotice(result) {
  if (!result || !result.persistenceEnabled) {
    return null;
  }

  if (result.created) {
    const inviter = result.invitedBy?.displayName || 'your contact';
    return `✅ Invite linked: you joined from ${inviter}.`;
  }

  if (result.alreadyLinked) {
    return 'ℹ️ Invite already linked earlier.';
  }

  if (result.existingUser) {
    return 'ℹ️ Invite link ignored: referral credit only applies on the first start.';
  }

  if (result.invalid) {
    return result.reason === 'self_referral'
      ? '⚠️ Invite link ignored: you cannot use your own invite link.'
      : '⚠️ Invite link ignored: this link is not valid for invite credit.';
  }

  return null;
}

export function createInviteComposer({
  clearAllPendingInputs,
  buildHomeSurface,
  buildInviteSurface,
  buildInviteLinkSurface,
  buildInvitePerformanceSurface,
  buildInviteRewardsSurface,
  buildInviteHistorySurface,
  buildInviteCardMessage,
  buildDirectoryCardSurface
}) {
  const composer = new Composer();

  const renderHome = async (ctx, method = 'edit', notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildHomeSurface(ctx, notice);
    if (method === 'reply') {
      await ctx.reply(surface.text, {
        reply_markup: surface.reply_markup,
        ...(surface.parse_mode ? { parse_mode: surface.parse_mode } : {}),
        ...(surface.disable_web_page_preview ? { disable_web_page_preview: true } : {})
      });
      return;
    }
    await safeEditOrReply(ctx, surface.text, {
      reply_markup: surface.reply_markup,
      ...(surface.parse_mode ? { parse_mode: surface.parse_mode } : {}),
      ...(surface.disable_web_page_preview ? { disable_web_page_preview: true } : {})
    });
  };

  const renderInvite = async (ctx, method = 'edit', notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildInviteSurface(ctx, notice);
    const options = {
      reply_markup: surface.reply_markup,
      ...(surface.parse_mode ? { parse_mode: surface.parse_mode } : {}),
      ...(surface.disable_web_page_preview ? { disable_web_page_preview: true } : {})
    };
    if (method === 'reply') {
      await ctx.reply(surface.text, options);
      return;
    }
    await safeEditOrReply(ctx, surface.text, options);
  };

  const renderInvitePerformance = async (ctx, method = 'edit', notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildInvitePerformanceSurface(ctx, notice);
    const options = {
      reply_markup: surface.reply_markup,
      ...(surface.parse_mode ? { parse_mode: surface.parse_mode } : {}),
      ...(surface.disable_web_page_preview ? { disable_web_page_preview: true } : {})
    };
    if (method === 'reply') {
      await ctx.reply(surface.text, options);
      return;
    }
    await safeEditOrReply(ctx, surface.text, options);
  };

  const renderInviteHistory = async (ctx, page = 1, method = 'edit', notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildInviteHistorySurface(ctx, page, notice);
    const options = {
      reply_markup: surface.reply_markup,
      ...(surface.parse_mode ? { parse_mode: surface.parse_mode } : {}),
      ...(surface.disable_web_page_preview ? { disable_web_page_preview: true } : {})
    };
    if (method === 'reply') {
      await ctx.reply(surface.text, options);
      return;
    }
    await safeEditOrReply(ctx, surface.text, options);
  };

  const renderInviteRewards = async (ctx, method = 'edit', notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildInviteRewardsSurface(ctx, notice);
    const options = {
      reply_markup: surface.reply_markup,
      ...(surface.parse_mode ? { parse_mode: surface.parse_mode } : {}),
      ...(surface.disable_web_page_preview ? { disable_web_page_preview: true } : {})
    };
    if (method === 'reply') {
      await ctx.reply(surface.text, options);
      return;
    }
    await safeEditOrReply(ctx, surface.text, options);
  };

  const renderInviteRedeem = async (ctx, method = 'edit', notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const state = await loadInviteRedeemReadModel({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => ({
      persistenceEnabled: true,
      mode: 'off',
      blockedReason: String(error?.message || error),
      catalog: [],
      rewardsSummary: { mode: 'off', availablePoints: 0, pendingPoints: 0, redeemedPoints: 0 }
    }));
    const text = renderInviteRedeemText({ redeemState: state, notice });
    const reply_markup = renderInviteRedeemKeyboard({ redeemState: state });
    if (method === 'reply') {
      await ctx.reply(text, { reply_markup, parse_mode: 'HTML', disable_web_page_preview: true });
      return;
    }
    await safeEditOrReply(ctx, text, { reply_markup, parse_mode: 'HTML', disable_web_page_preview: true });
  };

  composer.command('start', async (ctx, next) => {
    const startParam = parseStartParam(ctx);
    const sharedProfileMatch = /^profile_(\d+)$/.exec(String(startParam || ''));
    if (sharedProfileMatch && typeof buildDirectoryCardSurface === 'function') {
      await clearAllPendingInputs(ctx.from.id);
      const profileId = Number.parseInt(sharedProfileMatch[1], 10);
      const surface = await buildDirectoryCardSurface(ctx, profileId, 0, 'Opened from a member-approved LinkedIn share.');
      await ctx.reply(surface.text, { reply_markup: surface.reply_markup });
      return undefined;
    }

    const attribution = await attemptInviteAttributionForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      startParam
    }).catch((error) => ({
      persistenceEnabled: true,
      created: false,
      reason: String(error?.message || error)
    }));

    const notice = formatInviteStartNotice(attribution);
    await renderHome(ctx, 'reply', notice);
    if (typeof next === 'function') {
      return next();
    }
    return undefined;
  });

  composer.command('invite', async (ctx) => {
    await renderInvite(ctx, 'reply');
  });

  composer.callbackQuery('invite:root', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderInvite(ctx, 'edit');
  });


  composer.callbackQuery(/^invite:(?:perf|activity)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderInvitePerformance(ctx, 'edit');
  });

  composer.callbackQuery('invite:points', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderInviteRewards(ctx, 'edit');
  });

  composer.callbackQuery('invite:redeem', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderInviteRedeem(ctx, 'edit');
  });

  composer.callbackQuery(/^invite:redeem_item:([a-z0-9_:-]+)$/i, async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await beginInviteRewardRedemptionForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      catalogCode: ctx.match?.[1] || null
    }).catch((error) => ({ persistenceEnabled: true, created: false, blocked: true, reason: String(error?.message || error) }));

    if (!result.persistenceEnabled) {
      await ctx.answerCallbackQuery({ text: 'This feature is temporarily unavailable. Try again later.' });
      return;
    }

    if (!result.created || !result.redemption) {
      await renderInviteRedeem(ctx, 'edit', result.reason === 'insufficient_available_points'
        ? 'Not enough available points yet.'
        : result.reason === 'catalog_item_not_found'
          ? 'This reward item is not available.'
          : result.reason === 'redeem_not_available_in_earn_only'
            ? 'Redeem is not live yet. Earn-only mode keeps balances visible without spending.'
            : result.reason === 'redeem_not_available_in_paused'
              ? 'Rewards are paused right now.'
              : result.reason === 'redeem_not_available_in_off'
                ? 'Rewards program is off right now.'
                : 'Could not open redeem right now.');
      return;
    }

    const summaryState = await loadInviteRewardsSummaryState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch(() => ({ rewardsSummary: result.summary || { availablePoints: 0 } }));

    const text = renderInviteRedeemConfirmText({
      catalogItem: result.catalogItem,
      rewardsSummary: summaryState.rewardsSummary,
      notice: null
    });
    const reply_markup = renderInviteRedeemConfirmKeyboard({ redemptionId: result.redemption.redemptionId });
    await safeEditOrReply(ctx, text, { reply_markup, parse_mode: 'HTML', disable_web_page_preview: true });
  });

  composer.callbackQuery(/^invite:redeem_confirm:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await confirmInviteRewardRedemptionForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      redemptionId: Number.parseInt(ctx.match?.[1] || '0', 10)
    }).catch((error) => ({ persistenceEnabled: true, changed: false, blocked: true, reason: String(error?.message || error) }));

    if (!result.persistenceEnabled) {
      await ctx.answerCallbackQuery({ text: 'This feature is temporarily unavailable. Try again later.' });
      return;
    }

    if (result.changed) {
      await renderInviteRewards(ctx, 'edit', `✅ Redeemed: ${result.catalogItem?.label || 'Pro reward'} applied.`);
      return;
    }

    if (result.duplicate) {
      await renderInviteRewards(ctx, 'edit', 'ℹ️ This reward redemption was already completed.');
      return;
    }

    const reasonMap = {
      insufficient_available_points: 'Not enough available points.',
      redemption_not_found: 'This redeem confirmation is no longer available.',
      redeem_not_available_in_earn_only: 'Redeem is not live yet.',
      redeem_not_available_in_paused: 'Rewards are paused right now.',
      redeem_not_available_in_off: 'Rewards program is off right now.',
      catalog_item_not_found: 'This reward item is not available.'
    };
    await renderInviteRedeem(ctx, 'edit', reasonMap[result.reason] || 'Could not complete this redeem right now.');
  });

  composer.callbackQuery(/^invite:hist:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderInviteHistory(ctx, Number.parseInt(ctx.match?.[1] || '1', 10), 'edit');
  });

  composer.callbackQuery('invite:show_link', async (ctx) => {
    await ctx.answerCallbackQuery();
    const surface = await buildInviteLinkSurface(ctx);
    await ctx.reply(surface.text, { reply_markup: surface.reply_markup, parse_mode: 'HTML', disable_web_page_preview: true });
  });

  composer.callbackQuery('invite:send_card', async (ctx) => {
    await ctx.answerCallbackQuery('Forwarding card sent below.');
    const card = await buildInviteCardMessage(ctx);
    const media = card.media || null;
    const photo = media?.photoFileId || media?.photoUrl || null;

    if (photo && typeof ctx.replyWithPhoto === 'function') {
      try {
        await ctx.replyWithPhoto(photo, {
          caption: media.caption,
          parse_mode: media.parseMode || 'HTML',
          reply_markup: media.replyMarkup
        });
        return;
      } catch (error) {
        console.warn('[invite] forwarding photo card failed; using text fallback', error?.message || error);
      }
    }

    await ctx.reply(card.text, {
      reply_markup: card.reply_markup,
      parse_mode: card.parse_mode || 'HTML',
      disable_web_page_preview: true
    });
  });

  composer.inlineQuery(/^invite(?:\s+.*)?$/i, async (ctx) => {
    const surface = await buildInviteCardMessage(ctx).catch(() => null);
    if (!surface?.snapshot?.inviteLink) {
      await ctx.answerInlineQuery([], { is_personal: true, cache_time: 0 });
      return;
    }

    await ctx.answerInlineQuery([
      buildInlineInviteResult({ inviteState: surface.snapshot })
    ], {
      is_personal: true,
      cache_time: 0
    });
  });

  return composer;
}
