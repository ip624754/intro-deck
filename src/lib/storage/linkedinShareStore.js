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
import {
  markAiNewsDraftPublishedByShareIntent,
  markAiNewsDraftShareFailed,
  reopenAiNewsDraftAfterShareCancel
} from '../../db/aiNewsRepo.js';
import { getSchemaCompat } from '../../db/schemaCompat.js';
import { buildProfileSharePostText, LinkedInShareApiError, publishLinkedInTextPost } from '../linkedin/share.js';
import { publishProfileShareWithOptionalImage } from '../linkedin/profileShareMedia.js';

function requirePersistence() {
  if (!isDatabaseConfigured()) {
    return { persistenceEnabled: false, reason: 'DATABASE_URL is not configured' };
  }
  return null;
}

async function persistProviderSuccessAsUnknownBestEffort({ claim, claimToken, provider, failureReason }) {
  try {
    return await withDbTransaction(async (client) => {
      const row = await markLinkedInShareOutcomeUnknownAfterProviderSuccess(client, {
        shareIntentId: claim.intent.id,
        claimToken,
        providerPostId: provider.postId,
        providerRequestId: provider.requestId,
        providerHttpStatus: provider.httpStatus,
        failureReason
      });
      if (row && claim.intent.source_kind === 'ai_news_draft') {
        await markAiNewsDraftShareFailed(client, { shareIntentId: claim.intent.id, outcomeUnknown: true });
      }
      return row;
    });
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

export async function createLinkedInTextShareIntentWithClient(client, {
  telegramUserId,
  telegramUsername = null,
  postText,
  visibility,
  ttlSeconds,
  sourceKind = 'profile_share',
  sourceRefId = null,
  sourceSnapshotHash = null,
  attributionToken = null
}) {
    const compat = await getSchemaCompat(client);
    if (!compat.hasLinkedInShareIntentsTable || !compat.hasLinkedInShareEventsTable) {
      return { persistenceEnabled: true, created: false, reason: 'migration_029_required' };
    }
    if (sourceKind === 'ai_news_draft' && (!compat.linkedInShareHasSourceKind || !compat.hasAiNewsDraftsTable)) {
      return { persistenceEnabled: true, created: false, reason: 'migration_030_required' };
    }
    if (sourceKind === 'profile_share' && !compat.linkedInShareAttributionReady) {
      return { persistenceEnabled: true, created: false, reason: 'migration_038_required' };
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
    const unresolvedResult = await client.query(
      `select * from linkedin_share_intents
       where user_id=$1 and status in ('draft','authorization_started','publishing','unknown')
       order by created_at desc limit 1 for update`,
      [user.id]
    );
    const unresolvedIntent = unresolvedResult.rows[0] || null;
    if (sourceKind === 'profile_share' && unresolvedIntent?.source_kind === 'ai_news_draft') {
      return {
        persistenceEnabled: true,
        created: false,
        reason: unresolvedIntent.status === 'unknown'
          ? 'linkedin_share_previous_outcome_unknown'
          : 'ai_news_share_pending',
        intent: unresolvedIntent
      };
    }
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

    const publicToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (ttlSeconds * 1000));
    const intent = await createLinkedInShareIntent(client, {
      publicToken,
      userId: user.id,
      linkedinAccountId: linkedinAccount.id,
      profileId: profile.profile_id,
      postText,
      visibility,
      expiresAt,
      sourceKind,
      sourceRefId,
      sourceSnapshotHash,
      attributionToken,
      attributionReady: compat.linkedInShareAttributionReady
    });

    await createAdminAuditEvent(client, {
      eventType: sourceKind === 'ai_news_draft' ? 'ai_news_linkedin_share_draft_created' : 'linkedin_profile_share_draft_created',
      actorUserId: user.id,
      targetUserId: user.id,
      summary: sourceKind === 'ai_news_draft'
        ? 'Member approved an evidence-bound AI news draft for LinkedIn authorization.'
        : 'Member created a LinkedIn profile-share draft.',
      detail: { shareIntentId: intent.id, visibility, expiresAt: expiresAt.toISOString(), sourceKind, sourceRefId }
    });

    return { persistenceEnabled: true, created: true, reason: 'share_draft_created', intent, profile };
}

export async function createLinkedInTextShareIntentForTelegramUser(args) {
  const unavailable = requirePersistence();
  if (unavailable) return unavailable;
  return withDbTransaction(async (client) => createLinkedInTextShareIntentWithClient(client, args));
}

export async function createProfileShareDraftForTelegramUser({
  telegramUserId,
  telegramUsername = null,
  botUsername,
  postLanguage = 'en',
  visibility,
  ttlSeconds
}) {
  const unavailable = requirePersistence();
  if (unavailable) return unavailable;
  const profileResult = await withDbClient(async (client) => getProfileSnapshotByTelegramUserId(client, telegramUserId));
  if (!profileResult?.linkedin_sub) return { persistenceEnabled: true, created: false, reason: 'linkedin_not_connected' };
  const attributionToken = crypto.randomBytes(16).toString('base64url');
  const postText = buildProfileSharePostText({
    profileSnapshot: profileResult,
    botUsername,
    postLanguage,
    shareAttributionToken: attributionToken
  });
  return createLinkedInTextShareIntentForTelegramUser({
    telegramUserId,
    telegramUsername,
    postText,
    visibility,
    ttlSeconds,
    sourceKind: 'profile_share',
    attributionToken
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
    const result = await markLinkedInShareAuthorizationStarted(client, { publicToken, telegramUserId });
    if (!result.ok && result.reason === 'share_intent_expired' && result.intent?.source_kind === 'ai_news_draft') {
      await reopenAiNewsDraftAfterShareCancel(client, { shareIntentId: result.intent.id, reason: 'expired' });
    }
    return { persistenceEnabled: true, ...result };
  });
}

export async function cancelLinkedInShareForTelegramUser({ publicToken, telegramUserId }) {
  const unavailable = requirePersistence();
  if (unavailable) return unavailable;
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasLinkedInShareIntentsTable || !compat.hasLinkedInShareEventsTable) return { persistenceEnabled: true, changed: false, reason: 'migration_029_required' };
    const result = await cancelLinkedInShareIntent(client, { publicToken, telegramUserId });
    if (result.changed && result.intent?.source_kind === 'ai_news_draft') {
      await reopenAiNewsDraftAfterShareCancel(client, { shareIntentId: result.intent.id, reason: 'cancelled' });
    }
    return { persistenceEnabled: true, ...result };
  });
}

