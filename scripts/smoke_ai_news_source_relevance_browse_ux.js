import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateAiNewsSearchUsage } from '../src/db/aiNewsRepo.js';
import { classifySourceDomain } from '../src/lib/news/sourceRegistry.js';
import {
  assessSourceRelevance,
  publicSourceRelevanceSummary,
  resolveProviderDiscoveryQuery
} from '../src/lib/news/sourceRelevance.js';
import { normalizeSourceArticle } from '../src/lib/news/sourceContract.js';
import { fetchTrustedRssSources } from '../src/lib/news/rss.js';
import { discoverNewsSources } from '../src/lib/news/multiSource.js';
import {
  renderAiNewsHubKeyboard,
  renderAiNewsHubText,
  renderAiNewsSourcesKeyboard,
  renderAiNewsSourcesText
} from '../src/lib/telegram/aiNewsRender.js';

const now = Date.now();

function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

function textResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(payload, {
    status,
    headers: { 'content-type': 'application/xml', ...headers }
  });
}

function article({ domain, title, description = '', categories = ['crypto'] }) {
  const domainClass = classifySourceDomain(domain);
  return normalizeSourceArticle({
    url: `https://${domain}/article`,
    title,
    description,
    sourceName: domain,
    categories,
    publishedAt: new Date(now - 60_000)
  }, {
    provider: 'newsdata',
    sourceKind: domainClass.sourceKind,
    authorityScore: domainClass.authorityScore,
    isPrimary: domainClass.isPrimary,
    metadata: { qualityTier: domainClass.qualityTier }
  });
}

assert.equal(classifySourceDomain('www.reuters.com').authorityScore, 92);
assert.equal(classifySourceDomain('coinpedia.org').qualityTier, 'low');
assert.equal(classifySourceDomain('unknown.example').authorityScore, 60);
const publicPolicy = publicSourceRelevanceSummary();
assert.equal(publicPolicy.presetQueryMapping, true);
assert.equal(publicPolicy.providerMinimumScores.newsdata, 35);
assert.equal(publicPolicy.promotionalContentPolicy, 'reject_high_confidence_non_primary');
assert.match(resolveProviderDiscoveryQuery({ presetKey: 'crypto_web3', provider: 'newsdata', fallbackQuery: 'crypto' }), /Ethereum/);
assert.match(resolveProviderDiscoveryQuery({ presetKey: 'ai_technology', provider: 'hacker_news', fallbackQuery: 'AI' }), /LLM/);

const rejectedPrediction = assessSourceRelevance(article({
  domain: 'coinpedia.org',
  title: 'Audius Price Prediction 2026: Can AUDIO Hit $1 in the Next Bull Run?'
}), { presetKey: 'crypto_web3', provider: 'newsdata' });
assert.equal(rejectedPrediction.accepted, false);
assert.equal(rejectedPrediction.reason, 'promotional_content');

const rejectedIntel = assessSourceRelevance(article({
  domain: 'coinpedia.org',
  title: 'Intel Stock in Focus as Company Seeks Partner for Ohio Chip Plant',
  categories: []
}), { presetKey: 'crypto_web3', provider: 'newsdata' });
assert.equal(rejectedIntel.accepted, false);
assert.equal(rejectedIntel.reason, 'below_relevance_threshold');

const acceptedExploit = assessSourceRelevance(article({
  domain: 'mpost.io',
  title: 'B2 Network suffers exploit and offers attacker partial refund',
  description: 'A blockchain protocol exploit affected a Web3 network.'
}), { presetKey: 'crypto_web3', provider: 'newsdata' });
assert.equal(acceptedExploit.accepted, true);
assert.ok(acceptedExploit.score >= acceptedExploit.threshold);

const rssFailure = await fetchTrustedRssSources({
  presetKey: 'crypto_web3',
  query: 'crypto OR blockchain OR Ethereum',
  maxSources: 1,
  fetchImpl: async () => textResponse('unavailable', { status: 503 })
});
assert.equal(rssFailure.error.code, 'rss_http_503');
assert.equal(rssFailure.detail.failures[0].registryKey, 'ethereum_foundation_blog');
assert.equal(rssFailure.detail.failures[0].code, 'http_503');

