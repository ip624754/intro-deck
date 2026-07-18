import { getContactPolicyConfig, getPricingConfig, getRuntimeGuardConfig, getTelegramConfig } from '../../config/env.js';
import { isDatabaseConfigured, withDbTransaction } from '../../db/pool.js';
import {
  authorizeContactUnlockCheckout,
  createOrGetContactUnlockRequest,
  decideContactUnlockRequest,
  getContactUnlockInboxStateByUserId,
  getContactUnlockRequestDetailByUserId,
  getContactUnlockRequestPaymentEnvelope,
  markContactUnlockRequestPaymentConfirmed
} from '../../db/contactUnlockRepo.js';
import { getProfileSnapshotByUserId } from '../../db/profileRepo.js';
import { tryAcquireUserActionGuard } from '../../db/runtimeGuardRepo.js';
import { upsertTelegramUser } from '../../db/usersRepo.js';
import { sendTelegramMessage } from '../telegram/botApi.js';
import { acquirePaymentChargeLock, createConfirmedPurchaseReceipt, findPurchaseReceiptByPaymentCharge, getProOutreachAllowance, getUserEntitlements } from '../../db/monetizationRepo.js';
import { buildRequestFeeDisclosure, REQUEST_DELIVERY_FEE_POLICY } from '../contact/contract.js';

export function buildContactUnlockInvoicePayload(requestId) {
  return `cu:${requestId}`;
}

export function parseContactUnlockInvoicePayload(payload) {
  const normalized = String(payload || '').trim();
  const match = normalized.match(/^cu:(\d+)$/);
  if (!match) {
    return null;
  }
  const requestId = Number.parseInt(match[1], 10);
  return Number.isFinite(requestId) && requestId > 0 ? { requestId } : null;
}

function buildOwnerNotification(request) {
  return {
    text: [
      '🔐 New Telegram contact request',
      '',
      request.pro_covered
        ? `${request.requester_display_name || 'A member'} used Pro to send a direct Telegram contact request.`
        : `${request.requester_display_name || 'A member'} paid to deliver a direct Telegram contact request.`,
      request.requester_headline_user ? `Headline: ${request.requester_headline_user}` : null,
      '',
      'Review the request and approve or decline it.'
    ].filter(Boolean).join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `cu:acc:${request.contact_unlock_request_id}` },
          { text: '❌ Decline', callback_data: `cu:dec:${request.contact_unlock_request_id}` }
        ],
        [{ text: '🧾 Open request', callback_data: `cu:view:${request.contact_unlock_request_id}` }]
      ]
    }
  };
}

function buildRequesterPaidNotification(request) {
  return {
    text: [
      request.pro_covered ? '⭐ Telegram contact request sent via Pro' : '⭐ Telegram contact request delivered',
      '',
      `Your request for ${request.target_display_name || 'this member'} is now waiting for approval.`,
      request.pro_covered
        ? 'Your Pro allowance covers request delivery only. The recipient still decides whether to reveal contact. Approval is not guaranteed.'
        : 'The fee pays for request delivery only. The recipient still decides whether to reveal contact. Approval is not guaranteed, and decline alone does not trigger an automatic refund.'
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: '🧾 View request', callback_data: `cu:view:${request.contact_unlock_request_id}` }],
        [{ text: '📥 Inbox', callback_data: 'intro:inbox' }]
      ]
    }
  };
}

function buildRequesterRevealNotification(request) {
  const username = String(request.revealed_contact_value || '').trim();
  const clean = username.replace(/^@+/, '');
  return {
    text: [
      '✅ Telegram contact approved',
      '',
      `Telegram username: @${clean}`,
      'You can now open the direct contact in Telegram.'
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: '🔓 Open contact', url: `https://t.me/${clean}` }],
        [{ text: '🧾 View request', callback_data: `cu:view:${request.contact_unlock_request_id}` }]
      ]
    }
  };
}

