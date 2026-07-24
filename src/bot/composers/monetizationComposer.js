import { Composer } from 'grammy';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import {
  authorizeProCheckoutForTelegramUser,
  confirmProSubscriptionPaymentForTelegramUser,
  getProSubscriptionInvoiceForTelegramUser,
  parseProInvoicePayload
} from '../../lib/storage/monetizationStore.js';
import { formatUserFacingError } from '../utils/notices.js';

async function sendSubscriptionInvoice(ctx, invoice) {
  return ctx.api.raw.sendInvoice({
    chat_id: ctx.from.id,
    title: invoice.title,
    description: invoice.description,
    payload: invoice.payload,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: 'Intro Deck Pro', amount: invoice.amountStars }]
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
      await ctx.answerCallbackQuery({ text: 'This feature is temporarily unavailable. Try again later.' });
      return;
    }

    if (result.blocked || !result.invoice) {
      const text = result.reason === 'pro_subscription_already_active'
        ? 'Pro is already active on this account.'
        : formatUserFacingError(result.reason, 'Could not open the Pro payment sheet right now.');
      await ctx.answerCallbackQuery({ text });
      return;
    }

    try {
      await sendSubscriptionInvoice(ctx, result.invoice);
      await ctx.answerCallbackQuery({ text: `Payment sheet opened · ${result.invoice.amountStars}⭐` });
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatUserFacingError(error?.message || error, 'Could not open the Pro payment sheet right now.') });
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
      ...(ok ? {} : { error_message: formatUserFacingError(authorization.reason, 'This Pro payment request expired or changed. Reopen Pro and start a new payment.') })
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

    if (result.changed) {
      await ctx.reply('✅ Payment confirmed. Intro Deck Pro is active. Pro covers a bounded fair-use allowance for delivering contact permission requests; each recipient still decides whether to accept.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⭐ View Pro status', callback_data: 'plans:root' }],
            [{ text: '🏠 Home', callback_data: 'home:root' }]
          ]
        }
      });
      return;
    }

    if (result.duplicate) {
      await ctx.reply('ℹ️ This Pro purchase was already confirmed. No second subscription was created.');
      return;
    }

    if (result.reason === 'payment_charge_replay_detected') {
      await ctx.reply('⚠️ This payment is already linked to another purchase. Do not pay again. Contact support.');
      return;
    }

    await ctx.reply(`⚠️ ${formatUserFacingError(result.reason, 'The Pro payment was received, but activation could not be finalized. Do not pay again. Contact support.')}`);
  });

  return composer;
}
