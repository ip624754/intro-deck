import { CONTACT_POLICY_SNAPSHOT, getTelegramStarsPaymentMismatchReason, PAID_CONTACT_MODE, REQUEST_DELIVERY_FEE_POLICY } from '../lib/contact/contract.js';
import { acquireContactPairLock, getContactPairRestriction } from './contactPolicyRepo.js';
import { getSchemaCompat, selectHiddenTelegramUsername } from './schemaCompat.js';

function unsupportedSchemaResult(reason = 'contact_unlock_requires_migrations') {
  return { changed: false, created: false, blocked: true, duplicate: false, reason, request: null, target: null };
}

async function ensureContactUnlockSchema(client) {
  const compat = await getSchemaCompat(client);
  return {
    compat,
    supported: compat.memberProfilesHasHiddenTelegramUsername && compat.hasContactUnlockRequestsTable,
    contractSupported: Boolean(
      compat.memberProfilesHasHiddenTelegramUsername &&
      compat.hasContactUnlockRequestsTable &&
      compat.contactUnlockHasProCovered &&
      compat.contactUnlockHasCheckoutAuthorizedAt &&
      compat.hasContactUnlockEventsTable &&
      compat.hasMemberDmThreadsTable
    )
  };
}

function contactContractSelects(alias, compat) {
  return {
    proCovered: compat?.contactUnlockHasProCovered ? `${alias}.pro_covered` : 'false',
    checkoutAuthorizedAt: compat?.contactUnlockHasCheckoutAuthorizedAt ? `${alias}.checkout_authorized_at` : 'null::timestamptz'
  };
}

async function createContactUnlockEvent(client, { requestId, actorUserId = null, eventType, detail = null }) {
  const compat = await getSchemaCompat(client);
  if (!compat.hasContactUnlockEventsTable) {
    return;
  }
  await client.query(
    `
      insert into contact_unlock_events (request_id, actor_user_id, event_type, detail_json)
      values ($1, $2, $3, $4::jsonb)
    `,
    [requestId, actorUserId, eventType, detail ? JSON.stringify(detail) : null]
  );
}

function normalizeUnlockItem(row, role) {
  if (!row) {
    return null;
  }

  return {
    contact_unlock_request_id: row.contact_unlock_request_id,
    status: row.status,
    payment_state: row.payment_state,
    price_stars_snapshot: row.price_stars_snapshot,
    requested_at: row.requested_at,
    approved_at: row.approved_at,
    declined_at: row.declined_at,
    revealed_at: row.revealed_at,
    updated_at: row.updated_at,
    profile_id: row.profile_id,
    display_name: row.display_name,
    headline_user: row.headline_user,
    revealed_contact_value: row.revealed_contact_value || null,
    policy_snapshot: row.policy_snapshot || null,
    pro_covered: Boolean(row.pro_covered),
    checkout_authorized_at: row.checkout_authorized_at || null,
    role
  };
}

async function loadRequesterSnapshotRow(client, requesterUserId) {
  const result = await client.query(
    `
      select
        u.id as requester_user_id,
        mp.id as profile_id,
        coalesce(nullif(mp.display_name, ''), la.full_name, 'Unknown member') as display_name,
        mp.headline_user
      from users u
      left join member_profiles mp on mp.user_id = u.id
      left join linkedin_accounts la on la.user_id = u.id
      where u.id = $1
      limit 1
    `,
    [requesterUserId]
  );

  return result.rows[0] || null;
}

async function loadTargetContactRow(client, targetProfileId) {
  const compat = await getSchemaCompat(client);
  const hiddenTelegramSelect = selectHiddenTelegramUsername('mp', compat);
  const result = await client.query(
    `
      select
        mp.id as profile_id,
        mp.user_id as target_user_id,
        mp.contact_mode,
        mp.visibility_status,
        mp.profile_state,
        ${hiddenTelegramSelect} as telegram_username_hidden,
        coalesce(nullif(mp.display_name, ''), la.full_name, 'Unnamed profile') as display_name,
        mp.headline_user
      from member_profiles mp
      join users u on u.id = mp.user_id
      left join linkedin_accounts la on la.user_id = u.id
      where mp.id = $1
      limit 1
    `,
    [targetProfileId]
  );

  return result.rows[0] || null;
}

