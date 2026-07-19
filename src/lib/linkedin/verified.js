const VERIFIED_CATEGORY_IDENTITY = 'IDENTITY';
const VERIFIED_CATEGORY_WORKPLACE = 'WORKPLACE';
const ALLOWED_VERIFICATION_CATEGORIES = new Set([
  VERIFIED_CATEGORY_IDENTITY,
  VERIFIED_CATEGORY_WORKPLACE
]);

export class LinkedInVerifiedApiError extends Error {
  constructor(message, { status = null, code = null, payload = null } = {}) {
    super(message);
    this.name = 'LinkedInVerifiedApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function normalizeTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  const date = new Date(numeric);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeVerificationCategories(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item) => ALLOWED_VERIFICATION_CATEGORIES.has(item)))]
    .sort();
}

function determineVerificationState({ categories, verificationUrl }) {
  const hasIdentity = categories.includes(VERIFIED_CATEGORY_IDENTITY);
  const hasWorkplace = categories.includes(VERIFIED_CATEGORY_WORKPLACE);

  if (hasIdentity && hasWorkplace) {
    return 'identity_and_workplace_verified';
  }
  if (hasIdentity || hasWorkplace) {
    return 'category_verified';
  }
  if (verificationUrl) {
    return 'verification_available';
  }
  return 'no_category_or_url';
}

async function fetchLinkedInRestJson({ endpoint, accessToken, apiVersion, timeoutMs }) {
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      'LinkedIn-Version': apiVersion,
      'X-Restli-Protocol-Version': '2.0.0'
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const serviceCode = payload?.serviceErrorCode || payload?.status || null;
    throw new LinkedInVerifiedApiError(
      `LinkedIn Verified API request failed: ${response.status}`,
      {
        status: response.status,
        code: serviceCode ? String(serviceCode) : null,
        payload
      }
    );
  }

  return payload;
}

export async function fetchLinkedInIdentityMe({ accessToken, apiVersion, timeoutMs }) {
  return fetchLinkedInRestJson({
    endpoint: 'https://api.linkedin.com/rest/identityMe',
    accessToken,
    apiVersion,
    timeoutMs
  });
}

export async function fetchLinkedInVerificationReport({ accessToken, apiVersion, timeoutMs }) {
  const endpoint = new URL('https://api.linkedin.com/rest/verificationReport');
  endpoint.searchParams.append('verificationCriteria', VERIFIED_CATEGORY_IDENTITY);
  endpoint.searchParams.append('verificationCriteria', VERIFIED_CATEGORY_WORKPLACE);

  return fetchLinkedInRestJson({
    endpoint: endpoint.toString(),
    accessToken,
    apiVersion,
    timeoutMs
  });
}

export function normalizeVerifiedOnLinkedInSnapshot({
  identityMe,
  verificationReport,
  sourceTier,
  identityApiVersion,
  reportApiVersion,
  syncedAt = new Date().toISOString()
}) {
  const identityMemberId = typeof identityMe?.id === 'string' ? identityMe.id.trim() : '';
  const verificationMemberId = typeof verificationReport?.id === 'string' ? verificationReport.id.trim() : '';

  if (!identityMemberId || !verificationMemberId) {
    throw new LinkedInVerifiedApiError('LinkedIn Verified API response is missing the app-scoped member id', {
      code: 'MISSING_MEMBER_ID'
    });
  }

  if (identityMemberId !== verificationMemberId) {
    throw new LinkedInVerifiedApiError('LinkedIn Verified API member ids do not match', {
      code: 'MEMBER_ID_MISMATCH'
    });
  }

  const categories = normalizeVerificationCategories(verificationReport?.verifications);
  const verificationUrl = typeof verificationReport?.verificationUrl === 'string' && verificationReport.verificationUrl.trim()
    ? verificationReport.verificationUrl.trim()
    : null;
  const snapshot = {
    apiMemberId: identityMemberId,
    verificationCategories: categories,
    identityVerified: categories.includes(VERIFIED_CATEGORY_IDENTITY),
    workplaceVerified: categories.includes(VERIFIED_CATEGORY_WORKPLACE),
    verificationState: determineVerificationState({ categories, verificationUrl }),
    verificationUrlOffered: Boolean(verificationUrl),
    sourceTier,
    identityApiVersion,
    reportApiVersion,
    profileLastRefreshedAt: normalizeTimestamp(identityMe?.lastRefreshedAt),
    syncedAt
  };

  return {
    snapshot,
    verificationUrl
  };
}

function classifyUnavailableReason(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return 'linkedin_verified_timeout';
  }
  if (error?.code === 'MEMBER_ID_MISMATCH') {
    return 'linkedin_verified_member_id_mismatch';
  }
  if (error?.status === 401) {
    return 'linkedin_verified_token_rejected';
  }
  if (error?.status === 403) {
    return 'linkedin_verified_scope_or_development_admin_required';
  }
  if (error?.status === 429) {
    return 'linkedin_verified_rate_limited';
  }
  if (Number(error?.status) >= 500) {
    return 'linkedin_verified_provider_unavailable';
  }
  return 'linkedin_verified_sync_failed';
}

export async function syncVerifiedOnLinkedIn({ accessToken, verificationConfig }) {
  if (!verificationConfig?.enabled) {
    return {
      requested: false,
      status: 'disabled',
      reason: 'linkedin_verified_mode_off',
      snapshot: null,
      verificationUrl: null
    };
  }

  if (!accessToken) {
    return {
      requested: true,
      status: 'unavailable',
      reason: 'linkedin_verified_access_token_missing',
      snapshot: null,
      verificationUrl: null
    };
  }

  try {
    const [identityMe, verificationReport] = await Promise.all([
      fetchLinkedInIdentityMe({
        accessToken,
        apiVersion: verificationConfig.identityApiVersion,
        timeoutMs: verificationConfig.timeoutMs
      }),
      fetchLinkedInVerificationReport({
        accessToken,
        apiVersion: verificationConfig.reportApiVersion,
        timeoutMs: verificationConfig.timeoutMs
      })
    ]);

    const normalized = normalizeVerifiedOnLinkedInSnapshot({
      identityMe,
      verificationReport,
      sourceTier: verificationConfig.mode,
      identityApiVersion: verificationConfig.identityApiVersion,
      reportApiVersion: verificationConfig.reportApiVersion
    });

    return {
      requested: true,
      status: 'success',
      reason: 'linkedin_verified_snapshot_fetched',
      snapshot: normalized.snapshot,
      verificationUrl: normalized.verificationUrl
    };
  } catch (error) {
    return {
      requested: true,
      status: 'unavailable',
      reason: classifyUnavailableReason(error),
      snapshot: null,
      verificationUrl: null,
      error: {
        name: error?.name || 'Error',
        status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
        code: error?.code || null,
        message: error?.message || String(error)
      }
    };
  }
}

export function buildVerificationSnapshotSummary(snapshot) {
  if (!snapshot) {
    return 'Verification snapshot not available';
  }

  const categories = [];
  if (snapshot.identityVerified) categories.push('identity');
  if (snapshot.workplaceVerified) categories.push('workplace');

  return categories.length
    ? `Verified on LinkedIn: ${categories.join(' + ')}`
    : `Verified on LinkedIn: no completed verification categories (${snapshot.verificationState})`;
}