export async function publishLinkedInShareForOAuthCallback({
  publicToken,
  telegramUserId,
  linkedinSub,
  accessToken,
  shareConfig,
  postLanguage = 'en',
  publishImpl = publishLinkedInTextPost,
  publishProfileWithMediaImpl = publishProfileShareWithOptionalImage
}) {
  const unavailable = requirePersistence();
  if (unavailable) return unavailable;

  const claimToken = crypto.randomUUID();
  const claim = await withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasLinkedInShareIntentsTable || !compat.hasLinkedInShareEventsTable) return { claimed: false, reason: 'migration_029_required' };
    const result = await claimLinkedInShareIntent(client, {
      publicToken,
      telegramUserId,
      linkedinSub,
      claimToken,
      staleAfterSeconds: shareConfig.claimTimeoutSeconds
    });
    if (!result.claimed && result.reason === 'share_intent_expired' && result.intent?.source_kind === 'ai_news_draft') {
      await reopenAiNewsDraftAfterShareCancel(client, { shareIntentId: result.intent.id, reason: 'expired' });
    }
    return result;
  });

  if (!claim.claimed) {
    return { persistenceEnabled: true, ...claim };
  }

  let provider;
  try {
    provider = claim.intent.source_kind === 'profile_share'
      ? await publishProfileWithMediaImpl({
          accessToken,
          authorId: linkedinSub,
          commentary: claim.intent.post_text,
          visibility: claim.intent.visibility,
          postLanguage,
          apiVersion: shareConfig.postsApiVersion,
          timeoutMs: shareConfig.timeoutMs,
          publishImpl
        })
      : await publishImpl({
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
      if (row && claim.intent.source_kind === 'ai_news_draft') {
        await markAiNewsDraftShareFailed(client, { shareIntentId: claim.intent.id, outcomeUnknown });
      }
      if (row) {
        const isAiNewsDraft = claim.intent.source_kind === 'ai_news_draft';
        await createAdminAuditEvent(client, {
          eventType: isAiNewsDraft
            ? (outcomeUnknown ? 'ai_news_linkedin_share_outcome_unknown' : 'ai_news_linkedin_share_failed')
            : (outcomeUnknown ? 'linkedin_profile_share_outcome_unknown' : 'linkedin_profile_share_failed'),
          actorUserId: claim.intent.user_id,
          targetUserId: claim.intent.user_id,
          summary: isAiNewsDraft
            ? (outcomeUnknown
              ? 'AI/news LinkedIn share outcome is unknown; automatic retry is blocked.'
              : 'AI/news LinkedIn share attempt failed.')
            : (outcomeUnknown
              ? 'LinkedIn profile-share outcome is unknown; automatic retry is blocked.'
              : 'LinkedIn profile-share attempt failed.'),
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
    published = await withDbTransaction(async (client) => {
      const row = await finalizeLinkedInSharePublished(client, {
        shareIntentId: claim.intent.id,
        claimToken,
        providerPostId: provider.postId,
        providerRequestId: provider.requestId,
        providerHttpStatus: provider.httpStatus
      });
      if (row && claim.intent.source_kind === 'ai_news_draft') {
        await markAiNewsDraftPublishedByShareIntent(client, { shareIntentId: claim.intent.id });
      }
      return row;
    });
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
    await withDbTransaction(async (client) => {
      const isAiNewsDraft = claim.intent.source_kind === 'ai_news_draft';
      return createAdminAuditEvent(client, {
      eventType: isAiNewsDraft ? 'ai_news_linkedin_share_published' : 'linkedin_profile_share_published',
      actorUserId: claim.intent.user_id,
      targetUserId: claim.intent.user_id,
      summary: isAiNewsDraft
        ? 'Member explicitly published an evidence-bound AI/news draft on LinkedIn.'
        : 'Member explicitly published a profile share on LinkedIn.',
      detail: {
        shareIntentId: claim.intent.id,
        providerPostId: provider.postId,
        providerRequestId: provider.requestId,
        visibility: claim.intent.visibility,
        sourceKind: claim.intent.source_kind,
        sourceRefId: claim.intent.source_ref_id,
        mediaAttached: Boolean(provider.mediaAttached),
        mediaId: provider.mediaId || null,
        mediaLanguage: provider.mediaLanguage || null,
        mediaFallbackReason: provider.mediaFallbackReason || null
      }
      });
    });
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
