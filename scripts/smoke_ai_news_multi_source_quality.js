import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getAiNewsDraftConfig } from '../src/config/env.js';
import {
  canonicalizeSourceUrl,
  deduplicateAndRankSources,
  normalizeSourceArticle,
  titleSimilarity
} from '../src/lib/news/sourceContract.js';
import { assertTrustedProviderUrl, readBoundedText } from '../src/lib/news/providerUtils.js';
import { parseRssOrAtomFeed } from '../src/lib/news/rss.js';
import { discoverNewsSources } from '../src/lib/news/multiSource.js';
import { fetchNewsDataLatest } from '../src/lib/news/newsdata.js';
import { fetchHackerNewsStories } from '../src/lib/news/hackerNews.js';

function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

function textResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(payload, {
    status,
    headers: { 'content-type': 'application/rss+xml', ...headers }
  });
}

assert.equal(
  canonicalizeSourceUrl('https://www.example.com/story/?utm_source=x&b=2&a=1#fragment'),
  'https://www.example.com/story?a=1&b=2'
);
assert.ok(titleSimilarity('OpenAI releases a new agents SDK for developers', 'OpenAI launches new agent SDK for developers') >= 0.4);
assert.ok(titleSimilarity('Google launches Gemini agent tools', 'Google launches Gemini agent tools') >= 0.82);
assert.throws(
  () => assertTrustedProviderUrl('https://example.com/feed', { provider: 'rss', allowedHostnames: ['blog.google'] }),
  /allowlisted/
);

await assert.rejects(
  () => readBoundedText(new Response(new ReadableStream({ start() {} })), 32, { timeoutMs: 20, provider: 'rss' }),
  (error) => error?.code === 'body_timeout' && error?.retryable === true
);
await assert.rejects(
  () => readBoundedText(new Response('12345'), 4, { timeoutMs: 100, provider: 'rss' }),
  (error) => error?.code === 'response_too_large'
);

await assert.rejects(
  () => fetchNewsDataLatest({
    apiKey: 'news-key',
    baseUrl: 'https://newsdata.io/api/1/',
    query: 'AI',
    fetchImpl: async () => new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } })
  }),
  (error) => error?.code === 'invalid_json' && error?.message === 'newsdata_invalid_json'
);

