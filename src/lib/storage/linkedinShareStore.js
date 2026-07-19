import crypto from 'node:crypto';
import { isDatabaseConfigured, withDbClient, withDbTransaction } from '../../db/pool.js';
import { upsertTelegramUser } from '../../db/usersRepo.js';
import { getProfileSnapshotByTelegramUserId } from '../../db/profileRepo.js';
import { getLinkedInAccountByUserId } from '../../db/linkedinRepo.js';
import {
  acquireLinkedInShareUserLock,
  cancelLinkedInShareIntent,
  claimLinkedInShareIntent,
  createLinkedInShareIntent,
  finalizeLinkedInShareFailed,
  finalizeLinkedInSharePublished,
  getBlockingLinkedInShareIntentForUser,
  getLinkedInShareIntentByToken,
  markLinkedInShareAuthorizationStarted,
  markLinkedInShareOutcomeUnknownAfterProviderSuccess
} from '../../db/linkedinShareRepo.js';
import { createAdminAuditEvent } from '../../db/adminRepo.js';
import { getSchemaCompat } from '../../db/schemaCompat.js';
import { buildProfileSharePostText, LinkedInShareApiError, publishLinkedInTextPost } from '../linkedin/share.js';

function requirePersistence() {
  if (!isDatabaseConfigured()) {
    return { persistenceEnabled: false, reason: 'DATABASE_URL is not configured' };
  }
  return null;
}

async function persistProviderSuccessAsUnknownBestEffort({ claim, claimToken, provider, failureReason }) {
  try {
    return await withDbTransaction(async (client) => markLinkedInShareOutcomeUnknownAfterProviderSuccess(client, {
      shareIntentId: claim.intent.id,
      claimToken,
      providerPostId: provider.postId,
      providerRequestId: provider.requestId,
      providerHttpStatus: provider.httpStatus,
      failureReason
    }));
  } catch (error) {
    console.error('[linkedin share] could not persist provider-success unknown state', {
      shareIntentId: claim.intent.id,
      providerPostId: provider.postId,
      providerRequestId: provider.requestId,
      failureReason,
      error: error?.message || String(error)
    });
    return null;
  }
}

export async function createProfileShareDraftForTelegramUser({
  telegramUserId,
  telegramUsername = null,
  botUsername,
  visibility,
  ttlSeconds
}) {
  const unavailable = requirePersistence();
  if (unavailable) return unavailable;

  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasLinkedInShareIntentsTable || !compat.hasLinkedInShareEventsTable) {
      return { persistenceEnabled: true, created: false, reason: 'migration_029_required' };
    }
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const profile = await getProfileSnapshotByTelegramUserId(client, telegramUserId);
    if (!profile?.linkedin_sub) return { persistenceEnabled: true, created: false, reason: 'linkedin_not_connected' };
    if (profile.profile_state !== 'active' || profile.visibility_status !== 'listed') {
      return { persistenceEnabled: true, created: false, reason: 'share_profile_not_listed', profile };
    }
    const linkedinAccount = await getLinkedInAccountByUserId(client, user.id);
    if (!linkedinAccount) return { persistenceEnabled: true, created: false, reason: 'linkedin_account_missing' };

    await acquireLinkedInShareUserLock(client, user.id);
    const blockingIntent = await getBlockingLinkedInShareIntentForUser(client, user.id);
    if (blockingIntent) {
      return {
        persistenceEnabled: true,
        created: false,
        reason: blockingIntent.status === 'unknown'
          ? 'linkedin_share_previous_outcome_unknown'
          : 'linkedin_share_publish_in_progress',
        intent: blockingIntent
      };
    }

    const postText = buildProfileSharePostText({ profileSnapshot: profile, botUsername });
    const publicToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (ttlSeconds * 1000));
    const intent = await createLinkedInShareIntent(client, {
      publicToken,
      userId: user.id,
      linkedinAccountId: linkedinAccount.id,
      profileId: profile.profile_id,
      postText,
      visibility,
      expiresAt
    });

    await createAdminAuditEvent(client, {
      eventType: 'linkedin_profile_share_draft_created',
      actorUserId: user.id,
      targetUserId: user.id,
      summary: 'Member created a LinkedIn profile-share draft.',
      detail: { shareIntentId: intent.id, visibility, expiresAt: expiresAt.toISOString() }
    });

    return { persistenceEnabled: true, created: true, reason: 'share_draft_created', intent, profile };
  });
}

