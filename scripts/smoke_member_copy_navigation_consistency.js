import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import {
  renderContactInboxKeyboard,
  renderContactInboxText,
  renderDirectoryCardKeyboard,
  renderDirectoryCardText,
  renderDirectoryListKeyboard,
  renderHelpKeyboard,
  renderHelpText,
  renderHomeKeyboard,
  renderHomeText,
  renderInviteText,
  renderPricingKeyboard,
  renderPricingText,
  renderProfileMenuText
} from '../src/lib/telegram/render.js';
import { renderAiNewsHubText, renderAiNewsSourcesText } from '../src/lib/telegram/aiNewsRender.js';
import { formatUserFacingError } from '../src/bot/utils/notices.js';
import { buildPersistenceSummary } from '../src/lib/linkedin/profile.js';

assert.ok(['STEP064B1', 'STEP064B2', 'STEP064B3', 'STEP064B4A', 'STEP064B4B'].includes(CURRENT_SOURCE_STEP));

const profile = {
  linkedin_sub: 'sub', linkedin_name: 'Rustam', display_name: 'Rustam Lukmanov',
  visibility_status: 'listed', profile_state: 'active',
  completion: { isReady: true, requiredFilledCount: 4, requiredCount: 4, hasRequiredSkills: true, skillsCount: 2, requiredSkillCount: 1 },
  skills: [{ skill_label: 'Product' }, { skill_label: 'AI' }]
};
const home = renderHomeText({ profileSnapshot: profile, persistenceEnabled: true, directoryStats: { totalCount: 0 }, introInboxStats: { receivedPending: 0, sentPending: 0 } });
assert.match(home, /Find professionals\. Connect by permission\./);
assert.match(home, /Profile: Live/);
assert.match(home, /Other listed profiles: 0/);
assert.doesNotMatch(home, /Directory readiness|Setup progress|Connected as:|profile_state|visibility_status/i);

const homeButtons = renderHomeKeyboard({ appBaseUrl: 'https://example.com', telegramUserId: 1, profileSnapshot: profile, persistenceEnabled: true, aiNewsVisible: true }).inline_keyboard.flat().map((b) => b.text);
for (const label of ['🌐 Browse', '📥 Requests', '🗞 Story finder', '✉️ Invite people', '⭐ Pro']) assert.ok(homeButtons.includes(label), label);
assert.ok(homeButtons.includes('🧩 Edit profile') || homeButtons.includes('➡️ Continue setup'));
assert.ok(!homeButtons.includes('📨 Contact inbox'));
assert.ok(!homeButtons.includes('🧠 News drafts'));
assert.ok(!homeButtons.includes('📨 Invite contacts'));

const help = renderHelpText({ aiNewsVisible: true });
assert.match(help, /Private contact details stay hidden until approval/);
assert.doesNotMatch(help, /Lite mode|feature flag|evidence snapshot|OAuth access token|AI\/news drafts/i);
const helpButtons = renderHelpKeyboard({ aiNewsVisible: true }).inline_keyboard.flat().map((b) => b.text);
assert.ok(helpButtons.includes('📥 Requests'));
assert.ok(helpButtons.includes('🗞 Story finder'));

const profileText = renderProfileMenuText({ profileSnapshot: profile, persistenceEnabled: true });
assert.match(profileText, /LinkedIn confirms the connected account/);
assert.doesNotMatch(profileText, /Directory readiness|member-provided professional card|profile_state/i);

const directoryText = renderDirectoryCardText({ profileSnapshot: { ...profile, profile_id: 7, headline_user: 'Founder', company_user: 'Intro Deck', city_user: 'Remote', industry_user: 'Software', about_user: 'Building products.', contact_mode: 'intro_request' }, persistenceEnabled: true });
assert.match(directoryText, /Professional profile/);
assert.doesNotMatch(directoryText, /State:|Visibility:|Profile details: member-provided/);
const directoryButtons = renderDirectoryCardKeyboard({ profileSnapshot: { ...profile, profile_id: 7, is_viewer: false, linkedin_public_url: 'https://www.linkedin.com/in/test', contact_mode: 'intro_request' } }).inline_keyboard.flat().map((b) => b.text);
assert.ok(directoryButtons.includes('🤝 Contact options'));
assert.ok(directoryButtons.includes('← Back to directory'));
const pager = renderDirectoryListKeyboard({ profiles: [], hasPrev: true, hasNext: true }).inline_keyboard.flat().map((b) => b.text);
assert.ok(pager.includes('‹ Previous'));
assert.ok(pager.includes('Next ›'));

