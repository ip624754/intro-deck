import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildLinkedInStartUrl,
  renderDirectoryCardText,
  renderProfileMenuKeyboard,
  renderProfileMenuText
} from '../src/lib/telegram/render.js';
import { getLinkedInVerificationConfig } from '../src/config/env.js';
import { normalizeVerifiedOnLinkedInSnapshot, syncVerifiedOnLinkedIn } from '../src/lib/linkedin/verified.js';
import { buildSignedLinkedInLaunchTicket, verifySignedLinkedInLaunchTicket } from '../src/lib/linkedin/oidc.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

process.env.LINKEDIN_VERIFIED_MODE = 'development';
process.env.LINKEDIN_VERIFIED_SCOPES = 'r_profile_basicinfo r_verify';
process.env.LINKEDIN_VERIFIED_IDENTITY_API_VERSION = '202510.03';
process.env.LINKEDIN_VERIFIED_REPORT_API_VERSION = '202510';
process.env.LINKEDIN_VERIFIED_API_TIMEOUT_MS = '8000';
const config = getLinkedInVerificationConfig();
assert.equal(config.mode, 'development');
assert.equal(config.identityApiVersion, '202510.03');
assert.equal(config.reportApiVersion, '202510');
assert.deepEqual(config.scopes, ['r_profile_basicinfo', 'r_verify']);

const { snapshot, verificationUrl } = normalizeVerifiedOnLinkedInSnapshot({
  identityMe: {
    id: 'member-app-scoped-1',
    lastRefreshedAt: 1770000000000,
    basicInfo: {
      firstName: { localized: { en_US: 'Ada' }, preferredLocale: { language: 'en', country: 'US' } },
      lastName: { localized: { en_US: 'Lovelace' }, preferredLocale: { language: 'en', country: 'US' } },
      profileUrl: 'https://www.linkedin.com/in/ada-lovelace'
    }
  },
  verificationReport: {
    id: 'member-app-scoped-1',
    verifications: ['WORKPLACE', 'IDENTITY', 'IDENTITY'],
    verificationUrl: 'https://www.linkedin.com/trust/verification?example=1'
  },
  sourceTier: 'development',
  identityApiVersion: '202510.03',
  reportApiVersion: '202510',
  syncedAt: '2026-07-19T12:00:00.000Z'
});
assert.equal(snapshot.identityVerified, true);
assert.equal(snapshot.workplaceVerified, true);
assert.equal(snapshot.verificationState, 'identity_and_workplace_verified');
assert.deepEqual(snapshot.verificationCategories, ['IDENTITY', 'WORKPLACE']);
assert.equal(verificationUrl.startsWith('https://www.linkedin.com/'), true);

assert.throws(() => normalizeVerifiedOnLinkedInSnapshot({
  identityMe: { id: 'member-a', basicInfo: {} },
  verificationReport: { id: 'member-b', verifications: [] },
  sourceTier: 'development',
  identityApiVersion: '202510.03',
  reportApiVersion: '202510'
}), /member ids do not match/);

const originalFetch = globalThis.fetch;
const apiCalls = [];
globalThis.fetch = async (url, options) => {
  apiCalls.push({ url: String(url), headers: options?.headers || {} });
  const payload = String(url).includes('/identityMe')
    ? { id: 'member-live-1', lastRefreshedAt: 1770000000000, basicInfo: {} }
    : { id: 'member-live-1', verifications: ['IDENTITY'] };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};
try {
  const liveShape = await syncVerifiedOnLinkedIn({
    accessToken: 'test-access-token',
    verificationConfig: config
  });
  assert.equal(liveShape.status, 'success');
  assert.equal(apiCalls.length, 2);
  const identityCall = apiCalls.find((call) => call.url.includes('/identityMe'));
  const reportCall = apiCalls.find((call) => call.url.includes('/verificationReport'));
  assert.equal(identityCall.headers['LinkedIn-Version'], '202510.03');
  assert.equal(reportCall.headers['LinkedIn-Version'], '202510');
  assert.deepEqual(new URL(reportCall.url).searchParams.getAll('verificationCriteria'), ['IDENTITY', 'WORKPLACE']);
  assert.equal(reportCall.url.includes('IDENTITY%2CWORKPLACE'), false);
} finally {
  globalThis.fetch = originalFetch;
}

