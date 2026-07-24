import { getSchemaCompat } from './schemaCompat.js';
import { normalizeInterfaceLanguage } from '../lib/i18n/language.js';

function normalizeNotificationEventType(eventType) {
  if (eventType === 'intro_request_created') {
    return eventType;
  }

  if (eventType === 'intro_request_accepted') {
    return eventType;
  }

  if (eventType === 'intro_request_declined') {
    return eventType;
  }

  return null;
}

function buildNotificationEventKey({ eventType, introRequestId, recipientUserId }) {
  return `${eventType}:${introRequestId}:${recipientUserId}`;
}

function normalizeNotificationEnvelope(row) {
  if (!row) {
    return null;
  }

  return {
    eventType: row.event_type,
    introRequestId: row.intro_request_id,
    recipientUserId: row.recipient_user_id,
    recipientTelegramUserId: row.recipient_telegram_user_id,
    counterpartDisplayName: row.counterpart_display_name,
    counterpartHeadline: row.counterpart_headline_user,
    status: row.status,
    role: row.role,
    interfaceLanguage: normalizeInterfaceLanguage(row.recipient_interface_language)
  };
}

function normalizeNotificationReceiptAttempt(row) {
  if (!row) {
    return null;
  }

  return {
    notificationReceiptId: row.notification_receipt_id,
    eventKey: row.event_key,
    eventType: row.event_type,
    introRequestId: row.intro_request_id,
    recipientUserId: row.recipient_user_id,
    recipientTelegramUserId: row.recipient_telegram_user_id,
    deliveryStatus: row.delivery_status,
    attemptCount: Number(row.attempt_count || 0),
    maxAttempts: Number(row.max_attempts || 0),
    nextAttemptAt: row.next_attempt_at,
    lastAttemptAt: row.last_attempt_at,
    payloadJson: row.payload_json || null,
    lastErrorCode: row.last_error_code || null,
    errorMessage: row.error_message || null
  };
}

export const NOTIFICATION_RECEIPT_OPERATOR_BUCKETS = ['sent', 'failed', 'skipped', 'retry_due', 'exhausted'];

const NOTIFICATION_RECEIPT_OPERATOR_BUCKET_SQL = `
  case
    when nr.delivery_status = 'sent' then 'sent'
    when nr.delivery_status = 'skipped' then 'skipped'
    when nr.delivery_status = 'failed'
      and (nr.attempt_count >= nr.max_attempts or nr.next_attempt_at is null)
      then 'exhausted'
    when nr.delivery_status in ('pending', 'failed')
      and nr.sent_message_id is null
      and nr.attempt_count < nr.max_attempts
      and nr.next_attempt_at is not null
      and nr.next_attempt_at <= now()
      then 'retry_due'
    when nr.delivery_status = 'failed' then 'failed'
    when nr.delivery_status = 'pending' then 'failed'
    else 'failed'
  end
`;

function normalizeNotificationReceiptDiagnostic(row) {
  if (!row) {
    return null;
  }

  return {
    notificationReceiptId: row.notification_receipt_id,
    eventKey: row.event_key,
    eventType: row.event_type,
    introRequestId: row.intro_request_id,
    recipientUserId: row.recipient_user_id,
    recipientTelegramUserId: row.recipient_telegram_user_id,
    deliveryStatus: row.delivery_status,
    operatorBucket: row.operator_bucket,
    attemptCount: Number(row.attempt_count || 0),
    maxAttempts: Number(row.max_attempts || 0),
    nextAttemptAt: row.next_attempt_at,
    lastAttemptAt: row.last_attempt_at,
    deliveredAt: row.delivered_at,
    sentMessageId: row.sent_message_id ? Number(row.sent_message_id) : null,
    createdAt: row.created_at,
    lastErrorCode: row.last_error_code || null,
    errorMessage: row.error_message || null,
    payloadJson: row.payload_json || null
  };
}

