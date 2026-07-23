import { safeSourceText } from './sourceContract.js';

const PROMOTIONAL_REJECT_PATTERNS = Object.freeze([
  /\bpresale\b/i,
  /\bprice prediction\b/i,
  /\b(?:can|will)\s+[a-z0-9$._-]{2,20}\s+hit\s+\$?\d/i,
  /\bbest (?:crypto|coin|token)s? to buy\b/i,
  /\bnext\s+(?:10x|50x|100x|1000x)\b/i,
  /\bguaranteed returns?\b/i,
  /\bget rich\b/i,
  /\bpromo code\b/i,
  /\bsponsored (?:post|content|article)\b/i,
  /\badvertorial\b/i
]);

const PROMOTIONAL_PENALTY_PATTERNS = Object.freeze([
  /\bbull run\b/i,
  /\bprice target\b/i,
  /\bmarket forecast\b/i,
  /\btop \d+ (?:coins?|tokens?|cryptos?)\b/i,
  /\bbuy now\b/i,
  /\bto the moon\b/i,
  /\bairdrop\b/i,
  /\bgiveaway\b/i
]);

const PRESET_PROFILES = Object.freeze({
  ai_technology: Object.freeze({
    queries: Object.freeze({
      rss: 'AI OR Gemini OR Copilot OR machine learning',
      hacker_news: 'AI OR LLM OR AI agents OR machine learning',
      newsdata: 'artificial intelligence OR LLM OR AI agents OR machine learning'
    }),
    strongTerms: Object.freeze([
      'artificial intelligence', 'generative ai', 'machine learning', 'large language model', 'llm',
      'ai agent', 'ai agents', 'openai', 'anthropic', 'gemini', 'deepmind', 'copilot',
      'inference', 'neural network', 'foundation model'
    ]),
    supportTerms: Object.freeze([
      'model', 'agent', 'automation', 'robotics', 'developer tool', 'developer tools',
      'data center', 'semiconductor', 'chip', 'gpu', 'computer vision', 'speech model'
    ]),
    categoryTerms: Object.freeze(['ai', 'artificial intelligence', 'machine learning', 'technology'])
  }),
  business_growth: Object.freeze({
    queries: Object.freeze({
      rss: 'startup OR founder OR funding OR SaaS OR business growth',
      hacker_news: 'startup OR founder OR funding OR SaaS OR revenue',
      newsdata: 'startup OR founder OR funding OR SaaS OR business growth'
    }),
    strongTerms: Object.freeze([
      'startup', 'startups', 'founder', 'founders', 'entrepreneur', 'entrepreneurship',
      'venture capital', 'funding', 'fundraise', 'series a', 'series b', 'seed round',
      'saas', 'revenue', 'acquisition', 'ipo', 'business growth'
    ]),
    supportTerms: Object.freeze([
      'company', 'enterprise', 'market', 'sales', 'productivity', 'commerce', 'fintech',
      'customer', 'profit', 'cash flow', 'partnership', 'small business'
    ]),
    categoryTerms: Object.freeze(['business', 'startup', 'entrepreneurship', 'technology'])
  }),
  crypto_web3: Object.freeze({
    queries: Object.freeze({
      rss: 'crypto OR blockchain OR Ethereum OR Bitcoin OR Web3',
      hacker_news: 'crypto OR blockchain OR Ethereum OR Bitcoin OR Solana',
      newsdata: 'cryptocurrency OR blockchain OR Web3 OR Bitcoin OR Ethereum'
    }),
    strongTerms: Object.freeze([
      'crypto', 'cryptocurrency', 'blockchain', 'web3', 'bitcoin', 'btc', 'ethereum', 'eth',
      'solana', 'defi', 'stablecoin', 'token', 'wallet', 'smart contract', 'layer 2', 'layer2',
      'dao', 'nft', 'digital asset', 'onchain', 'on-chain'
    ]),
    supportTerms: Object.freeze([
      'exchange', 'validator', 'staking', 'protocol', 'mainnet', 'testnet', 'exploit',
      'bridge', 'liquidity', 'custody', 'mining', 'consensus', 'ledger'
    ]),
    categoryTerms: Object.freeze(['crypto', 'cryptocurrency', 'blockchain', 'web3'])
  })
});

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.$-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textTokens(value) {
  return new Set(normalizeText(value).split(/\s+/).filter(Boolean));
}