const profile = {
  linkedin_sub: 'oidc-sub-1',
  linkedin_name: 'Ada Lovelace',
  display_name: 'Ada Lovelace',
  visibility_status: 'hidden',
  profile_state: 'active',
  linkedin_identity_verified: true,
  linkedin_workplace_verified: true,
  linkedin_verification_state: 'identity_and_workplace_verified',
  linkedin_verification_source_tier: 'development',
  linkedin_verification_synced_at: '2026-07-19T12:00:00.000Z',
  linkedin_verification_schema_ready: true,
  completion: {
    isReady: true,
    requiredFilledCount: 5,
    requiredCount: 5,
    hasRequiredSkills: true
  },
  skills: [{ skill_slug: 'product', skill_label: 'Product' }]
};

const privateText = renderProfileMenuText({
  persistenceEnabled: true,
  profileSnapshot: profile,
  linkedinVerificationAccess: { enabled: true, mode: 'development' }
});
for (const fragment of [
  'Verified on LinkedIn • Development testing',
  'Private trust status. Development data is not shown as a public badge.',
  'Snapshot: fresh verified-category snapshot',
  'Identity: confirmed by LinkedIn',
  'Workplace: confirmed by LinkedIn',
  'Public badge: Blocked: LinkedIn Lite approval is required for public badges.',
  'Role, company, skills, bio, and experience remain member-provided.'
]) {
  assert.equal(privateText.includes(fragment), true, `private verification surface missing: ${fragment}`);
}

const launchSecret = '12345678901234567890123456789012';
const launchTicket = buildSignedLinkedInLaunchTicket({
  telegramUserId: 123456,
  purpose: 'verification_refresh',
  secret: launchSecret
});
assert.equal(verifySignedLinkedInLaunchTicket(launchTicket, launchSecret).telegramUserId, '123456');
assert.throws(() => verifySignedLinkedInLaunchTicket(buildSignedLinkedInLaunchTicket({
  telegramUserId: 123456,
  purpose: 'verification_refresh',
  ttlSeconds: -1,
  secret: launchSecret
}), launchSecret), /Expired or invalid/);

const privateKeyboard = renderProfileMenuKeyboard({
  appBaseUrl: 'https://intro-deck.vercel.app',
  telegramUserId: 123456,
  persistenceEnabled: true,
  profileSnapshot: profile,
  linkedinVerificationAccess: { enabled: true, mode: 'development' },
  linkedinVerificationLaunchTicket: launchTicket
});
const refreshButton = privateKeyboard.inline_keyboard.flat().find((button) => button.text === '🛡 Refresh LinkedIn verification');
assert.ok(refreshButton?.url);
assert.equal(new URL(refreshButton.url).searchParams.get('purpose'), 'verification_refresh');
assert.equal(new URL(refreshButton.url).searchParams.get('ticket'), launchTicket);

const normalStartUrl = new URL(buildLinkedInStartUrl({
  appBaseUrl: 'https://intro-deck.vercel.app',
  telegramUserId: 123456
}));
assert.equal(normalStartUrl.searchParams.has('purpose'), false);

const publicCard = renderDirectoryCardText({
  persistenceEnabled: true,
  profileSnapshot: {
    ...profile,
    profile_id: 1,
    headline_user: 'Founder',
    company_user: 'Analytical Engines',
    city_user: 'London',
    industry_user: 'Technology',
    about_user: 'Building products',
    visibility_status: 'listed',
    contact_mode: 'intro_request'
  }
});
for (const forbidden of ['Identity verified', 'Workplace verified', 'Verified on LinkedIn']) {
  assert.equal(publicCard.includes(forbidden), false, `STEP058A must not expose public badge copy: ${forbidden}`);
}