function buildRequesterDeclineNotification(request) {
  return {
    text: [
      'ℹ️ Telegram contact request declined',
      '',
      `${request.display_name || 'This member'} declined your Telegram contact request.`,
      'No Telegram username was revealed. A decline does not trigger an automatic refund of the request-delivery fee.'
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: '🧾 View request', callback_data: `cu:view:${request.contact_unlock_request_id}` }],
        [{ text: '📥 Inbox', callback_data: 'intro:inbox' }]
      ]
    }
  };
}

async function notifyOwnerOfPaidRequest(request) {
  const { botToken } = getTelegramConfig();
  if (!request?.target_telegram_user_id) {
    return { sent: false, skipped: true, reason: 'target_telegram_user_id_missing' };
  }
  const message = buildOwnerNotification(request);
  await sendTelegramMessage({
    botToken,
    chatId: request.target_telegram_user_id,
    text: message.text,
    replyMarkup: message.replyMarkup,
    parseMode: null
  });
  return { sent: true, skipped: false, reason: 'owner_notified' };
}

async function notifyRequesterOfPaidRequest(request) {
  const { botToken } = getTelegramConfig();
  if (!request?.requester_telegram_user_id) {
    return { sent: false, skipped: true, reason: 'requester_telegram_user_id_missing' };
  }
  const message = buildRequesterPaidNotification(request);
  await sendTelegramMessage({
    botToken,
    chatId: request.requester_telegram_user_id,
    text: message.text,
    replyMarkup: message.replyMarkup,
    parseMode: null
  });
  return { sent: true, skipped: false, reason: 'requester_paid_notified' };
}

async function notifyRequesterOfDecision(decisionResult) {
  const request = decisionResult?.requesterRequest || decisionResult?.request;
  const requesterTelegramUserId = decisionResult?.requesterTelegramUserId;
  if (!requesterTelegramUserId) {
    return { sent: false, skipped: true, reason: 'requester_telegram_user_id_missing' };
  }
  const { botToken } = getTelegramConfig();
  const message = request?.status === 'revealed'
    ? buildRequesterRevealNotification(request)
    : buildRequesterDeclineNotification(request);
  await sendTelegramMessage({
    botToken,
    chatId: requesterTelegramUserId,
    text: message.text,
    replyMarkup: message.replyMarkup,
    parseMode: null
  });
  return { sent: true, skipped: false, reason: 'requester_decision_notified' };
}

export async function loadContactUnlockInboxState({ telegramUserId, telegramUsername = null }) {
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      inbox: null,
      profile: null,
      reason: 'DATABASE_URL is not configured'
    };
  }

  const result = await withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const profile = await getProfileSnapshotByUserId(client, user.id);
    const inbox = await getContactUnlockInboxStateByUserId(client, { userId: user.id });

    return {
      persistenceEnabled: true,
      inbox,
      profile,
      reason: 'contact_unlock_inbox_loaded'
    };
  });
}

