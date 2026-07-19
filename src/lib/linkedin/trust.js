const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export const LINKEDIN_TRUST_CATEGORY_IDENTITY = 'IDENTITY';
export const LINKEDIN_TRUST_CATEGORY_WORKPLACE = 'WORKPLACE';

function parseTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function collectCategories(profileSnapshot = {}) {
  const categories = [];
  if (profileSnapshot.linkedin_identity_verified) categories.push(LINKEDIN_TRUST_CATEGORY_IDENTITY);
  if (profileSnapshot.linkedin_workplace_verified) categories.push(LINKEDIN_TRUST_CATEGORY_WORKPLACE);
  return categories;
}

function normalizeMode(value) {
  return ['off', 'development', 'lite'].includes(value) ? value : 'off';
}

export function resolveLinkedInTrustState({
  profileSnapshot = null,
  verificationConfig = null,
  now = Date.now()
} = {}) {
  const snapshot = profileSnapshot || {};
  const config = verificationConfig || {};
  const mode = normalizeMode(config.mode);
  const maxAgeDays = Number.isFinite(Number(config.publicBadgeMaxAgeDays))
    ? Math.max(1, Number(config.publicBadgeMaxAgeDays))
    : 30;
  const syncedAtMs = parseTimestamp(snapshot.linkedin_verification_synced_at);
  const nowMs = Number(now);
  const timestampInFuture = syncedAtMs != null && Number.isFinite(nowMs) && syncedAtMs > nowMs + MAX_FUTURE_SKEW_MS;
  const ageMs = syncedAtMs == null || timestampInFuture ? null : Math.max(0, nowMs - syncedAtMs);
  const ageDays = ageMs == null ? null : ageMs / DAY_MS;
  const isFresh = !timestampInFuture && ageDays != null && ageDays <= maxAgeDays;
  const categories = collectCategories(snapshot);
  const hasVerifiedCategory = categories.length > 0;
  const schemaReady = Boolean(snapshot.linkedin_verification_schema_ready);
  const sourceTier = normalizeMode(snapshot.linkedin_verification_source_tier);

  let snapshotStatus = 'missing';
  if (!schemaReady) {
    snapshotStatus = 'schema_missing';
  } else if (timestampInFuture) {
    snapshotStatus = 'clock_invalid';
  } else if (syncedAtMs != null && !isFresh) {
    snapshotStatus = 'stale';
  } else if (syncedAtMs != null) {
    snapshotStatus = hasVerifiedCategory ? 'fresh_verified' : 'fresh_no_categories';
  }

  const publicBlockReasons = [];
  if (!config.enabled) publicBlockReasons.push('verification_disabled');
  if (mode !== 'lite') publicBlockReasons.push('lite_required');
  if (!config.publicBadgesEnabled) publicBlockReasons.push('feature_flag_disabled');
  if (!schemaReady) publicBlockReasons.push('snapshot_schema_missing');
  if (syncedAtMs == null) publicBlockReasons.push('snapshot_missing');
  if (timestampInFuture) publicBlockReasons.push('snapshot_clock_invalid');
  if (syncedAtMs != null && !timestampInFuture && !isFresh) publicBlockReasons.push('snapshot_stale');
  if (!hasVerifiedCategory) publicBlockReasons.push('no_verified_category');
  if (sourceTier !== 'lite') publicBlockReasons.push('lite_snapshot_required');

  const publicBadgeEligible = publicBlockReasons.length === 0;

  return {
    mode,
    sourceTier,
    maxAgeDays,
    schemaReady,
    snapshotStatus,
    syncedAt: syncedAtMs == null ? null : new Date(syncedAtMs).toISOString(),
    timestampInFuture,
    ageDays: ageDays == null ? null : Math.floor(ageDays * 10) / 10,
    isFresh,
    categories,
    identityVerified: categories.includes(LINKEDIN_TRUST_CATEGORY_IDENTITY),
    workplaceVerified: categories.includes(LINKEDIN_TRUST_CATEGORY_WORKPLACE),
    hasVerifiedCategory,
    verificationState: snapshot.linkedin_verification_state || null,
    verificationUrlOffered: Boolean(snapshot.linkedin_verification_url_offered),
    publicBadgeEligible,
    publicBlockReasons
  };
}