export async function loadLinkedInShareIntentForTelegramUser({ publicToken, telegramUserId }) {
  const unavailable = requirePersistence();
  if (unavailable) return unavailable;
  return withDbClient(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasLinkedInShareIntentsTable || !compat.hasLinkedInShareEventsTable) return { persistenceEnabled: true, intent: null, reason: 'migration_029_required' };
    const intent = await getLinkedInShareIntentByToken(client, publicToken);
    if (!intent) return { persistenceEnabled: true, intent: null, reason: 'share_intent_not_found' };
    if (String(intent.telegram_user_id) !== String(telegramUserId)) {
      return { persistenceEnabled: true, intent: null, reason: 'share_intent_owner_mismatch' };
    }
    return { persistenceEnabled: true, intent, reason: 'share_intent_loaded' };
  });
}

export async function markLinkedInShareAuthorizationForTelegramUser({ publicToken, telegramUserId }) {
  const unavailable = requirePersistence();
  if (unavailable) return unavailable;
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasLinkedInShareIntentsTable || !compat.hasLinkedInShareEventsTable) return { persistenceEnabled: true, ok: false, reason: 'migration_029_required' };
    return {
      persistenceEnabled: true,
        ...(await markLinkedInShareAuthorizationStarted(client, { publicToken, telegramUserId }))
    };
  });
}

export async function cancelLinkedInShareForTelegramUser({ publicToken, telegramUserId }) {
  const unavailable = requirePersistence();
  if (unavailable) return unavailable;
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasLinkedInShareIntentsTable || !compat.hasLinkedInShareEventsTable) return { persistenceEnabled: true, changed: false, reason: 'migration_029_required' };
    return {
      persistenceEnabled: true,
        ...(await cancelLinkedInShareIntent(client, { publicToken, telegramUserId }))
    };
  });
}