export async function beginContactUnlockPaymentForTelegramUser({ telegramUserId, telegramUsername = null, targetProfileId }) {
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      changed: false,
      created: false,
      duplicate: false,
      blocked: false,
      throttled: false,
      reason: 'DATABASE_URL is not configured',
      request: null,
      target: null,
      invoice: null
    };
  }

  const result = await withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const profile = await getProfileSnapshotByUserId(client, user.id);
    const { actionThrottleSeconds } = getRuntimeGuardConfig();
    const guard = await tryAcquireUserActionGuard(client, {
      guardKey: `contact_unlock:${user.id}:${targetProfileId}`,
      ttlSeconds: actionThrottleSeconds
    });

    if (!guard.acquired) {
      return {
        persistenceEnabled: true,
        changed: false,
        created: false,
        duplicate: false,
        blocked: false,
        throttled: true,
        reason: 'contact_unlock_request_throttled',
        request: null,
        target: null,
        invoice: null
      };
    }

    if (!profile?.linkedin_sub) {
      return {
        persistenceEnabled: true,
        changed: false,
        created: false,
        duplicate: false,
        blocked: true,
        throttled: false,
        reason: 'connect_linkedin_before_contact_unlock',
        request: null,
        target: null,
        invoice: null
      };
    }

    const { contactUnlockPriceStars } = getPricingConfig();
    const policyConfig = getContactPolicyConfig();
    const entitlements = await getUserEntitlements(client, { userId: user.id });
    let allowance = null;
    if (entitlements.canUseDirectContactWithoutPayment) {
      // Lock order is always Pro allowance -> contact pair to avoid cross-flow deadlocks.
      allowance = await getProOutreachAllowance(client, {
        userId: user.id,
        dailyLimit: policyConfig.proOutreachDailyLimit,
        acquireLock: true
      });
    }

    const result = await createOrGetContactUnlockRequest(client, {
      requesterUserId: user.id,
      targetProfileId,
      priceStars: contactUnlockPriceStars,
      retryCooldownDays: policyConfig.retryCooldownDays
    });

    let request = result.request || null;
    const target = result.target || null;
    let autoCovered = false;
    let policyBlocked = Boolean(result.blocked);
    let reason = result.reason;

    if (request && request.status === 'payment_pending' && entitlements.canUseDirectContactWithoutPayment && !policyBlocked) {
      if (!allowance.supported) {
        policyBlocked = true;
        reason = allowance.reason;
      } else if (!allowance.allowed) {
        reason = allowance.reason;
      } else {
        const covered = await markContactUnlockRequestPaymentConfirmed(client, {
          requestId: request.contact_unlock_request_id,
          requesterUserId: user.id,
          telegramPaymentChargeId: null,
          providerPaymentChargeId: null,
          proCovered: true,
          checkoutAuthorizationTtlMinutes: policyConfig.checkoutAuthorizationTtlMinutes,
          retryCooldownDays: policyConfig.retryCooldownDays
        });
        if (covered.changed) {
          request = covered.request || request;
          autoCovered = true;
          reason = covered.reason;
        } else if (covered.blocked) {
          policyBlocked = true;
          reason = covered.reason;
        }
      }
    }

    const invoice = request && request.status === 'payment_pending' && !autoCovered && !policyBlocked
      ? {
        payload: buildContactUnlockInvoicePayload(request.contact_unlock_request_id),
        amountStars: request.price_stars_snapshot,
        title: 'Telegram contact request',
        description: buildRequestFeeDisclosure({
          amountStars: request.price_stars_snapshot,
          actionLabel: 'direct-contact permission request',
          recipientName: target?.display_name || 'this member'
        })
      }
      : null;

    return {
      persistenceEnabled: true,
      changed: Boolean(result.created) || autoCovered,
      created: Boolean(result.created),
      duplicate: Boolean(result.duplicate),
      blocked: policyBlocked,
      throttled: false,
      autoCovered,
      allowance,
      reason,
      request,
      target,
      invoice
    };
  });

  if (result.autoCovered && result.request) {
    await notifyOwnerOfPaidRequest(result.request).catch((error) => {
      console.warn('[contact unlock] owner notify failed', error?.message || error);
    });
    await notifyRequesterOfPaidRequest(result.request).catch((error) => {
      console.warn('[contact unlock] requester paid notify failed', error?.message || error);
    });
  }

  return result;
}

export async function authorizeContactUnlockCheckoutForTelegramUser({
  telegramUserId,
  telegramUsername = null,
  requestId,
  currency,
  totalAmount
}) {
  if (!isDatabaseConfigured()) {
    return { persistenceEnabled: false, authorized: false, blocked: true, reason: 'DATABASE_URL is not configured', request: null };
  }
  return withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const policyConfig = getContactPolicyConfig();
    const result = await authorizeContactUnlockCheckout(client, {
      requestId,
      requesterUserId: user.id,
      retryCooldownDays: policyConfig.retryCooldownDays,
      checkoutRetryLockSeconds: policyConfig.checkoutRetryLockSeconds,
      currency,
      totalAmount
    });
    return { persistenceEnabled: true, ...result };
  });
}

