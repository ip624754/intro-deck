import { normalizeSourceUrl } from '../ai/newsDraftContract.js';
import { fetchTrustedProviderResponse, NewsSourceProviderError, readBoundedJson } from './providerUtils.js';

export class NewsDataApiError extends Error {
  constructor(message, { status = null, code = null, requestId = null, durationMs = null } = {}) {
    super(message);
    this.name = 'NewsDataApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.durationMs = Number.isFinite(Number(durationMs)) ? Number(durationMs) : null;
  }
}

function safeText(value, maxLength) {
  const normalized = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function parsePublishedAt(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeArticle(item) {
  let url;
  try {
    url = normalizeSourceUrl(item?.link || item?.url);
  } catch {
    return null;
  }
  const publishedAt = parsePublishedAt(item?.pubDate || item?.pubDateTZ || item?.published_at);
  const title = safeText(item?.title, 600);
  if (!title || !publishedAt) return null;
  const sourceDomain = (() => {
    try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
  })();
  return {
    providerArticleId: safeText(item?.article_id || item?.id, 240),
    url,
    title,
    description: safeText(item?.description, 1600),
    contentExcerpt: safeText(item?.content, 2400),
    sourceName: safeText(item?.source_name || item?.source_id, 200),
    sourceDomain,
    language: safeText(item?.language, 16),
    country: Array.isArray(item?.country) ? safeText(item.country[0], 16) : safeText(item?.country, 16),
    categories: Array.isArray(item?.category) ? item.category.slice(0, 8).map((value) => String(value).slice(0, 40)) : [],
    publishedAt
  };
}

export async function fetchNewsDataLatest({
  apiKey,
  baseUrl,
  query,
  language = 'en',
  country = null,
  category = null,
  timeoutMs = 8000,
  maxSourceAgeHours = 48,
  maxArticles = 5,
  fetchImpl = fetch
}) {
  const endpoint = new URL('latest', String(baseUrl || 'https://newsdata.io/api/1/').replace(/\/?$/, '/'));
  endpoint.searchParams.set('apikey', apiKey);
  endpoint.searchParams.set('q', query);
  if (language) endpoint.searchParams.set('language', language);
  if (country) endpoint.searchParams.set('country', country);
  if (category) endpoint.searchParams.set('category', category);

  const startedAt = Date.now();
  let response;
  let requestId = null;
  let durationMs = null;
  let maxBytes = 1_500_000;
  try {
    const trusted = await fetchTrustedProviderResponse(endpoint, {
      provider: 'newsdata',
      allowedHostnames: ['newsdata.io', 'www.newsdata.io'],
      timeoutMs,
      fetchImpl,
      headers: { accept: 'application/json', 'user-agent': 'IntroDeck-NewsBot/1.0' },
      maxBytes
    });
    response = trusted.response;
    requestId = trusted.requestId;
    durationMs = trusted.durationMs;
    maxBytes = trusted.maxBytes;
  } catch (error) {
    if (error instanceof NewsSourceProviderError) {
      throw new NewsDataApiError(
        error.code === 'timeout' ? 'newsdata_timeout' : error.message || 'newsdata_request_failed',
        { status: error.status, code: error.code, requestId: error.requestId, durationMs: error.durationMs }
      );
    }
    throw new NewsDataApiError('newsdata_internal_error', { durationMs: Date.now() - startedAt });
  }

  let payload;
  try {
    const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
    payload = await readBoundedJson(response, maxBytes, { timeoutMs: remainingMs, provider: 'newsdata' });
  } catch (error) {
    const code = error instanceof NewsSourceProviderError ? error.code : null;
    const mappedCode = code === 'response_too_large' ? 'response_too_large'
      : code === 'body_timeout' ? 'body_timeout'
        : 'invalid_json';
    throw new NewsDataApiError(
      mappedCode === 'response_too_large' ? 'newsdata_response_too_large'
        : mappedCode === 'body_timeout' ? 'newsdata_body_timeout'
          : 'newsdata_invalid_json',
      {
        status: response.status,
        code: mappedCode,
        requestId,
        durationMs: Date.now() - startedAt
      }
    );
  }
  if (!response.ok || payload?.status === 'error') {
    throw new NewsDataApiError(
      safeText(payload?.results?.message || payload?.message || `newsdata_http_${response.status}`, 300) || 'newsdata_request_failed',
      { status: response.status, code: safeText(payload?.results?.code || payload?.code, 100), requestId, durationMs: Date.now() - startedAt }
    );
  }

  const cutoff = Date.now() - (maxSourceAgeHours * 60 * 60 * 1000);
  const seen = new Set();
  const articles = [];
  for (const item of Array.isArray(payload?.results) ? payload.results : []) {
    const article = normalizeArticle(item);
    if (!article || article.publishedAt.getTime() < cutoff || seen.has(article.url)) continue;
    seen.add(article.url);
    articles.push(article);
    if (articles.length >= maxArticles) break;
  }
  return {
    articles,
    nextPage: safeText(payload?.nextPage, 240),
    requestId,
    durationMs: Date.now() - startedAt,
    rawResultCount: Array.isArray(payload?.results) ? payload.results.length : 0
  };
}
