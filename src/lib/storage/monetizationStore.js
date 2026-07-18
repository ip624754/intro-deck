import { getContactPolicyConfig, getPricingConfig, getSubscriptionConfig, getTelegramConfig } from '../../config/env.js';
import { isDatabaseConfigured, withDbTransaction } from '../../db/pool.js';
import { acquirePaymentChargeLock, createConfirmedPurchaseReceipt, activateOrExtendProSubscription, findPurchaseReceiptByPaymentCharge, getMemberPricingStateByUserId, getProOutreachAllowance, listRecentPurchaseReceipts } from '../../db/monetizationRepo.js';
import { getProfileSnapshotByUserId } from '../../db/profileRepo.js';
import { upsertTelegramUser } from '../../db/usersRepo.js';
import { getTelegramStarsPaymentMismatchReason, TELEGRAM_STARS_CURRENCY } from '../contact/contract.js';

export function buildProInvoicePayload(planCode = 'pro_monthly') {
  return `sub:${planCode}`;
}

export function parseProInvoicePayload(payload) {
  const normalized = String(payload || '').trim();
  const match = normalized.match(/^sub:([a-z0-9_:-]+)$/i);
  if (!match) {
    return null;
  }
  return { planCode: match[1].toLowerCase() };
}

export async function loadPricingSurfaceState({ telegramUserId, telegramUsername = null }) {
  const pricing = getPricingConfig();
  const subscriptionConfig = getSubscriptionConfig();
  const contactPolicy = getContactPolicyConfig();
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      profile: null,
      subscription: null,
      recentReceipts: [],
      pricing,
      subscriptionConfig,
      contactPolicy,
      proOutreachAllowance: { supported: false, allowed: false, used: 0, remaining: 0, limit: contactPolicy.proOutreachDailyLimit, reason: 'DATABASE_URL is not configured' },
      reason: 'DATABASE_URL is not configured'
    };
  }

  return withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const [profile, pricingState, proOutreachAllowance] = await Promise.all([
      getProfileSnapshotByUserId(client, user.id),
      getMemberPricingStateByUserId(client, { userId: user.id }),
      getProOutreachAllowance(client, { userId: user.id, dailyLimit: contactPolicy.proOutreachDailyLimit })
    ]);
    return {
      persistenceEnabled: true,
      profile,
      subscription: pricingState.subscription,
      recentReceipts: pricingState.recentReceipts,
      pricing,
      subscriptionConfig,
      contactPolicy,
      proOutreachAllowance,
      reason: 'pricing_state_loaded'
    };
  });
}

export async function getProSubscriptionInvoiceForTelegramUser({ telegramUserId, telegramUsername = null }) {
  const pricing = getPricingConfig();
  const subscriptionConfig = getSubscriptionConfig();
  const contactPolicy = getContactPolicyConfig();
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      blocked: false,
      invoice: null,
      subscription: null,
      pricing,
      reason: 'DATABASE_URL is not configured'
    };
  }

  return withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const pricingState = await getMemberPricingStateByUserId(client, { userId: user.id });
    if (pricingState.subscription?.isActive) {
      return {
        persistenceEnabled: true,
        blocked: true,
        invoice: null,
        subscription: pricingState.subscription,
        pricing,
        reason: 'pro_subscription_already_active'
      };
    }

    return {
      persistenceEnabled: true,
      blocked: false,
      subscription: pricingState.subscription,
      pricing,
      reason: 'pro_invoice_ready',
      invoice: {
        payload: buildProInvoicePayload('pro_monthly'),
        amountStars: pricing.proMonthlyPriceStars,
        title: 'Intro Deck Pro',
        description: `Unlock Pro for ${subscriptionConfig.proMonthlyDurationDays} days. Includes up to ${contactPolicy.proOutreachDailyLimit} contact-request deliveries across private-chat and Telegram-contact options per rolling 24 hours. Recipient approval is still required.`
      }
    };
  });
}

