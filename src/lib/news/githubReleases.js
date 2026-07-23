import { normalizeSourceArticle } from './sourceContract.js';
import { fetchTrustedProviderResponse, readBoundedJson } from './providerUtils.js';
import { listGitHubReposForPreset } from './sourceRegistry.js';

const GITHUB_API_BASE_URL = 'https://api.github.com/';
const GITHUB_API_HOSTS = ['api.github.com'];


function trustedReleaseUrl(value, registryItem) {
  try {
    const url = new URL(value);
    const expectedPrefix = `/${registryItem.owner}/${registryItem.repo}/releases/`;
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || !url.pathname.startsWith(expectedPrefix)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchRepositoryReleases(registryItem, options) {
  const startedAt = Date.now();
  const endpoint = new URL(`repos/${encodeURIComponent(registryItem.owner)}/${encodeURIComponent(registryItem.repo)}/releases`, GITHUB_API_BASE_URL);
  endpoint.searchParams.set('per_page', String(options.perRepo));
  endpoint.searchParams.set('page', '1');
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'IntroDeck-NewsBot/1.0'
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const { response, requestId, maxBytes } = await fetchTrustedProviderResponse(endpoint, {
    provider: 'github_releases',
    allowedHostnames: GITHUB_API_HOSTS,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    headers,
    maxBytes: options.maxBytes
  });
  const remainingMs = Math.max(1, options.timeoutMs - (Date.now() - startedAt));
  const payload = await readBoundedJson(response, maxBytes, { timeoutMs: remainingMs, provider: 'github_releases' });
  return { releases: Array.isArray(payload) ? payload : [], durationMs: Date.now() - startedAt, requestId };
}

export async function fetchGitHubReleases({
  presetKey,
  token = null,
  timeoutMs = 8000,
  maxSourceAgeHours = 48,
  maxArticles = 5,
  maxRepos = 2,
  perRepo = 2,
  maxBytes = 1_500_000,
  fetchImpl = fetch,
  profileContext = null
}) {
  const startedAt = Date.now();
  const repos = listGitHubReposForPreset(presetKey, { maxRepos, profileContext });
  if (!repos.length) {
    return { provider: 'github_releases', articles: [], rawResultCount: 0, durationMs: 0, requestId: null, detail: { configuredRepositories: 0 } };
  }
  const settled = await Promise.allSettled(repos.map((repo) => fetchRepositoryReleases(repo, {
    token,
    timeoutMs,
    perRepo,
    maxBytes,
    fetchImpl
  })));
  const cutoff = Date.now() - maxSourceAgeHours * 3_600_000;
  const articles = [];
  const failures = [];
  const requestIds = [];
  let rawResultCount = 0;
  let rejectedReleaseUrls = 0;
  let draftReleases = 0;
  let staleReleases = 0;
  let invalidDates = 0;
  let acceptedReleases = 0;
  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    const registryItem = repos[index];
    if (result.status === 'rejected') {
      failures.push({ repository: `${registryItem.owner}/${registryItem.repo}`, code: result.reason?.code || result.reason?.message || 'github_release_fetch_failed' });
      continue;
    }
    rawResultCount += result.value.releases.length;
    if (result.value.requestId) requestIds.push(result.value.requestId);
    for (const release of result.value.releases) {
      if (release?.draft) {
        draftReleases += 1;
        continue;
      }
      if (!release?.html_url) {
        rejectedReleaseUrls += 1;
        continue;
      }
      const releaseUrl = trustedReleaseUrl(release.html_url, registryItem);
      if (!releaseUrl) {
        rejectedReleaseUrls += 1;
        continue;
      }
      const publishedAt = release?.published_at || release?.created_at;
      const date = publishedAt ? new Date(publishedAt) : null;
      if (!date || Number.isNaN(date.getTime())) {
        invalidDates += 1;
        continue;
      }
      if (date.getTime() < cutoff) {
        staleReleases += 1;
        continue;
      }
      const releaseName = release?.name || release?.tag_name || 'release';
      const normalized = normalizeSourceArticle({
        providerArticleId: release.id,
        url: releaseUrl,
        title: `${registryItem.owner}/${registryItem.repo}: ${releaseName}`,
        description: release?.body,
        sourceName: `${registryItem.owner}/${registryItem.repo}`,
        publishedAt,
        language: 'en',
        categories: ['github_release', presetKey]
      }, {
        provider: 'github_releases',
        sourceKind: 'official_release',
        authorityScore: registryItem.authorityScore,
        isPrimary: true,
        metadata: {
          repository: `${registryItem.owner}/${registryItem.repo}`,
          tagName: release?.tag_name || null,
          prerelease: Boolean(release?.prerelease),
          presetKey,
          qualityTier: 'primary'
        }
      });
      if (normalized) {
        articles.push(normalized);
        acceptedReleases += 1;
      } else {
        rejectedReleaseUrls += 1;
      }
    }
  }
  articles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  return {
    provider: 'github_releases',
    articles: articles.slice(0, maxArticles),
    rawResultCount,
    durationMs: Date.now() - startedAt,
    requestId: requestIds[0] || null,
    detail: {
      configuredRepositories: repos.length,
      successfulRepositories: repos.length - failures.length,
      failedRepositories: failures.length,
      authenticated: Boolean(token),
      rejectedReleaseUrls,
      draftReleases,
      staleReleases,
      invalidDates,
      acceptedReleases,
      noResultReason: articles.length ? null
        : failures.length === repos.length ? 'repository_fetch_failed'
          : staleReleases ? 'outside_freshness_window'
            : rawResultCount ? 'no_eligible_release' : 'empty_release_feed',
      failures
    }
  };
}