const config = {
  maxArticles: 5,
  maxSourceAgeHours: 48,
  source: {
    mode: 'multi_source',
    enabledProviders: ['rss', 'hacker_news', 'github_releases', 'newsdata'],
    providerMaxArticles: 5,
    rssTimeoutMs: 5000,
    rssMaxFeedsPerSearch: 1,
    hackerNewsTimeoutMs: 5000,
    hackerNewsScanLimit: 4,
    hackerNewsMinScore: 10,
    githubTimeoutMs: 5000,
    githubMaxReposPerSearch: 2,
    githubToken: null
  },
  newsdata: {
    configured: true,
    apiKey: 'test',
    baseUrl: 'https://newsdata.io/api/1/',
    timeoutMs: 5000,
    estimatedRequestCostUsd: 0
  }
};

const mockFetch = async (input) => {
  const url = new URL(String(input));
  if (url.hostname === 'blog.ethereum.org') return textResponse('unavailable', { status: 503 });
  if (url.hostname === 'hacker-news.firebaseio.com' && url.pathname.endsWith('/topstories.json')) return jsonResponse([]);
  if (url.hostname === 'api.github.com') return jsonResponse([]);
  if (url.hostname === 'newsdata.io') {
    return jsonResponse({
      status: 'success',
      results: [
        {
          article_id: 'prediction',
          title: 'BTC Price Prediction: Can Bitcoin Hit $100K in the Next Bull Run?',
          link: 'https://blockchain.news/news/prediction',
          description: 'Price target and market forecast.',
          source_name: 'Blockchain News',
          category: ['crypto'],
          pubDate: new Date(now - 30_000).toISOString()
        },
        {
          article_id: 'exploit',
          title: 'B2 Network suffers exploit and offers attacker partial refund',
          link: 'https://mpost.io/b2-network-exploit',
          description: 'A blockchain protocol exploit affected a Web3 network.',
          source_name: 'Metaverse Post',
          category: ['crypto'],
          pubDate: new Date(now - 60_000).toISOString()
        },
        {
          article_id: 'audius',
          title: 'Audius Price Prediction 2026: Can AUDIO Hit $1?',
          link: 'https://coinpedia.org/price-prediction/audius',
          description: 'Next bull run forecast.',
          source_name: 'Coinpedia',
          category: ['crypto'],
          pubDate: new Date(now - 90_000).toISOString()
        },
        {
          article_id: 'intel',
          title: 'Intel stock in focus as company seeks partner for Ohio chip plant',
          link: 'https://coinpedia.org/news/intel',
          description: 'Company and chip plant update.',
          source_name: 'Coinpedia',
          category: ['business'],
          pubDate: new Date(now - 120_000).toISOString()
        },
        {
          article_id: 'ethereum',
          title: 'Ethereum client update improves validator reliability',
          link: 'https://www.reuters.com/technology/ethereum-validator-update',
          description: 'The blockchain update focuses on Ethereum validators and network reliability.',
          source_name: 'Reuters',
          category: ['crypto'],
          pubDate: new Date(now - 150_000).toISOString()
        }
      ]
    });
  }
  return jsonResponse({ error: 'not found' }, { status: 404 });
};

const discovery = await discoverNewsSources({
  config,
  query: 'crypto OR blockchain OR web3',
  preferences: {
    preset_key: 'crypto_web3',
    custom_query: null,
    source_language: 'en',
    source_country: null,
    source_category: null
  },
  fetchImpl: mockFetch
});
assert.equal(discovery.newsdataFallbackUsed, true);
assert.deepEqual(discovery.articles.map((item) => item.provider), ['newsdata', 'newsdata']);
assert.ok(discovery.articles.some((item) => item.title.includes('Ethereum client update')));
assert.ok(discovery.articles.some((item) => item.title.includes('B2 Network')));
assert.equal(discovery.articles.some((item) => /Intel|Price Prediction|Audius/i.test(item.title)), false);
const rssResult = discovery.providerResults.find((item) => item.provider === 'rss');
assert.equal(rssResult.outcome, 'failed');
assert.equal(rssResult.error.code, 'rss_http_503');
const newsdataResult = discovery.providerResults.find((item) => item.provider === 'newsdata');
assert.equal(newsdataResult.detail.relevance.rejectedCount, 3);
assert.equal(newsdataResult.detail.relevance.rejectionCounts.promotional_content, 2);
assert.equal(newsdataResult.detail.relevance.rejectionCounts.below_relevance_threshold, 1);

