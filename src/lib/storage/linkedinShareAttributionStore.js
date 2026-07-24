import crypto from 'node:crypto';
import { isDatabaseConfigured, withDbClient, withDbTransaction } from '../../db/pool.js';
import { getSchemaCompat } from '../../db/schemaCompat.js';
import { upsertTelegramUser } from '../../db/usersRepo.js';
import {
  getActiveLinkedInShareAttributionSession,
  getLinkedInShareSubmittedAttributionByEntity,
  getPublishedLinkedInShareByAttributionToken,
  insertLinkedInShareAttributionEvent,
  upsertLinkedInShareAttributionSession
} from '../../db/linkedinShareAttributionRepo.js';

const ATTRIBUTION_SESSION_TTL_DAYS = 30;
const ATTRIBUTION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const EVENT_TYPES = new Set([
  'profile_opened',
  'contact_request_started',
  'private_chat_request_started',
  'request_submitted',
  'request_approved'
]);
const ENTITY_TYPES = new Set(['intro_request', 'contact_unlock_request', 'dm_thread']);

function unavailable() {
  return { persistenceEnabled: false, recorded: false, reason: 'DATABASE_URL is not configured' };
}

function normalizeUpdateId(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeEntity(entityType, entityId) {
  if (entityType == null && entityId == null) return { entityType: null, entityId: null };
  const normalizedId = Number.parseInt(String(entityId ?? ''), 10);
  if (!ENTITY_TYPES.has(entityType) || !Number.isSafeInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('linkedin_share_attribution_entity_invalid');
  }
  return { entityType, entityId: normalizedId };
}

function buildEventKey({ eventType, shareIntentId, visitorUserId, telegramUpdateId, entityType, entityId }) {
  if (entityType && entityId) {
    return `${eventType}:${entityType}:${entityId}`;
  }
  if (telegramUpdateId) {
    return `${eventType}:share:${shareIntentId}:visitor:${visitorUserId}:update:${telegramUpdateId}`;
  }
  return `${eventType}:share:${shareIntentId}:visitor:${visitorUserId}:nonce:${crypto.randomUUID()}`;
}

async function insertSessionEvent(client, {
  session,
  eventType,
  telegramUpdateId = null,
  entityType = null,
  entityId = null,
  detail = null
}) {
  if (!EVENT_TYPES.has(eventType)) throw new Error('linkedin_share_attribution_event_type_invalid');
  const entity = normalizeEntity(entityType, entityId);
  const updateId = normalizeUpdateId(telegramUpdateId);
  const eventKey = buildEventKey({
    eventType,
    shareIntentId: session.share_intent_id,
    visitorUserId: session.visitor_user_id,
    telegramUpdateId: updateId,
    entityType: entity.entityType,
    entityId: entity.entityId
  });
  const row = await insertLinkedInShareAttributionEvent(client, {
    eventKey,
    shareIntentId: session.share_intent_id,
    profileId: session.profile_id,
    ownerUserId: session.owner_user_id,
    visitorUserId: session.visitor_user_id,
    eventType,
    entityType: entity.entityType,
    entityId: entity.entityId,
    telegramUpdateId: updateId,
    detail
  });
  return { recorded: Boolean(row), duplicate: !row, event: row, eventKey };
}

export async function resolveLinkedInShareAttributionStartForTelegramUser({
  attributionToken,
  telegramUserId,
  telegramUsername = null,
  telegramLanguageCode = null,
  telegramUpdateId = null
}) {
  if (!isDatabaseConfigured()) return unavailable();
  if (!ATTRIBUTION_TOKEN_PATTERN.test(String(attributionToken || ''))) {
    return { persistenceEnabled: true, resolved: false, recorded: false, reason: 'attribution_token_invalid' };
  }

  const resolvedState = await withDbClient(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.linkedInShareHasAttributionToken) {
      return { persistenceEnabled: true, resolved: false, recorded: false, reason: 'migration_038_required' };
    }
    const user = await upsertTelegramUser(client, {
      telegramUserId,
      telegramUsername,
      telegramLanguageCode
    });
    const share = await getPublishedLinkedInShareByAttributionToken(client, attributionToken);
    if (!share) {
      return { persistenceEnabled: true, resolved: false, recorded: false, reason: 'attribution_share_not_found' };
    }
    if (share.profile_state !== 'active' || share.visibility_status !== 'listed') {
      return { persistenceEnabled: true, resolved: false, recorded: false, reason: 'attribution_profile_not_public' };
    }
    return {
      persistenceEnabled: true,
      resolved: true,
      recorded: false,
      profileId: Number(share.profile_id),
      shareIntentId: Number(share.share_intent_id),
      providerPostId: share.provider_post_id || null,
      visitorUserId: Number(user.id),
      ownerUserId: Number(share.owner_user_id),
      reason: 'attribution_profile_resolved'
    };
  });

  if (!resolvedState.resolved) return resolvedState;
  if (String(resolvedState.visitorUserId) === String(resolvedState.ownerUserId)) {
    return { ...resolvedState, reason: 'attribution_self_open_not_counted' };
  }

  try {
    const evidence = await withDbTransaction(async (client) => {
      const compat = await getSchemaCompat(client);
      if (!compat.linkedInShareAttributionReady) {
        return { recorded: false, duplicate: false, reason: 'migration_038_evidence_not_ready' };
      }
      const expiresAt = new Date(Date.now() + ATTRIBUTION_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      const session = await upsertLinkedInShareAttributionSession(client, {
        visitorUserId: resolvedState.visitorUserId,
        shareIntentId: resolvedState.shareIntentId,
        profileId: resolvedState.profileId,
        expiresAt
      });
      const eventResult = await insertSessionEvent(client, {
        session: { ...session, owner_user_id: resolvedState.ownerUserId },
        eventType: 'profile_opened',
        telegramUpdateId,
        detail: { providerPostId: resolvedState.providerPostId }
      });
      return {
        recorded: eventResult.recorded,
        duplicate: eventResult.duplicate,
        reason: eventResult.duplicate ? 'attribution_profile_open_duplicate' : 'attribution_profile_open_recorded'
      };
    });
    return { ...resolvedState, ...evidence };
  } catch (error) {
    console.warn('[linkedin share attribution] profile resolved but evidence was not recorded', error?.message || error);
    return {
      ...resolvedState,
      recorded: false,
      duplicate: false,
      reason: 'attribution_profile_resolved_evidence_failed'
    };
  }
}