async function loadContactUnlockDetailRow(client, requestId, userId) {
  const compat = await getSchemaCompat(client);
  const contract = contactContractSelects('cur', compat);
  const result = await client.query(
    `
      select
        cur.id as contact_unlock_request_id,
        cur.status,
        cur.payment_state,
        cur.price_stars_snapshot,
        cur.requested_at,
        cur.approved_at,
        cur.declined_at,
        cur.revealed_at,
        cur.updated_at,
        cur.revealed_contact_value,
        cur.policy_snapshot,
        ${contract.proCovered} as pro_covered,
        ${contract.checkoutAuthorizedAt} as checkout_authorized_at,
        case
          when cur.target_user_id = $2 then 'received'
          when cur.requester_user_id = $2 then 'sent'
          else null
        end as role,
        case
          when cur.target_user_id = $2 then requester_mp.id
          else target_mp.id
        end as profile_id,
        case
          when cur.target_user_id = $2 then coalesce(nullif(requester_mp.display_name, ''), requester_la.full_name, cur.requester_display_name, 'Unknown member')
          else coalesce(nullif(target_mp.display_name, ''), target_la.full_name, cur.target_display_name, 'Unknown member')
        end as display_name,
        case
          when cur.target_user_id = $2 then coalesce(requester_mp.headline_user, cur.requester_headline_user)
          else coalesce(target_mp.headline_user, cur.target_headline_user)
        end as headline_user
      from contact_unlock_requests cur
      left join member_profiles requester_mp on requester_mp.user_id = cur.requester_user_id
      left join linkedin_accounts requester_la on requester_la.user_id = cur.requester_user_id
      left join member_profiles target_mp on target_mp.user_id = cur.target_user_id
      left join linkedin_accounts target_la on target_la.user_id = cur.target_user_id
      where cur.id = $1
        and (cur.target_user_id = $2 or cur.requester_user_id = $2)
      limit 1
    `,
    [requestId, userId]
  );

  return result.rows[0] || null;
}