export function buildLinkedInPublicBadgeLines(trustState) {
  if (!trustState?.publicBadgeEligible) return [];

  const lines = [];
  if (trustState.identityVerified) lines.push('🛡 Identity verified on LinkedIn');
  if (trustState.workplaceVerified) lines.push('🛡 Workplace verified on LinkedIn');
  return lines;
}

export function describeLinkedInTrustSnapshotStatus(trustState) {
  switch (trustState?.snapshotStatus) {
    case 'schema_missing':
      return 'snapshot storage unavailable';
    case 'clock_invalid':
      return 'snapshot timestamp is in the future';
    case 'stale':
      return `snapshot stale (older than ${trustState.maxAgeDays} days)`;
    case 'fresh_verified':
      return 'fresh verified-category snapshot';
    case 'fresh_no_categories':
      return 'fresh snapshot with no completed categories';
    case 'missing':
    default:
      return 'no snapshot yet';
  }
}

export function describeLinkedInPublicBadgeGate(trustState) {
  const reason = trustState?.publicBlockReasons?.[0] || null;
  switch (reason) {
    case 'verification_disabled':
      return 'Blocked: Verified on LinkedIn is disabled.';
    case 'lite_required':
      return 'Blocked: LinkedIn Lite approval is required for public badges.';
    case 'feature_flag_disabled':
      return 'Blocked: public badge feature flag is off.';
    case 'snapshot_schema_missing':
      return 'Blocked: verification snapshot storage is unavailable.';
    case 'snapshot_missing':
      return 'Blocked: no successful verification snapshot exists.';
    case 'snapshot_clock_invalid':
      return 'Blocked: snapshot timestamp is ahead of the current clock.';
    case 'snapshot_stale':
      return `Blocked: refresh verification; snapshot is older than ${trustState?.maxAgeDays || 30} days.`;
    case 'no_verified_category':
      return 'Blocked: LinkedIn returned no completed verification category.';
    case 'lite_snapshot_required':
      return 'Blocked: a fresh snapshot created under Lite mode is required.';
    default:
      return trustState?.publicBadgeEligible ? 'Eligible for public display.' : 'Blocked by trust policy.';
  }
}

export function describeLinkedInVerificationSyncReason(reason, error = null) {
  const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : null;
  const code = error?.code ? String(error.code) : null;
  const evidence = [status ? `HTTP ${status}` : null, code ? `code ${code}` : null].filter(Boolean).join(' • ');
  const suffix = evidence ? ` (${evidence})` : '';

  switch (reason) {
    case 'linkedin_verified_timeout':
      return `LinkedIn verification API timed out${suffix}. Retry from Profile.`;
    case 'linkedin_verified_member_id_mismatch':
      return `LinkedIn returned inconsistent member identifiers${suffix}. No snapshot was accepted.`;
    case 'linkedin_verified_token_rejected':
      return `LinkedIn rejected the verification access token${suffix}. Re-authorize from Profile.`;
    case 'linkedin_verified_scope_or_development_admin_required':
      return `LinkedIn denied verification access${suffix}. Confirm the account is an app administrator and the app has r_profile_basicinfo plus r_verify_details or legacy r_verify.`;
    case 'linkedin_verified_rate_limited':
      return `LinkedIn rate limit reached${suffix}. Retry later.`;
    case 'linkedin_verified_provider_unavailable':
      return `LinkedIn verification service is temporarily unavailable${suffix}. Retry later.`;
    case 'linkedin_verified_bad_request_or_version':
      return `LinkedIn rejected the API request${suffix}. Check granted scopes and current LinkedIn-Version values.`;
    case 'linkedin_verified_api_version_deprecated':
      return `LinkedIn requires a newer API version${suffix}. Update the configured LinkedIn-Version.`;
    case 'linkedin_verified_member_unavailable':
      return `LinkedIn could not return verification data for this member${suffix}.`;
    case 'linkedin_verified_access_token_missing':
      return 'LinkedIn verification access token was not returned. Re-authorize from Profile.';
    case 'linkedin_verified_runtime_mode_changed':
      return 'Verification mode changed during authorization. Open a fresh verification link.';
    default:
      return `LinkedIn verification sync was unavailable${suffix}. Your normal LinkedIn connection remains active.`;
  }
}
