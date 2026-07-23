import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import healthHandler from '../api/health.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import {
  AI_NEWS_AUDIENCES,
  AI_NEWS_ANGLES,
  audienceLabel,
  angleLabel,
  buildPersonalizedDiscoveryQuery,
  buildProfileAffinityContext,
  normalizeAudienceKey,
  normalizeAngleKey,
  publicAudienceDiscoverySummary
} from '../src/lib/ai/newsDiscoveryContract.js';
import {
  AI_NEWS_PRESETS,
  normalizePresetKey,
  resolvePreferenceQuery
} from '../src/lib/ai/newsDraftContract.js';
import {
  buildNewsDraftInput,
  buildNewsDraftInstructions
} from '../src/lib/ai/newsDraftGenerationContract.js';
import { buildPresetName } from '../src/lib/ai/newsPresetSchedule.js';
import { assessSourceRelevance } from '../src/lib/news/sourceRelevance.js';
import { normalizeSourceArticle } from '../src/lib/news/sourceContract.js';
import {
  renderAiNewsAudienceKeyboard,
  renderAiNewsAngleKeyboard,
  renderAiNewsHubKeyboard,
  renderAiNewsHubText,
  renderAiNewsPresetText,
  renderAiNewsSourcesText
} from '../src/lib/telegram/aiNewsRender.js';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

assert.equal(CURRENT_SOURCE_STEP, 'STEP063B-H1R1');
assert.equal(normalizePresetKey('business_growth'), 'business_markets');
assert.equal(normalizePresetKey('unknown'), 'for_you');
for (const key of ['for_you', 'ai_technology', 'startups_product', 'business_markets', 'career_leadership', 'crypto_web3', 'custom']) {
  assert.ok(AI_NEWS_PRESETS[key], `missing topic ${key}`);
}
assert.equal(normalizeAudienceKey('FOUNDERS_EXECUTIVES'), 'founders_executives');
assert.equal(normalizeAudienceKey('unknown'), 'professional_network');
assert.equal(normalizeAngleKey('PRACTICAL_LESSONS'), 'practical_lessons');
assert.equal(normalizeAngleKey('unknown'), 'expert_take');
assert.equal(Object.keys(AI_NEWS_AUDIENCES).length, 7);
assert.equal(Object.keys(AI_NEWS_ANGLES).length, 7);

const profile = {
  headline_user: 'Founder building Telegram AI products',
  industry_user: 'Software Development',
  company_user: 'Private Company Must Not Become A Dedicated Field',
  about_user: 'Private long-form profile text must not enter the discovery query.',
  skills: [
    { skill_label: 'Product Engineering' },
    { skill_label: 'Web3 Infrastructure' },
    { skill_label: 'Developer Tools' }
  ]
};
const profileContext = buildProfileAffinityContext(profile);
assert.equal(profileContext.available, true);
assert.ok(profileContext.terms.includes('founder'));
assert.ok(profileContext.terms.includes('telegram'));
assert.equal(profileContext.terms.includes('private'), false);
const personalizedQuery = buildPersonalizedDiscoveryQuery({
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'practical_lessons'
});
assert.ok(personalizedQuery.length <= 100);
assert.match(personalizedQuery, /founder|telegram|product/i);
assert.doesNotMatch(personalizedQuery, /Private Company|long-form/i);
assert.equal(resolvePreferenceQuery({
  preset_key: 'for_you',
  audience_key: 'product_engineering',
  angle_key: 'practical_lessons',
  profile_affinity_enabled: true
}, profileContext), personalizedQuery);
assert.doesNotMatch(resolvePreferenceQuery({
  preset_key: 'for_you',
  audience_key: 'product_engineering',
  angle_key: 'practical_lessons',
  profile_affinity_enabled: false
}, profileContext), /telegram/i);

