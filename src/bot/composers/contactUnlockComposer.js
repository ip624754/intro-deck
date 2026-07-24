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
import { getTransactionDisclosures, paymentSheetOpenedNotice } from '../../lib/telegram/transactionCopy.js';
import { localizeMemberText } from '../../lib/telegram/memberLocalization.js';
import {
  recordLinkedInShareAttributionApprovalByEntity,
  recordLinkedInShareAttributionEventForTelegramUser
} from '../../lib/storage/linkedinShareAttributionStore.js';

async function sendContactUnlockInvoice(ctx, invoice) {
  return ctx.api.raw.sendInvoice({
    chat_id: ctx.from.id,
    title: invoice.title,
    description: invoice.description,
    payload: invoice.payload,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: ctx.interfaceLanguage === 'ru' ? 'Доставка запроса' : 'Request delivery', amount: invoice.amountStars }]
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

    await recordLinkedInShareAttributionEventForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      targetProfileId: profileId,
      eventType: 'contact_request_started',
      telegramUpdateId: ctx.update?.update_id || null,
      detail: { contactKind: 'telegram_contact' }
    }).catch(() => null);

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
      await recordLinkedInShareAttributionEventForTelegramUser({
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username || null,
        targetProfileId: result.request.target_profile_id || profileId,
        eventType: 'request_submitted',
        telegramUpdateId: ctx.update?.update_id || null,
        entityType: 'contact_unlock_request',
        entityId: result.request.contact_unlock_request_id,
        detail: { contactKind: 'telegram_contact', paymentMode: 'pro_covered' }
      }).catch(() => null);
      await ctx.answerCallbackQuery({ text: formatContactUnlockRequestReason(result.reason, ctx.interfaceLanguage) });
      const surface = await buildContactUnlockDetailSurface(ctx, result.request.contact_unlock_request_id, ctx.interfaceLanguage === 'ru' ? '✅ Запрос отправлен за счёт Pro. Получатель теперь решает, открыть ли Telegram-контакт.' : '✅ Request sent with Pro. The recipient now decides whether to share their Telegram contact.');
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
      await ctx.answerCallbackQuery({ text: paymentSheetOpenedNotice(result.invoice.amountStars, ctx.interfaceLanguage) });
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

    const russian = ctx.interfaceLanguage === 'ru';
    let notice = russian ? 'Запрос Telegram-контакта обновлён.' : 'Telegram contact request updated.';
    if (!result.persistenceEnabled) {
      notice = russian ? '⚠️ Функция временно недоступна. Попробуйте позже.' : '⚠️ This feature is temporarily unavailable. Try again later.';
    } else if (result.changed && result.reason === 'contact_unlock_revealed') {
      await recordLinkedInShareAttributionApprovalByEntity({
        ownerTelegramUserId: ctx.from.id,
        entityType: 'contact_unlock_request',
        entityId: result.request?.contact_unlock_request_id || requestId,
        telegramUpdateId: ctx.update?.update_id || null,
        detail: { decision: 'approved' }
      }).catch(() => null);
      notice = russian
        ? `✅ Вы открыли Telegram-контакт пользователю ${result.request?.display_name || 'этот участник'}. Скрытый username теперь доступен только этому отправителю.`
        : `✅ Shared your Telegram contact with ${result.request?.display_name || 'this member'}. Your hidden username is now visible to this requester.`;
    } else if (result.changed && result.reason === 'contact_unlock_declined') {
      notice = russian
        ? `✅ Вы отклонили запрос Telegram-контакта от ${result.request?.display_name || 'этого участника'}. Username не был раскрыт.`
        : `✅ Declined the Telegram contact request from ${result.request?.display_name || 'this member'}. Your username was not shared.`;
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
      await recordLinkedInShareAttributionEventForTelegramUser({
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username || null,
        targetProfileId: result.request?.target_profile_id,
        eventType: 'request_submitted',
        telegramUpdateId: ctx.update?.update_id || null,
        entityType: 'contact_unlock_request',
        entityId: result.request?.contact_unlock_request_id || parsed.requestId,
        detail: { contactKind: 'telegram_contact', paymentMode: 'telegram_stars' }
      }).catch(() => null);
      const russian = ctx.interfaceLanguage === 'ru';
      const disclosure = getTransactionDisclosures(ctx.interfaceLanguage).requestDeliveryPayment;
      await ctx.reply(russian
        ? `✅ Оплата подтверждена. Запрос Telegram-контакта доставлен. ${disclosure}`
        : `✅ Payment confirmed. Your Telegram contact request was delivered. ${disclosure}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: russian ? '📥 Входящие' : '📥 Inbox', callback_data: 'intro:inbox' }],
            [{ text: russian ? '🧾 Открыть запрос' : '🧾 View request', callback_data: `cu:view:${parsed.requestId}` }]
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
