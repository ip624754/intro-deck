import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import healthHandler from '../api/health.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import {
  buildPersonalizedDiscoveryPlan,
  buildProfileAffinityContext,
  publicAudienceDiscoverySummary
} from '../src/lib/ai/newsDiscoveryContract.js';
import {
  assessSourceRelevance,
  filterRelevantSources,
  publicSourceRelevanceSummary,
  resolveProviderDiscoveryQuery
} from '../src/lib/news/sourceRelevance.js';
import { fetchHackerNewsStories } from '../src/lib/news/hackerNews.js';
import { parseRssOrAtomFeed } from '../src/lib/news/rss.js';
import { normalizeSourceArticle } from '../src/lib/news/sourceContract.js';
import { listGitHubReposForPreset, listRssSourcesForPreset } from '../src/lib/news/sourceRegistry.js';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
assert.equal(['STEP063B-H2', 'STEP064A', 'STEP064B1', 'STEP064B2', 'STEP064B3', 'STEP064B4A', 'STEP064B4B', 'STEP064B4C', 'STEP064B4C1', 'STEP064B4D1', 'STEP064B4D1A', 'STEP064B4D2'].includes(CURRENT_SOURCE_STEP), true);

const profileContext = buildProfileAffinityContext({
  headline_user: 'AI-assisted product builder',
  industry_user: 'Software Development',
  skills: [
    { skill_label: 'Telegram Products' },
    { skill_label: 'Web3 Infrastructure' },
    { skill_label: 'Product Engineering' }
  ]
});
assert.deepEqual(profileContext.signalGroups.sort(), ['ai', 'engineering', 'founder', 'product', 'telegram', 'web3'].sort());
assert.ok(profileContext.specificTerms.includes('telegram'));
assert.equal(profileContext.specificTerms.includes('development'), false);

const plan = buildPersonalizedDiscoveryPlan({
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'explain_simply'
});
assert.equal(plan.policyVersion, 'for_you_v2_phrase_anchors');
assert.ok(plan.query.length <= 100);
assert.match(plan.query, /AI product development/i);
assert.match(plan.query, /Telegram developer products|Telegram products/i);
assert.match(plan.query, /Web3 infrastructure/i);
assert.doesNotMatch(plan.query, /(?:^| OR )(?:product|systems|builder|development)(?: OR |$)/i);
assert.equal(plan.finalFitPolicy.preferNoResultToWeakFallback, true);

const providerQuery = resolveProviderDiscoveryQuery({
  presetKey: 'for_you',
  provider: 'newsdata',
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'explain_simply',
  personalizedQueryPlan: plan
});
assert.equal(providerQuery, plan.query);

function source(title, description, {
  provider = 'newsdata',
  primary = false,
  authority = 60,
  metadata = { qualityTier: primary ? 'primary' : 'standard' }
} = {}) {
  return normalizeSourceArticle({
    url: `https://example.com/${encodeURIComponent(title.toLowerCase().slice(0, 30))}`,
    title,
    description,
    sourceName: 'Example',
    categories: [],
    publishedAt: new Date()
  }, {
    provider,
    sourceKind: primary ? 'official_release' : 'news_report',
    authorityScore: authority,
    isPrimary: primary,
    metadata
  });
}

const weakFallback = assessSourceRelevance(source(
  'Why franchises must rethink growth in a digital-first world',
  'A restaurant operator discusses business growth and regional expansion.'
), {
  presetKey: 'for_you',
  provider: 'newsdata',
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'explain_simply',
  personalizedQueryPlan: plan
});
assert.equal(weakFallback.accepted, false);
assert.equal(weakFallback.reason, 'missing_professional_anchor');

const horticulture = assessSourceRelevance(source(
  'Officers expedite construction of a horticulture development centre',
  'Regional officials reviewed construction schedules and agricultural facilities.'
), {
  presetKey: 'for_you',
  provider: 'newsdata',
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'explain_simply',
  personalizedQueryPlan: plan
});
assert.equal(horticulture.accepted, false);
assert.equal(horticulture.reason, 'missing_professional_anchor');

const aligned = assessSourceRelevance(source(
  'AI developer tooling improves product engineering workflows',
  'An explainer for software teams building Telegram products and Web3 infrastructure.'
), {
  presetKey: 'for_you',
  provider: 'newsdata',
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'explain_simply',
  personalizedQueryPlan: plan
});
assert.equal(aligned.accepted, true);
assert.ok(aligned.finalFitScore >= aligned.finalFitThreshold);
assert.ok(aligned.requiredAnchorMatches.length >= 1);
assert.ok(aligned.profileAffinityScore >= 14);

const registryAlignedRelease = assessSourceRelevance(source(
  'openai/openai-node: v6.49.0',
  '',
  {
    provider: 'github_releases',
    primary: true,
    authority: 98,
    metadata: {
      qualityTier: 'primary',
      focusGroups: ['ai', 'engineering'],
      personalizedFocusMatches: ['ai', 'engineering']
    }
  }
), {
  presetKey: 'for_you',
  provider: 'github_releases',
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'explain_simply',
  personalizedQueryPlan: plan
});
assert.equal(registryAlignedRelease.accepted, true);
assert.deepEqual(registryAlignedRelease.registryFocusMatches.sort(), ['ai', 'engineering']);

