import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildProfileSharePostText,
  LinkedInShareApiError,
  publishLinkedInTextPost
} from '../src/lib/linkedin/share.js';
import {
  buildSignedLinkedInLaunchTicket,
  buildSignedState,
  verifySignedLinkedInLaunchTicket,
  verifySignedState
} from '../src/lib/linkedin/oidc.js';
import {
  renderLinkedInSharePreviewKeyboard,
  renderLinkedInSharePreviewText,
  renderProfilePreviewKeyboard
} from '../src/lib/telegram/render.js';
import { getLinkedInShareConfig } from '../src/config/env.js';
import { computeProfileCompletion } from '../src/lib/profile/contract.js';

const root = process.cwd();
const secret = 'x'.repeat(64);
const shareToken = '11111111-2222-4333-8444-555555555555';

const profile = {
  linkedin_sub: 'member-sub',
  linkedin_name: 'Rustam Lukmanov',
  profile_id: 42,
  display_name: 'Rustam Lukmanov',
  headline_user: 'Founder building permission-based professional networking',
  company_user: 'Intro Deck',
  industry_user: 'Technology',
  about_user: 'Building useful products.',
  visibility_status: 'listed',
  profile_state: 'active',
  skills: [
    { skill_slug: 'product', skill_label: 'Product' },
    { skill_slug: 'dev', skill_label: 'Development' }
  ]
};
profile.completion = computeProfileCompletion(profile);

const postText = buildProfileSharePostText({ profileSnapshot: profile, botUsername: '@introdeckbot' });
assert.match(postText, /I’ve published my professional profile on Intro Deck/);
assert.match(postText, /Rustam Lukmanov/);
assert.match(postText, /permission-based professional directory/);
assert.match(postText, /private contact details stay hidden until the profile owner approves/);
assert.match(postText, /https:\/\/t\.me\/introdeckbot\?start=profile_42/);
assert.ok(postText.length <= 3000);

let capturedRequest = null;
const successFetch = async (url, options) => {
  capturedRequest = { url, options };
  return {
    ok: true,
    status: 201,
    headers: new Headers({
      'x-restli-id': 'urn:li:share:123',
      'x-restli-request-id': 'request-123'
    }),
    json: async () => ({})
  };
};

const published = await publishLinkedInTextPost({
  accessToken: 'secret-token-for-test',
  authorId: 'member-sub',
  commentary: postText,
  visibility: 'PUBLIC',
  apiVersion: '202606',
  fetchImpl: successFetch
});
assert.equal(published.postId, 'urn:li:share:123');
assert.equal(capturedRequest.url, 'https://api.linkedin.com/rest/posts');
assert.equal(capturedRequest.options.headers['linkedin-version'], '202606');
assert.equal(capturedRequest.options.headers.authorization, 'Bearer secret-token-for-test');
const requestBody = JSON.parse(capturedRequest.options.body);
assert.equal(requestBody.author, 'urn:li:person:member-sub');
assert.equal(requestBody.commentary, postText);
assert.equal(requestBody.lifecycleState, 'PUBLISHED');
assert.equal(requestBody.visibility, 'PUBLIC');

for (const [status, unknown] of [[400, false], [500, true]]) {
  await assert.rejects(
    () => publishLinkedInTextPost({
      accessToken: 'token',
      authorId: 'member-sub',
      commentary: postText,
      visibility: 'PUBLIC',
      apiVersion: '202606',
      fetchImpl: async () => ({
        ok: false,
        status,
        headers: new Headers({ 'x-restli-request-id': `req-${status}` }),
        json: async () => ({ serviceErrorCode: status })
      })
    }),
    (error) => error instanceof LinkedInShareApiError
      && error.status === status
      && error.outcomeUnknown === unknown
      && error.requestId === `req-${status}`
  );
}

const launchTicket = buildSignedLinkedInLaunchTicket({
  telegramUserId: 123,
  purpose: 'share_profile',
  shareIntentToken: shareToken,
  secret
});
const launchPayload = verifySignedLinkedInLaunchTicket(launchTicket, secret);
assert.equal(launchPayload.purpose, 'share_profile');
assert.equal(launchPayload.shareIntentToken, shareToken);

const state = buildSignedState({
  telegramUserId: 123,
  purpose: 'share_profile',
  shareRequested: true,
  shareIntentToken: shareToken,
  ttlSeconds: 600,
  secret
});
const statePayload = verifySignedState(state, secret);
assert.equal(statePayload.purpose, 'share_profile');
assert.equal(statePayload.shareRequested, true);
assert.equal(statePayload.shareIntentToken, shareToken);

const previewText = renderLinkedInSharePreviewText({
  intent: { post_text: postText, visibility: 'PUBLIC' }
});
assert.match(previewText, /Nothing is published (?:until|yet)/);
assert.match(previewText, /One approval can create at most one provider post/);
assert.match(previewText, /does not store the OAuth access token/);
const previewKeyboard = renderLinkedInSharePreviewKeyboard({
  publishUrl: 'https://example.com/oauth',
  publicToken: shareToken
});
assert.equal(previewKeyboard.inline_keyboard[0][0].url, 'https://example.com/oauth');
assert.equal(previewKeyboard.inline_keyboard[1][0].callback_data, `li:share:cancel:${shareToken}`);

