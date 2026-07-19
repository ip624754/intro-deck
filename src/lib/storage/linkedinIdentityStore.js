import { withDbTransaction, isDatabaseConfigured } from '../../db/pool.js';
import { upsertTelegramUser } from '../../db/usersRepo.js';
import {
  deleteLinkedInAccountByUserId,
  getLinkedInAccountBySub,
  getLinkedInAccountByUserId,
  refreshLinkedInAccountBySub,
  upsertLinkedInAccount
} from '../../db/linkedinRepo.js';
import { ensureProfileDraft, getProfileSnapshotByUserId, hideProfileListingByUserId } from '../../db/profileRepo.js';
import { createAdminAuditEvent } from '../../db/adminRepo.js';
import { getSchemaCompat } from '../../db/schemaCompat.js';
import { upsertLinkedInVerificationSnapshot } from '../../db/linkedinVerificationRepo.js';
import { maybeCreatePendingInviteRewardForActivationWithClient } from './inviteStore.js';

function sanitizeTokenPayload(rawTokenPayload) {
  if (!rawTokenPayload || typeof rawTokenPayload !== 'object') {
    return null;
  }

  return {
    token_type: rawTokenPayload.token_type || null,
    expires_in: Number.isFinite(Number(rawTokenPayload.expires_in)) ? Number(rawTokenPayload.expires_in) : null,
    refresh_token_expires_in: Number.isFinite(Number(rawTokenPayload.refresh_token_expires_in))
      ? Number(rawTokenPayload.refresh_token_expires_in)
      : null,
    scope: rawTokenPayload.scope || null,
    has_access_token: Boolean(rawTokenPayload.access_token),
    has_refresh_token: Boolean(rawTokenPayload.refresh_token),
    has_id_token: Boolean(rawTokenPayload.id_token)
  };
}

function buildRawIdentityPayload({ identity, rawTokenPayload, rawUserInfo, source = 'linkedin_oidc' }) {
  return {
    source,
    identity,
    token: sanitizeTokenPayload(rawTokenPayload),
    userinfo: rawUserInfo || null
  };
}

async function persistVerificationEvidenceWithinSavepoint(client, {
  userId,
  linkedinAccount,
  verificationSnapshot = null,
  verificationSync = null
}) {
  if (!verificationSync?.requested) {
    return {
      persisted: false,
      status: verificationSync?.status || 'not_requested',
      reason: verificationSync?.reason || 'linkedin_verified_not_requested'
    };
  }

  const compat = await getSchemaCompat(client);
  if (!compat.hasLinkedInVerificationSnapshotsTable) {
    await createAdminAuditEvent(client, {
      eventType: 'linkedin_verification_migration_required',
      actorUserId: userId,
      targetUserId: userId,
      summary: 'Verified on LinkedIn snapshot could not be stored because migration 028 is missing.',
      detail: {
        syncStatus: verificationSync.status || null,
        syncReason: verificationSync.reason || null
      }
    });
    return {
      persisted: false,
      status: 'blocked',
      reason: 'migration_028_required'
    };
  }

  if (!verificationSnapshot) {
    await createAdminAuditEvent(client, {
      eventType: 'linkedin_verification_sync_unavailable',
      actorUserId: userId,
      targetUserId: userId,
      summary: 'Verified on LinkedIn synchronization was unavailable; previous trust snapshot was not overwritten.',
      detail: {
        syncStatus: verificationSync.status || null,
        syncReason: verificationSync.reason || null,
        errorStatus: verificationSync.error?.status || null,
        errorCode: verificationSync.error?.code || null,
        failedEndpoint: verificationSync.error?.endpoint || null,
        requestId: verificationSync.error?.requestId || null,
        requestAttempt: verificationSync.error?.attempt || null,
        compatibilityFallbackAttempted: Boolean(verificationSync.error?.compatibilityFallbackAttempted)
      }
    });
    return {
      persisted: false,
      status: verificationSync.status || 'unavailable',
      reason: verificationSync.reason || 'linkedin_verified_sync_unavailable'
    };
  }

  const row = await upsertLinkedInVerificationSnapshot(client, {
    linkedinAccountId: linkedinAccount.id,
    snapshot: verificationSnapshot
  });

  await createAdminAuditEvent(client, {
    eventType: 'linkedin_verification_snapshot_synced',
    actorUserId: userId,
    targetUserId: userId,
    summary: 'Verified on LinkedIn category snapshot synchronized.',
    detail: {
      sourceTier: verificationSnapshot.sourceTier,
      identityApiVersion: verificationSnapshot.identityApiVersion,
      reportApiVersion: verificationSnapshot.reportApiVersion,
      verificationState: verificationSnapshot.verificationState,
      identityVerified: verificationSnapshot.identityVerified,
      workplaceVerified: verificationSnapshot.workplaceVerified,
      verificationUrlOffered: verificationSnapshot.verificationUrlOffered,
      syncedAt: verificationSnapshot.syncedAt,
      verificationReportStrategy: verificationSync.diagnostics?.verificationReportStrategy || null,
      compatibilityFallbackAttempted: Boolean(verificationSync.diagnostics?.fallbackAttempted),
      requestId: verificationSync.diagnostics?.requestId || null
    }
  });

  return {
    persisted: true,
    status: 'success',
    reason: 'linkedin_verified_snapshot_persisted',
    snapshot: row
  };
}

