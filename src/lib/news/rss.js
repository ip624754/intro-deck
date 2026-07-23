import { normalizeSourceArticle, safeSourceText } from './sourceContract.js';
import { fetchTrustedProviderResponse, NewsSourceProviderError, readBoundedText } from './providerUtils.js';
import { listRssSourcesForPreset } from './sourceRegistry.js';

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function tagValue(block, names) {
  for (const name of names) {
    const escaped = name.replace(':', '\\:');
    const match = block.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    if (match) return decodeXmlEntities(match[1]);
  }
  return null;
}

function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*)\/?\s*>/gi)];
  for (const match of links) {
    const attributes = match[1] || '';
    const href = attributes.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const rel = attributes.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] || 'alternate';
    if (href && ['alternate', ''].includes(rel.toLowerCase())) return decodeXmlEntities(href);
  }
  return links[0]?.[1]?.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || null;
}

function rssLink(block) {
  const raw = tagValue(block, ['link']);
  if (raw && /^\s*https?:\/\//i.test(raw.replace(/<[^>]*>/g, '').trim())) return raw.replace(/<[^>]*>/g, '').trim();
  return atomLink(block);
}

function articleHostnameAllowed(urlValue, source) {
  if (!Array.isArray(source?.allowedArticleHostnames) || !source.allowedArticleHostnames.length) return false;
  let hostname;
  try { hostname = new URL(urlValue).hostname.toLowerCase(); } catch { return false; }
  return source.allowedArticleHostnames.some((allowed) => {
    const normalized = String(allowed || '').toLowerCase();
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

function itemBlocks(xml) {
  const rssItems = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  if (rssItems.length) return rssItems;
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) => match[1]);
}

function queryTerms(query, source) {
  const fromQuery = String(query || '')
    .toLowerCase()
    .replace(/\bor\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 2 && !['artificial', 'technology', 'business', 'growth'].includes(term));
  return [...new Set([...(source.matchTerms || []), ...fromQuery])];
}

function matchesTerms(article, terms) {
  if (!terms.length) return true;
  const tokens = `${article.title || ''} ${article.description || ''}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const tokenSet = new Set(tokens);
  return terms.some((term) => {
    const normalized = String(term).toLowerCase();
    return normalized.length <= 3 ? tokenSet.has(normalized) : tokenSet.has(normalized) || tokens.some((token) => token.startsWith(`${normalized}-`));
  });
}

function parseFeedDetailed(xml, {
  source,
  query,
  maxSourceAgeHours = 48,
  maxArticles = 5,
  nowMs = Date.now()
}) {
  const cutoff = nowMs - maxSourceAgeHours * 3_600_000;
  const terms = queryTerms(query, source);
  const blocks = itemBlocks(String(xml || '')).slice(0, 80);
  const articles = [];
  const diagnostics = {
    registryKey: source.key,
    itemCount: blocks.length,
    invalidItems: 0,
    rejectedArticleHosts: 0,
    staleItems: 0,
    queryMismatches: 0,
    acceptedItems: 0
  };
  for (const block of blocks) {
    const title = safeSourceText(tagValue(block, ['title']), 600);
    const url = rssLink(block);
    const publishedAt = tagValue(block, ['pubDate', 'published', 'updated', 'dc:date']);
    const description = tagValue(block, ['description', 'summary']);
    const content = tagValue(block, ['content:encoded', 'content']);
    const providerArticleId = safeSourceText(tagValue(block, ['guid', 'id']), 240);
    const author = safeSourceText(tagValue(block, ['author', 'dc:creator']), 200);
    const normalized = normalizeSourceArticle({
      providerArticleId,
      url,
      title,
      description,
      contentExcerpt: content,
      sourceName: source.name,
      publishedAt,
      language: 'en',
      categories: [source.key, 'rss'],
      metadata: { registryKey: source.key, author, presetKey: source.presetKeys?.[0] || null }
    }, {
      provider: 'rss',
      sourceKind: source.sourceKind,
      authorityScore: source.authorityScore,
      isPrimary: true,
      metadata: { registryKey: source.key, author, qualityTier: 'primary' }
    });
    if (!normalized) {
      diagnostics.invalidItems += 1;
      continue;
    }
    if (!articleHostnameAllowed(normalized.url, source)) {
      diagnostics.rejectedArticleHosts += 1;
      continue;
    }
    if (normalized.publishedAt.getTime() < cutoff) {
      diagnostics.staleItems += 1;
      continue;
    }
    if (!matchesTerms(normalized, terms)) {
      diagnostics.queryMismatches += 1;
      continue;
    }
    articles.push(normalized);
    diagnostics.acceptedItems += 1;
    if (articles.length >= maxArticles) break;
  }
  return { articles, diagnostics };
}

export function parseRssOrAtomFeed(xml, options) {
  return parseFeedDetailed(xml, options).articles;
}

async function fetchOneFeed(source, options) {
  const startedAt = Date.now();
  const { response, requestId, maxBytes } = await fetchTrustedProviderResponse(source.feedUrl, {
    provider: 'rss',
    allowedHostnames: source.allowedHostnames,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    headers: {
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
      'user-agent': 'IntroDeck-NewsBot/1.0'
    },
    maxBytes: options.maxBytes
  });
  const remainingMs = Math.max(1, options.timeoutMs - (Date.now() - startedAt));
  const xml = await readBoundedText(response, maxBytes, { timeoutMs: remainingMs, provider: 'rss' });
  if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) {
    throw new NewsSourceProviderError('rss_invalid_document', { provider: 'rss', code: 'invalid_xml_document', durationMs: Date.now() - startedAt });
  }
  const parsed = parseFeedDetailed(xml, { source, ...options });
  return {
    articles: parsed.articles,
    durationMs: Date.now() - startedAt,
    requestId,
    registryKey: source.key,
    diagnostics: parsed.diagnostics
  };
}

function safeFailureCode(error) {
  return String(error?.code || error?.message || 'rss_fetch_failed')
    .trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').slice(0, 100) || 'rss_fetch_failed';
}

export async function fetchTrustedRssSources({
  presetKey,
  query,
  timeoutMs = 8000,
  maxSourceAgeHours = 48,
  maxArticles = 5,
  maxSources = 2,
  maxBytes = 1_500_000,
  fetchImpl = fetch,
  profileContext = null
}) {
  const startedAt = Date.now();
  const sources = listRssSourcesForPreset(presetKey, { maxSources, profileContext });
  if (!sources.length) {
    return { provider: 'rss', articles: [], rawResultCount: 0, durationMs: 0, requestId: null, detail: { configuredSources: 0, sourceDiagnostics: [] } };
  }
  const settled = await Promise.allSettled(sources.map((source) => fetchOneFeed(source, {
    query,
    timeoutMs,
    maxSourceAgeHours,
    maxArticles,
    maxBytes,
    fetchImpl
  })));
  const articles = [];
  const failures = [];
  const requestIds = [];
  const sourceDiagnostics = [];
  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    if (result.status === 'fulfilled') {
      articles.push(...result.value.articles);
      sourceDiagnostics.push(result.value.diagnostics);
      if (result.value.requestId) requestIds.push(result.value.requestId);
    } else {
      const code = safeFailureCode(result.reason);
      failures.push({ registryKey: sources[index].key, code });
      sourceDiagnostics.push({ registryKey: sources[index].key, outcome: 'failed', errorCode: code });
    }
  }
  const allFailed = failures.length === sources.length;
  const failureCodes = [...new Set(failures.map((failure) => failure.code))];
  return {
    provider: 'rss',
    articles,
    rawResultCount: sourceDiagnostics.reduce((sum, item) => sum + Number(item.itemCount || 0), 0),
    durationMs: Date.now() - startedAt,
    requestId: requestIds[0] || null,
    error: allFailed ? {
      code: failureCodes.length === 1 ? `rss_${failureCodes[0]}` : 'rss_all_sources_failed',
      status: null,
      retryable: failureCodes.some((code) => ['timeout', 'body_timeout', 'network_error', 'http_429', 'http_500', 'http_502', 'http_503', 'http_504'].includes(code))
    } : null,
    detail: {
      configuredSources: sources.length,
      successfulSources: sources.length - failures.length,
      failedSources: failures.length,
      failureCodes,
      failures,
      sourceDiagnostics
    }
  };
}
