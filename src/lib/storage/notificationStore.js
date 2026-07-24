import { getNotificationOpsConfig, getNotificationRetryConfig, getTelegramConfig } from '../../config/env.js';
import {
  claimNotificationReceipt,
  claimNotificationReceiptAttempt,
  claimRetryableNotificationReceipts,
  getIntroNotificationReceiptSummary,
  getNotificationReceiptBucketCounts,
  listRecentNotificationReceipts,
  loadIntroNotificationEnvelope,
  markNotificationReceiptStatus,
  NOTIFICATION_RECEIPT_OPERATOR_BUCKETS
} from '../../db/notificationRepo.js';
import { isDatabaseConfigured, withDbClient, withDbTransaction } from '../../db/pool.js';
import { renderIntroNotificationKeyboard, renderIntroNotificationText } from '../telegram/render.js';
import { sendTelegramMessage } from '../telegram/botApi.js';
import { cleanupExpiredRuntimeGuards } from './runtimeGuardStore.js';

function normalizeNotificationErrorCode(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (!message) {
    return 'unknown_error';
  }

  if (message.includes('429')) {
    return 'telegram_rate_limited';
  }

  if (message.includes('chat not found')) {
    return 'telegram_chat_not_found';
  }

  if (message.includes('forbidden')) {
    return 'telegram_forbidden';
  }

  if (message.includes('unauthorized')) {
    return 'telegram_unauthorized';
  }

  return 'telegram_send_failed';
}

function computeNextAttemptAt({ attemptCount, maxAttempts, retryDelaySeconds }) {
  if (!Number.isFinite(attemptCount) || !Number.isFinite(maxAttempts) || attemptCount >= maxAttempts) {
    return null;
  }

  return new Date(Date.now() + retryDelaySeconds * 1000);
}

async function loadEnvelopeOrSkip({ notificationReceiptId, eventType, introRequestId }) {
  const envelope = await withDbTransaction(async (client) => {
    return loadIntroNotificationEnvelope(client, { eventType, introRequestId });
  });

  if (envelope) {
    return { envelope, skipped: false };
  }

  await withDbTransaction(async (client) => {
    await markNotificationReceiptStatus(client, {
      notificationReceiptId,
      deliveryStatus: 'skipped',
      errorMessage: 'notification_envelope_missing',
      errorCode: 'notification_envelope_missing',
      clearNextAttempt: true
    });
  });

  return {
    envelope: null,
    skipped: true,
    reason: 'notification_envelope_missing'
  };
}

async function markRecipientMissing({ notificationReceiptId }) {
  await withDbTransaction(async (client) => {
    await markNotificationReceiptStatus(client, {
      notificationReceiptId,
      deliveryStatus: 'skipped',
      errorMessage: 'recipient_telegram_user_id_missing',
      errorCode: 'recipient_telegram_user_id_missing',
      clearNextAttempt: true
    });
  });

  return {
    sent: false,
    skipped: true,
    reason: 'recipient_telegram_user_id_missing'
  };
}