const now = Date.now();
const googleUrl = 'https://blog.google/technology/ai/gemini-agent-tools';
const rssXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Google Blog</title><item>
<title><![CDATA[Google launches Gemini agent tools]]></title>
<link>${googleUrl}?utm_source=rss</link>
<guid>google-1</guid>
<pubDate>${new Date(now - 60 * 60 * 1000).toUTCString()}</pubDate>
<description><![CDATA[New Gemini agent tools are available for developers.]]></description>
</item></channel></rss>`;
const parsedRss = parseRssOrAtomFeed(rssXml, {
  source: {
    key: 'google_blog',
    name: 'Google Blog',
    matchTerms: ['gemini', 'ai'],
    authorityScore: 96,
    sourceKind: 'official_blog',
    allowedArticleHostnames: ['blog.google']
  },
  query: 'artificial intelligence',
  maxSourceAgeHours: 48,
  maxArticles: 5,
  nowMs: now
});
assert.equal(parsedRss.length, 1);
assert.equal(parsedRss[0].provider, 'rss');
assert.equal(parsedRss[0].url, googleUrl);
assert.equal(parsedRss[0].isPrimary, true);

const rejectedRss = parseRssOrAtomFeed(rssXml.replace(googleUrl, 'https://evil.example/private-feed-link'), {
  source: {
    key: 'google_blog',
    name: 'Google Blog',
    matchTerms: ['gemini', 'ai'],
    authorityScore: 96,
    sourceKind: 'official_blog',
    allowedArticleHostnames: ['blog.google']
  },
  query: 'artificial intelligence',
  maxSourceAgeHours: 48,
  maxArticles: 5,
  nowMs: now
});
assert.equal(rejectedRss.length, 0);

const falseSubstringHn = await fetchHackerNewsStories({
  query: 'AI',
  maxSourceAgeHours: 48,
  minScore: 1,
  scanLimit: 1,
  fetchImpl: async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/topstories.json')) return jsonResponse([301]);
    return jsonResponse({
      id: 301,
      type: 'story',
      title: 'A chair design update',
      url: 'https://example.com/chair-design',
      time: Math.floor(Date.now() / 1000),
      score: 50,
      descendants: 5
    });
  }
});
assert.equal(falseSubstringHn.articles.length, 0);

const direct = normalizeSourceArticle({
  url: googleUrl,
  title: 'Google launches Gemini agent tools',
  publishedAt: new Date(now - 60 * 60 * 1000),
  sourceName: 'Google Blog'
}, { provider: 'rss', sourceKind: 'official_blog', authorityScore: 96, isPrimary: true });
const aggregatorDuplicate = normalizeSourceArticle({
  url: `${googleUrl}?utm_campaign=dup`,
  title: 'Google launches Gemini agent tools',
  publishedAt: new Date(now - 30 * 60 * 1000),
  sourceName: 'Aggregator'
}, { provider: 'newsdata', sourceKind: 'official_blog', authorityScore: 96, isPrimary: true });
const deduped = deduplicateAndRankSources([aggregatorDuplicate, direct], { maxArticles: 5 });
assert.equal(deduped.length, 1);
assert.equal(deduped[0].provider, 'rss');

function buildConfig(maxArticles = 5) {
  return {
    maxArticles,
    maxSourceAgeHours: 48,
    source: {
      mode: 'multi_source',
      enabledProviders: ['rss', 'hacker_news', 'github_releases', 'newsdata'],
      providerMaxArticles: 4,
      rssTimeoutMs: 7000,
      rssMaxFeedsPerSearch: 1,
      hackerNewsTimeoutMs: 7000,
      hackerNewsScanLimit: 4,
      hackerNewsMinScore: 10,
      githubTimeoutMs: 8000,
      githubMaxReposPerSearch: 2,
      githubToken: null
    },
    newsdata: {
      configured: true,
      apiKey: 'news-key',
      baseUrl: 'https://newsdata.io/api/1/',
      timeoutMs: 8000,
      estimatedRequestCostUsd: 0
    }
  };
}

function createMockFetch({ failRss = false, failHnItems = false } = {}) {
  const calls = [];
  const mock = async (input) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    if (url.hostname === 'blog.google') {
      return failRss ? textResponse('failed', { status: 503 }) : textResponse(rssXml);
    }
    if (url.hostname === 'hacker-news.firebaseio.com' && url.pathname.endsWith('/topstories.json')) {
      return jsonResponse([101], { headers: { 'x-request-id': 'hn-top' } });
    }
    if (url.hostname === 'hacker-news.firebaseio.com' && url.pathname.endsWith('/item/101.json')) {
      if (failHnItems) return jsonResponse({ error: 'temporary' }, { status: 503 });
      return jsonResponse({
        id: 101,
        type: 'story',
        title: 'OpenAI agent SDK gains new review controls',
        url: 'https://example.com/openai-agent-sdk-review-controls',
        time: Math.floor((now - 2 * 60 * 60 * 1000) / 1000),
        score: 180,
        descendants: 42
      });
    }
    if (url.hostname === 'api.github.com' && url.pathname.includes('/openai/openai-node/releases')) {
      return jsonResponse([{
        id: 200,
        html_url: 'https://evil.example/openai-release',
        name: 'malicious redirect',
        tag_name: 'bad',
        body: 'must be rejected',
        draft: false,
        prerelease: false,
        published_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
      }, {
        id: 201,
        html_url: 'https://github.com/openai/openai-node/releases/tag/v9.0.0',
        name: 'v9.0.0',
        tag_name: 'v9.0.0',
        body: 'Adds bounded agent review controls.',
        draft: false,
        prerelease: false,
        published_at: new Date(now - 3 * 60 * 60 * 1000).toISOString()
      }], { headers: { 'x-request-id': 'gh-openai' } });
    }
    if (url.hostname === 'api.github.com' && url.pathname.includes('/huggingface/transformers/releases')) {
      return jsonResponse([{
        id: 202,
        html_url: 'https://github.com/huggingface/transformers/releases/tag/v6.0.0',
        name: 'v6.0.0',
        tag_name: 'v6.0.0',
        body: 'New inference and model support.',
        draft: false,
        prerelease: false,
        published_at: new Date(now - 4 * 60 * 60 * 1000).toISOString()
      }], { headers: { 'x-request-id': 'gh-hf' } });
    }
    if (url.hostname === 'newsdata.io') {
      return jsonResponse({
        status: 'success',
        results: [{
          article_id: 'duplicate-google',
          title: 'Google launches Gemini agent tools',
          link: `${googleUrl}?utm_source=newsdata`,
          description: 'Duplicate discovery result.',
          source_name: 'Google',
          language: 'english',
          pubDate: new Date(now - 30 * 60 * 1000).toISOString()
        }, {
          article_id: 'news-unique',
          title: 'Independent report examines AI agent adoption',
          link: 'https://example.org/ai-agent-adoption-report',
          description: 'A separate report on adoption patterns.',
          source_name: 'Example Report',
          language: 'english',
          pubDate: new Date(now - 90 * 60 * 1000).toISOString()
        }]
      }, { headers: { 'x-request-id': 'newsdata-1' } });
    }
    return jsonResponse({ error: 'not found' }, { status: 404 });
  };
  return { mock, calls };
}

const first = createMockFetch();
const discovery = await discoverNewsSources({
  config: buildConfig(5),
  query: 'artificial intelligence OR AI technology',
  preferences: { preset_key: 'ai_technology', source_language: 'en', source_country: null, source_category: null },
  fetchImpl: first.mock
});
assert.equal(discovery.newsdataFallbackUsed, true);
assert.equal(discovery.articles.length, 5);
assert.equal(discovery.articles.filter((item) => item.url === googleUrl).length, 1);
assert.equal(discovery.articles.find((item) => item.url === googleUrl)?.provider, 'rss');
assert.equal(discovery.articles.some((item) => item.url.includes('evil.example/openai-release')), false);
assert.ok(discovery.providerResults.some((item) => item.provider === 'rss' && item.outcome === 'success'));
assert.ok(discovery.providerResults.some((item) => item.provider === 'newsdata' && item.outcome === 'success'));

const second = createMockFetch();
const noFallback = await discoverNewsSources({
  config: buildConfig(3),
  query: 'artificial intelligence OR AI technology',
  preferences: { preset_key: 'ai_technology', source_language: 'en', source_country: null, source_category: null },
  fetchImpl: second.mock
});
assert.equal(noFallback.newsdataFallbackUsed, false);
assert.equal(second.calls.some((url) => url.includes('newsdata.io')), false);
assert.equal(noFallback.articles.length, 3);

const legacy = await discoverNewsSources({
  config: { ...buildConfig(2), source: { mode: 'newsdata_only', enabledProviders: ['newsdata'] } },
  query: 'artificial intelligence OR AI technology',
  preferences: { preset_key: 'ai_technology', source_language: 'en', source_country: null, source_category: null },
  fetchImpl: createMockFetch().mock
});
assert.equal(legacy.newsdataFallbackUsed, false);
assert.deepEqual(legacy.providerResults.map((item) => item.provider), ['newsdata']);

const third = createMockFetch({ failRss: true });
const isolated = await discoverNewsSources({
  config: buildConfig(3),
  query: 'artificial intelligence OR AI technology',
  preferences: { preset_key: 'ai_technology', source_language: 'en', source_country: null, source_category: null },
  fetchImpl: third.mock
});
assert.ok(isolated.articles.length >= 2);
assert.ok(isolated.providerResults.some((item) => item.provider === 'rss' && item.outcome === 'failed'));
assert.ok(isolated.providerResults.some((item) => item.provider === 'github_releases' && item.outcome === 'success'));

const fourth = createMockFetch({ failHnItems: true });
const hnIsolated = await discoverNewsSources({
  config: buildConfig(3),
  query: 'artificial intelligence OR AI technology',
  preferences: { preset_key: 'ai_technology', source_language: 'en', source_country: null, source_category: null },
  fetchImpl: fourth.mock
});
assert.ok(hnIsolated.articles.length >= 2);
assert.ok(hnIsolated.providerResults.some((item) => item.provider === 'hacker_news' && item.outcome === 'failed'));
assert.ok(hnIsolated.providerResults.some((item) => item.provider === 'rss' && item.outcome === 'success'));

const oldEnv = { ...process.env };
try {
  process.env.AI_NEWS_DRAFT_MODE = 'operator';
  process.env.AI_NEWS_SOURCE_MODE = 'multi_source';
  process.env.AI_NEWS_ENABLED_PROVIDERS = 'rss,github_releases';
  delete process.env.NEWSDATA_API_KEY;
  process.env.OPENAI_API_KEY = 'openai-key';
  const config = getAiNewsDraftConfig({ strict: true });
  assert.equal(config.enabled, true);
  assert.equal(config.source.mode, 'multi_source');
  assert.deepEqual(config.source.enabledProviders, ['rss', 'github_releases']);
  assert.equal(config.newsdata.configured, false);
} finally {
  process.env = oldEnv;
}

const migration = fs.readFileSync(new URL('../migrations/033_ai_news_multi_source_quality_foundation.sql', import.meta.url), 'utf8');
for (const token of [
  "provider IN ('newsdata', 'rss', 'hacker_news', 'github_releases')",
  'source_authority_score',
  'source_is_primary',
  'source_metadata_json',
  "operation IN ('search_latest', 'discover_sources', 'generate_draft')"
]) {
  assert.ok(migration.includes(token), `missing migration contract: ${token}`);
}


const sourceRender = fs.readFileSync(new URL('../src/lib/telegram/aiNewsRender.js', import.meta.url), 'utf8');
assert.match(sourceRender, /Open source/);
assert.match(sourceRender, /Selection valid until/);
assert.match(sourceRender, /source_authority_score/);

const shareStore = fs.readFileSync(new URL('../src/lib/storage/linkedinShareStore.js', import.meta.url), 'utf8');
assert.doesNotMatch(shareStore, /discoverNewsSources|fetchTrustedRssSources|fetchHackerNewsStories|fetchGitHubReleases/);

console.log('OK: STEP063A multi-source ingestion and source-quality contract');