function containsTerm(text, tokens, term) {
  const normalized = normalizeText(term);
  if (!normalized) return false;
  if (normalized.includes(' ')) return ` ${text} `.includes(` ${normalized} `);
  if (normalized.length <= 3) return tokens.has(normalized);
  return tokens.has(normalized) || ` ${text} `.includes(` ${normalized} `);
}

function matchingTerms(value, terms) {
  const text = normalizeText(value);
  const tokens = textTokens(text);
  return [...new Set((terms || []).filter((term) => containsTerm(text, tokens, term)))];
}

function customTerms(query) {
  return [...new Set(normalizeText(query)
    .replace(/\bor\b/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 2 && !['and', 'or', 'the', 'for', 'with'].includes(term)))].slice(0, 12);
}

export function resolveProviderDiscoveryQuery({ presetKey, customQuery = null, provider, fallbackQuery }) {
  if (presetKey === 'custom') return safeSourceText(customQuery || fallbackQuery, 100) || '';
  const profile = PRESET_PROFILES[presetKey] || PRESET_PROFILES.ai_technology;
  return profile.queries[provider] || safeSourceText(fallbackQuery, 100) || '';
}

export function minimumRelevanceScore(provider, presetKey) {
  if (presetKey === 'custom') return provider === 'newsdata' ? 24 : 18;
  if (provider === 'newsdata') return 35;
  if (provider === 'hacker_news') return 32;
  return 24;
}

function promotionalAssessment(article) {
  const title = String(article?.title || '');
  const body = `${title} ${article?.description || ''} ${article?.contentExcerpt || ''}`;
  const rejectPattern = PROMOTIONAL_REJECT_PATTERNS.find((pattern) => pattern.test(body));
  const penaltyMatches = PROMOTIONAL_PENALTY_PATTERNS.filter((pattern) => pattern.test(body));
  return {
    rejected: Boolean(rejectPattern),
    rejectCode: rejectPattern ? 'promotional_content' : null,
    penalty: Math.min(30, penaltyMatches.length * 10),
    flags: penaltyMatches.length ? ['promotional_signals'] : []
  };
}

function presetAffinity(article, presetKey) {
  const categories = (article?.categories || []).map((value) => normalizeText(value));
  const metadataPreset = normalizeText(article?.metadata?.presetKey || article?.metadata?.preset_key);
  const registryKey = normalizeText(article?.metadata?.registryKey);
  if (metadataPreset === normalizeText(presetKey)) return 22;
  if (categories.includes(normalizeText(presetKey))) return 22;
  if (presetKey === 'crypto_web3' && registryKey.includes('ethereum')) return 22;
  if (presetKey === 'ai_technology' && ['google_blog', 'github_blog'].includes(registryKey)) return 8;
  if (article?.provider === 'github_releases' && categories.includes(normalizeText(presetKey))) return 22;
  return 0;
}

