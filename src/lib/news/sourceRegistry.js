const RSS_REGISTRY = Object.freeze([
  Object.freeze({
    key: 'google_blog',
    name: 'Google Blog',
    feedUrl: 'https://blog.google/feed/',
    allowedHostnames: ['blog.google'],
    allowedArticleHostnames: ['blog.google'],
    presetKeys: ['ai_technology', 'business_growth'],
    matchTerms: ['ai', 'gemini', 'deepmind', 'cloud', 'startup', 'business', 'developer'],
    authorityScore: 96,
    sourceKind: 'official_blog'
  }),
  Object.freeze({
    key: 'github_blog',
    name: 'GitHub Blog',
    feedUrl: 'https://github.blog/feed/',
    allowedHostnames: ['github.blog'],
    allowedArticleHostnames: ['github.blog'],
    presetKeys: ['ai_technology', 'business_growth'],
    matchTerms: ['copilot', 'ai', 'agent', 'developer', 'security', 'enterprise', 'productivity'],
    authorityScore: 95,
    sourceKind: 'official_blog'
  }),
  Object.freeze({
    key: 'ethereum_foundation_blog',
    name: 'Ethereum Foundation Blog',
    feedUrl: 'https://blog.ethereum.org/feed.xml',
    allowedHostnames: ['blog.ethereum.org'],
    allowedArticleHostnames: ['blog.ethereum.org'],
    presetKeys: ['crypto_web3'],
    matchTerms: [],
    authorityScore: 98,
    sourceKind: 'official_blog'
  })
]);

const GITHUB_RELEASE_REGISTRY = Object.freeze([
  Object.freeze({ owner: 'openai', repo: 'openai-node', presetKeys: ['ai_technology'], authorityScore: 98 }),
  Object.freeze({ owner: 'huggingface', repo: 'transformers', presetKeys: ['ai_technology'], authorityScore: 96 }),
  Object.freeze({ owner: 'vercel', repo: 'ai', presetKeys: ['ai_technology', 'business_growth'], authorityScore: 94 }),
  Object.freeze({ owner: 'stripe', repo: 'stripe-node', presetKeys: ['business_growth'], authorityScore: 94 }),
  Object.freeze({ owner: 'ethereum', repo: 'go-ethereum', presetKeys: ['crypto_web3'], authorityScore: 98 }),
  Object.freeze({ owner: 'bitcoin', repo: 'bitcoin', presetKeys: ['crypto_web3'], authorityScore: 98 })
]);


const FIRST_PARTY_DOMAIN_SCORES = Object.freeze({
  'openai.com': 98,
  'anthropic.com': 98,
  'deepmind.google': 98,
  'blog.google': 96,
  'github.blog': 95,
  'cloudflare.com': 95,
  'blog.cloudflare.com': 95,
  'vercel.com': 94,
  'stripe.com': 94,
  'blog.ethereum.org': 98,
  'ethereum.org': 97,
  'solana.com': 97,
  'bitcoin.org': 97
});

const EDITORIAL_DOMAIN_SCORES = Object.freeze({
  'reuters.com': { authorityScore: 92, qualityTier: 'high' },
  'apnews.com': { authorityScore: 92, qualityTier: 'high' },
  'bloomberg.com': { authorityScore: 90, qualityTier: 'high' },
  'ft.com': { authorityScore: 90, qualityTier: 'high' },
  'wsj.com': { authorityScore: 89, qualityTier: 'high' },
  'techcrunch.com': { authorityScore: 86, qualityTier: 'high' },
  'arstechnica.com': { authorityScore: 85, qualityTier: 'high' },
  'theverge.com': { authorityScore: 84, qualityTier: 'high' },
  'wired.com': { authorityScore: 84, qualityTier: 'high' },
  'coindesk.com': { authorityScore: 84, qualityTier: 'high' },
  'theblock.co': { authorityScore: 84, qualityTier: 'high' },
  'blockworks.co': { authorityScore: 82, qualityTier: 'high' },
  'decrypt.co': { authorityScore: 80, qualityTier: 'standard' },
  'techinasia.com': { authorityScore: 76, qualityTier: 'standard' },
  'cointelegraph.com': { authorityScore: 74, qualityTier: 'standard' },
  'blockchain.news': { authorityScore: 68, qualityTier: 'standard' },
  'mpost.io': { authorityScore: 55, qualityTier: 'low' },
  'coinpedia.org': { authorityScore: 46, qualityTier: 'low' }
});

function domainMatch(normalized, domain) {
  return normalized === domain || normalized.endsWith(`.${domain}`);
}

export function classifySourceDomain(hostname) {
  const normalized = String(hostname || '').toLowerCase().replace(/^www\./, '');
  for (const [domain, authorityScore] of Object.entries(FIRST_PARTY_DOMAIN_SCORES)) {
    if (domainMatch(normalized, domain)) {
      return { isPrimary: true, authorityScore, sourceKind: 'official_blog', qualityTier: 'primary' };
    }
  }
  for (const [domain, policy] of Object.entries(EDITORIAL_DOMAIN_SCORES)) {
    if (domainMatch(normalized, domain)) {
      return { isPrimary: false, sourceKind: 'news_report', ...policy };
    }
  }
  return { isPrimary: false, authorityScore: 60, sourceKind: 'news_report', qualityTier: 'standard' };
}

export function listRssSourcesForPreset(presetKey, { maxSources = 2 } = {}) {
  if (presetKey === 'custom') return [];
  return RSS_REGISTRY.filter((source) => source.presetKeys.includes(presetKey)).slice(0, maxSources);
}

export function listGitHubReposForPreset(presetKey, { maxRepos = 2 } = {}) {
  if (presetKey === 'custom') return [];
  return GITHUB_RELEASE_REGISTRY.filter((source) => source.presetKeys.includes(presetKey)).slice(0, maxRepos);
}

export function publicSourceRegistrySummary() {
  return {
    rss: RSS_REGISTRY.map(({ key, name, presetKeys }) => ({ key, name, presetKeys })),
    githubReleases: GITHUB_RELEASE_REGISTRY.map(({ owner, repo, presetKeys }) => ({ repository: `${owner}/${repo}`, presetKeys }))
  };
}