const windowStartedAt = new Date(now - 60 * 60 * 1000);
const usage = calculateAiNewsSearchUsage({ search_window_started_at: windowStartedAt, search_count_in_window: 10 }, 10, now);
assert.equal(usage.remaining, 0);
assert.equal(usage.resetsAt.toISOString(), new Date(windowStartedAt.getTime() + 24 * 60 * 60 * 1000).toISOString());

const state = {
  eligible: true,
  config: {
    generator: { mode: 'off', browseOnly: true },
    schedule: { enabled: false },
    rolloutStage: 'operator_acceptance',
    source: { mode: 'multi_source' },
    searchDailyLimit: 10,
    presetLimit: 3
  },
  preferences: { preset_key: 'crypto_web3', post_language: 'ru', tone: 'concise' },
  latestDraft: { status: 'failed', public_token: 'old' },
  searchUsage: usage,
  presets: [],
  presetUsage: { used: 0, limit: 3 },
  presetPersistenceReady: true
};
const hubText = renderAiNewsHubText({ state });
assert.match(hubText, /Searches: 0\/10/);
assert.match(hubText, /Available again:/);
assert.doesNotMatch(hubText, /Latest draft: failed/);
assert.equal(renderAiNewsHubKeyboard({ state }).inline_keyboard.flat().some((button) => button.callback_data === 'news:find'), false);

const sourceResult = {
  query: 'crypto OR blockchain OR web3',
  sourceMode: 'multi_source',
  generatorMode: 'off',
  draftGenerationAvailable: false,
  newsdataFallbackUsed: true,
  searchUsage: usage,
  providerSummary: [{ provider: 'rss', outcome: 'failed', errorCode: 'rss_http_503' }],
  articles: [{
    public_token: '11111111-1111-4111-8111-111111111111',
    provider: 'newsdata',
    source_title: 'Ethereum client update improves validator reliability',
    source_name: 'Reuters',
    source_url: 'https://www.reuters.com/technology/ethereum-validator-update',
    source_authority_score: 92,
    source_is_primary: false,
    published_at: new Date(now).toISOString(),
    expires_at: new Date(now + 30 * 60 * 1000).toISOString(),
    source_metadata_json: { qualityTier: 'high', relevanceScore: 100 }
  }]
};
const sourceText = renderAiNewsSourcesText({ result: sourceResult });
assert.match(sourceText, /Established source/);
assert.match(sourceText, /Strong match/);
assert.match(sourceText, /Some sources were unavailable/);
assert.doesNotMatch(sourceText, /relevance 100\/100|rss_http_503|authority 92\/100/);
const sourceButtons = renderAiNewsSourcesKeyboard({ result: sourceResult }).inline_keyboard.flat();
assert.equal(sourceButtons.some((button) => button.callback_data === 'news:find'), false);
assert.ok(sourceButtons.some((button) => button.url?.startsWith('https://www.reuters.com/')));

assert.equal(fs.existsSync(new URL('../migrations/035_ai_news_source_relevance.sql', import.meta.url)), false);
const shareStore = fs.readFileSync(new URL('../src/lib/storage/linkedinShareStore.js', import.meta.url), 'utf8');
assert.doesNotMatch(shareStore, /sourceRelevance|calculateAiNewsSearchUsage/);

console.log('PASS STEP063A-H1A source relevance, provider diagnostics, and browse UX smoke');