export async function createOrGetContactUnlockRequest(client, { requesterUserId, targetProfileId, priceStars, retryCooldownDays = 30 }) {
  const schema = await ensureContactUnlockSchema(client);
  if (!schema.supported) {
    return unsupportedSchemaResult();
  }
  if (!schema.contractSupported) {
    return unsupportedSchemaResult('contact_contract_requires_migration');
  }

  const requester = await loadRequesterSnapshotRow(client, requesterUserId);
  if (!requester) {
    return { created: false, blocked: true, reason: 'requester_user_missing', request: null, target: null };
  }

  const target = await loadTargetContactRow(client, targetProfileId);
  if (!target) {
    return { created: false, blocked: true, reason: 'target_profile_missing', request: null, target: null };
  }

  if (String(target.target_user_id) == String(requesterUserId)) {
    return { created: false, blocked: true, reason: 'cannot_request_direct_contact_to_self', request: null, target };
  }

  if (target.visibility_status !== 'listed' || target.profile_state !== 'active') {
    return { created: false, blocked: true, reason: 'target_profile_not_public', request: null, target };
  }

  if (target.contact_mode !== PAID_CONTACT_MODE) {
    return { created: false, blocked: true, reason: 'target_profile_not_paid_unlock_mode', request: null, target };
  }

  if (!(typeof target.telegram_username_hidden === 'string' && target.telegram_username_hidden.trim())) {
    return { created: false, blocked: true, reason: 'target_profile_no_hidden_telegram_username', request: null, target };
  }

  await acquireContactPairLock(client, {
    userAId: requesterUserId,
    userBId: target.target_user_id
  });
  const restriction = await getContactPairRestriction(client, {
    requesterUserId,
    targetUserId: target.target_user_id,
    retryCooldownDays
  });
  if (restriction.blocked) {
    return { created: false, blocked: true, duplicate: false, reason: 'contact_path_blocked', request: null, target };
  }
  if (restriction.retryAvailableAt) {
    return {
      created: false,
      blocked: true,
      duplicate: false,
      reason: 'contact_request_cooldown_active',
      retry_available_at: restriction.retryAvailableAt,
      request: null,
      target
    };
  }

  const existingResult = await client.query(
    `
      select
        id as contact_unlock_request_id,
        status,
        payment_state,
        price_stars_snapshot,
        requested_at,
        approved_at,
        declined_at,
        revealed_at,
        updated_at,
        revealed_contact_value,
        policy_snapshot,
        pro_covered,
        checkout_authorized_at
      from contact_unlock_requests
      where requester_user_id = $1
        and target_profile_id = $2
        and contact_type = 'telegram_username'
        and status in ('payment_pending', 'paid_pending_approval', 'revealed')
      order by id desc
      limit 1
    `,
    [requesterUserId, targetProfileId]
  );

  const existing = existingResult.rows[0] || null;
  if (existing) {
    return {
      created: false,
      blocked: false,
      duplicate: true,
      reason: existing.status === 'revealed' ? 'contact_unlock_already_revealed' : 'contact_unlock_request_already_exists',
      request: {
        ...existing,
        target_user_id: target.target_user_id,
        target_profile_id: target.profile_id,
        display_name: target.display_name,
        headline_user: target.headline_user
      },
      target
    };
  }

  const insertResult = await client.query(
    `
      insert into contact_unlock_requests (
        requester_user_id,
        target_user_id,
        target_profile_id,
        contact_type,
        status,
        payment_state,
        price_stars_snapshot,
        policy_snapshot,
        requester_display_name,
        requester_headline_user,
        target_display_name,
        target_headline_user
      )
      values ($1, $2, $3, 'telegram_username', 'payment_pending', 'pending', $4, $5, $6, $7, $8, $9)
      returning
        id as contact_unlock_request_id,
        status,
        payment_state,
        price_stars_snapshot,
        requested_at,
        approved_at,
        declined_at,
        revealed_at,
        updated_at,
        revealed_contact_value
    `,
    [
      requesterUserId,
      target.target_user_id,
      target.profile_id,
      priceStars,
      CONTACT_POLICY_SNAPSHOT,
      requester.display_name,
      requester.headline_user || null,
      target.display_name,
      target.headline_user || null
    ]
  );

  const createdRequestId = insertResult.rows[0]?.contact_unlock_request_id;
  if (createdRequestId) {
    await createContactUnlockEvent(client, {
      requestId: createdRequestId,
      actorUserId: requesterUserId,
      eventType: 'contact_request_created',
      detail: {
        targetProfileId: target.profile_id,
        contactMode: target.contact_mode,
        feePolicy: REQUEST_DELIVERY_FEE_POLICY
      }
    });
  }

  return {
    created: true,
    blocked: false,
    duplicate: false,
    reason: 'contact_unlock_request_created',
    request: {
      ...insertResult.rows[0],
      target_user_id: target.target_user_id,
      target_profile_id: target.profile_id,
      display_name: target.display_name,
      headline_user: target.headline_user
    },
    target
  };
}

export async function getContactUnlockRequestPaymentEnvelope(client, { requestId }) {
  const schema = await ensureContactUnlockSchema(client);
  if (!schema.supported) {
    return null;
  }

  const hiddenTelegramSelect = selectHiddenTelegramUsername('target_mp', schema.compat);
  const contract = contactContractSelects('cur', schema.compat);
  const result = await client.query(
    `
      select
        cur.id as contact_unlock_request_id,
        cur.requester_user_id,
        requester.telegram_user_id as requester_telegram_user_id,
        cur.target_user_id,
        target.telegram_user_id as target_telegram_user_id,
        cur.target_profile_id,
        cur.status,
        cur.payment_state,
        cur.price_stars_snapshot,
        cur.policy_snapshot,
        ${contract.proCovered} as pro_covered,
        ${contract.checkoutAuthorizedAt} as checkout_authorized_at,
        target_mp.contact_mode as target_contact_mode,
        target_mp.visibility_status as target_visibility_status,
        target_mp.profile_state as target_profile_state,
        coalesce(nullif(requester_mp.display_name, ''), requester_la.full_name, cur.requester_display_name, 'Unknown member') as requester_display_name,
        coalesce(requester_mp.headline_user, cur.requester_headline_user) as requester_headline_user,
        coalesce(nullif(target_mp.display_name, ''), target_la.full_name, cur.target_display_name, 'Unknown member') as target_display_name,
        coalesce(target_mp.headline_user, cur.target_headline_user) as target_headline_user,
        ${hiddenTelegramSelect} as telegram_username_hidden
      from contact_unlock_requests cur
      join users requester on requester.id = cur.requester_user_id
      join users target on target.id = cur.target_user_id
      left join member_profiles requester_mp on requester_mp.user_id = cur.requester_user_id
      left join linkedin_accounts requester_la on requester_la.user_id = cur.requester_user_id
      left join member_profiles target_mp on target_mp.user_id = cur.target_user_id
      left join linkedin_accounts target_la on target_la.user_id = cur.target_user_id
      where cur.id = $1
      limit 1
    `,
    [requestId]
  );

  return result.rows[0] || null;
}

