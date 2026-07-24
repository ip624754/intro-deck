import { Composer } from 'grammy';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import {
  authorizeProCheckoutForTelegramUser,
  confirmProSubscriptionPaymentForTelegramUser,
  getProSubscriptionInvoiceForTelegramUser,
  parseProInvoicePayload
} from '../../lib/storage/monetizationStore.js';
import { formatUserFacingError } from '../utils/notices.js';
import { paymentSheetOpenedNotice } from '../../lib/telegram/transactionCopy.js';

async function sendSubscriptionInvoice(ctx, invoice) {
  return ctx.api.raw.sendInvoice({
    chat_id: ctx.from.id,
    title: invoice.title,
    description: invoice.description,
    payload: invoice.payload,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: ctx.interfaceLanguage === 'ru' ? 'Intro Deck Pro' : 'Intro Deck Pro', amount: invoice.amountStars }]
  });
}

export function createMonetizationComposer({ clearAllPendingInputs, buildPricingSurface }) {
  const composer = new Composer();

  async function renderPricing(ctx, method = 'edit', notice = null) {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildPricingSurface(ctx, notice);
    if (method === 'reply') {
      await ctx.reply(surface.text, { reply_markup: surface.reply_markup });
      return;
    }
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  }

  composer.command('plans', async (ctx) => {
    await renderPricing(ctx, 'reply');
  });

  composer.callbackQuery('plans:root', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderPricing(ctx, 'edit');
  });

  composer.callbackQuery('plans:buy:pro', async (ctx) => {
    await clearAllPendingInputs(ctx.from.id);
    const result = await getProSubscriptionInvoiceForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => ({
      persistenceEnabled: true,
      blocked: false,
      invoice: null,
      subscription: null,
      reason: String(error?.message || error)
    }));

    if (!result.persistenceEnabled) {
      await ctx.answerCallbackQuery({ text: ctx.interfaceLanguage === 'ru' ? 'Функция временно недоступна. Попробуйте позже.' : 'This feature is temporarily unavailable. Try again later.' });
      return;
    }

    if (result.blocked || !result.invoice) {
      const text = result.reason === 'pro_subscription_already_active'
        ? (ctx.interfaceLanguage === 'ru' ? 'Pro уже активен для этого аккаунта.' : 'Pro is already active on this account.')
        : formatUserFacingError(result.reason, ctx.interfaceLanguage === 'ru' ? 'Не удалось открыть оплату Pro.' : 'Could not open the Pro payment sheet right now.', ctx.interfaceLanguage);
      await ctx.answerCallbackQuery({ text });
      return;
    }

    try {
      await sendSubscriptionInvoice(ctx, result.invoice);
      await ctx.answerCallbackQuery({ text: paymentSheetOpenedNotice(result.invoice.amountStars, ctx.interfaceLanguage) });
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatUserFacingError(error?.message || error, ctx.interfaceLanguage === 'ru' ? 'Не удалось открыть оплату Pro.' : 'Could not open the Pro payment sheet right now.', ctx.interfaceLanguage) });
    }
  });

  composer.on('pre_checkout_query', async (ctx, next) => {
    const parsed = parseProInvoicePayload(ctx.preCheckoutQuery?.invoice_payload);
    if (!parsed) {
      return next();
    }

    const authorization = await authorizeProCheckoutForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      planCode: parsed.planCode,
      currency: ctx.preCheckoutQuery.currency,
      totalAmount: ctx.preCheckoutQuery.total_amount
    }).catch(() => ({ authorized: false, reason: 'pro_checkout_unavailable' }));
    const ok = Boolean(authorization.authorized);
    await ctx.api.raw.answerPreCheckoutQuery({
      pre_checkout_query_id: ctx.preCheckoutQuery.id,
      ok,
      ...(ok ? {} : { error_message: formatUserFacingError(authorization.reason, ctx.interfaceLanguage === 'ru' ? 'Запрос оплаты Pro устарел или изменился. Откройте Pro и начните новую оплату.' : 'This Pro payment request expired or changed. Reopen Pro and start a new payment.', ctx.interfaceLanguage) })
    });
  });

  composer.on('message:successful_payment', async (ctx, next) => {
    const payment = ctx.message?.successful_payment;
    const parsed = parseProInvoicePayload(payment?.invoice_payload);
    if (!parsed) {
      return next();
    }

    const result = await confirmProSubscriptionPaymentForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      telegramPaymentChargeId: payment.telegram_payment_charge_id,
      providerPaymentChargeId: payment.provider_payment_charge_id || null,
      payload: payment.invoice_payload,
      currency: payment.currency,
      totalAmount: payment.total_amount
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      duplicate: false,
      blocked: false,
      subscription: null,
      reason: String(error?.message || error)
    }));

    const russian = ctx.interfaceLanguage === 'ru';
    if (result.changed) {
      await ctx.reply(russian
        ? '✅ Оплата подтверждена. Intro Deck Pro активирован. Pro покрывает ограниченный fair-use лимит доставки запросов на контакт; решение по каждому запросу всё равно принимает получатель.'
        : '✅ Payment confirmed. Intro Deck Pro is active. Pro covers a bounded fair-use allowance for delivering contact permission requests; each recipient still decides whether to accept.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: russian ? '⭐ Статус Pro' : '⭐ View Pro status', callback_data: 'plans:root' }],
            [{ text: russian ? '🏠 Главная' : '🏠 Home', callback_data: 'home:root' }]
          ]
        }
      });
      return;
    }

    if (result.duplicate) {
      await ctx.reply(russian
        ? 'ℹ️ Эта покупка Pro уже подтверждена. Вторая подписка не создавалась.'
        : 'ℹ️ This Pro purchase was already confirmed. No second subscription was created.');
      return;
    }

    if (result.reason === 'payment_charge_replay_detected') {
      await ctx.reply(russian
        ? '⚠️ Этот платёж уже связан с другой покупкой. Не платите повторно — обратитесь в поддержку.'
        : '⚠️ This payment is already linked to another purchase. Do not pay again. Contact support.');
      return;
    }

    await ctx.reply(`⚠️ ${formatUserFacingError(result.reason, russian ? 'Платёж Pro получен, но активацию не удалось завершить. Не платите повторно — обратитесь в поддержку.' : 'The Pro payment was received, but activation could not be finalized. Do not pay again. Contact support.', ctx.interfaceLanguage)}`);
  });

  return composer;
}
