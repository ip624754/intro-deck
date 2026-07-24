import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import { buildProfileSharePostText } from '../src/lib/linkedin/share.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(['STEP065A1', 'STEP065A2'].includes(CURRENT_SOURCE_STEP));
assert.ok(['0.66.0', '0.67.0'].includes(packageJson.version));

const attributionToken = 'AbCdEfGhIjKlMnOpQrStUv';
const profile = {
  profile_id: 42,
  industry_user: 'Software Development',
  skills: [{ skill_label: 'AI' }, { skill_label: 'Telegram' }, { skill_label: 'Web3' }]
};
const attributedPost = buildProfileSharePostText({
  profileSnapshot: profile,
  botUsername: 'introdeckbot',
  postLanguage: 'en',
  shareAttributionToken: attributionToken
});
assert.match(attributedPost, /https:\/\/t\.me\/introdeckbot\?start=ls_AbCdEfGhIjKlMnOpQrStUv/);
assert.ok(`ls_${attributionToken}`.length <= 64, 'Telegram start payload must stay within the platform limit');
assert.doesNotMatch(attributedPost, /start=profile_42/);

const legacyPost = buildProfileSharePostText({ profileSnapshot: profile, botUsername: 'introdeckbot', postLanguage: 'en' });
assert.match(legacyPost, /start=profile_42/, 'legacy fallback remains supported for callers without an attribution token');

const migration = readFileSync(new URL('../migrations/038_linkedin_profile_share_attribution_foundation.sql', import.meta.url), 'utf8');
for (const token of [
  'attribution_token text',
  'linkedin_share_attribution_sessions',
  'linkedin_share_attribution_events',
  'profile_opened',
  'contact_request_started',
  'private_chat_request_started',
  'request_submitted',
  'request_approved',
  'trg_linkedin_share_attribution_events_immutable',
  'before update or delete',
  'event_key text not null unique'
]) assert.match(migration, new RegExp(token.replaceAll('_', '[_]'), 'i'));
assert.doesNotMatch(migration, /(?:cookie|fingerprint|tracking_pixel)_[a-z0-9_]+/i);

const compatSource = readFileSync(new URL('../src/db/schemaCompat.js', import.meta.url), 'utf8');
for (const token of [
  'linkedInShareHasAttributionToken',
  'hasLinkedInShareAttributionSessionsTable',
  'hasLinkedInShareAttributionEventsTable',
  'linkedInShareAttributionEventsImmutable',
  'linkedInShareAttributionReady'
]) assert.match(compatSource, new RegExp(token));

const repoSource = readFileSync(new URL('../src/db/linkedinShareAttributionRepo.js', import.meta.url), 'utf8');
assert.match(repoSource, /lsi\.status = 'published'/);
assert.match(repoSource, /lsi\.source_kind = 'profile_share'/);
assert.match(repoSource, /lsi\.attribution_revoked_at is null/);
assert.match(repoSource, /s\.profile_id = \$2/);
assert.match(repoSource, /on conflict \(event_key\) do nothing/);

const storeSource = readFileSync(new URL('../src/lib/storage/linkedinShareAttributionStore.js', import.meta.url), 'utf8');
assert.match(storeSource, /ATTRIBUTION_SESSION_TTL_DAYS = 30/);
assert.match(storeSource, /attribution_self_open_not_counted/);
assert.match(storeSource, /attribution_profile_open_recorded/);
assert.match(storeSource, /attribution_session_not_found/);
assert.match(storeSource, /request_approved/);
assert.match(storeSource, /migration_038_required/);

const inviteSource = readFileSync(new URL('../src/bot/composers/inviteComposer.js', import.meta.url), 'utf8');
assert.match(inviteSource, /\^ls_\(\[A-Za-z0-9_-\]\{22\}\)\$/);
assert.match(inviteSource, /resolveLinkedInShareAttributionStartForTelegramUser/);
assert.match(inviteSource, /\^profile_\(\\d\+\)\$/, 'legacy profile links remain supported');

for (const [file, tokens] of Object.entries({
  '../src/bot/composers/directoryComposer.js': ['contact_request_started', 'request_submitted', 'intro_request'],
  '../src/bot/composers/contactUnlockComposer.js': ['contact_request_started', 'request_submitted', 'recordLinkedInShareAttributionApprovalByEntity', 'contact_unlock_request'],
  '../src/bot/composers/dmComposer.js': ['private_chat_request_started', 'request_submitted', 'recordLinkedInShareAttributionApprovalByEntity', 'dm_thread'],
  '../src/bot/composers/textComposer.js': ['request_submitted', 'pro_covered'],
  '../src/bot/composers/introComposer.js': ['recordLinkedInShareAttributionApprovalByEntity', 'intro_request']
})) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  for (const token of tokens) assert.match(source, new RegExp(token));
}

const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
for (const token of [
  'linkedInShareAttributionPolicy',
  "schemaRequirement: 'migration_038'",
  "deepLinkContract: 'ls_128bit_base64url_exact_match'",
  "eventLedger: 'immutable_append_only'",
  'externalTracking: false',
  'browserFingerprinting: false',
  'visitorIdentityOwnerVisible: false',
  'attributionFailureBlocksProductAction: false'
]) assert.match(healthSource, new RegExp(token.replaceAll('.', '\\.')));

assert.match(healthSource, new RegExp(CURRENT_SOURCE_STEP === 'STEP065A2' ? 'dashboardIncluded: true' : 'dashboardIncluded: false'));

assert.equal(readdirSync(new URL('../migrations/', import.meta.url)).some((name) => /^039_/i.test(name)), false);
assert.match(storeSource, /attribution_profile_resolved_evidence_failed/);
assert.match(storeSource, /attribution_event_recording_failed/);
assert.match(storeSource, /attribution_approval_recording_failed/);

console.log('OK: STEP065A1 LinkedIn profile-share attribution foundation');
