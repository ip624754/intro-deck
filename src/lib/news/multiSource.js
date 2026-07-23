import { fetchNewsDataLatest, NewsDataApiError } from './newsdata.js';
import { fetchTrustedRssSources } from './rss.js';
import { fetchHackerNewsStories } from './hackerNews.js';
import { fetchGitHubReleases } from './githubReleases.js';
import { deduplicateAndRankSources, normalizeSourceArticle } from './sourceContract.js';
import { classifySourceDomain } from './sourceRegistry.js';
import { filterRelevantSources, resolveProviderDiscoveryQuery } from './sourceRelevance.js';

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
      metadata: {
        discoveryProvider: 'newsdata',
        qualityTier: domainClass.qualityTier,
        baseAuthorityScore: domainClass.authorityScore
      }
    });
    if (normalized) articles.push(normalized);
  }
  return articles;
}

function applyRelevance(result, {
  provider,
  presetKey,
  customQuery,
  providerQuery,
  profileContext,
  audienceKey,
  customAudience,
  angleKey,
  profileAffinityEnabled
}) {
  if (result?.error) return result;
  const relevant = filterRelevantSources(result?.articles || [], {
    provider,
    presetKey,
    customQuery,
    profileContext,
    audienceKey,
    customAudience,
    angleKey,
    profileAffinityEnabled
  });
  return {
    ...result,
    articles: relevant.articles,
    detail: {
      ...(result?.detail || {}),
      providerQuery,
      relevance: relevant.detail
    }
  };
}

async function runNewsData({ config, query, preferences, profileContext, fetchImpl }) {
  const providerQuery = resolveProviderDiscoveryQuery({
    presetKey: preferences.preset_key,
    customQuery: preferences.custom_query,
    provider: 'newsdata',
    fallbackQuery: query,
    profileContext,
    audienceKey: preferences.audience_key,
    customAudience: preferences.custom_audience,
    angleKey: preferences.angle_key
  });
  return runProvider('newsdata', async () => {
    try {
      const result = await fetchNewsDataLatest({
        apiKey: config.newsdata.apiKey,
        baseUrl: config.newsdata.baseUrl,
        query: providerQuery,
        language: preferences.source_language,
        country: preferences.source_country,
        category: preferences.source_category,
        timeoutMs: config.newsdata.timeoutMs,
        maxSourceAgeHours: config.maxSourceAgeHours,
        maxArticles: Math.min(10, Math.max(config.maxArticles * 2, config.source?.providerMaxArticles || config.maxArticles)),
        fetchImpl
      });
      return applyRelevance({ ...result, articles: normalizeNewsDataArticles(result) }, {
        provider: 'newsdata',
        presetKey: preferences.preset_key,
        customQuery: preferences.custom_query,
        providerQuery,
        profileContext,
        audienceKey: preferences.audience_key,
        customAudience: preferences.custom_audience,
        angleKey: preferences.angle_key,
        profileAffinityEnabled: preferences.profile_affinity_enabled
      });
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
  profileContext = null,
  fetchImpl = fetch
}) {
  const source = config.source || { mode: 'newsdata_only', enabledProviders: ['newsdata'] };
  if (source.mode === 'newsdata_only') {
    const newsdata = await runNewsData({ config, query, preferences, profileContext, fetchImpl });
    return {
      articles: deduplicateAndRankSources(newsdata.articles, { maxArticles: config.maxArticles }),
      providerResults: [newsdata],
      newsdataFallbackUsed: false
    };
  }

  const presetKey = preferences.preset_key;
  const customQuery = preferences.custom_query;
  const freeTasks = [];
  if (source.enabledProviders.includes('rss')) {
    const providerQuery = resolveProviderDiscoveryQuery({
      presetKey, customQuery, provider: 'rss', fallbackQuery: query, profileContext,
      audienceKey: preferences.audience_key, customAudience: preferences.custom_audience, angleKey: preferences.angle_key
    });
    freeTasks.push(runProvider('rss', async () => applyRelevance(await fetchTrustedRssSources({
      presetKey,
      query: providerQuery,
      timeoutMs: source.rssTimeoutMs,
      maxSourceAgeHours: config.maxSourceAgeHours,
      maxArticles: source.providerMaxArticles,
      maxSources: source.rssMaxFeedsPerSearch,
      fetchImpl,
      profileContext
    }), {
      provider: 'rss', presetKey, customQuery, providerQuery, profileContext,
      audienceKey: preferences.audience_key, customAudience: preferences.custom_audience,
      angleKey: preferences.angle_key, profileAffinityEnabled: preferences.profile_affinity_enabled
    })));
  }
  if (source.enabledProviders.includes('hacker_news')) {
    const providerQuery = resolveProviderDiscoveryQuery({
      presetKey, customQuery, provider: 'hacker_news', fallbackQuery: query, profileContext,
      audienceKey: preferences.audience_key, customAudience: preferences.custom_audience, angleKey: preferences.angle_key
    });
    freeTasks.push(runProvider('hacker_news', async () => applyRelevance(await fetchHackerNewsStories({
      query: providerQuery,
      timeoutMs: source.hackerNewsTimeoutMs,
      maxSourceAgeHours: config.maxSourceAgeHours,
      maxArticles: source.providerMaxArticles,
      scanLimit: source.hackerNewsScanLimit,
      minScore: source.hackerNewsMinScore,
      fetchImpl
    }), {
      provider: 'hacker_news', presetKey, customQuery, providerQuery, profileContext,
      audienceKey: preferences.audience_key, customAudience: preferences.custom_audience,
      angleKey: preferences.angle_key, profileAffinityEnabled: preferences.profile_affinity_enabled
    })));
  }
  if (source.enabledProviders.includes('github_releases')) {
    freeTasks.push(runProvider('github_releases', async () => applyRelevance(await fetchGitHubReleases({
      presetKey,
      token: source.githubToken,
      timeoutMs: source.githubTimeoutMs,
      maxSourceAgeHours: config.maxSourceAgeHours,
      maxArticles: source.providerMaxArticles,
      maxRepos: source.githubMaxReposPerSearch,
      fetchImpl,
      profileContext
    }), {
      provider: 'github_releases', presetKey, customQuery, providerQuery: `registry:${presetKey}`, profileContext,
      audienceKey: preferences.audience_key, customAudience: preferences.custom_audience,
      angleKey: preferences.angle_key, profileAffinityEnabled: preferences.profile_affinity_enabled
    })));
  }

  const providerResults = await Promise.all(freeTasks);
  let articles = deduplicateAndRankSources(providerResults.flatMap((result) => result.articles || []), {
    maxArticles: config.maxArticles
  });
  let newsdataFallbackUsed = false;

  if (source.enabledProviders.includes('newsdata') && config.newsdata.configured && articles.length < config.maxArticles) {
    const newsdata = await runNewsData({ config, query, preferences, profileContext, fetchImpl });
    providerResults.push(newsdata);
    newsdataFallbackUsed = true;
    articles = deduplicateAndRankSources(providerResults.flatMap((result) => result.articles || []), {
      maxArticles: config.maxArticles
    });
  }

  return { articles, providerResults, newsdataFallbackUsed };
}