export async function confirmContactUnlockPaymentForTelegramUser({
  telegramUserId,
  telegramUsername = null,
  requestId,
  telegramPaymentChargeId,
  providerPaymentChargeId = null,
  currency,
  totalAmount
}) {
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      changed: false,
      blocked: false,
      duplicate: false,
      reason: 'DATABASE_URL is not configured',
      request: null
    };
  }

  const paymentResult = await withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const policyConfig = getContactPolicyConfig();
    await acquirePaymentChargeLock(client, telegramPaymentChargeId);
    const existingReceipt = await findPurchaseReceiptByPaymentCharge(client, {
      telegramPaymentChargeId,
      providerPaymentChargeId
    });
    if (existingReceipt) {
      const sameRequest = existingReceipt.relatedEntityType === 'contact_unlock_request' && String(existingReceipt.relatedEntityId) === String(requestId);
      return {
        changed: false,
        duplicate: sameRequest,
        blocked: !sameRequest,
        reason: sameRequest ? 'contact_unlock_payment_already_confirmed' : 'payment_charge_replay_detected',
        request: null
      };
    }

    const result = await markContactUnlockRequestPaymentConfirmed(client, {
      requestId,
      requesterUserId: user.id,
      telegramPaymentChargeId,
      providerPaymentChargeId,
      proCovered: false,
      checkoutAuthorizationTtlMinutes: policyConfig.checkoutAuthorizationTtlMinutes,
      currency,
      totalAmount
    });
    if (result.changed && result.request) {
      await createConfirmedPurchaseReceipt(client, {
        userId: user.id,
        receiptType: 'contact_unlock',
        productCode: 'contact_unlock_request_delivery',
        amountStars: result.request.price_stars_snapshot || getPricingConfig().contactUnlockPriceStars,
        relatedEntityType: 'contact_unlock_request',
        relatedEntityId: result.request.contact_unlock_request_id,
        telegramPaymentChargeId,
        providerPaymentChargeId,
        rawPayloadSnapshot: {
          requestId,
          feePolicy: REQUEST_DELIVERY_FEE_POLICY,
          recipientApprovalRequired: true,
          automaticRefundOnDecline: false
        }
      });
    }
    return result;
  });

  if (paymentResult.changed && paymentResult.request) {
    await notifyOwnerOfPaidRequest(paymentResult.request).catch((error) => {
      console.warn('[contact unlock] owner notify failed', error?.message || error);
    });
    await notifyRequesterOfPaidRequest(paymentResult.request).catch((error) => {
      console.warn('[contact unlock] requester paid notify failed', error?.message || error);
    });
  }

  return {
    persistenceEnabled: true,
    ...paymentResult
  };
}

export async function decideContactUnlockRequestForTelegramUser({ telegramUserId, telegramUsername = null, requestId, decision }) {
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      changed: false,
      blocked: false,
      duplicate: false,
      reason: 'DATABASE_URL is not configured',
      request: null
    };
  }

  const result = await withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const decisionResult = await decideContactUnlockRequest(client, { userId: user.id, requestId, decision });
    if (!decisionResult.request) {
      return decisionResult;
    }
    const envelope = await getContactUnlockRequestPaymentEnvelope(client, { requestId });
    const requesterView = envelope?.requester_user_id
      ? await getContactUnlockRequestDetailByUserId(client, { userId: envelope.requester_user_id, requestId })
      : { request: null };
    return {
      ...decisionResult,
      requesterTelegramUserId: envelope?.requester_telegram_user_id || null,
      requesterRequest: requesterView?.request || null
    };
  });

  if (result.changed && result.request) {
    await notifyRequesterOfDecision(result).catch((error) => {
      console.warn('[contact unlock] requester decision notify failed', error?.message || error);
    });
  }

  return {
    persistenceEnabled: true,
    ...result
  };
}

export async function loadContactUnlockRequestDetailForTelegramUser({ telegramUserId, telegramUsername = null, requestId }) {
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      request: null,
      profile: null,
      reason: 'DATABASE_URL is not configured'
    };
  }

  return withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const profile = await getProfileSnapshotByUserId(client, user.id);
    const result = await getContactUnlockRequestDetailByUserId(client, { userId: user.id, requestId });
    return {
      persistenceEnabled: true,
      request: result.request || null,
      profile,
      blocked: Boolean(result.blocked),
      reason: result.reason
    };
  });
}