export async function authorizeContactUnlockCheckout(client, {
  requestId,
  requesterUserId,
  retryCooldownDays = 30,
  checkoutRetryLockSeconds = 1800,
  currency,
  totalAmount
}) {
  const schema = await ensureContactUnlockSchema(client);
  if (!schema.contractSupported) {
    return { authorized: false, blocked: true, reason: 'contact_contract_requires_migration', request: null };
  }
  const current = await getContactUnlockRequestPaymentEnvelope(client, { requestId });
  if (!current) {
    return { authorized: false, blocked: true, reason: 'contact_unlock_request_missing', request: null };
  }
  if (String(current.requester_user_id) !== String(requesterUserId)) {
    return { authorized: false, blocked: true, reason: 'contact_unlock_request_not_owned_by_user', request: current };
  }
  await acquireContactPairLock(client, {
    userAId: current.requester_user_id,
    userBId: current.target_user_id
  });
  const refreshedCurrent = await getContactUnlockRequestPaymentEnvelope(client, { requestId });
  if (!refreshedCurrent) {
    return { authorized: false, blocked: true, reason: 'contact_unlock_request_missing', request: null };
  }
  if (refreshedCurrent.status !== 'payment_pending' || refreshedCurrent.payment_state !== 'pending') {
    return { authorized: false, blocked: true, reason: 'contact_unlock_request_not_ready_for_payment', request: refreshedCurrent };
  }
  const paymentMismatch = getTelegramStarsPaymentMismatchReason({
    currency,
    totalAmount,
    expectedAmount: refreshedCurrent.price_stars_snapshot
  });
  if (paymentMismatch) {
    return { authorized: false, blocked: true, reason: paymentMismatch, request: refreshedCurrent };
  }
  const restriction = await getContactPairRestriction(client, {
    requesterUserId: refreshedCurrent.requester_user_id,
    targetUserId: refreshedCurrent.target_user_id,
    retryCooldownDays
  });
  if (restriction.blocked) {
    return { authorized: false, blocked: true, reason: 'contact_path_blocked', request: refreshedCurrent };
  }
  if (restriction.retryAvailableAt) {
    return { authorized: false, blocked: true, reason: 'contact_request_cooldown_active', request: refreshedCurrent };
  }
  const previousAuthorization = refreshedCurrent.checkout_authorized_at ? new Date(refreshedCurrent.checkout_authorized_at).getTime() : 0;
  if (previousAuthorization && Date.now() - previousAuthorization < checkoutRetryLockSeconds * 1000) {
    return { authorized: false, blocked: true, reason: 'contact_checkout_already_in_progress', request: refreshedCurrent };
  }
  if (refreshedCurrent.target_visibility_status !== 'listed' || refreshedCurrent.target_profile_state !== 'active') {
    return { authorized: false, blocked: true, reason: 'target_profile_not_public', request: refreshedCurrent };
  }
  if (refreshedCurrent.target_contact_mode !== PAID_CONTACT_MODE || refreshedCurrent.policy_snapshot !== CONTACT_POLICY_SNAPSHOT) {
    return { authorized: false, blocked: true, reason: 'target_profile_not_paid_unlock_mode', request: refreshedCurrent };
  }

  await client.query(
    `update contact_unlock_requests set checkout_authorized_at = now(), updated_at = now() where id = $1`,
    [requestId]
  );
  await createContactUnlockEvent(client, {
    requestId,
    actorUserId: requesterUserId,
    eventType: 'contact_checkout_authorized',
    detail: { feePolicy: REQUEST_DELIVERY_FEE_POLICY, currency, amountStars: refreshedCurrent.price_stars_snapshot }
  });
  const request = await getContactUnlockRequestPaymentEnvelope(client, { requestId });
  return { authorized: true, blocked: false, reason: 'contact_checkout_authorized', request };
}