async function persistVerificationEvidence(client, input) {
  const savepoint = 'linkedin_verification_optional';
  await client.query(`savepoint ${savepoint}`);
  try {
    const result = await persistVerificationEvidenceWithinSavepoint(client, input);
    await client.query(`release savepoint ${savepoint}`);
    return result;
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    await client.query(`release savepoint ${savepoint}`);
    console.warn('[linkedin verification] optional persistence rolled back', {
      userId: input?.userId || null,
      error: error?.message || String(error)
    });
    return {
      persisted: false,
      status: 'unavailable',
      reason: 'linkedin_verification_optional_persistence_failed',
      error: {
        code: error?.code || null
      }
    };
  }
}

function hasNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function collectIdentityImportedFields(identity = {}) {
  const imported = [];
  if (hasNonEmptyText(identity.linkedinSub)) imported.push('linkedin_sub');
  if (hasNonEmptyText(identity.name)) imported.push('full_name');
  if (hasNonEmptyText(identity.givenName)) imported.push('given_name');
  if (hasNonEmptyText(identity.familyName)) imported.push('family_name');
  if (hasNonEmptyText(identity.pictureUrl)) imported.push('picture_url');
  if (hasNonEmptyText(identity.locale)) imported.push('locale');
  if (hasNonEmptyText(identity.email)) imported.push('email');
  return imported;
}

function buildProfileSeedMeta({ beforeProfile, afterProfile, identity }) {
  const expectedDisplayName = typeof identity?.name === 'string' && identity.name.trim()
    ? identity.name.trim()
    : [identity?.givenName, identity?.familyName].filter((part) => typeof part === 'string' && part.trim()).join(' ').trim() || null;

  const beforeDisplayName = hasNonEmptyText(beforeProfile?.display_name);
  const afterDisplayName = hasNonEmptyText(afterProfile?.display_name) ? afterProfile.display_name.trim() : null;
  const displayNameSeeded = !beforeDisplayName && Boolean(expectedDisplayName) && afterDisplayName === expectedDisplayName;

  return {
    displayNameSeeded,
    seededFields: displayNameSeeded ? ['display_name'] : []
  };
}

