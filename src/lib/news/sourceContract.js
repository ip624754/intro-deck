import { normalizeSourceUrl } from '../ai/newsDraftContract.js';

const TRACKING_KEYS = /^(?:utm_|fbclid$|gclid$|dclid$|msclkid$|mc_cid$|mc_eid$|vero_id$|oly_anon_id$|oly_enc_id$)/i;
const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'will', 'with',
  'и', 'в', 'во', 'на', 'с', 'со', 'для', 'из', 'по', 'о', 'об', 'что', 'это', 'как', 'к', 'от'
]);

export function safeSourceText(value, maxLength) {
  const normalized = String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function parseSourcePublishedAt(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function canonicalizeSourceUrl(value) {
  const normalized = normalizeSourceUrl(value);
  const url = new URL(normalized);
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_KEYS.test(key)) url.searchParams.delete(key);
  }
  const sorted = [...url.searchParams.entries()].sort(([aKey, aValue], [bKey, bValue]) => (
    aKey.localeCompare(bKey) || aValue.localeCompare(bValue)
  ));
  url.search = '';
  for (const [key, item] of sorted) url.searchParams.append(key, item);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export function sourceUrlDedupeKey(value) {
  const url = new URL(canonicalizeSourceUrl(value));
  const hostname = url.hostname.replace(/^www\./, '');
  return `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search}`;
}

function sourceDomain(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeSourceArticle(article, {
  provider,
  sourceKind = 'news_report',
  authorityScore = 50,
  isPrimary = false,
  trendScore = 0,
  metadata = null
} = {}) {
  let url;
  try {
    url = canonicalizeSourceUrl(article?.url || article?.link || article?.html_url);
  } catch {
    return null;
  }
  const title = safeSourceText(article?.title || article?.name, 600);
  const publishedAt = parseSourcePublishedAt(article?.publishedAt || article?.published_at || article?.pubDate || article?.updated_at);
  if (!provider || !title || !publishedAt) return null;

  return {
    provider,
    providerArticleId: safeSourceText(article?.providerArticleId || article?.provider_article_id || article?.id, 240),
    url,
    dedupeKey: sourceUrlDedupeKey(url),
    title,
    description: safeSourceText(article?.description || article?.summary, 1600),
    contentExcerpt: safeSourceText(article?.contentExcerpt || article?.content_excerpt || article?.content || article?.body, 2400),
    sourceName: safeSourceText(article?.sourceName || article?.source_name, 200),
    sourceDomain: sourceDomain(url),
    language: safeSourceText(article?.language, 16),
    country: safeSourceText(article?.country, 16),
    categories: Array.isArray(article?.categories)
      ? article.categories.slice(0, 8).map((item) => String(item).slice(0, 40))
      : [],
    publishedAt,
    sourceKind,
    authorityScore: Math.max(0, Math.min(100, Math.round(Number(authorityScore) || 0))),
    isPrimary: Boolean(isPrimary),
    trendScore: Math.max(0, Math.min(1_000_000, Math.round(Number(trendScore) || 0))),
    metadata: metadata && typeof metadata === 'object' ? metadata : null
  };
}

export function titleTokens(value) {
  return [...new Set(String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !TITLE_STOP_WORDS.has(token)))];
}

export function titleSimilarity(left, right) {
  const a = new Set(titleTokens(left));
  const b = new Set(titleTokens(right));
  if (a.size < 3 || b.size < 3) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function articleRank(article, nowMs = Date.now()) {
  const ageHours = Math.max(0, (nowMs - article.publishedAt.getTime()) / 3_600_000);
  const freshness = Math.max(0, 2_000 - Math.round(ageHours * 35));
  const primary = article.isPrimary ? 20_000 : 0;
  const trend = Math.min(2_000, Math.round(Math.log10(1 + article.trendScore) * 600));
  const directDiscovery = ['rss', 'github_releases'].includes(article.provider) ? 5_000 : 0;
  const relevance = Math.max(0, Math.min(100, Number(article?.metadata?.relevanceScore) || 0));
  return article.authorityScore * 5_000 + relevance * 2_500 + primary + directDiscovery + freshness + trend;
}

function preferArticle(current, candidate) {
  if (!current) return candidate;
  const currentRank = articleRank(current);
  const candidateRank = articleRank(candidate);
  if (candidateRank !== currentRank) return candidateRank > currentRank ? candidate : current;
  return candidate.publishedAt.getTime() > current.publishedAt.getTime() ? candidate : current;
}

export function deduplicateAndRankSources(articles, {
  maxArticles = 5,
  titleSimilarityThreshold = 0.82,
  maxPerProvider = 2
} = {}) {
  const byUrl = new Map();
  for (const article of Array.isArray(articles) ? articles : []) {
    if (!article?.dedupeKey || !article?.publishedAt) continue;
    byUrl.set(article.dedupeKey, preferArticle(byUrl.get(article.dedupeKey), article));
  }

  const ranked = [...byUrl.values()].sort((a, b) => articleRank(b) - articleRank(a));
  const titleDeduped = [];
  for (const article of ranked) {
    const duplicateIndex = titleDeduped.findIndex((existing) => titleSimilarity(existing.title, article.title) >= titleSimilarityThreshold);
    if (duplicateIndex === -1) {
      titleDeduped.push(article);
    } else {
      titleDeduped[duplicateIndex] = preferArticle(titleDeduped[duplicateIndex], article);
    }
  }
  titleDeduped.sort((a, b) => articleRank(b) - articleRank(a));

  const selected = [];
  const deferred = [];
  const providerCounts = new Map();
  for (const article of titleDeduped) {
    const count = providerCounts.get(article.provider) || 0;
    if (count < maxPerProvider && selected.length < maxArticles) {
      selected.push(article);
      providerCounts.set(article.provider, count + 1);
    } else {
      deferred.push(article);
    }
  }
  for (const article of deferred) {
    if (selected.length >= maxArticles) break;
    selected.push(article);
  }
  return selected;
}