export async function recordLinkedInShareAttributionEventForTelegramUser({
  telegramUserId,
  telegramUsername = null,
  targetProfileId,
  eventType,
  telegramUpdateId = null,
  entityType = null,
  entityId = null,
  detail = null
}) {
  if (!isDatabaseConfigured()) return unavailable();
  const profileId = Number.parseInt(String(targetProfileId ?? ''), 10);
  if (!Number.isSafeInteger(profileId) || profileId <= 0) {
    return { persistenceEnabled: true, recorded: false, reason: 'attribution_target_profile_invalid' };
  }

  try {
    return await withDbTransaction(async (client) => {
      const compat = await getSchemaCompat(client);
      if (!compat.linkedInShareAttributionReady) {
        return { persistenceEnabled: true, recorded: false, reason: 'migration_038_required' };
      }
      const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
      const session = await getActiveLinkedInShareAttributionSession(client, {
        visitorUserId: user.id,
        targetProfileId: profileId
      });
      if (!session) {
        return { persistenceEnabled: true, recorded: false, reason: 'attribution_session_not_found' };
      }
      const result = await insertSessionEvent(client, {
        session,
        eventType,
        telegramUpdateId,
        entityType,
        entityId,
        detail
      });
      return {
        persistenceEnabled: true,
        ...result,
        shareIntentId: Number(session.share_intent_id),
        reason: result.duplicate ? 'attribution_event_duplicate' : 'attribution_event_recorded'
      };
    });
  } catch (error) {
    console.warn('[linkedin share attribution] event was not recorded', error?.message || error);
    return {
      persistenceEnabled: true,
      recorded: false,
      duplicate: false,
      reason: 'attribution_event_recording_failed'
    };
  }
}

export async function recordLinkedInShareAttributionApprovalByEntity({
  ownerTelegramUserId,
  entityType,
  entityId,
  telegramUpdateId = null,
  detail = null
}) {
  if (!isDatabaseConfigured()) return unavailable();
  const entity = normalizeEntity(entityType, entityId);

  try {
    return await withDbTransaction(async (client) => {
      const compat = await getSchemaCompat(client);
      if (!compat.linkedInShareAttributionReady) {
        return { persistenceEnabled: true, recorded: false, reason: 'migration_038_required' };
      }
      const source = await getLinkedInShareSubmittedAttributionByEntity(client, {
        entityType: entity.entityType,
        entityId: entity.entityId,
        ownerTelegramUserId
      });
      if (!source) {
        return { persistenceEnabled: true, recorded: false, reason: 'attribution_submission_not_found' };
      }
      const eventKey = buildEventKey({
        eventType: 'request_approved',
        shareIntentId: source.share_intent_id,
        visitorUserId: source.visitor_user_id,
        telegramUpdateId: normalizeUpdateId(telegramUpdateId),
        entityType: entity.entityType,
        entityId: entity.entityId
      });
      const row = await insertLinkedInShareAttributionEvent(client, {
        eventKey,
        shareIntentId: source.share_intent_id,
        profileId: source.profile_id,
        ownerUserId: source.owner_user_id,
        visitorUserId: source.visitor_user_id,
        eventType: 'request_approved',
        entityType: entity.entityType,
        entityId: entity.entityId,
        telegramUpdateId: normalizeUpdateId(telegramUpdateId),
        detail
      });
      return {
        persistenceEnabled: true,
        recorded: Boolean(row),
        duplicate: !row,
        reason: row ? 'attribution_approval_recorded' : 'attribution_event_duplicate'
      };
    });
  } catch (error) {
    console.warn('[linkedin share attribution] approval event was not recorded', error?.message || error);
    return {
      persistenceEnabled: true,
      recorded: false,
      duplicate: false,
      reason: 'attribution_approval_recording_failed'
    };
  }
}