const migration = read('migrations/035_ai_news_audience_aware_discovery.sql');
for (const column of ['audience_key', 'custom_audience', 'angle_key', 'profile_affinity_enabled']) {
  assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`, 'i'));
}
assert.match(migration, /ALTER COLUMN preset_key SET DEFAULT 'for_you'/i);
assert.match(migration, /audience_query/);
assert.match(migration, /business_growth/);
assert.match(migration, /business_markets/);

const presetRepo = read('src/db/aiNewsPresetRepo.js');
assert.match(presetRepo, /audience_key, custom_audience, angle_key, profile_affinity_enabled/);
assert.match(presetRepo, /p\.audience_key, p\.custom_audience, p\.angle_key, p\.profile_affinity_enabled/);
const presetStore = read('src/lib/storage/aiNewsPresetStore.js');
assert.match(presetStore, /migration_036_required/);
assert.match(presetStore, /audienceKey: preferences\.audience_key/);
assert.match(presetStore, /angleKey: preferences\.angle_key/);
assert.match(presetStore, /profileAffinityEnabled: preferences\.profile_affinity_enabled !== false/);

const preferences = {
  preset_key: 'for_you',
  audience_key: 'founders_executives',
  custom_audience: null,
  angle_key: 'founder_perspective',
  profile_affinity_enabled: true,
  post_language: 'en',
  tone: 'professional'
};
assert.equal(audienceLabel(preferences), 'Founders & executives');
assert.equal(angleLabel(preferences), 'Founder perspective');
const presetName = buildPresetName({
  presetKey: 'for_you',
  postLanguage: 'en',
  tone: 'professional',
  audienceLabel: audienceLabel(preferences),
  angleLabel: angleLabel(preferences)
});
assert.ok(presetName.length <= 80);
assert.match(presetName, /For you/);
assert.match(presetName, /Founders/);

const hubState = {
  eligible: true,
  preferences,
  personalization: profileContext,
  config: {
    generator: { mode: 'off' },
    source: { mode: 'multi_source' },
    schedule: { enabled: false },
    rolloutStage: 'operator_acceptance',
    dailyLimit: 3,
    searchDailyLimit: 10,
    presetLimit: 3
  },
  dailyUsage: { remaining: 3, limit: 3 },
  searchUsage: { remaining: 9, limit: 10 },
  presetUsage: { used: 1, limit: 3 },
  presets: [{}],
  presetPersistenceReady: true
};
const hubText = renderAiNewsHubText({ state: hubState });
assert.match(hubText, /Topic: For you/);
assert.match(hubText, /Audience: Founders & executives/);
assert.match(hubText, /Angle: Founder perspective/);
assert.match(hubText, /Profile match: .*public profile signals/);
const hubButtons = renderAiNewsHubKeyboard({ state: hubState }).inline_keyboard.flat().map((button) => button.text);
for (const expected of ['✨ For you', '🤖 AI & Tech', '🚀 Startups', '📈 Business', '🧭 Career', '⛓ Crypto']) {
  assert.ok(hubButtons.some((text) => text.includes(expected)), `missing hub button ${expected}`);
}
assert.ok(hubButtons.some((text) => text.includes('Founders & executives')));
assert.ok(hubButtons.some((text) => text.includes('Founder perspective')));
assert.ok(hubButtons.includes('🔎 Find relevant stories'));

const audienceCallbacks = renderAiNewsAudienceKeyboard({ preferences }).inline_keyboard.flat().map((button) => button.callback_data).filter(Boolean);
assert.ok(audienceCallbacks.includes('news:aud:product_engineering'));
assert.ok(audienceCallbacks.includes('news:aud:custom'));
const angleCallbacks = renderAiNewsAngleKeyboard({ preferences }).inline_keyboard.flat().map((button) => button.callback_data).filter(Boolean);
assert.ok(angleCallbacks.includes('news:ang:practical_lessons'));
assert.ok(angleCallbacks.includes('news:ang:career_implications'));

const now = new Date();
function source({ title, description, categories = ['technology'], provider = 'newsdata' }) {
  return normalizeSourceArticle({
    url: `https://example.com/${encodeURIComponent(title.toLowerCase().slice(0, 20))}`,
    title,
    description,
    sourceName: 'Example',
    categories,
    publishedAt: now
  }, {
    provider,
    sourceKind: 'news_report',
    authorityScore: 70,
    isPrimary: false,
    metadata: { qualityTier: 'standard' }
  });
}
const aligned = assessSourceRelevance(source({
  title: 'AI agent workflow released for product engineering teams',
  description: 'The developer platform explains practical implementation lessons for software teams.'
}), {
  presetKey: 'ai_technology',
  provider: 'newsdata',
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'practical_lessons',
  profileAffinityEnabled: true
});
assert.equal(aligned.accepted, true);
assert.ok(aligned.profileAffinityScore > 0);
assert.ok(aligned.audienceFitScore > 0);
assert.ok(aligned.angleFitScore > 0);
assert.ok(aligned.topicSignalScore > 0);
const unrelated = assessSourceRelevance(source({
  title: 'Restaurant chain opens a new regional location',
  description: 'The company announced a menu and building renovation.',
  categories: ['lifestyle']
}), {
  presetKey: 'crypto_web3',
  provider: 'newsdata',
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'practical_lessons'
});
assert.equal(unrelated.accepted, false);
assert.equal(unrelated.reason, 'below_relevance_threshold');
assert.ok(unrelated.qualityFlags.includes('topic_mismatch'));