function normalizeNotificationReceiptBucketCount(row) {
  if (!row) {
    return null;
  }

  return {
    operatorBucket: row.operator_bucket,
    receiptCount: Number(row.receipt_count || 0)
  };
}

function normalizeIntroNotificationReceiptSummary(row) {
  if (!row) {
    return null;
  }

  return {
    introRequestId: Number(row.intro_request_id || 0),
    totalCount: Number(row.total_count || 0),
    sentCount: Number(row.sent_count || 0),
    failedCount: Number(row.failed_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    retryDueCount: Number(row.retry_due_count || 0),
    exhaustedCount: Number(row.exhausted_count || 0),
    lastEventAt: row.last_event_at || null
  };
}

export async function loadIntroNotificationEnvelope(client, { eventType, introRequestId }) {
  const compat = await getSchemaCompat(client);
  const recipientLanguageSql = compat.userLanguageContractReady ? 'ru.interface_language' : "'en'::text";
  const normalizedEventType = normalizeNotificationEventType(eventType);
  if (!normalizedEventType) {
    return null;
  }

  if (normalizedEventType === 'intro_request_created') {
    const result = await client.query(
      `
        select
          $2::text as event_type,
          ir.id as intro_request_id,
          ir.target_user_id as recipient_user_id,
          ru.telegram_user_id as recipient_telegram_user_id,
          ${recipientLanguageSql} as recipient_interface_language,
          coalesce(nullif(rmp.display_name, ''), rla.full_name, ir.requester_display_name, 'Unknown member') as counterpart_display_name,
          coalesce(rmp.headline_user, ir.requester_headline_user) as counterpart_headline_user,
          ir.status,
          'received'::text as role
        from intro_requests ir
        join users ru on ru.id = ir.target_user_id
        left join member_profiles rmp on rmp.user_id = ir.requester_user_id
        left join linkedin_accounts rla on rla.user_id = ir.requester_user_id
        where ir.id = $1
        limit 1
      `,
      [introRequestId, normalizedEventType]
    );

    return normalizeNotificationEnvelope(result.rows[0] || null);
  }

  const result = await client.query(
    `
      select
        $2::text as event_type,
        ir.id as intro_request_id,
        ir.requester_user_id as recipient_user_id,
        ru.telegram_user_id as recipient_telegram_user_id,
        ${recipientLanguageSql} as recipient_interface_language,
        coalesce(nullif(tmp.display_name, ''), tla.full_name, ir.target_display_name, 'Unknown member') as counterpart_display_name,
        coalesce(tmp.headline_user, ir.target_headline_user) as counterpart_headline_user,
        ir.status,
        'sent'::text as role
      from intro_requests ir
      join users ru on ru.id = ir.requester_user_id
      left join member_profiles tmp on tmp.user_id = ir.target_user_id
      left join linkedin_accounts tla on tla.user_id = ir.target_user_id
      where ir.id = $1
      limit 1
    `,
    [introRequestId, normalizedEventType]
  );

  return normalizeNotificationEnvelope(result.rows[0] || null);
}

export async function claimNotificationReceipt(client, { eventType, introRequestId, recipientUserId, recipientTelegramUserId = null, payloadJson = null, maxAttempts = 3 }) {
  const normalizedEventType = normalizeNotificationEventType(eventType);
  if (!normalizedEventType) {
    throw new Error(`Unsupported notification event type: ${eventType}`);
  }

  const eventKey = buildNotificationEventKey({
    eventType: normalizedEventType,
    introRequestId,
    recipientUserId
  });

  const result = await client.query(
    `
      insert into notification_receipts (
        event_key,
        event_type,
        intro_request_id,
        recipient_user_id,
        recipient_telegram_user_id,
        payload_json,
        max_attempts,
        next_attempt_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, now())
      on conflict (event_key) do nothing
      returning
        id as notification_receipt_id,
        event_key,
        event_type,
        intro_request_id,
        recipient_user_id,
        recipient_telegram_user_id,
        delivery_status,
        attempt_count,
        max_attempts,
        next_attempt_at,
        last_attempt_at,
        payload_json,
        last_error_code,
        error_message
    `,
    [
      eventKey,
      normalizedEventType,
      introRequestId,
      recipientUserId,
      recipientTelegramUserId,
      payloadJson,
      maxAttempts
    ]
  );

  if (result.rows[0]) {
    return {
      claimed: true,
      duplicate: false,
      ...normalizeNotificationReceiptAttempt(result.rows[0])
    };
  }

  const existingResult = await client.query(
    `
      select
        id as notification_receipt_id,
        event_key,
        event_type,
        intro_request_id,
        recipient_user_id,
        recipient_telegram_user_id,
        delivery_status,
        attempt_count,
        max_attempts,
        next_attempt_at,
        last_attempt_at,
        payload_json,
        last_error_code,
        error_message
      from notification_receipts
      where event_key = $1
      limit 1
    `,
    [eventKey]
  );

  return {
    claimed: false,
    duplicate: true,
    ...normalizeNotificationReceiptAttempt(existingResult.rows[0] || null)
  };
}

export async function claimNotificationReceiptAttempt(client, { notificationReceiptId, claimTimeoutSeconds }) {
  const result = await client.query(
    `
      update notification_receipts
      set attempt_count = attempt_count + 1,
          last_attempt_at = now()
      where id = $1
        and delivery_status in ('pending', 'failed')
        and sent_message_id is null
        and attempt_count < max_attempts
        and (next_attempt_at is null or next_attempt_at <= now())
        and (
          last_attempt_at is null
          or last_attempt_at <= now() - ($2 * interval '1 second')
        )
      returning
        id as notification_receipt_id,
        event_key,
        event_type,
        intro_request_id,
        recipient_user_id,
        recipient_telegram_user_id,
        delivery_status,
        attempt_count,
        max_attempts,
        next_attempt_at,
        last_attempt_at,
        payload_json,
        last_error_code,
        error_message
    `,
    [notificationReceiptId, claimTimeoutSeconds]
  );

  return normalizeNotificationReceiptAttempt(result.rows[0] || null);
}

export async function claimRetryableNotificationReceipts(client, { batchSize, claimTimeoutSeconds }) {
  const result = await client.query(
    `
      with due as (
        select id
        from notification_receipts
        where delivery_status in ('pending', 'failed')
          and sent_message_id is null
          and attempt_count < max_attempts
          and (next_attempt_at is null or next_attempt_at <= now())
          and (
            last_attempt_at is null
            or last_attempt_at <= now() - ($2 * interval '1 second')
          )
        order by coalesce(next_attempt_at, created_at) asc, id asc
        for update skip locked
        limit $1
      )
      update notification_receipts nr
      set attempt_count = nr.attempt_count + 1,
          last_attempt_at = now()
      from due
      where nr.id = due.id
      returning
        nr.id as notification_receipt_id,
        nr.event_key,
        nr.event_type,
        nr.intro_request_id,
        nr.recipient_user_id,
        nr.recipient_telegram_user_id,
        nr.delivery_status,
        nr.attempt_count,
        nr.max_attempts,
        nr.next_attempt_at,
        nr.last_attempt_at,
        nr.payload_json,
        nr.last_error_code,
        nr.error_message
    `,
    [batchSize, claimTimeoutSeconds]
  );

  return result.rows.map((row) => normalizeNotificationReceiptAttempt(row));
}

export async function markNotificationReceiptStatus(client, {
  notificationReceiptId,
  deliveryStatus,
  errorMessage = null,
  errorCode = null,
  sentMessageId = null,
  nextAttemptAt = null,
  clearNextAttempt = false
}) {
  const result = await client.query(
    `
      update notification_receipts
      set delivery_status = $2,
          error_message = $3,
          last_error_code = $4,
          sent_message_id = $5,
          next_attempt_at = case
            when $6::boolean then null
            when $7::timestamptz is not null then $7::timestamptz
            else next_attempt_at
          end,
          delivered_at = case when $2 in ('sent', 'failed', 'skipped') then now() else delivered_at end
      where id = $1
      returning
        id as notification_receipt_id,
        event_key,
        event_type,
        intro_request_id,
        recipient_user_id,
        recipient_telegram_user_id,
        delivery_status,
        attempt_count,
        max_attempts,
        next_attempt_at,
        last_attempt_at,
        payload_json,
        last_error_code,
        error_message,
        sent_message_id,
        delivered_at
    `,
    [notificationReceiptId, deliveryStatus, errorMessage, errorCode, sentMessageId, clearNextAttempt, nextAttemptAt]
  );

  return result.rows[0] || null;
}

export async function listRecentNotificationReceipts(client, { introRequestId = null, operatorBucket = null, limit = 20 } = {}) {
  const result = await client.query(
    `
      select *
      from (
        select
          nr.id as notification_receipt_id,
          nr.event_key,
          nr.event_type,
          nr.intro_request_id,
          nr.recipient_user_id,
          nr.recipient_telegram_user_id,
          nr.delivery_status,
          ${NOTIFICATION_RECEIPT_OPERATOR_BUCKET_SQL} as operator_bucket,
          nr.attempt_count,
          nr.max_attempts,
          nr.next_attempt_at,
          nr.last_attempt_at,
          nr.delivered_at,
          nr.sent_message_id,
          nr.created_at,
          nr.last_error_code,
          nr.error_message,
          nr.payload_json
        from notification_receipts nr
        where ($1::bigint is null or nr.intro_request_id = $1)
      ) recent
      where ($2::text is null or recent.operator_bucket = $2)
      order by coalesce(recent.last_attempt_at, recent.delivered_at, recent.created_at) desc, recent.notification_receipt_id desc
      limit $3
    `,
    [introRequestId, operatorBucket, limit]
  );

  return result.rows.map((row) => normalizeNotificationReceiptDiagnostic(row));
}

export async function getNotificationReceiptBucketCounts(client, { introRequestId = null } = {}) {
  const result = await client.query(
    `
      select counts.operator_bucket, count(*)::integer as receipt_count
      from (
        select ${NOTIFICATION_RECEIPT_OPERATOR_BUCKET_SQL} as operator_bucket
        from notification_receipts nr
        where ($1::bigint is null or nr.intro_request_id = $1)
      ) counts
      group by counts.operator_bucket
    `,
    [introRequestId]
  );

  return result.rows.map((row) => normalizeNotificationReceiptBucketCount(row));
}

export async function getIntroNotificationReceiptSummary(client, { introRequestId }) {
  const result = await client.query(
    `
      select
        summary.intro_request_id,
        count(*)::integer as total_count,
        count(*) filter (where summary.operator_bucket = 'sent')::integer as sent_count,
        count(*) filter (where summary.operator_bucket = 'failed')::integer as failed_count,
        count(*) filter (where summary.operator_bucket = 'skipped')::integer as skipped_count,
        count(*) filter (where summary.operator_bucket = 'retry_due')::integer as retry_due_count,
        count(*) filter (where summary.operator_bucket = 'exhausted')::integer as exhausted_count,
        max(summary.event_timestamp) as last_event_at
      from (
        select
          nr.intro_request_id,
          ${NOTIFICATION_RECEIPT_OPERATOR_BUCKET_SQL} as operator_bucket,
          coalesce(nr.delivered_at, nr.last_attempt_at, nr.created_at) as event_timestamp
        from notification_receipts nr
        where nr.intro_request_id = $1
      ) summary
      group by summary.intro_request_id
      limit 1
    `,
    [introRequestId]
  );

  return normalizeIntroNotificationReceiptSummary(result.rows[0] || null);
}