export async function persistLinkedInIdentity({
  telegramUserId,
  telegramUsername = null,
  identity,
  rawTokenPayload,
  rawUserInfo,
  verificationSnapshot = null,
  verificationSync = null,
  transferMode = 'detect'
}) {
  if (!identity?.linkedinSub) {
    throw new Error('Cannot persist LinkedIn identity without linkedinSub');
  }

  if (!isDatabaseConfigured()) {
    return {
      persisted: false,
      reason: 'DATABASE_URL is not configured',
      telegramUserId,
      identity
    };
  }

  return withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, {
      telegramUserId,
      telegramUsername
    });

    const rawIdentityPayload = buildRawIdentityPayload({
      identity,
      rawTokenPayload,
      rawUserInfo,
      source: transferMode === 'confirm' ? 'linkedin_oidc_transfer_confirmed' : 'linkedin_oidc'
    });

    const identityImportedFields = collectIdentityImportedFields(identity);
    const existingBySub = await getLinkedInAccountBySub(client, identity.linkedinSub);

    if (existingBySub && String(existingBySub.user_id) !== String(user.id)) {
      if (transferMode !== 'confirm') {
        return {
          persisted: false,
          reason: 'LINKEDIN_TRANSFER_REQUIRED',
          transferRequired: true,
          user,
          identity,
          identityImportedFields,
          conflict: {
            linkedinSub: existingBySub.linkedin_sub,
            fullName: existingBySub.full_name,
            previousUserId: existingBySub.user_id,
            previousTelegramUserId: existingBySub.telegram_user_id,
            previousTelegramUsername: existingBySub.telegram_username
          }
        };
      }

      const existingByTargetUser = await getLinkedInAccountByUserId(client, user.id);
      if (existingByTargetUser && existingByTargetUser.linkedin_sub !== identity.linkedinSub) {
        await deleteLinkedInAccountByUserId(client, user.id);
      }

      const profileBeforeSeed = await getProfileSnapshotByUserId(client, user.id);
      await hideProfileListingByUserId(client, existingBySub.user_id);

      const linkedinAccount = await refreshLinkedInAccountBySub(client, {
        linkedinSub: identity.linkedinSub,
        userId: user.id,
        identity,
        rawIdentityPayload
      });

      const profileDraft = await ensureProfileDraft(client, {
        userId: user.id,
        identity
      });
      const profileSeed = buildProfileSeedMeta({
        beforeProfile: profileBeforeSeed,
        afterProfile: profileDraft,
        identity
      });
      const inviteRewardResult = await maybeCreatePendingInviteRewardForActivationWithClient(client, { userId: user.id });
      const verificationPersistence = await persistVerificationEvidence(client, {
        userId: user.id,
        linkedinAccount,
        verificationSnapshot,
        verificationSync
      });

      await createAdminAuditEvent(client, {
        eventType: 'linkedin_relink_transferred',
        actorUserId: user.id,
        targetUserId: user.id,
        secondaryTargetUserId: existingBySub.user_id,
        summary: 'LinkedIn connection moved to a new Telegram account.',
        detail: {
          linkedinSub: identity.linkedinSub,
          fullName: identity.name || existingBySub.full_name || null,
          previousTelegramUserId: existingBySub.telegram_user_id || null,
          previousTelegramUsername: existingBySub.telegram_username || null,
          newTelegramUserId: telegramUserId,
          newTelegramUsername: telegramUsername || null,
          identityImportedFields,
          profileSeed,
          inviteRewardResult
        }
      });

      return {
        persisted: true,
        transferred: true,
        reason: 'LinkedIn identity moved to the new Telegram account',
        user,
        linkedinAccount,
        profileDraft,
        profileSeed,
        identityImportedFields,
        inviteRewardResult,
        verificationPersistence,
        previousOwner: {
          userId: existingBySub.user_id,
          telegramUserId: existingBySub.telegram_user_id,
          telegramUsername: existingBySub.telegram_username,
          fullName: existingBySub.full_name
        }
      };
    }

    const profileBeforeSeed = await getProfileSnapshotByUserId(client, user.id);

    const linkedinAccount = existingBySub
      ? await refreshLinkedInAccountBySub(client, {
          linkedinSub: identity.linkedinSub,
          userId: user.id,
          identity,
          rawIdentityPayload
        })
      : await upsertLinkedInAccount(client, {
          userId: user.id,
          identity,
          rawIdentityPayload
        });

    const profileDraft = await ensureProfileDraft(client, {
      userId: user.id,
      identity
    });
    const profileSeed = buildProfileSeedMeta({
      beforeProfile: profileBeforeSeed,
      afterProfile: profileDraft,
      identity
    });
    const inviteRewardResult = await maybeCreatePendingInviteRewardForActivationWithClient(client, { userId: user.id });
    const verificationPersistence = await persistVerificationEvidence(client, {
      userId: user.id,
      linkedinAccount,
      verificationSnapshot,
      verificationSync
    });

    return {
      persisted: true,
      reason: existingBySub
        ? 'LinkedIn identity refreshed and profile draft ensured'
        : 'LinkedIn identity persisted and profile draft ensured',
      user,
      linkedinAccount,
      profileDraft,
      profileSeed,
      identityImportedFields,
      inviteRewardResult,
      verificationPersistence
    };
  });
}