export function assessSourceRelevance(article, {
  presetKey = 'ai_technology',
  customQuery = null,
  provider = article?.provider
} = {}) {
  const title = String(article?.title || '');
  const body = `${article?.description || ''} ${article?.contentExcerpt || ''}`;
  const categories = (article?.categories || []).join(' ');
  const source = `${article?.sourceName || ''} ${article?.sourceDomain || ''}`;
  const promotion = promotionalAssessment(article);
  if (promotion.rejected && !article?.isPrimary) {
    return {
      accepted: false,
      score: 0,
      threshold: minimumRelevanceScore(provider, presetKey),
      reason: promotion.rejectCode,
      matchedTerms: [],
      qualityFlags: ['promotional_content']
    };
  }

  let strongTerms;
  let supportTerms;
  let categoryTerms;
  if (presetKey === 'custom') {
    strongTerms = customTerms(customQuery);
    supportTerms = [];
    categoryTerms = [];
  } else {
    const profile = PRESET_PROFILES[presetKey] || PRESET_PROFILES.ai_technology;
    strongTerms = profile.strongTerms;
    supportTerms = profile.supportTerms;
    categoryTerms = profile.categoryTerms;
  }

  const titleStrong = matchingTerms(title, strongTerms);
  const bodyStrong = matchingTerms(body, strongTerms);
  const titleSupport = matchingTerms(title, supportTerms);
  const bodySupport = matchingTerms(body, supportTerms);
  const categoryMatches = matchingTerms(categories, [...strongTerms, ...categoryTerms]);
  const exactCategoryMatches = matchingTerms(categories, categoryTerms);
  const sourceMatches = matchingTerms(source, strongTerms);

  let score = 0;
  score += Math.min(52, titleStrong.length * 26);
  score += Math.min(30, bodyStrong.length * 15);
  score += Math.min(18, titleSupport.length * 9);
  score += Math.min(12, bodySupport.length * 6);
  score += Math.min(18, categoryMatches.length * 9);
  score += exactCategoryMatches.length ? 18 : 0;
  score += Math.min(12, sourceMatches.length * 6);
  score += presetAffinity(article, presetKey);
  score -= promotion.penalty;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const threshold = minimumRelevanceScore(provider, presetKey);
  const matchedTerms = [...new Set([
    ...titleStrong, ...bodyStrong, ...titleSupport, ...bodySupport, ...categoryMatches, ...exactCategoryMatches, ...sourceMatches
  ])].slice(0, 12);
  return {
    accepted: score >= threshold,
    score,
    threshold,
    reason: score >= threshold ? null : 'below_relevance_threshold',
    matchedTerms,
    qualityFlags: promotion.flags
  };
}

export function filterRelevantSources(articles, options = {}) {
  const accepted = [];
  const rejectionCounts = {};
  const scores = [];
  for (const article of Array.isArray(articles) ? articles : []) {
    const assessment = assessSourceRelevance(article, options);
    scores.push(assessment.score);
    if (!assessment.accepted) {
      rejectionCounts[assessment.reason || 'rejected'] = (rejectionCounts[assessment.reason || 'rejected'] || 0) + 1;
      continue;
    }
    const qualityTier = article?.metadata?.qualityTier || (article?.isPrimary ? 'primary' : 'standard');
    accepted.push({
      ...article,
      metadata: {
        ...(article?.metadata || {}),
        relevanceScore: assessment.score,
        relevanceThreshold: assessment.threshold,
        relevanceMatchedTerms: assessment.matchedTerms,
        qualityTier,
        qualityFlags: assessment.qualityFlags
      }
    });
  }
  return {
    articles: accepted,
    detail: {
      evaluatedCount: Array.isArray(articles) ? articles.length : 0,
      acceptedCount: accepted.length,
      rejectedCount: (Array.isArray(articles) ? articles.length : 0) - accepted.length,
      rejectionCounts,
      minimumScore: minimumRelevanceScore(options.provider, options.presetKey),
      maximumObservedScore: scores.length ? Math.max(...scores) : null
    }
  };
}

export function publicSourceRelevanceSummary() {
  return {
    presetQueryMapping: true,
    providerMinimumScores: {
      rss: minimumRelevanceScore('rss', 'ai_technology'),
      hackerNews: minimumRelevanceScore('hacker_news', 'ai_technology'),
      githubReleases: minimumRelevanceScore('github_releases', 'ai_technology'),
      newsdata: minimumRelevanceScore('newsdata', 'ai_technology')
    },
    promotionalContentPolicy: 'reject_high_confidence_non_primary',
    authorityPolicy: 'domain_tiers_plus_primary_source_preference',
    rankingPolicy: 'authority_relevance_primary_freshness_trend'
  };
}