async function deliverClaimedNotificationReceipt({ receiptAttempt, retryDelaySeconds }) {
  const envelopeResult = await loadEnvelopeOrSkip({
    notificationReceiptId: receiptAttempt.notificationReceiptId,
    eventType: receiptAttempt.eventType,
    introRequestId: receiptAttempt.introRequestId
  });

  if (envelopeResult.skipped) {
    return {
      sent: false,
      skipped: true,
      failed: false,
      reason: envelopeResult.reason,
      notificationReceiptId: receiptAttempt.notificationReceiptId
    };
  }

  const envelope = envelopeResult.envelope;
  if (!envelope?.recipientTelegramUserId) {
    const result = await markRecipientMissing({ notificationReceiptId: receiptAttempt.notificationReceiptId });
    return {
      ...result,
      notificationReceiptId: receiptAttempt.notificationReceiptId
    };
  }

  const { botToken } = getTelegramConfig();
  const interfaceLanguage = receiptAttempt.payloadJson?.interfaceLanguage || envelope.interfaceLanguage || 'en';
  const text = renderIntroNotificationText({
    eventType: receiptAttempt.eventType,
    introRequest: {
      intro_request_id: envelope.introRequestId,
      display_name: envelope.counterpartDisplayName,
      headline_user: envelope.counterpartHeadline,
      status: envelope.status,
      role: envelope.role
    },
    interfaceLanguage
  });
  const replyMarkup = renderIntroNotificationKeyboard({
    eventType: receiptAttempt.eventType,
    introRequestId: envelope.introRequestId,
    interfaceLanguage
  });

  try {
    const response = await sendTelegramMessage({
      botToken,
      chatId: envelope.recipientTelegramUserId,
      text,
      replyMarkup
    });

    await withDbTransaction(async (client) => {
      await markNotificationReceiptStatus(client, {
        notificationReceiptId: receiptAttempt.notificationReceiptId,
        deliveryStatus: 'sent',
        sentMessageId: response?.result?.message_id || null,
        clearNextAttempt: true,
        errorMessage: null,
        errorCode: null
      });
    });

    return {
      sent: true,
      skipped: false,
      failed: false,
      exhausted: false,
      duplicate: false,
      reason: 'notification_sent',
      notificationReceiptId: receiptAttempt.notificationReceiptId,
      attemptCount: receiptAttempt.attemptCount,
      maxAttempts: receiptAttempt.maxAttempts
    };
  } catch (error) {
    const errorCode = normalizeNotificationErrorCode(error);
    const nextAttemptAt = computeNextAttemptAt({
      attemptCount: receiptAttempt.attemptCount,
      maxAttempts: receiptAttempt.maxAttempts,
      retryDelaySeconds
    });
    const exhausted = !nextAttemptAt;

    await withDbTransaction(async (client) => {
      await markNotificationReceiptStatus(client, {
        notificationReceiptId: receiptAttempt.notificationReceiptId,
        deliveryStatus: 'failed',
        errorMessage: String(error?.message || error).slice(0, 500),
        errorCode,
        nextAttemptAt,
        clearNextAttempt: exhausted,
        sentMessageId: null
      });
    });

    return {
      sent: false,
      skipped: false,
      failed: true,
      exhausted,
      willRetry: !exhausted,
      duplicate: false,
      reason: exhausted ? 'notification_retry_exhausted' : 'notification_send_failed_retry_scheduled',
      notificationReceiptId: receiptAttempt.notificationReceiptId,
      attemptCount: receiptAttempt.attemptCount,
      maxAttempts: receiptAttempt.maxAttempts,
      errorCode,
      error: String(error?.message || error)
    };
  }
}