export async function authorizeProCheckoutForTelegramUser({
  telegramUserId,
  telegramUsername = null,
  planCode,
  currency,
  totalAmount
}) {
  if (planCode !== 'pro_monthly') {
    return { persistenceEnabled: true, authorized: false, blocked: true, reason: 'unsupported_subscription_plan' };
  }
  const invoiceState = await getProSubscriptionInvoiceForTelegramUser({ telegramUserId, telegramUsername });
  if (!invoiceState.persistenceEnabled || invoiceState.blocked || !invoiceState.invoice) {
    return {
      persistenceEnabled: invoiceState.persistenceEnabled,
      authorized: false,
      blocked: true,
      reason: invoiceState.reason || 'pro_checkout_unavailable'
    };
  }
  const paymentMismatch = getTelegramStarsPaymentMismatchReason({
    currency,
    totalAmount,
    expectedAmount: invoiceState.invoice.amountStars
  });
  if (paymentMismatch) {
    return { persistenceEnabled: true, authorized: false, blocked: true, reason: paymentMismatch };
  }
  return { persistenceEnabled: true, authorized: true, blocked: false, reason: 'pro_checkout_authorized' };
}

export async function confirmProSubscriptionPaymentForTelegramUser({
  telegramUserId,
  telegramUsername = null,
  telegramPaymentChargeId,
  providerPaymentChargeId = null,
  payload = null,
  currency,
  totalAmount
}) {
  const pricing = getPricingConfig();
  const subscriptionConfig = getSubscriptionConfig();
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      changed: false,
      duplicate: false,
      blocked: false,
      subscription: null,
      receipt: null,
      reason: 'DATABASE_URL is not configured'
    };
  }
  if (String(currency || '').trim().toUpperCase() !== TELEGRAM_STARS_CURRENCY) {
    return { persistenceEnabled: true, changed: false, duplicate: false, blocked: true, subscription: null, receipt: null, reason: 'payment_currency_mismatch' };
  }
  const actualAmountStars = Number.parseInt(String(totalAmount), 10);
  if (!Number.isFinite(actualAmountStars) || actualAmountStars <= 0) {
    return { persistenceEnabled: true, changed: false, duplicate: false, blocked: true, subscription: null, receipt: null, reason: 'payment_amount_mismatch' };
  }

  return withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    await acquirePaymentChargeLock(client, telegramPaymentChargeId);
    const existingReceipt = await findPurchaseReceiptByPaymentCharge(client, {
      telegramPaymentChargeId,
      providerPaymentChargeId
    });
    if (existingReceipt) {
      const sameSubscription = existingReceipt.receiptType === 'subscription' && existingReceipt.productCode === 'pro_monthly' && String(existingReceipt.userId) === String(user.id);
      const pricingState = await getMemberPricingStateByUserId(client, { userId: user.id });
      return {
        persistenceEnabled: true,
        changed: false,
        duplicate: sameSubscription,
        blocked: !sameSubscription,
        subscription: pricingState.subscription,
        receipt: existingReceipt,
        reason: sameSubscription ? 'pro_subscription_payment_already_confirmed' : 'payment_charge_replay_detected'
      };
    }

    const receiptResult = await createConfirmedPurchaseReceipt(client, {
      userId: user.id,
      receiptType: 'subscription',
      productCode: 'pro_monthly',
      amountStars: actualAmountStars,
      relatedEntityType: 'subscription',
      relatedEntityId: user.id,
      telegramPaymentChargeId,
      providerPaymentChargeId,
      rawPayloadSnapshot: {
        payload,
        paidAmountStars: actualAmountStars,
        configuredAmountStarsAtConfirmation: pricing.proMonthlyPriceStars,
        amountMatchesCurrentConfig: actualAmountStars === pricing.proMonthlyPriceStars,
        currency: TELEGRAM_STARS_CURRENCY,
        proOutreachDailyLimit: getContactPolicyConfig().proOutreachDailyLimit,
        recipientApprovalRequired: true,
        unlimitedOutreach: false
      }
    });

    const subscription = await activateOrExtendProSubscription(client, {
      userId: user.id,
      durationDays: subscriptionConfig.proMonthlyDurationDays,
      telegramPaymentChargeId,
      providerPaymentChargeId,
      lastReceiptId: receiptResult.receipt?.receiptId || null,
      planCode: 'pro_monthly'
    });

    return {
      persistenceEnabled: true,
      changed: true,
      duplicate: false,
      blocked: false,
      subscription,
      receipt: receiptResult.receipt,
      reason: 'pro_subscription_activated'
    };
  });
}

export async function loadAdminMonetizationState() {
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      recentReceipts: [],
      pricing: getPricingConfig(),
      reason: 'DATABASE_URL is not configured'
    };
  }

  return withDbTransaction(async (client) => ({
    persistenceEnabled: true,
    recentReceipts: await listRecentPurchaseReceipts(client, { limit: 8 }),
    pricing: getPricingConfig(),
    reason: 'admin_monetization_state_loaded'
  }));
}