const generatedInstructions = buildNewsDraftInstructions({
  sourceUrl: 'https://example.com/source',
  postLanguage: 'en',
  tone: 'professional',
  audienceKey: 'founders_executives',
  angleKey: 'founder_perspective'
});
assert.match(generatedInstructions, /Founders & executives/);
assert.match(generatedInstructions, /Founder perspective/);
const generatedInput = JSON.parse(buildNewsDraftInput({
  source: { source_title: 'Title', source_url: 'https://example.com/source' },
  sourceEvidence: 'Title: Title\nSource URL: https://example.com/source',
  profile,
  audienceKey: 'founders_executives',
  angleKey: 'founder_perspective'
}));
assert.equal(generatedInput.editorial_contract.audience_key, 'founders_executives');
assert.equal(generatedInput.editorial_contract.angle_key, 'founder_perspective');

const sourceText = renderAiNewsSourcesText({ result: {
  query: personalizedQuery,
  sourceMode: 'multi_source',
  generatorMode: 'off',
  draftGenerationAvailable: false,
  preferences,
  personalization: profileContext,
  articles: [{
    provider: 'newsdata',
    source_title: 'Aligned story',
    source_name: 'Example',
    source_domain: 'example.com',
    published_at: now,
    source_authority_score: 70,
    source_is_primary: false,
    source_metadata_json: {
      qualityTier: 'standard', relevanceScore: 88, profileAffinityScore: 14,
      audienceFitScore: 12, angleFitScore: 8
    }
  }],
  providerSummary: [],
  newsdataFallbackUsed: false
} });
assert.match(sourceText, /Audience: Founders & executives/);
assert.match(sourceText, /Angle: Founder perspective/);
assert.match(sourceText, /profile 14\/100/);
assert.match(sourceText, /audience 12\/100/);
assert.match(sourceText, /angle 8\/100/);

const presetText = renderAiNewsPresetText({ state: {
  preset: { ...preferences, name: presetName, status: 'active', schedule_kind: 'manual', delivery_hour_utc: 9 },
  config: { generator: { mode: 'off' }, schedule: { enabled: false, driver: 'vercel_daily', dailyHourUtc: 8 } }
} });
assert.match(presetText, /Audience: Founders & executives/);
assert.match(presetText, /Angle: Founder perspective/);
assert.match(presetText, /Profile match: on/);

const publicPolicy = publicAudienceDiscoverySummary();
assert.equal(publicPolicy.personalizedTopic, 'for_you');
assert.deepEqual(publicPolicy.profileSignals, ['headline', 'industry', 'skills']);
assert.equal(publicPolicy.presetContract, 'topic_audience_angle_language_tone');

const savedEnv = { ...process.env };
try {
  process.env.AI_NEWS_DRAFT_MODE = 'operator';
  process.env.AI_NEWS_GENERATOR_MODE = 'off';
  process.env.AI_NEWS_SOURCE_MODE = 'multi_source';
  process.env.AI_NEWS_ENABLED_PROVIDERS = 'rss,hacker_news,github_releases,newsdata';
  process.env.NEWSDATA_API_KEY = 'test-news-key';
  process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN';
  process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook';
  process.env.OPERATOR_TELEGRAM_USER_IDS = '123456';
  const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await healthHandler({}, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.step, 'STEP063B-H1R1');
  assert.equal(response.body.aiNewsDraft.audienceDiscoveryPolicy.personalizedTopic, 'for_you');
  assert.equal(response.body.aiNewsDraft.automaticPublishing, false);
} finally {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
}

const composer = read('src/bot/composers/aiNewsComposer.js');
assert.match(composer, /news:audience/);
assert.match(composer, /news:angle/);
assert.match(composer, /professional_network\|founders_executives[\s\S]*recruiters_talent\|custom/);
assert.match(composer, /renderAiNewsSearchProgressText/);
const publisher = read('src/lib/storage/linkedinShareStore.js');
assert.doesNotMatch(publisher, /newsDiscoveryContract|audience_key|angle_key/);

console.log('PASS STEP063B LinkedIn audience-aware discovery and personalized presets smoke');