export async function deliverIntroNotificationReceipt({ eventType, introRequestId }) {
  const retryConfig = getNotificationRetryConfig();

  const envelopeResult = await withDbTransaction(async (client) => {
    const envelope = await loadIntroNotificationEnvelope(client, { eventType, introRequestId });
    if (!envelope) {
      return {
        found: false,
        claimed: false,
        duplicate: false,
        notificationReceiptId: null,
        envelope: null,
        reason: 'notification_envelope_missing'
      };
    }

    const claim = await claimNotificationReceipt(client, {
      eventType,
      introRequestId,
      recipientUserId: envelope.recipientUserId,
      recipientTelegramUserId: envelope.recipientTelegramUserId,
      maxAttempts: retryConfig.maxAttempts,
      payloadJson: {
        introRequestId: envelope.introRequestId,
        recipientUserId: envelope.recipientUserId,
        role: envelope.role,
        status: envelope.status,
        counterpartDisplayName: envelope.counterpartDisplayName,
        counterpartHeadline: envelope.counterpartHeadline,
        interfaceLanguage: envelope.interfaceLanguage || 'en'
      }
    });

    return {
      found: true,
      claimed: Boolean(claim.claimed),
      duplicate: Boolean(claim.duplicate),
      notificationReceiptId: claim.notificationReceiptId,
      envelope,
      reason: claim.claimed ? 'notification_claimed' : 'notification_duplicate'
    };
  });

  if (!envelopeResult.found) {
    return {
      sent: false,
      duplicate: false,
      skipped: true,
      reason: envelopeResult.reason
    };
  }

  if (envelopeResult.duplicate) {
    return {
      sent: false,
      duplicate: true,
      skipped: false,
      reason: 'notification_already_recorded'
    };
  }

  const receiptAttempt = await withDbTransaction(async (client) => {
    return claimNotificationReceiptAttempt(client, {
      notificationReceiptId: envelopeResult.notificationReceiptId,
      claimTimeoutSeconds: retryConfig.claimTimeoutSeconds
    });
  });

  if (!receiptAttempt) {
    return {
      sent: false,
      duplicate: false,
      skipped: true,
      reason: 'notification_attempt_not_claimed'
    };
  }

  return deliverClaimedNotificationReceipt({
    receiptAttempt,
    retryDelaySeconds: retryConfig.retryDelaySeconds
  });
}

export async function retryDueNotificationReceipts({ batchSize = null } = {}) {
  const retryConfig = getNotificationRetryConfig();
  const effectiveBatchSize = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : retryConfig.batchSize;

  let guardCleanup = {
    persistenceEnabled: false,
    telegramUpdateReceiptsDeletedCount: 0,
    userActionGuardsDeletedCount: 0,
    totalDeletedCount: 0,
    reason: 'runtime_guard_cleanup_not_attempted'
  };

  try {
    guardCleanup = await cleanupExpiredRuntimeGuards();
  } catch (error) {
    console.warn('[notificationStore.retryDueNotificationReceipts] runtime guard cleanup degraded', error?.message || error);
    guardCleanup = {
      persistenceEnabled: false,
      telegramUpdateReceiptsDeletedCount: 0,
      userActionGuardsDeletedCount: 0,
      totalDeletedCount: 0,
      reason: 'runtime_guard_cleanup_failed'
    };
  }

  const claimedReceipts = await withDbTransaction(async (client) => {
    return claimRetryableNotificationReceipts(client, {
      batchSize: effectiveBatchSize,
      claimTimeoutSeconds: retryConfig.claimTimeoutSeconds
    });
  });

  const summary = {
    claimedCount: claimedReceipts.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    exhaustedCount: 0,
    guardCleanup,
    retried: []
  };

  for (const receiptAttempt of claimedReceipts) {
    const result = await deliverClaimedNotificationReceipt({
      receiptAttempt,
      retryDelaySeconds: retryConfig.retryDelaySeconds
    });

    summary.retried.push({
      notificationReceiptId: receiptAttempt.notificationReceiptId,
      introRequestId: receiptAttempt.introRequestId,
      eventType: receiptAttempt.eventType,
      reason: result.reason,
      sent: Boolean(result.sent),
      skipped: Boolean(result.skipped),
      failed: Boolean(result.failed),
      exhausted: Boolean(result.exhausted),
      attemptCount: result.attemptCount || receiptAttempt.attemptCount,
      maxAttempts: result.maxAttempts || receiptAttempt.maxAttempts,
      errorCode: result.errorCode || null
    });

    if (result.sent) {
      summary.sentCount += 1;
      continue;
    }

    if (result.skipped) {
      summary.skippedCount += 1;
      continue;
    }

    if (result.failed) {
      summary.failedCount += 1;
      if (result.exhausted) {
        summary.exhaustedCount += 1;
      }
    }
  }

  return summary;
}


export function normalizeNotificationReceiptBucket(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  return NOTIFICATION_RECEIPT_OPERATOR_BUCKETS.includes(normalized) ? normalized : null;
}