export async function markContactUnlockRequestPaymentConfirmed(client, {
  requestId,
  requesterUserId,
  telegramPaymentChargeId,
  providerPaymentChargeId = null,
  proCovered = false,
  checkoutAuthorizationTtlMinutes = 30,
  currency = null,
  totalAmount = null,
  retryCooldownDays = 30
}) {
  const schema = await ensureContactUnlockSchema(client);
  if (!schema.contractSupported) {
    return { changed: false, blocked: true, duplicate: false, reason: 'contact_contract_requires_migration', request: null };
  }

  const current = await getContactUnlockRequestPaymentEnvelope(client, { requestId });
  if (!current) {
    return { changed: false, blocked: true, reason: 'contact_unlock_request_missing', request: null };
  }
  if (String(current.requester_user_id) !== String(requesterUserId)) {
    return { changed: false, blocked: true, reason: 'contact_unlock_request_not_owned_by_user', request: null };
  }
  if (current.status === 'revealed') {
    return { changed: false, duplicate: true, reason: 'contact_unlock_already_revealed', request: current };
  }
  if (current.payment_state === 'paid') {
    return { changed: false, duplicate: true, reason: 'contact_unlock_payment_already_confirmed', request: current };
  }
  if (current.status !== 'payment_pending' || current.payment_state !== 'pending') {
    return { changed: false, blocked: true, reason: 'contact_unlock_request_not_ready_for_payment', request: current };
  }

  if (proCovered) {
    await acquireContactPairLock(client, {
      userAId: current.requester_user_id,
      userBId: current.target_user_id
    });
    const restriction = await getContactPairRestriction(client, {
      requesterUserId: current.requester_user_id,
      targetUserId: current.target_user_id,
      retryCooldownDays
    });
    if (restriction.blocked) {
      return { changed: false, blocked: true, reason: 'contact_path_blocked', request: current };
    }
    if (restriction.retryAvailableAt) {
      return { changed: false, blocked: true, reason: 'contact_request_cooldown_active', request: current };
    }
    if (current.target_visibility_status !== 'listed' || current.target_profile_state !== 'active') {
      return { changed: false, blocked: true, reason: 'target_profile_not_public', request: current };
    }
    if (current.target_contact_mode !== PAID_CONTACT_MODE || current.policy_snapshot !== CONTACT_POLICY_SNAPSHOT) {
      return { changed: false, blocked: true, reason: 'target_profile_not_paid_unlock_mode', request: current };
    }
  } else {
    const paymentMismatch = getTelegramStarsPaymentMismatchReason({
      currency,
      totalAmount,
      expectedAmount: current.price_stars_snapshot
    });
    if (paymentMismatch) {
      return { changed: false, blocked: true, reason: paymentMismatch, request: current };
    }
    const authorizedAt = current.checkout_authorized_at ? new Date(current.checkout_authorized_at).getTime() : 0;
    const ttlMs = checkoutAuthorizationTtlMinutes * 60 * 1000;
    if (!authorizedAt || Date.now() - authorizedAt > ttlMs) {
      return { changed: false, blocked: true, reason: 'contact_checkout_authorization_missing_or_expired', request: current };
    }
    if (!telegramPaymentChargeId) {
      return { changed: false, blocked: true, reason: 'contact_payment_charge_missing', request: current };
    }
  }

  const result = await client.query(
    `
      update contact_unlock_requests
      set
        status = 'paid_pending_approval',
        payment_state = 'paid',
        telegram_payment_charge_id = $3,
        provider_payment_charge_id = $4,
        pro_covered = $5,
        updated_at = now()
      where id = $1
        and requester_user_id = $2
        and status = 'payment_pending'
        and payment_state = 'pending'
      returning id as contact_unlock_request_id
    `,
    [requestId, requesterUserId, telegramPaymentChargeId, providerPaymentChargeId, proCovered]
  );

  if (!result.rows[0]) {
    return { changed: false, blocked: true, reason: 'contact_unlock_payment_confirmation_failed', request: null };
  }

  await createContactUnlockEvent(client, {
    requestId,
    actorUserId: requesterUserId,
    eventType: proCovered ? 'contact_request_covered_by_pro' : 'contact_payment_confirmed',
    detail: {
      amountStars: current.price_stars_snapshot,
      currency: proCovered ? null : currency,
      feePolicy: REQUEST_DELIVERY_FEE_POLICY,
      proCovered,
      telegramPaymentChargeId: telegramPaymentChargeId || null,
      providerPaymentChargeId: providerPaymentChargeId || null
    }
  });

  const request = await getContactUnlockRequestPaymentEnvelope(client, { requestId });
  return {
    changed: true,
    blocked: false,
    duplicate: false,
    reason: proCovered ? 'contact_unlock_covered_by_pro' : 'contact_unlock_payment_confirmed',
    request
  };
}