export async function publishLinkedInShareForOAuthCallback({
  publicToken,
  telegramUserId,
  linkedinSub,
  accessToken,
  shareConfig,
  publishImpl = publishLinkedInTextPost
}) {
  const unavailable = requirePersistence();
  if (unavailable) return unavailable;

  const claimToken = crypto.randomUUID();
  const claim = await withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasLinkedInShareIntentsTable || !compat.hasLinkedInShareEventsTable) return { claimed: false, reason: 'migration_029_required' };
    return claimLinkedInShareIntent(client, {
      publicToken,
      telegramUserId,
      linkedinSub,
      claimToken,
      staleAfterSeconds: shareConfig.claimTimeoutSeconds
    });
  });

  if (!claim.claimed) {
    return { persistenceEnabled: true, ...claim };
  }

  let provider;
  try {
    provider = await publishImpl({
      accessToken,
      authorId: linkedinSub,
      commentary: claim.intent.post_text,
      visibility: claim.intent.visibility,
      apiVersion: shareConfig.postsApiVersion,
      timeoutMs: shareConfig.timeoutMs
    });
  } catch (error) {
    const isProviderError = error instanceof LinkedInShareApiError;
    const outcomeUnknown = Boolean(isProviderError && error.outcomeUnknown);
    const finalStatus = outcomeUnknown ? 'unknown' : 'failed';
    const finalized = await withDbTransaction(async (client) => {
      const row = await finalizeLinkedInShareFailed(client, {
        shareIntentId: claim.intent.id,
        claimToken,
        status: finalStatus,
        providerRequestId: isProviderError ? error.requestId : null,
        providerHttpStatus: isProviderError ? error.status : null,
        providerErrorCode: isProviderError && error.code != null ? String(error.code) : null,
        failureReason: isProviderError ? error.message : 'linkedin_share_internal_error'
      });
      if (row) {
        await createAdminAuditEvent(client, {
          eventType: outcomeUnknown ? 'linkedin_profile_share_outcome_unknown' : 'linkedin_profile_share_failed',
          actorUserId: claim.intent.user_id,
          targetUserId: claim.intent.user_id,
          summary: outcomeUnknown
            ? 'LinkedIn profile-share outcome is unknown; automatic retry is blocked.'
            : 'LinkedIn profile-share attempt failed.',
          detail: {
            shareIntentId: claim.intent.id,
            providerRequestId: isProviderError ? error.requestId : null,
            providerHttpStatus: isProviderError ? error.status : null,
            providerErrorCode: isProviderError && error.code != null ? String(error.code) : null
          }
        });
      }
      return row;
    });

    return {
      persistenceEnabled: true,
      published: false,
      outcomeUnknown,
      reason: outcomeUnknown ? 'linkedin_share_outcome_unknown' : 'linkedin_share_failed',
      intent: finalized,
      error: {
        status: isProviderError ? error.status : null,
        code: isProviderError ? error.code : null,
        requestId: isProviderError ? error.requestId : null,
        message: error?.message || String(error)
      }
    };
  }

  // From this point LinkedIn has returned a concrete post id. Never downgrade the
  // intent to retryable `failed` if local receipt persistence or audit logging fails.
  // A retry after an external success could create a duplicate LinkedIn post.
  let published;
  try {
    published = await withDbTransaction(async (client) => finalizeLinkedInSharePublished(client, {
      shareIntentId: claim.intent.id,
      claimToken,
      providerPostId: provider.postId,
      providerRequestId: provider.requestId,
      providerHttpStatus: provider.httpStatus
    }));
  } catch (error) {
    console.error('[linkedin share] provider published but receipt persistence failed', {
      shareIntentId: claim.intent.id,
      providerPostId: provider.postId,
      providerRequestId: provider.requestId,
      error: error?.message || String(error)
    });
    const unknownIntent = await persistProviderSuccessAsUnknownBestEffort({
      claim,
      claimToken,
      provider,
      failureReason: 'linkedin_share_receipt_persistence_failed'
    });
    return {
      persistenceEnabled: true,
      published: false,
      outcomeUnknown: true,
      reason: 'linkedin_share_receipt_persistence_failed',
      intent: unknownIntent || { ...claim.intent, status: 'publishing' },
      provider,
      error: {
        status: null,
        code: 'linkedin_share_receipt_persistence_failed',
        requestId: provider.requestId,
        message: 'LinkedIn returned a post id, but Intro Deck could not persist the final receipt. Automatic retry is blocked.'
      }
    };
  }

  if (!published) {
    const unknownIntent = await persistProviderSuccessAsUnknownBestEffort({
      claim,
      claimToken,
      provider,
      failureReason: 'linkedin_share_claim_lost_after_provider_success'
    });
    return {
      persistenceEnabled: true,
      published: false,
      outcomeUnknown: true,
      reason: 'linkedin_share_claim_lost_after_provider_success',
      intent: unknownIntent || { ...claim.intent, status: 'publishing' },
      provider,
      error: {
        status: null,
        code: 'linkedin_share_claim_lost_after_provider_success',
        requestId: provider.requestId,
        message: 'LinkedIn returned a post id, but the local publish claim could not be finalized. Automatic retry is blocked.'
      }
    };
  }

  // Audit is deliberately best-effort after the durable publication receipt. An
  // audit insert must never roll back a confirmed provider post receipt.
  try {
    await withDbTransaction(async (client) => createAdminAuditEvent(client, {
      eventType: 'linkedin_profile_share_published',
      actorUserId: claim.intent.user_id,
      targetUserId: claim.intent.user_id,
      summary: 'Member explicitly published a profile share on LinkedIn.',
      detail: {
        shareIntentId: claim.intent.id,
        providerPostId: provider.postId,
        providerRequestId: provider.requestId,
        visibility: claim.intent.visibility
      }
    }));
  } catch (auditError) {
    console.warn('[linkedin share] published receipt saved; audit insert skipped', {
      shareIntentId: claim.intent.id,
      providerPostId: provider.postId,
      error: auditError?.message || String(auditError)
    });
  }

  return {
    persistenceEnabled: true,
    published: true,
    reason: 'linkedin_share_published',
    intent: published,
    provider
  };
}