assert.match(renderContactInboxText(), /Requests & chats/);
const contactButtons = renderContactInboxKeyboard().inline_keyboard.flat().map((b) => b.text);
assert.ok(contactButtons.includes('📥 Contact requests'));
assert.ok(contactButtons.includes('💬 Private chats'));

assert.match(renderInviteText({ inviteState: { persistenceEnabled: true, invitedCount: 1, activatedCount: 1 } }), /Invite people/);
assert.doesNotMatch(renderInviteText({ inviteState: { persistenceEnabled: true } }), /Share to a chat —|Forwarding card —/);

assert.match(renderPricingText({ pricingState: { persistenceEnabled: true, pricing: {}, subscriptionConfig: {}, contactPolicy: {} } }), /Intro Deck Pro/);
assert.doesNotMatch(renderPricingText({ pricingState: { persistenceEnabled: false, reason: 'DATABASE_URL is not configured' } }), /DATABASE_URL|Reason:/);
assert.ok(!renderPricingKeyboard({ pricingState: { persistenceEnabled: true, pricing: {} } }).inline_keyboard.flat().some((b) => b.text === '🔄 Refresh'));

const storyState = { eligible: true, preferences: { preset_key: 'for_you', audience_key: 'product_engineering', angle_key: 'explain_simply', post_language: 'en', tone: 'professional' }, personalization: { available: true, signalCount: 15 }, config: { generator: { mode: 'off' }, searchDailyLimit: 10, presetLimit: 3 }, searchUsage: { remaining: 9, limit: 10 }, presetUsage: { used: 1, limit: 3 }, presets: [] };
const story = renderAiNewsHubText({ state: storyState });
assert.match(story, /Story finder/);
assert.match(story, /Searches: 9\/10/);
assert.doesNotMatch(story, /Rollout stage|Source mode|Generator:|Draft allowance|public profile signals/);
const stories = renderAiNewsSourcesText({ result: { preferences: storyState.preferences, articles: [{ source_title: 'AI developer tooling release', source_name: 'GitHub', source_is_primary: true, source_metadata_json: JSON.stringify({ finalFitScore: 85, qualityTier: 'high' }) }], providerSummary: [{ outcome: 'failed', provider: 'rss', errorCode: 'rss_http_503' }] } });
assert.match(stories, /Official source · Strong match/);
assert.match(stories, /Some sources were unavailable/);
assert.doesNotMatch(stories, /rss_http_503|authority \d|relevance \d|profile \d|audience \d|angle \d|Source mode|Generator/);


const linkedinShareComposer = fs.readFileSync(new URL('../src/bot/composers/linkedinShareComposer.js', import.meta.url), 'utf8');
const linkedinCallback = fs.readFileSync(new URL('../api/oauth/callback/linkedin.js', import.meta.url), 'utf8');
const linkedinStart = fs.readFileSync(new URL('../api/oauth/start/linkedin.js', import.meta.url), 'utf8');
for (const source of [linkedinShareComposer, linkedinCallback, linkedinStart]) {
  assert.doesNotMatch(source, /migration 0(?:28|29)|unknown_reason|Reason: \${/);
  assert.match(source, /memberReasonText/);
}

assert.equal(buildPersistenceSummary({ persisted: true }), 'LinkedIn connection saved.');
assert.equal(buildPersistenceSummary({ persisted: false }), 'LinkedIn connected, but profile saving is temporarily unavailable.');

assert.equal(formatUserFacingError('migration_036_required'), 'Personalized discovery is temporarily unavailable.');
assert.equal(formatUserFacingError('new row violates check constraint', 'Could not save this right now.'), 'Could not save this right now.');

console.log('OK: STEP064B1 member copy and primary navigation consistency');
