import { fetchNewsDataLatest, NewsDataApiError } from './newsdata.js';
import { fetchTrustedRssSources } from './rss.js';
import { fetchHackerNewsStories } from './hackerNews.js';
import { fetchGitHubReleases } from './githubReleases.js';
import { deduplicateAndRankSources, normalizeSourceArticle } from './sourceContract.js';
import { classifySourceDomain } from './sourceRegistry.js';

function providerOutcome(result) {
  if (result.error) return 'failed';
  if (result.articles?.length) return 'success';
  const detail = result.detail || {};
  const attempted = Number(detail.configuredSources || detail.configuredRepositories || detail.scannedStoryIds || 0);
  const succeeded = Number(detail.successfulSources || detail.successfulRepositories || detail.loadedStories || 0);
  const failed = Number(detail.failedSources || detail.failedRepositories || detail.failedStoryLoads || 0);
  if (attempted > 0 && succeeded === 0 && failed > 0) return 'failed';
  return 'no_result';
}

function normalizeProviderFailure(provider, error, startedAt) {
  return {
    provider,
    articles: [],
    rawResultCount: 0,
    durationMs: Number.isFinite(Number(error?.durationMs)) ? Number(error.durationMs) : Date.now() - startedAt,
    requestId: error?.requestId || null,
    error: {
      code: error?.code || error?.message || `${provider}_internal_error`,
      status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
      retryable: Boolean(error?.retryable)
    }
  };
}

async function runProvider(provider, task) {
  const startedAt = Date.now();
  try {
    const result = await task();
    return { ...result, provider, outcome: providerOutcome(result) };
  } catch (error) {
    const failed = normalizeProviderFailure(provider, error, startedAt);
    return { ...failed, outcome: 'failed' };
  }
}

function normalizeNewsDataArticles(result) {
  const articles = [];
  for (const article of result.articles || []) {
    const domainClass = classifySourceDomain(article.sourceDomain);
    const normalized = normalizeSourceArticle(article, {
      provider: 'newsdata',
      sourceKind: domainClass.sourceKind,
      authorityScore: domainClass.authorityScore,
      isPrimary: domainClass.isPrimary,
      metadata: { discoveryProvider: 'newsdata' }
    });
    if (normalized) articles.push(normalized);
  }
  return articles;
}

async function runNewsData({ config, query, preferences, fetchImpl }) {
  return runProvider('newsdata', async () => {
    try {
      const result = await fetchNewsDataLatest({
        apiKey: config.newsdata.apiKey,
        baseUrl: config.newsdata.baseUrl,
        query,
        language: preferences.source_language,
        country: preferences.source_country,
        category: preferences.source_category,
        timeoutMs: config.newsdata.timeoutMs,
        maxSourceAgeHours: config.maxSourceAgeHours,
        maxArticles: config.maxArticles,
        fetchImpl
      });
      return { ...result, articles: normalizeNewsDataArticles(result) };
    } catch (error) {
      if (error instanceof NewsDataApiError) {
        error.provider = 'newsdata';
        error.retryable = error.status === 429 || Number(error.status) >= 500 || !error.status;
      }
      throw error;
    }
  });
}

export async function discoverNewsSources({
  config,
  query,
  preferences,
  fetchImpl = fetch
}) {
  const source = config.source || { mode: 'newsdata_only', enabledProviders: ['newsdata'] };
  if (source.mode === 'newsdata_only') {
    const newsdata = await runNewsData({ config, query, preferences, fetchImpl });
    return {
      articles: deduplicateAndRankSources(newsdata.articles, { maxArticles: config.maxArticles }),
      providerResults: [newsdata],
      newsdataFallbackUsed: false
    };
  }

  const freeTasks = [];
  if (source.enabledProviders.includes('rss')) {
    freeTasks.push(runProvider('rss', () => fetchTrustedRssSources({
      presetKey: preferences.preset_key,
      query,
      timeoutMs: source.rssTimeoutMs,
      maxSourceAgeHours: config.maxSourceAgeHours,
      maxArticles: source.providerMaxArticles,
      maxSources: source.rssMaxFeedsPerSearch,
      fetchImpl
    })));
  }
  if (source.enabledProviders.includes('hacker_news')) {
    freeTasks.push(runProvider('hacker_news', () => fetchHackerNewsStories({
      query,
      timeoutMs: source.hackerNewsTimeoutMs,
      maxSourceAgeHours: config.maxSourceAgeHours,
      maxArticles: source.providerMaxArticles,
      scanLimit: source.hackerNewsScanLimit,
      minScore: source.hackerNewsMinScore,
      fetchImpl
    })));
  }
  if (source.enabledProviders.includes('github_releases')) {
    freeTasks.push(runProvider('github_releases', () => fetchGitHubReleases({
      presetKey: preferences.preset_key,
      token: source.githubToken,
      timeoutMs: source.githubTimeoutMs,
      maxSourceAgeHours: config.maxSourceAgeHours,
      maxArticles: source.providerMaxArticles,
      maxRepos: source.githubMaxReposPerSearch,
      fetchImpl
    })));
  }

  const providerResults = await Promise.all(freeTasks);
  let articles = deduplicateAndRankSources(providerResults.flatMap((result) => result.articles || []), {
    maxArticles: config.maxArticles
  });
  let newsdataFallbackUsed = false;

  if (source.enabledProviders.includes('newsdata') && config.newsdata.configured && articles.length < config.maxArticles) {
    const newsdata = await runNewsData({ config, query, preferences, fetchImpl });
    providerResults.push(newsdata);
    newsdataFallbackUsed = true;
    articles = deduplicateAndRankSources(providerResults.flatMap((result) => result.articles || []), {
      maxArticles: config.maxArticles
    });
  }

  return { articles, providerResults, newsdataFallbackUsed };
}
