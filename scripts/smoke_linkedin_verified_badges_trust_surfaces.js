import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getLinkedInVerificationConfig } from '../src/config/env.js';
import {
  buildLinkedInPublicBadgeLines,
  describeLinkedInPublicBadgeGate,
  describeLinkedInVerificationSyncReason,
  resolveLinkedInTrustState
} from '../src/lib/linkedin/trust.js';
import {
  renderDirectoryCardText,
  renderHelpText,
  renderProfileMenuText,
  renderProfilePreviewText
} from '../src/lib/telegram/render.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function withVerificationEnv(values, fn) {
  const keys = [
    'LINKEDIN_VERIFIED_MODE',
    'LINKEDIN_VERIFIED_SCOPES',
    'LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED',
    'LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS',
    'LINKEDIN_VERIFIED_IDENTITY_API_VERSION',
    'LINKEDIN_VERIFIED_REPORT_API_VERSION'
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const baseProfile = {
  linkedin_sub: 'oidc-sub-058b',
  linkedin_name: 'Ada Lovelace',
  display_name: 'Ada Lovelace',
  profile_id: 58,
  headline_user: 'Founder',
  company_user: 'Analytical Engines',
  city_user: 'London',
  industry_user: 'Technology',
  about_user: 'Building analytical products.',
  visibility_status: 'listed',
  contact_mode: 'intro_request',
  profile_state: 'active',
  linkedin_identity_verified: true,
  linkedin_workplace_verified: true,
  linkedin_verification_state: 'identity_and_workplace_verified',
  linkedin_verification_source_tier: 'development',
  linkedin_verification_synced_at: '2026-07-19T12:00:00.000Z',
  linkedin_verification_schema_ready: true,
  skills: [{ skill_slug: 'product', skill_label: 'Product' }],
  completion: {
    isReady: true,
    requiredFilledCount: 5,
    requiredCount: 5,
    hasRequiredSkills: true
  }
};

const developmentConfig = withVerificationEnv({
  LINKEDIN_VERIFIED_MODE: 'development',
  LINKEDIN_VERIFIED_SCOPES: 'r_profile_basicinfo r_verify',
  LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED: '1',
  LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS: '30',
  LINKEDIN_VERIFIED_IDENTITY_API_VERSION: '202510.03',
  LINKEDIN_VERIFIED_REPORT_API_VERSION: '202510'
}, () => getLinkedInVerificationConfig());

assert.equal(developmentConfig.verificationScope, 'r_verify');
assert.equal(developmentConfig.publicBadgeRequested, true);
assert.equal(developmentConfig.publicBadgesEnabled, false, 'Development mode must never enable public badges');

const legacyScopeConfig = withVerificationEnv({
  LINKEDIN_VERIFIED_MODE: 'development',
  LINKEDIN_VERIFIED_SCOPES: 'r_profile_basicinfo r_verify',
  LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED: '0'
}, () => getLinkedInVerificationConfig());
assert.equal(legacyScopeConfig.verificationScope, 'r_verify');

const devTrust = resolveLinkedInTrustState({
  profileSnapshot: baseProfile,
  verificationConfig: developmentConfig,
  now: Date.parse('2026-07-20T12:00:00.000Z')
});
assert.equal(devTrust.hasVerifiedCategory, true);
assert.equal(devTrust.publicBadgeEligible, false);
assert.equal(devTrust.publicBlockReasons.includes('lite_required'), true);
assert.equal(buildLinkedInPublicBadgeLines(devTrust).length, 0);
assert.match(describeLinkedInPublicBadgeGate(devTrust), /Lite approval/);

const liteConfigFlagOff = {
  ...developmentConfig,
  mode: 'lite',
  enabled: true,
  publicBadgeRequested: false,
  publicBadgesEnabled: false
};
const liteFlagOffTrust = resolveLinkedInTrustState({
  profileSnapshot: { ...baseProfile, linkedin_verification_source_tier: 'lite' },
  verificationConfig: liteConfigFlagOff,
  now: Date.parse('2026-07-20T12:00:00.000Z')
});
assert.equal(liteFlagOffTrust.publicBadgeEligible, false);
assert.equal(liteFlagOffTrust.publicBlockReasons.includes('feature_flag_disabled'), true);

const liteConfig = {
  ...liteConfigFlagOff,
  publicBadgeRequested: true,
  publicBadgesEnabled: true,
  publicBadgeMaxAgeDays: 30
};
const liteProfile = {
  ...baseProfile,
  linkedin_verification_source_tier: 'lite',
  linkedin_verification_synced_at: '2026-07-19T12:00:00.000Z'
};
const eligibleTrust = resolveLinkedInTrustState({
  profileSnapshot: liteProfile,
  verificationConfig: liteConfig,
  now: Date.parse('2026-07-20T12:00:00.000Z')
});
assert.equal(eligibleTrust.publicBadgeEligible, true);
assert.deepEqual(buildLinkedInPublicBadgeLines(eligibleTrust), [
  '🛡 Identity verified on LinkedIn',
  '🛡 Workplace verified on LinkedIn'
]);

const staleTrust = resolveLinkedInTrustState({
  profileSnapshot: {
    ...liteProfile,
    linkedin_verification_synced_at: '2026-05-01T12:00:00.000Z'
  },
  verificationConfig: liteConfig,
  now: Date.parse('2026-07-20T12:00:00.000Z')
});
assert.equal(staleTrust.publicBadgeEligible, false);
assert.equal(staleTrust.publicBlockReasons.includes('snapshot_stale'), true);

const futureTrust = resolveLinkedInTrustState({
  profileSnapshot: {
    ...liteProfile,
    linkedin_verification_synced_at: '2026-07-20T12:10:01.000Z'
  },
  verificationConfig: liteConfig,
  now: Date.parse('2026-07-20T12:00:00.000Z')
});
assert.equal(futureTrust.publicBadgeEligible, false);
assert.equal(futureTrust.snapshotStatus, 'clock_invalid');
assert.equal(futureTrust.publicBlockReasons.includes('snapshot_clock_invalid'), true);
assert.match(describeLinkedInPublicBadgeGate(futureTrust), /timestamp is ahead/);

const developmentDirectory = renderDirectoryCardText({
  persistenceEnabled: true,
  profileSnapshot: baseProfile,
  linkedinVerificationConfig: developmentConfig
});
assert.equal(developmentDirectory.includes('Identity verified on LinkedIn'), false);
assert.equal(developmentDirectory.includes('Workplace verified on LinkedIn'), false);

const liteDirectory = renderDirectoryCardText({
  persistenceEnabled: true,
  profileSnapshot: liteProfile,
  linkedinVerificationConfig: liteConfig
});
for (const fragment of [
  'Identity verified on LinkedIn',
  'Workplace verified on LinkedIn',
  'Role, company, skills, and expertise remain member-provided.'
]) {
  assert.equal(liteDirectory.includes(fragment), true, `public trust surface missing: ${fragment}`);
}

const privatePreview = renderProfilePreviewText({
  persistenceEnabled: true,
  profileSnapshot: baseProfile,
  linkedinVerificationConfig: developmentConfig
});
for (const fragment of [
  '🧪 Private badge preview',
  'Identity verified on LinkedIn',
  'Workplace verified on LinkedIn',
  'LinkedIn Lite approval is required for public badges',
  'Professional card details remain member-provided.'
]) {
  assert.equal(privatePreview.includes(fragment), true, `private preview missing: ${fragment}`);
}

const privateMenu = renderProfileMenuText({
  persistenceEnabled: true,
  profileSnapshot: baseProfile,
  linkedinVerificationAccess: developmentConfig
});
for (const fragment of [
  'Verified on LinkedIn • Development testing',
  'Development data is not shown as a public badge',
  'Snapshot: fresh verified-category snapshot',
  'Public badge: Blocked: LinkedIn Lite approval is required for public badges.'
]) {
  assert.equal(privateMenu.includes(fragment), true, `owner trust panel missing: ${fragment}`);
}

const help = renderHelpText();
assert.equal(help.includes('LinkedIn confirms the connected account.'), true);
assert.equal(help.includes('You provide your role, company, skills, and bio.'), true);
assert.equal(help.includes('Public badges require LinkedIn Lite mode'), false);

assert.match(
  describeLinkedInVerificationSyncReason('linkedin_verified_bad_request_or_version', {
    status: 400,
    code: 'BAD_REQUEST'
  }),
  /HTTP 400.*granted scopes.*LinkedIn-Version/
);
assert.match(
  describeLinkedInVerificationSyncReason('linkedin_verified_api_version_deprecated', {
    status: 426
  }),
  /newer API version/
);

const health = read('api/health.js');
const env = read('src/config/env.js');
const callback = read('api/oauth/callback/linkedin.js');
const directoryRepo = read('src/db/directoryRepo.js');
const profileRepo = read('src/db/profileRepo.js');
const adminSurface = read('src/bot/surfaces/adminSurfaces.js');
const privacy = read('privacy/index.html');
const terms = read('terms/index.html');
const landing = read('index.html');

for (const required of [
  'r_verify',
  'LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED',
  'LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS',
  "mode === 'lite' && publicBadgeRequested"
]) {
  assert.equal(env.includes(required), true, `env contract missing: ${required}`);
}
for (const required of [
  'publicBadgeRequested',
  'publicBadgeMaxAgeDays',
  "publicBadgePolicy: 'lite_plus_explicit_flag_plus_fresh_lite_snapshot'"
]) {
  assert.equal(health.includes(required), true, `health trust contract missing: ${required}`);
}
assert.equal(callback.includes('describeLinkedInVerificationSyncReason'), true);
assert.equal(callback.includes('Failed API:'), true);
assert.equal(directoryRepo.includes('buildLinkedInVerificationSnapshotSql'), true);
assert.equal(profileRepo.includes('buildLinkedInVerificationSnapshotSql'), true);
assert.equal(adminSurface.includes('Доверие LinkedIn: личность'), true);
assert.equal(privacy.includes('fresh Lite snapshot'), true);
assert.equal(terms.includes('Public verification badges may be shown only'), true);
assert.equal(landing.includes('LinkedIn verification categories'), true);
assert.equal(['STEP058B', 'STEP058B1', 'STEP059', 'STEP060', 'STEP061', 'STEP061H1', 'STEP061A', 'STEP063A', 'STEP063A-H1', 'STEP063A-H1A', 'STEP063B', 'STEP063B-H1', 'STEP063B-H1R1', 'STEP063B-H2', 'STEP064A', 'STEP064B1', 'STEP064B2', 'STEP064B3', 'STEP064B4A', 'STEP064B4B', 'STEP064B4C', 'STEP064B4C1', 'STEP064B4D1', 'STEP064B4D1A'].includes(CURRENT_SOURCE_STEP), true);

console.log('OK: STEP058B Verified badges and trust surfaces contract');