export async function decideContactUnlockRequest(client, { userId, requestId, decision }) {
  const schema = await ensureContactUnlockSchema(client);
  if (!schema.contractSupported) {
    return { changed: false, blocked: true, duplicate: false, reason: 'contact_contract_requires_migration', request: null };
  }

  const nextDecision = decision === 'acc' ? 'reveal' : decision === 'dec' ? 'decline' : null;
  if (!nextDecision) {
    return { changed: false, blocked: true, reason: 'contact_unlock_invalid_decision', request: null };
  }

  let current = await getContactUnlockRequestPaymentEnvelope(client, { requestId });
  if (!current) {
    return { changed: false, blocked: true, reason: 'contact_unlock_request_missing', request: null };
  }

  if (String(current.target_user_id) !== String(userId)) {
    return { changed: false, blocked: true, reason: 'contact_unlock_request_not_actionable_by_user', request: null };
  }

  await acquireContactPairLock(client, {
    userAId: current.requester_user_id,
    userBId: current.target_user_id
  });
  current = await getContactUnlockRequestPaymentEnvelope(client, { requestId });
  if (!current) {
    return { changed: false, blocked: true, reason: 'contact_unlock_request_missing', request: null };
  }

  if (current.status === 'revealed') {
    return { changed: false, duplicate: true, reason: 'contact_unlock_already_revealed', request: current };
  }

  if (current.status === 'declined') {
    return { changed: false, duplicate: true, reason: 'contact_unlock_already_declined', request: current };
  }

  if (current.status !== 'paid_pending_approval') {
    return { changed: false, blocked: true, reason: 'contact_unlock_request_not_ready_for_decision', request: current };
  }

  if (nextDecision === 'decline') {
    await client.query(
      `
        update contact_unlock_requests
        set
          status = 'declined',
          declined_at = now(),
          updated_at = now()
        where id = $1
      `,
      [requestId]
    );

    await createContactUnlockEvent(client, {
      requestId,
      actorUserId: userId,
      eventType: 'contact_request_declined',
      detail: { feePolicy: REQUEST_DELIVERY_FEE_POLICY }
    });
    const request = await loadContactUnlockDetailRow(client, requestId, userId);
    return { changed: true, blocked: false, duplicate: false, reason: 'contact_unlock_declined', request };
  }

  const targetContact = await loadTargetContactRow(client, current.target_profile_id);
  if (!targetContact) {
    return { changed: false, blocked: true, reason: 'target_profile_missing', request: current };
  }
  if (!(typeof targetContact.telegram_username_hidden === 'string' && targetContact.telegram_username_hidden.trim())) {
    return { changed: false, blocked: true, reason: 'target_profile_no_hidden_telegram_username', request: current };
  }

  await client.query(
    `
      update contact_unlock_requests
      set
        status = 'revealed',
        approved_at = now(),
        revealed_at = now(),
        revealed_contact_value = $2,
        updated_at = now()
      where id = $1
    `,
    [requestId, targetContact.telegram_username_hidden.trim()]
  );

  await createContactUnlockEvent(client, {
    requestId,
    actorUserId: userId,
    eventType: 'contact_request_approved_and_revealed',
    detail: { feePolicy: REQUEST_DELIVERY_FEE_POLICY }
  });
  const request = await loadContactUnlockDetailRow(client, requestId, userId);
  return { changed: true, blocked: false, duplicate: false, reason: 'contact_unlock_revealed', request };
}

