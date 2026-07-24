import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import {
  renderLinkedInSharePerformanceKeyboard,
  renderLinkedInSharePerformancePostKeyboard,
  renderLinkedInSharePerformancePostText,
  renderLinkedInSharePerformanceText,
  renderProfilePreviewKeyboard
} from '../src/lib/telegram/render.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(CURRENT_SOURCE_STEP, 'STEP065A2');
assert.equal(packageJson.version, '0.67.0');

const state = {
  ready: true,
  metrics: {
    publishedPosts: 3,
    totalOpens: 12,
    uniqueOpens: 8,
    uniqueStarted: 4,
    uniqueSubmitted: 3,
    uniqueApproved: 2,
    publishedPosts7d: 1,
    uniqueOpens7d: 4,
    uniqueSubmitted7d: 2,
    uniqueApproved7d: 1,
    openToRequestPct: 37.5,
    requestToApprovalPct: 66.7
  },
  posts: [{
    publicToken: '11111111-2222-4333-8444-555555555555',
    providerPostId: 'urn:li:share:1234567890',
    publishedAt: '2026-07-25T10:00:00.000Z',
    uniqueOpens: 5,
    uniqueSubmitted: 2,
    uniqueApproved: 1,
    visitorUserId: 999999
  }]
};
const ruText = renderLinkedInSharePerformanceText({ state, interfaceLanguage: 'ru' });
assert.match(ruText, /Эффективность LinkedIn/);
assert.match(ruText, /Открытие → запрос: 37\.5%/);
assert.match(ruText, /Запрос → одобрение: 66\.7%/);
assert.doesNotMatch(ruText, /999999|visitor/i);
const enText = renderLinkedInSharePerformanceText({ state, interfaceLanguage: 'en' });
assert.match(enText, /LinkedIn performance/);
assert.match(enText, /Visitor identities are not shown/);
const keyboard = renderLinkedInSharePerformanceKeyboard({ state, interfaceLanguage: 'en' });
assert.equal(keyboard.inline_keyboard[0][0].callback_data, 'li:perf:post:11111111-2222-4333-8444-555555555555');
assert.ok(keyboard.inline_keyboard.flat().some((button) => button.callback_data === 'li:perf'));

const postState = {
  post: {
    ...state.posts[0], totalOpens: 7, uniqueStarted: 3, submittedRequests: 2, approvedRequests: 1,
    openToRequestPct: 40, requestToApprovalPct: 50,
    recentEvents: [
      { eventType: 'profile_opened', createdAt: '2026-07-25T10:01:00.000Z', visitorUserId: 999999 },
      { eventType: 'request_submitted', createdAt: '2026-07-25T10:02:00.000Z' }
    ]
  }
};
const postText = renderLinkedInSharePerformancePostText({ state: postState, interfaceLanguage: 'ru' });
assert.match(postText, /ID публикации: urn:li:share:1234567890/);
assert.match(postText, /Профиль открыт/);
assert.match(postText, /Запрос отправлен/);
assert.doesNotMatch(postText, /999999|visitor_user_id/i);
assert.equal(renderLinkedInSharePerformancePostKeyboard({ interfaceLanguage: 'en' }).inline_keyboard[0][0].callback_data, 'li:perf');

const profileKeyboard = renderProfilePreviewKeyboard({
  persistenceEnabled: true,
  profileSnapshot: { linkedin_sub: 'sub', profile_state: 'active', visibility_status: 'listed', display_name: 'Owner', headline_user: 'Builder', industry_user: 'Technology', about_user: 'Builds products.', skills: [{ skill_slug: 'product', skill_label: 'Product' }] },
  linkedinShareConfig: { enabled: true },
  interfaceLanguage: 'ru'
});
assert.ok(profileKeyboard.inline_keyboard.flat().some((button) => button.callback_data === 'li:perf'));

const repoSource = readFileSync(new URL('../src/db/linkedinShareConversionRepo.js', import.meta.url), 'utf8');
assert.match(repoSource, /count\(distinct e\.visitor_user_id\).*profile_opened/s);
assert.match(repoSource, /u\.telegram_user_id=\$1/);
assert.match(repoSource, /s\.public_token=\$2::uuid/);
assert.match(repoSource, /select event_type, created_at/);
assert.doesNotMatch(repoSource, /select event_type, created_at, visitor_user_id/);
const storeSource = readFileSync(new URL('../src/lib/storage/linkedinShareConversionStore.js', import.meta.url), 'utf8');
assert.match(storeSource, /Math\.min\(100/);
assert.match(storeSource, /linkedin_share_conversion_dashboard_failed/);
const composerSource = readFileSync(new URL('../src/bot/composers/linkedinShareComposer.js', import.meta.url), 'utf8');
assert.match(composerSource, /callbackQuery\('li:perf'/);
assert.match(composerSource, /li:perf:post:/);
const adminSource = readFileSync(new URL('../src/bot/surfaces/adminSurfaces.js', import.meta.url), 'utf8');
assert.match(adminSource, /LinkedIn-публикации/);
assert.match(adminSource, /Личности посетителей не раскрываются/);
assert.match(adminSource, /adm:li_share/);
const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
for (const token of [
  'linkedInShareConversionDashboardPolicy',
  "sourceOfTruth: 'migration_038_immutable_attribution_events'",
  'visitorIdentityVisibleToOwner: false',
  'visitorIdentityVisibleToAdmin: false',
  'analyticsFailureBlocksProductAction: false',
  'dashboardIncluded: true'
]) assert.match(healthSource, new RegExp(token.replaceAll('.', '\\.')));
assert.equal(readdirSync(new URL('../migrations/', import.meta.url)).some((name) => /^039_/i.test(name)), false);

console.log('OK: STEP065A2 LinkedIn share conversion dashboard');