export function buildNotificationReceiptBucketCounts(rows = []) {
  const counts = {
    sent: 0,
    failed: 0,
    skipped: 0,
    retry_due: 0,
    exhausted: 0,
    total: 0
  };

  for (const row of rows) {
    if (!row?.operatorBucket || !NOTIFICATION_RECEIPT_OPERATOR_BUCKETS.includes(row.operatorBucket)) {
      continue;
    }

    const value = Number(row.receiptCount || 0);
    counts[row.operatorBucket] = value;
    counts.total += value;
  }

  return counts;
}

export function buildNotificationReceiptDiagnostics({ recent = [], counts = [], introSummary = null } = {}) {
  return {
    counts: buildNotificationReceiptBucketCounts(counts),
    recent,
    introSummary
  };
}

export async function getNotificationReceiptDiagnostics({ introRequestId = null, bucket = null, limit = null } = {}) {
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      reason: 'DATABASE_URL is not configured',
      ...buildNotificationReceiptDiagnostics()
    };
  }

  const opsConfig = getNotificationOpsConfig();
  const normalizedBucket = normalizeNotificationReceiptBucket(bucket);
  const normalizedLimit = Number.isFinite(limit) && limit > 0
    ? Math.min(Math.trunc(limit), 100)
    : opsConfig.defaultDiagnosticsLimit;

  return withDbClient(async (client) => {
    const counts = await getNotificationReceiptBucketCounts(client, { introRequestId });
    const recent = await listRecentNotificationReceipts(client, {
      introRequestId,
      operatorBucket: normalizedBucket,
      limit: normalizedLimit
    });
    const introSummary = introRequestId ? await getIntroNotificationReceiptSummary(client, { introRequestId }) : null;

    return {
      persistenceEnabled: true,
      reason: 'notification_receipt_diagnostics_loaded',
      ...buildNotificationReceiptDiagnostics({ recent, counts, introSummary })
    };
  });
}


export async function loadNotificationOperatorSurface({ bucket = null, introRequestId = null } = {}) {
  const normalizedBucket = normalizeNotificationReceiptBucket(bucket);

  if (introRequestId) {
    const diagnostics = await getNotificationReceiptDiagnostics({ introRequestId, limit: 6 });
    return {
      persistenceEnabled: diagnostics.persistenceEnabled,
      reason: diagnostics.reason,
      bucket: null,
      introRequestId,
      diagnostics,
      hotRetryDue: [],
      hotFailed: [],
      hotExhausted: []
    };
  }

  if (normalizedBucket) {
    const diagnostics = await getNotificationReceiptDiagnostics({ bucket: normalizedBucket, limit: 8 });
    return {
      persistenceEnabled: diagnostics.persistenceEnabled,
      reason: diagnostics.reason,
      bucket: normalizedBucket,
      introRequestId: null,
      diagnostics,
      hotRetryDue: [],
      hotFailed: [],
      hotExhausted: []
    };
  }

  const diagnostics = await getNotificationReceiptDiagnostics({ limit: 6 });
  if (!diagnostics.persistenceEnabled) {
    return {
      persistenceEnabled: false,
      reason: diagnostics.reason,
      bucket: null,
      introRequestId: null,
      diagnostics,
      hotRetryDue: [],
      hotFailed: [],
      hotExhausted: []
    };
  }

  const retryDue = await getNotificationReceiptDiagnostics({ bucket: 'retry_due', limit: 3 });
  const failed = await getNotificationReceiptDiagnostics({ bucket: 'failed', limit: 3 });
  const exhausted = await getNotificationReceiptDiagnostics({ bucket: 'exhausted', limit: 2 });

  return {
    persistenceEnabled: true,
    reason: 'notification_operator_surface_loaded',
    bucket: null,
    introRequestId: null,
    diagnostics,
    hotRetryDue: retryDue.recent || [],
    hotFailed: failed.recent || [],
    hotExhausted: exhausted.recent || []
  };
}
