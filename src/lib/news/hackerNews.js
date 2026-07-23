import { normalizeSourceArticle } from './sourceContract.js';
import { fetchTrustedProviderResponse, readBoundedJson } from './providerUtils.js';
import { classifySourceDomain } from './sourceRegistry.js';

const HN_BASE_URL = 'https://hacker-news.firebaseio.com/v0/';
const HN_HOSTS = ['hacker-news.firebaseio.com'];

function queryTerms(query) {
  return [...new Set(String(query || '')
    .toLowerCase()
    .replace(/\bor\b/g, ' ')
    .replace(/[^\p{L}\p{N}+#.-]+/gu, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 2 && !['technology', 'business', 'growth'].includes(term)))];
}

function matchesQuery(item, terms) {
  if (!terms.length) return true;
  const tokens = `${item?.title || ''} ${item?.text || ''}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.-]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return terms.some((term) => tokens.some((token) => token === term || (term === 'ai' && token.endsWith('ai'))));
}

async function fetchJson(path, options) {
  const startedAt = Date.now();
  const { response, requestId, maxBytes } = await fetchTrustedProviderResponse(new URL(path, HN_BASE_URL), {
    provider: 'hacker_news',
    allowedHostnames: HN_HOSTS,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    headers: { accept: 'application/json', 'user-agent': 'IntroDeck-NewsBot/1.0' },
    maxBytes: options.maxBytes
  });
  const remainingMs = Math.max(1, options.timeoutMs - (Date.now() - startedAt));
  const payload = await readBoundedJson(response, maxBytes, { timeoutMs: remainingMs, provider: 'hacker_news' });
  return { payload, durationMs: Date.now() - startedAt, requestId };
}

export async function fetchHackerNewsStories({
  query,
  timeoutMs = 7000,
  maxSourceAgeHours = 48,
  maxArticles = 5,
  scanLimit = 12,
  minScore = 10,
  maxBytes = 1_000_000,
  fetchImpl = fetch
}) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeoutMs;
  const top = await fetchJson('topstories.json', { timeoutMs: Math.max(1, deadlineAt - Date.now()), maxBytes, fetchImpl });
  const ids = Array.isArray(top.payload) ? top.payload.slice(0, scanLimit) : [];
  const terms = queryTerms(query);
  const cutoff = Date.now() - maxSourceAgeHours * 3_600_000;
  const items = [];
  let failedStoryLoads = 0;
  let deadlineExceeded = false;

  for (let offset = 0; offset < ids.length; offset += 4) {
    const batch = ids.slice(offset, offset + 4);
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      failedStoryLoads += ids.length - offset;
      deadlineExceeded = true;
      break;
    }
    const settled = await Promise.allSettled(batch.map((id) => fetchJson(`item/${Number(id)}.json`, { timeoutMs: remainingMs, maxBytes, fetchImpl })));
    if (Date.now() >= deadlineAt && offset + batch.length < ids.length) deadlineExceeded = true;
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value.payload) items.push(result.value.payload);
      else failedStoryLoads += 1;
    }
  }

  const articles = [];
  let invalidStories = 0;
  let staleStories = 0;
  let belowScoreStories = 0;
  let queryMismatchStories = 0;
  let rejectedSourceUrls = 0;
  for (const item of items) {
    const publishedAt = Number(item?.time) > 0 ? new Date(Number(item.time) * 1000) : null;
    if (item?.type !== 'story' || !item?.url || !publishedAt) {
      invalidStories += 1;
      continue;
    }
    if (publishedAt.getTime() < cutoff) {
      staleStories += 1;
      continue;
    }
    if (Number(item.score || 0) < minScore) {
      belowScoreStories += 1;
      continue;
    }
    if (!matchesQuery(item, terms)) {
      queryMismatchStories += 1;
      continue;
    }
    let sourceDomain = null;
    try { sourceDomain = new URL(item.url).hostname.toLowerCase(); } catch { sourceDomain = null; }
    const domainClass = classifySourceDomain(sourceDomain);
    const normalized = normalizeSourceArticle({
      providerArticleId: item.id,
      url: item.url,
      title: item.title,
      description: `Discovered via Hacker News: score ${Number(item.score || 0)}, comments ${Number(item.descendants || 0)}.`,
      sourceName: sourceDomain || 'Hacker News',
      publishedAt,
      language: 'en',
      categories: ['hacker_news', 'trend_signal']
    }, {
      provider: 'hacker_news',
      sourceKind: domainClass.isPrimary ? domainClass.sourceKind : 'community_signal',
      authorityScore: domainClass.isPrimary ? domainClass.authorityScore : 55,
      isPrimary: domainClass.isPrimary,
      trendScore: Number(item.score || 0) + Math.round(Number(item.descendants || 0) * 0.25),
      metadata: {
        hackerNewsItemId: Number(item.id),
        hackerNewsUrl: `https://news.ycombinator.com/item?id=${Number(item.id)}`,
        score: Number(item.score || 0),
        comments: Number(item.descendants || 0),
        originalSourceDomain: sourceDomain,
        qualityTier: domainClass.qualityTier || (domainClass.isPrimary ? 'primary' : 'standard')
      }
    });
    if (normalized) articles.push(normalized);
    else rejectedSourceUrls += 1;
    if (articles.length >= maxArticles) break;
  }

  return {
    provider: 'hacker_news',
    articles,
    rawResultCount: items.length,
    durationMs: Date.now() - startedAt,
    requestId: top.requestId,
    detail: {
      scannedStoryIds: ids.length,
      loadedStories: items.length,
      failedStoryLoads,
      minimumScore: minScore,
      deadlineExceeded,
      invalidStories,
      staleStories,
      belowScoreStories,
      queryMismatchStories,
      rejectedSourceUrls,
      acceptedStories: articles.length,
      noResultReason: articles.length ? null
        : failedStoryLoads === ids.length && ids.length ? 'story_loads_failed'
          : queryMismatchStories ? 'query_mismatch'
            : belowScoreStories ? 'below_minimum_score'
              : staleStories ? 'outside_freshness_window'
                : invalidStories ? 'invalid_story_shape'
                  : ids.length ? 'no_matching_story' : 'empty_top_stories'
    }
  };
}
