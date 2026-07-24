import { Composer } from 'grammy';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import { decideIntroRequestForTelegramUser } from '../../lib/storage/introRequestStore.js';
import { deliverIntroNotificationReceipt } from '../../lib/storage/notificationStore.js';
import { renderIntroInboxKeyboard, renderIntroInboxText } from '../../lib/telegram/render.js';
import { formatUserFacingError } from '../utils/notices.js';

function fitTelegramText(text, limit = 3900) {
  const value = String(text || '').trim();
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 2).trimEnd()}…`;
}

export function createIntroComposer({
  clearAllPendingInputs,
  buildIntroInboxSurface,
  buildIntroDetailSurface,
  buildDirectoryCardSurface,
  formatIntroDecisionReason
}) {
  const composer = new Composer();

  const renderIntroInbox = async (ctx, method = 'edit', notice = null) => {
    try {
      await clearAllPendingInputs(ctx.from.id);
      const surface = await buildIntroInboxSurface(ctx, notice);
      const options = { reply_markup: surface.reply_markup };
      const text = fitTelegramText(surface.text);
      if (method === 'reply') {
        await ctx.reply(text, options);
        return;
      }
      await safeEditOrReply(ctx, text, options);
      return;
    } catch (error) {
      const fallbackNotice = `⚠️ ${formatUserFacingError(String(error?.message || error), 'Could not open intro inbox right now.')}`;
      const fallbackText = renderIntroInboxText({
        persistenceEnabled: false,
        inboxState: null,
        contactUnlockInbox: null,
        notice: fallbackNotice
      });
      const fallbackKeyboard = renderIntroInboxKeyboard({ inboxState: null, contactUnlockInbox: null });
      if (method === 'reply') {
        await ctx.reply(fitTelegramText(fallbackText), { reply_markup: fallbackKeyboard });
        return;
      }
      await safeEditOrReply(ctx, fitTelegramText(fallbackText), { reply_markup: fallbackKeyboard });
    }
  };

  composer.command('inbox', async (ctx) => {
    await renderIntroInbox(ctx, 'reply');
  });

  composer.callbackQuery('intro:inbox', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderIntroInbox(ctx, 'edit');
  });

  composer.callbackQuery('intro:noop', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'No linked public profile card is available for this row yet.' });
  });

  composer.callbackQuery(/^intro:view:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const introRequestId = Number.parseInt(ctx.match?.[1] || '0', 10);
    const surface = await buildIntroDetailSurface(ctx, introRequestId);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^intro:open:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const profileId = Number.parseInt(ctx.match?.[1] || '0', 10);
    const surface = await buildDirectoryCardSurface(ctx, profileId, 0, 'Opened from intro inbox.');

    if (!surface.reply_markup?.inline_keyboard?.length || surface.text.includes('Listed profile not found.')) {
      await renderIntroInbox(ctx, 'edit', '⚠️ Linked profile card is not available right now.');
      return;
    }

    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^intro:(acc|dec):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const action = ctx.match?.[1];
    const introRequestId = Number.parseInt(ctx.match?.[2] || '0', 10);

    const result = await decideIntroRequestForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      introRequestId,
      decision: action
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      duplicate: false,
      blocked: false,
      reason: String(error?.message || error),
      inbox: null
    }));

    let notice = 'Intro inbox updated.';
    let receiptResult = null;
    if (!result.persistenceEnabled) {
      notice = '⚠️ This feature is temporarily unavailable. Try again later.';
    } else if (result.changed && result.reason === 'intro_request_accepted') {
      receiptResult = await deliverIntroNotificationReceipt({
        eventType: 'intro_request_accepted',
        introRequestId: result.introRequest?.intro_request_id
      }).catch((error) => ({
        sent: false,
        duplicate: false,
        skipped: false,
        failed: true,
        reason: String(error?.message || error)
      }));

      notice = `✅ Accepted intro request from ${result.introRequest?.display_name || 'this member'}. If you set a public LinkedIn URL, the requester can now open it from their accepted intro row.`;
      if (receiptResult?.sent) {
        notice += ' The requester received a Telegram notice.';
      } else if (receiptResult?.duplicate) {
        notice += ' The requester notice was already recorded.';
      } else if (receiptResult?.skipped) {
        notice += ' The requester notice was skipped.';
      } else if (receiptResult?.failed) {
        notice += ' Requester notice delivery failed, but the decision is saved.';
      }
    } else if (result.changed && result.reason === 'intro_request_declined') {
      receiptResult = await deliverIntroNotificationReceipt({
        eventType: 'intro_request_declined',
        introRequestId: result.introRequest?.intro_request_id
      }).catch((error) => ({
        sent: false,
        duplicate: false,
        skipped: false,
        failed: true,
        reason: String(error?.message || error)
      }));

      notice = `✅ Declined intro request from ${result.introRequest?.display_name || 'this member'}.`;
      if (receiptResult?.sent) {
        notice += ' The requester received a Telegram notice.';
      } else if (receiptResult?.duplicate) {
        notice += ' The requester notice was already recorded.';
      } else if (receiptResult?.skipped) {
        notice += ' The requester notice was skipped.';
      } else if (receiptResult?.failed) {
        notice += ' Requester notice delivery failed, but the decision is saved.';
      }
    } else if (result.duplicate) {
      notice = `ℹ️ ${formatIntroDecisionReason(result.reason)}`;
    } else if (result.throttled) {
      notice = `⏳ ${formatIntroDecisionReason(result.reason)}`;
    } else if (result.blocked) {
      notice = `⚠️ ${formatIntroDecisionReason(result.reason)}`;
    } else {
      notice = `⚠️ ${formatUserFacingError(result.reason, formatIntroDecisionReason(result.reason))}`;
    }

    const detailRequestId = result.introRequest?.intro_request_id || introRequestId;
    const surface = detailRequestId
      ? await buildIntroDetailSurface(ctx, detailRequestId, notice)
      : await buildIntroInboxSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  return composer;
}
