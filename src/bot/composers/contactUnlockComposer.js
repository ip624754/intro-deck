import { Composer } from 'grammy';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import {
  authorizeContactUnlockCheckoutForTelegramUser,
  beginContactUnlockPaymentForTelegramUser,
  confirmContactUnlockPaymentForTelegramUser,
  loadContactUnlockRequestDetailForTelegramUser,
  parseContactUnlockInvoicePayload,
  decideContactUnlockRequestForTelegramUser
} from '../../lib/storage/contactUnlockStore.js';
import { formatContactUnlockDecisionReason, formatContactUnlockRequestReason, formatUserFacingError } from '../utils/notices.js';
import { TRANSACTION_DISCLOSURES, paymentSheetOpenedNotice } from '../../lib/telegram/transactionCopy.js';
import { localizeMemberText } from '../../lib/telegram/memberLocalization.js';

async function sendContactUnlockInvoice(ctx, invoice) {
  return ctx.api.raw.sendInvoice({
    chat_id: ctx.from.id,
    title: invoice.title,
    description: invoice.description,
    payload: invoice.payload,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: 'Request delivery', amount: invoice.amountStars }]
  });
}

export function createContactUnlockComposer({
  clearAllPendingInputs,
  buildContactUnlockDetailSurface,
  buildIntroInboxSurface
}) {
  const composer = new Composer();

  composer.callbackQuery(/^dir:unlock:(\d+):(\d+)$/, async (ctx) => {
    const profileId = Number.parseInt(ctx.match?.[1] || '0', 10);
    await clearAllPendingInputs(ctx.from.id);

    const result = await beginContactUnlockPaymentForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      targetProfileId: profileId
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      created: false,
      duplicate: false,
      blocked: false,
      throttled: false,
      reason: String(error?.message || error),
      request: null,
      invoice: null
    }));

    if (!result.persistenceEnabled) {
      await ctx.answerCallbackQuery({ text: localizeMemberText('This feature is temporarily unavailable. Try again later.', ctx.interfaceLanguage) });
      return;
    }

    if (result.autoCovered && result.request?.contact_unlock_request_id) {
      await ctx.answerCallbackQuery({ text: formatContactUnlockRequestReason(result.reason, ctx.interfaceLanguage) });
      const surface = await buildContactUnlockDetailSurface(ctx, result.request.contact_unlock_request_id, '✅ Request sent with Pro. The recipient now decides whether to share their Telegram contact.');
      await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
      return;
    }

    if (result.blocked || result.throttled) {
      await ctx.answerCallbackQuery({ text: formatContactUnlockRequestReason(result.reason, ctx.interfaceLanguage) });
      return;
    }

    if (!result.invoice) {
      if (result.request?.contact_unlock_request_id) {
        await ctx.answerCallbackQuery({ text: formatContactUnlockRequestReason(result.reason, ctx.interfaceLanguage) });
        const surface = await buildContactUnlockDetailSurface(ctx, result.request.contact_unlock_request_id, `ℹ️ ${formatContactUnlockRequestReason(result.reason, ctx.interfaceLanguage)}`);
        await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
        return;
      }
      await ctx.answerCallbackQuery({ text: formatContactUnlockRequestReason(result.reason, ctx.interfaceLanguage) });
      return;
    }

    try {
      await sendContactUnlockInvoice(ctx, result.invoice);
      await ctx.answerCallbackQuery({ text: paymentSheetOpenedNotice(result.invoice.amountStars) });
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatUserFacingError(error?.message || error, 'Could not open the payment sheet right now.', ctx.interfaceLanguage) });
    }
  });

  composer.callbackQuery(/^cu:view:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const requestId = Number.parseInt(ctx.match?.[1] || '0', 10);
    const surface = await buildContactUnlockDetailSurface(ctx, requestId);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^cu:(acc|dec):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const action = ctx.match?.[1];
    const requestId = Number.parseInt(ctx.match?.[2] || '0', 10);

    const result = await decideContactUnlockRequestForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      requestId,
      decision: action
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      duplicate: false,
      blocked: false,
      reason: String(error?.message || error),
      request: null
    }));

    let notice = 'Telegram contact request updated.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ This feature is temporarily unavailable. Try again later.';
    } else if (result.changed && result.reason === 'contact_unlock_revealed') {
      notice = `✅ Shared your Telegram contact with ${result.request?.display_name || 'this member'}. Your hidden username is now visible to this requester.`;
    } else if (result.changed && result.reason === 'contact_unlock_declined') {
      notice = `✅ Declined the Telegram contact request from ${result.request?.display_name || 'this member'}. Your username was not shared.`;
    } else if (result.duplicate) {
      notice = `ℹ️ ${formatContactUnlockDecisionReason(result.reason, ctx.interfaceLanguage)}`;
    } else if (result.blocked) {
      notice = `⚠️ ${formatContactUnlockDecisionReason(result.reason, ctx.interfaceLanguage)}`;
    } else {
      notice = `⚠️ ${formatUserFacingError(result.reason, formatContactUnlockDecisionReason(result.reason, ctx.interfaceLanguage), ctx.interfaceLanguage)}`;
    }

    const surface = result.request?.contact_unlock_request_id
      ? await buildContactUnlockDetailSurface(ctx, result.request.contact_unlock_request_id, notice)
      : await buildIntroInboxSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.on('pre_checkout_query', async (ctx, next) => {
    const parsed = parseContactUnlockInvoicePayload(ctx.preCheckoutQuery?.invoice_payload);
    if (!parsed) {
      return next();
    }

    const authorization = await authorizeContactUnlockCheckoutForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      requestId: parsed.requestId,
      currency: ctx.preCheckoutQuery.currency,
      totalAmount: ctx.preCheckoutQuery.total_amount
    }).catch(() => ({ persistenceEnabled: true, authorized: false, blocked: true, reason: 'contact_unlock_checkout_authorization_failed' }));

    const ok = Boolean(authorization.authorized);
    await ctx.api.raw.answerPreCheckoutQuery({
      pre_checkout_query_id: ctx.preCheckoutQuery.id,
      ok,
      ...(ok ? {} : { error_message: formatContactUnlockRequestReason(authorization.reason, ctx.interfaceLanguage) })
    });
  });

  composer.on('message:successful_payment', async (ctx, next) => {
    const payment = ctx.message?.successful_payment;
    const parsed = parseContactUnlockInvoicePayload(payment?.invoice_payload);
    if (!parsed) {
      return next();
    }

    const result = await confirmContactUnlockPaymentForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      requestId: parsed.requestId,
      telegramPaymentChargeId: payment.telegram_payment_charge_id,
      providerPaymentChargeId: payment.provider_payment_charge_id || null,
      currency: payment.currency,
      totalAmount: payment.total_amount
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      duplicate: false,
      blocked: false,
      reason: String(error?.message || error),
      request: null
    }));

    if (result.changed) {
      await ctx.reply(`✅ Payment confirmed. Your Telegram contact request was delivered. ${TRANSACTION_DISCLOSURES.requestDeliveryPayment}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📥 Inbox', callback_data: 'intro:inbox' }],
            [{ text: '🧾 View request', callback_data: `cu:view:${parsed.requestId}` }]
          ]
        }
      });
      return;
    }

    if (result.duplicate) {
      await ctx.reply(`ℹ️ ${formatContactUnlockRequestReason(result.reason, ctx.interfaceLanguage)}`);
      return;
    }

    await ctx.reply(`⚠️ ${formatUserFacingError(result.reason, 'The Telegram contact payment was received, but the request could not be finalized. Do not pay again. Contact support.', ctx.interfaceLanguage)}`);
  });

  return composer;
}