export async function getContactUnlockInboxStateByUserId(client, { userId }) {
  const schema = await ensureContactUnlockSchema(client);
  if (!schema.supported) {
    return {
      counts: {
        receivedPendingApproval: 0,
        receivedTotal: 0,
        sentPendingApproval: 0,
        sentTotal: 0,
        sentRevealed: 0
      },
      received: [],
      sent: [],
      schema_blocked_reason: 'contact_unlock_requires_migrations'
    };
  }

  const contract = contactContractSelects('cur', schema.compat);
  const receivedResult = await client.query(
    `
      select
        cur.id as contact_unlock_request_id,
        cur.status,
        cur.payment_state,
        cur.price_stars_snapshot,
        cur.requested_at,
        cur.approved_at,
        cur.declined_at,
        cur.revealed_at,
        cur.updated_at,
        cur.revealed_contact_value,
        cur.policy_snapshot,
        ${contract.proCovered} as pro_covered,
        ${contract.checkoutAuthorizedAt} as checkout_authorized_at,
        requester_mp.id as profile_id,
        coalesce(nullif(requester_mp.display_name, ''), requester_la.full_name, cur.requester_display_name, 'Unknown member') as display_name,
        coalesce(requester_mp.headline_user, cur.requester_headline_user) as headline_user
      from contact_unlock_requests cur
      left join member_profiles requester_mp on requester_mp.user_id = cur.requester_user_id
      left join linkedin_accounts requester_la on requester_la.user_id = cur.requester_user_id
      where cur.target_user_id = $1
      order by cur.updated_at desc, cur.id desc
      limit 8
    `,
    [userId]
  );

  const sentResult = await client.query(
    `
      select
        cur.id as contact_unlock_request_id,
        cur.status,
        cur.payment_state,
        cur.price_stars_snapshot,
        cur.requested_at,
        cur.approved_at,
        cur.declined_at,
        cur.revealed_at,
        cur.updated_at,
        cur.revealed_contact_value,
        cur.policy_snapshot,
        ${contract.proCovered} as pro_covered,
        ${contract.checkoutAuthorizedAt} as checkout_authorized_at,
        target_mp.id as profile_id,
        coalesce(nullif(target_mp.display_name, ''), target_la.full_name, cur.target_display_name, 'Unknown member') as display_name,
        coalesce(target_mp.headline_user, cur.target_headline_user) as headline_user
      from contact_unlock_requests cur
      left join member_profiles requester_mp on requester_mp.user_id = cur.requester_user_id
      left join linkedin_accounts requester_la on requester_la.user_id = cur.requester_user_id
      left join member_profiles target_mp on target_mp.user_id = cur.target_user_id
      left join linkedin_accounts target_la on target_la.user_id = cur.target_user_id
      where cur.requester_user_id = $1
      order by cur.updated_at desc, cur.id desc
      limit 8
    `,
    [userId]
  );

  const received = (receivedResult.rows || []).map((row) => normalizeUnlockItem(row, 'received'));
  const sent = (sentResult.rows || []).map((row) => normalizeUnlockItem(row, 'sent'));

  return {
    counts: {
      receivedPendingApproval: received.filter((item) => item.status === 'paid_pending_approval').length,
      receivedTotal: received.length,
      sentPendingApproval: sent.filter((item) => item.status === 'paid_pending_approval').length,
      sentTotal: sent.length,
      sentRevealed: sent.filter((item) => item.status === 'revealed').length
    },
    received,
    sent
  };
}

export async function getContactUnlockRequestDetailByUserId(client, { userId, requestId }) {
  const schema = await ensureContactUnlockSchema(client);
  if (!schema.supported) {
    return { request: null, blocked: true, reason: 'contact_unlock_requires_migrations' };
  }

  const row = await loadContactUnlockDetailRow(client, requestId, userId);
  if (!row) {
    return { request: null, blocked: true, reason: 'contact_unlock_request_missing' };
  }

  return {
    request: normalizeUnlockItem(row, row.role),
    blocked: false,
    reason: 'contact_unlock_request_loaded'
  };
}