const filtered = filterRelevantSources([
  source('Why franchises must rethink growth in a digital-first world', 'A restaurant operator discusses growth.'),
  source('AI developer tooling improves product engineering workflows', 'Telegram products and Web3 infrastructure explainer.')
], {
  presetKey: 'for_you',
  provider: 'newsdata',
  profileContext,
  audienceKey: 'product_engineering',
  angleKey: 'explain_simply',
  personalizedQueryPlan: plan
});
assert.equal(filtered.articles.length, 1);
assert.equal(filtered.detail.rejectionCounts.missing_professional_anchor, 1);
assert.equal(filtered.detail.personalizedQueryPlan.policyVersion, 'for_you_v2_phrase_anchors');
assert.deepEqual(filtered.detail.personalizedQueryPlan.requiredAnchors, plan.requiredAnchors);
assert.equal(filtered.articles[0].metadata.personalizedQueryPolicyVersion, 'for_you_v2_phrase_anchors');

const rssXml = `<?xml version="1.0"?><rss><channel>
  <item><title>Horticulture development centre opens</title><link>https://example.com/horticulture</link><pubDate>${new Date().toUTCString()}</pubDate><description>Regional construction update</description></item>
  <item><title>AI product development tools launch</title><link>https://example.com/ai-product</link><pubDate>${new Date().toUTCString()}</pubDate><description>Developer tooling for product engineering</description></item>
</channel></rss>`;
const rssArticles = parseRssOrAtomFeed(rssXml, {
  source: {
    key: 'test_feed',
    name: 'Test Feed',
    allowedArticleHostnames: ['example.com'],
    authorityScore: 95,
    sourceKind: 'official_blog',
    matchTerms: ['development'],
    focusGroups: ['ai', 'engineering'],
    presetKey: 'for_you',
    personalizedSearch: true
  },
  query: plan.query,
  maxSourceAgeHours: 48,
  maxArticles: 5
});
assert.equal(rssArticles.length, 1);
assert.match(rssArticles[0].title, /AI product development/i);

const nowSeconds = Math.floor(Date.now() / 1000);
const hnPayloads = new Map([
  ['/v0/topstories.json', [1, 2]],
  ['/v0/item/1.json', { id: 1, type: 'story', title: 'Horticulture development centre opens', url: 'https://example.com/horticulture', time: nowSeconds, score: 100, descendants: 20 }],
  ['/v0/item/2.json', { id: 2, type: 'story', title: 'AI product development platform launches', url: 'https://example.com/ai-product', time: nowSeconds, score: 100, descendants: 20 }]
]);
const hnFetch = async (url) => {
  const key = new URL(url).pathname;
  return new Response(JSON.stringify(hnPayloads.get(key)), { status: 200, headers: { 'content-type': 'application/json' } });
};
const hn = await fetchHackerNewsStories({
  query: plan.query,
  timeoutMs: 3000,
  maxSourceAgeHours: 48,
  maxArticles: 5,
  scanLimit: 2,
  minScore: 10,
  fetchImpl: hnFetch
});
assert.equal(hn.articles.length, 1);
assert.match(hn.articles[0].title, /AI product development/i);
assert.equal(hn.detail.queryMismatchStories, 1);

const rssRegistry = listRssSourcesForPreset('for_you', { maxSources: 2, profileContext });
assert.ok(rssRegistry.every((item) => Array.isArray(item.personalizedFocusMatches)));
assert.ok(rssRegistry[0].personalizedFocusMatches.length >= 1);
const githubRegistry = listGitHubReposForPreset('for_you', { maxRepos: 2, profileContext });
assert.ok(githubRegistry.every((item) => Array.isArray(item.personalizedFocusMatches)));
assert.ok(githubRegistry[0].personalizedFocusMatches.length >= 2);

const audiencePolicy = publicAudienceDiscoverySummary();
assert.equal(audiencePolicy.externalQueryPolicy, 'bounded_public_profile_phrase_anchors_only');
assert.equal(audiencePolicy.finalFitPolicy, 'professional_anchor_and_context_gate_prefer_no_result');
const sourcePolicy = publicSourceRelevanceSummary();
assert.equal(sourcePolicy.personalizedQueryPolicy, 'phrase_anchors_not_generic_or_tokens');
assert.equal(sourcePolicy.personalizedFinalFitGate, 'required_anchor_plus_context_prefer_no_result');

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
  assert.equal(response.body.step, CURRENT_SOURCE_STEP);
  assert.equal(response.body.aiNewsDraft.audienceDiscoveryPolicy.personalizedQueryPolicy, 'required_professional_phrases_plus_ranking_boosts');
  assert.equal(response.body.aiNewsDraft.sourceQualityPolicy.personalizedFinalFitGate, 'required_anchor_plus_context_prefer_no_result');
  assert.equal(response.body.aiNewsDraft.automaticPublishing, false);
} finally {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
}

const multiSource = read('src/lib/news/multiSource.js');
assert.match(multiSource, /buildPersonalizedDiscoveryPlan/);
assert.match(multiSource, /personalizedQueryPlan/);
const publisher = read('src/lib/storage/linkedinShareStore.js');
assert.doesNotMatch(publisher, /personalizedQueryPlan|finalFitThreshold|requiredAnchorMatches/);

console.log('PASS STEP063B-H2 personalized query precision and final-fit gate smoke');