const listedKeyboard = renderProfilePreviewKeyboard({
  profileSnapshot: profile,
  persistenceEnabled: true,
  linkedinShareConfig: { enabled: true }
});
assert.ok(listedKeyboard.inline_keyboard.flat().some((button) => button.callback_data === 'li:share:start'));
const hiddenKeyboard = renderProfilePreviewKeyboard({
  profileSnapshot: { ...profile, visibility_status: 'hidden' },
  persistenceEnabled: true,
  linkedinShareConfig: { enabled: true }
});
assert.ok(!hiddenKeyboard.inline_keyboard.flat().some((button) => button.callback_data === 'li:share:start'));

const previousEnv = { ...process.env };
try {
  process.env.LINKEDIN_SHARE_MODE = 'live';
  process.env.LINKEDIN_SHARE_SCOPES = 'openid';
  const invalid = getLinkedInShareConfig();
  assert.equal(invalid.enabled, false);
  assert.equal(invalid.configurationValid, false);
  assert.equal(invalid.configurationError.code, 'linkedin_share_config_invalid');

  process.env.LINKEDIN_SHARE_SCOPES = 'w_member_social';
  process.env.LINKEDIN_SHARE_POSTS_API_VERSION = '202606';
  const valid = getLinkedInShareConfig({ strict: true });
  assert.equal(valid.enabled, true);
  assert.equal(valid.configurationValid, true);
  assert.equal(valid.explicitApprovalRequired, true);
  assert.equal(valid.tokenPersistence, 'none');
} finally {
  process.env = previousEnv;
}

const migration = fs.readFileSync(path.join(root, 'migrations/029_linkedin_share_profile.sql'), 'utf8');
assert.match(migration, /create table if not exists linkedin_share_intents/);
assert.match(migration, /status in \('draft', 'authorization_started', 'publishing', 'published', 'failed', 'unknown', 'cancelled', 'expired'\)/);
assert.match(migration, /unique index if not exists uq_linkedin_share_provider_post/);
assert.match(migration, /unique index if not exists uq_linkedin_share_user_unresolved/);
assert.doesNotMatch(migration, /access_token|refresh_token|id_token/i);

const healthSource = fs.readFileSync(path.join(root, 'api/health.js'), 'utf8');
assert.match(healthSource, /explicitApprovalRequired: true/);
assert.match(healthSource, /tokenPersistence: 'none'/);
assert.match(healthSource, /automaticPublishing: false/);
const composerSource = fs.readFileSync(path.join(root, 'src/bot/composers/linkedinShareComposer.js'), 'utf8');
assert.match(composerSource, /composer\.command\('share'/);
assert.match(composerSource, /Approve and publish on LinkedIn|renderLinkedInSharePreviewKeyboard/);
const privacySource = fs.readFileSync(path.join(root, 'privacy/index.html'), 'utf8');
assert.match(privacySource, /Nothing is published automatically or in the background/);
assert.match(privacySource, /OAuth access token used for the approved post is not stored/);
const termsSource = fs.readFileSync(path.join(root, 'terms/index.html'), 'utf8');
assert.match(termsSource, /Publication requires the member to open LinkedIn and explicitly approve that one share/);
const landingSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(landingSource, /Can I share my profile on LinkedIn/);
assert.match(landingSource, /Nothing is published until you explicitly authorize that one share/);

const callbackSource = fs.readFileSync(path.join(root, 'api/oauth/callback/linkedin.js'), 'utf8');
assert.match(callbackSource, /publishLinkedInShareForOAuthCallback/);
assert.match(callbackSource, /statePayload\.shareRequested/);
assert.match(callbackSource, /Automatic retry is blocked to prevent a duplicate post/);
const shareStoreSource = fs.readFileSync(path.join(root, 'src/lib/storage/linkedinShareStore.js'), 'utf8');
assert.match(shareStoreSource, /outcomeUnknown \? 'unknown' : 'failed'/);
assert.match(shareStoreSource, /linkedin_profile_share_published/);
assert.match(shareStoreSource, /linkedin_share_previous_outcome_unknown/);
assert.match(shareStoreSource, /linkedin_share_receipt_persistence_failed/);
const shareRepoSource = fs.readFileSync(path.join(root, 'src/db/linkedinShareRepo.js'), 'utf8');
assert.match(shareRepoSource, /provider_request_id=null, provider_http_status=null, provider_error_code=null/);
assert.match(shareRepoSource, /provider_http_status=\$5, provider_error_code=null/);
assert.match(shareStoreSource, /Never downgrade the\n  \/\/ intent to retryable `failed`/);
assert.doesNotMatch(shareStoreSource, /access_token\s*:/i);
const inviteComposerSource = fs.readFileSync(path.join(root, 'src/bot/composers/inviteComposer.js'), 'utf8');
assert.match(inviteComposerSource, /\^profile_\(\\d\+\)\$/);
assert.match(inviteComposerSource, /Opened from a member-approved LinkedIn share/);

console.log('OK: STEP059 Share Profile on LinkedIn explicit-approval contract');