const envSource = read('src/config/env.js');
const startSource = read('api/oauth/start/linkedin.js');
const callbackSource = read('api/oauth/callback/linkedin.js');
const storageSource = read('src/lib/storage/linkedinIdentityStore.js');
const migration = read('migrations/028_linkedin_verified_development.sql');
const verificationRepo = read('src/db/linkedinVerificationRepo.js');
const profileRepo = read('src/db/profileRepo.js');
const privacy = read('privacy/index.html');
const terms = read('terms/index.html');
const health = read('api/health.js');

for (const scope of ['r_profile_basicinfo', 'r_verify']) {
  assert.equal(envSource.includes(scope), true, `missing required scope ${scope}`);
}
assert.equal(startSource.includes("verificationConfig.mode === 'development' && isOperatorTelegramUser(telegramUserId)"), true);
assert.equal(startSource.includes("purpose === 'verification_refresh'"), true);
assert.equal(startSource.includes('verifySignedLinkedInLaunchTicket'), true);
assert.equal(startSource.includes('Verification link expired'), true);
assert.equal(callbackSource.includes('syncVerifiedOnLinkedIn'), true);
assert.equal(callbackSource.includes('Your normal LinkedIn connection remains active.'), true);
assert.equal(storageSource.includes('sanitizeTokenPayload'), true);
assert.equal(storageSource.includes("has_access_token: Boolean(rawTokenPayload.access_token)"), true);
assert.equal(storageSource.includes('access_token: rawTokenPayload.access_token'), false);
assert.equal(storageSource.includes("const savepoint = 'linkedin_verification_optional'"), true);
assert.equal(storageSource.includes('rollback to savepoint'), true);
assert.equal(/verification_url\s+(?:text|varchar|character varying)/i.test(verificationRepo), false, 'single-use verification URL must not be persisted');
for (const forbiddenColumn of ['government_id', 'legal_name', 'verification_method', 'profile_url text', 'profile_first_name text', 'profile_last_name text']) {
  assert.equal(migration.includes(forbiddenColumn), false, `migration must not persist ${forbiddenColumn}`);
}
for (const required of [
  'linkedin_verification_snapshots',
  'idx_linkedin_verification_api_member',
  'identity_api_version',
  'report_api_version',
  "- 'access_token'",
  "- 'refresh_token'",
  "- 'id_token'"
]) {
  assert.equal(migration.includes(required), true, `migration missing ${required}`);
}
assert.equal(profileRepo.includes('buildLinkedInVerificationSnapshotSql'), true);
assert.equal(health.includes('identityApiVersion: linkedInVerification.identityApiVersion'), true);
assert.equal(health.includes('reportApiVersion: linkedInVerification.reportApiVersion'), true);
assert.equal(privacy.includes('category-level verification result'), true);
assert.equal(privacy.includes('access tokens, refresh tokens, and ID tokens are not retained'), true);
assert.equal(terms.includes('not a background check'), true);
assert.equal(terms.includes('employment screening tool'), true);
assert.equal(['STEP058A', 'STEP058B', 'STEP058B1', 'STEP059', 'STEP060', 'STEP061', 'STEP061H1', 'STEP061A', 'STEP063A', 'STEP063A-H1', 'STEP063A-H1A', 'STEP063B', 'STEP063B-H1', 'STEP063B-H1R1', 'STEP063B-H2', 'STEP064A', 'STEP064B1', 'STEP064B2', 'STEP064B3', 'STEP064B4A', 'STEP064B4B', 'STEP064B4C', 'STEP064B4C1', 'STEP064B4D1'].includes(CURRENT_SOURCE_STEP), true);

console.log('OK: STEP058A Verified on LinkedIn Development integration contract');
