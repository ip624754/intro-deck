import { safeSourceText } from './sourceContract.js';
import {
  angleTerms,
  audienceTerms,
  buildPersonalizedDiscoveryQuery,
  normalizeAngleKey,
  normalizeAudienceKey
} from '../ai/newsDiscoveryContract.js';

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
  startups_product: Object.freeze({
    queries: Object.freeze({
      rss: 'startup OR founder OR product OR SaaS',
      hacker_news: 'startup OR founder OR product launch OR SaaS',
      newsdata: 'startup OR founder OR product OR SaaS OR funding'
    }),
    strongTerms: Object.freeze([
      'startup', 'startups', 'founder', 'founders', 'product launch', 'product management',
      'saas', 'funding', 'seed round', 'series a', 'venture capital', 'developer tool'
    ]),
    supportTerms: Object.freeze([
      'product', 'customer', 'growth', 'market fit', 'platform', 'workflow', 'software',
      'acquisition', 'partnership', 'entrepreneurship'
    ]),
    categoryTerms: Object.freeze(['startup', 'product', 'saas', 'entrepreneurship', 'technology'])
  }),
  business_markets: Object.freeze({
    queries: Object.freeze({
      rss: 'business OR markets OR enterprise OR finance',
      hacker_news: 'business OR enterprise OR markets OR revenue',
      newsdata: 'business OR markets OR enterprise OR finance OR revenue'
    }),
    strongTerms: Object.freeze([
      'business', 'enterprise', 'market', 'markets', 'finance', 'revenue', 'profit', 'cash flow',
      'acquisition', 'ipo', 'regulation', 'partnership', 'commerce', 'fintech'
    ]),
    supportTerms: Object.freeze([
      'company', 'sales', 'customer', 'growth', 'investment', 'stock', 'economy', 'productivity',
      'small business', 'valuation'
    ]),
    categoryTerms: Object.freeze(['business', 'finance', 'markets', 'enterprise', 'economy'])
  }),
  career_leadership: Object.freeze({
    queries: Object.freeze({
      rss: 'career OR leadership OR hiring OR workplace',
      hacker_news: 'career OR hiring OR leadership OR workplace',
      newsdata: 'career OR leadership OR hiring OR workforce OR workplace'
    }),
    strongTerms: Object.freeze([
      'career', 'leadership', 'leader', 'hiring', 'workforce', 'workplace', 'skills', 'talent',
      'management', 'jobs', 'employment', 'education'
    ]),
    supportTerms: Object.freeze([
      'team', 'culture', 'training', 'mentorship', 'productivity', 'remote work', 'organization',
      'executive', 'professional development'
    ]),
    categoryTerms: Object.freeze(['career', 'leadership', 'workplace', 'jobs', 'education'])
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

function canonicalPresetKey(value) {
  return value === 'business_growth' ? 'business_markets' : value;
}

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

export function resolveProviderDiscoveryQuery({
  presetKey,
  customQuery = null,
  provider,
  fallbackQuery,
  profileContext = null,
  audienceKey = 'professional_network',
  customAudience = null,
  angleKey = 'expert_take'
}) {
  const key = canonicalPresetKey(presetKey);
  if (key === 'custom') return safeSourceText(customQuery || fallbackQuery, 100) || '';
  if (key === 'for_you') {
    return safeSourceText(buildPersonalizedDiscoveryQuery({
      profileContext,
      audienceKey,
      customAudience,
      angleKey,
      maxLength: 100
    }), 100) || 'technology OR business';
  }
  const profile = PRESET_PROFILES[key] || PRESET_PROFILES.ai_technology;
  return profile.queries[provider] || safeSourceText(fallbackQuery, 100) || '';
}

export function minimumRelevanceScore(provider, presetKey) {
  const key = canonicalPresetKey(presetKey);
  if (key === 'custom') return provider === 'newsdata' ? 24 : 18;
  if (key === 'for_you') return provider === 'newsdata' ? 30 : provider === 'hacker_news' ? 28 : 22;
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
  const key = canonicalPresetKey(presetKey);
  const categories = (article?.categories || []).map((value) => normalizeText(value));
  const metadataPreset = normalizeText(article?.metadata?.presetKey || article?.metadata?.preset_key);
  const registryKey = normalizeText(article?.metadata?.registryKey);
  if (metadataPreset === normalizeText(key)) return 22;
  if (categories.includes(normalizeText(key))) return 22;
  if (key === 'crypto_web3' && registryKey.includes('ethereum')) return 22;
  if (key === 'ai_technology' && ['google_blog', 'github_blog'].includes(registryKey)) return 8;
  if (article?.provider === 'github_releases' && categories.includes(normalizeText(key))) return 22;
  return 0;
}

function profileAffinity(articleText, profileContext = {}) {
  const terms = [...new Set(profileContext?.terms || [])].slice(0, 16);
  const matches = matchingTerms(articleText, terms);
  return {
    matches,
    score: Math.min(28, matches.length * 7)
  };
}

function audienceFit(articleText, options = {}) {
  const terms = audienceTerms({ audienceKey: options.audienceKey, customAudience: options.customAudience });
  const matches = matchingTerms(articleText, terms);
  return { matches, score: Math.min(18, matches.length * 6) };
}

function angleFit(articleText, angleKey) {
  const terms = angleTerms(angleKey);
  const matches = matchingTerms(articleText, terms);
  return { matches, score: Math.min(12, matches.length * 4) };
}

export function assessSourceRelevance(article, {
  presetKey = 'for_you',
  customQuery = null,
  provider = article?.provider,
  profileContext = null,
  audienceKey = 'professional_network',
  customAudience = null,
  angleKey = 'expert_take',
  profileAffinityEnabled = true
} = {}) {
  const key = canonicalPresetKey(presetKey);
  const title = String(article?.title || '');
  const body = `${article?.description || ''} ${article?.contentExcerpt || ''}`;
  const categories = (article?.categories || []).join(' ');
  const source = `${article?.sourceName || ''} ${article?.sourceDomain || ''}`;
  const combined = `${title} ${body} ${categories} ${source}`;
  const promotion = promotionalAssessment(article);
  if (promotion.rejected && !article?.isPrimary) {
    return {
      accepted: false,
      score: 0,
      threshold: minimumRelevanceScore(provider, key),
      reason: promotion.rejectCode,
      matchedTerms: [],
      qualityFlags: ['promotional_content'],
      profileAffinityScore: 0,
      audienceFitScore: 0,
      angleFitScore: 0
    };
  }

  let strongTerms;
  let supportTerms;
  let categoryTerms;
  if (key === 'custom') {
    strongTerms = customTerms(customQuery);
    supportTerms = [];
    categoryTerms = [];
  } else if (key === 'for_you') {
    strongTerms = [...new Set([...(profileContext?.terms || []), ...audienceTerms({ audienceKey, customAudience })])].slice(0, 20);
    supportTerms = angleTerms(angleKey);
    categoryTerms = [];
  } else {
    const profile = PRESET_PROFILES[key] || PRESET_PROFILES.ai_technology;
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
  const profile = profileAffinityEnabled ? profileAffinity(combined, profileContext) : { matches: [], score: 0 };
  const audience = audienceFit(combined, { audienceKey: normalizeAudienceKey(audienceKey), customAudience });
  const angle = angleFit(combined, normalizeAngleKey(angleKey));

  const presetScore = presetAffinity(article, key);
  const topicSignalScore = Math.min(52, titleStrong.length * 26)
    + Math.min(30, bodyStrong.length * 15)
    + Math.min(18, titleSupport.length * 9)
    + Math.min(12, bodySupport.length * 6)
    + Math.min(18, categoryMatches.length * 9)
    + (exactCategoryMatches.length ? 18 : 0)
    + Math.min(12, sourceMatches.length * 6)
    + presetScore;
  const topicSignalRequired = key !== 'for_you';
  if (topicSignalRequired && topicSignalScore <= 0) {
    return {
      accepted: false,
      score: 0,
      threshold: minimumRelevanceScore(provider, key),
      reason: 'below_relevance_threshold',
      matchedTerms: [],
      qualityFlags: [...promotion.flags, 'topic_mismatch'],
      profileAffinityScore: profile.score,
      profileMatchedTerms: profile.matches.slice(0, 8),
      audienceFitScore: audience.score,
      audienceMatchedTerms: audience.matches.slice(0, 8),
      angleFitScore: angle.score,
      angleMatchedTerms: angle.matches.slice(0, 8)
    };
  }

  let score = topicSignalScore;
  score += profile.score;
  score += audience.score;
  score += angle.score;
  score -= promotion.penalty;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const threshold = minimumRelevanceScore(provider, key);
  const matchedTerms = [...new Set([
    ...titleStrong, ...bodyStrong, ...titleSupport, ...bodySupport, ...categoryMatches,
    ...exactCategoryMatches, ...sourceMatches, ...profile.matches, ...audience.matches, ...angle.matches
  ])].slice(0, 16);
  return {
    accepted: score >= threshold,
    score,
    threshold,
    reason: score >= threshold ? null : 'below_relevance_threshold',
    matchedTerms,
    qualityFlags: promotion.flags,
    profileAffinityScore: profile.score,
    profileMatchedTerms: profile.matches.slice(0, 8),
    audienceFitScore: audience.score,
    audienceMatchedTerms: audience.matches.slice(0, 8),
    angleFitScore: angle.score,
    angleMatchedTerms: angle.matches.slice(0, 8),
    topicSignalScore
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
        profileAffinityScore: assessment.profileAffinityScore,
        profileMatchedTerms: assessment.profileMatchedTerms,
        audienceFitScore: assessment.audienceFitScore,
        audienceMatchedTerms: assessment.audienceMatchedTerms,
        angleFitScore: assessment.angleFitScore,
        angleMatchedTerms: assessment.angleMatchedTerms,
        topicSignalScore: assessment.topicSignalScore,
        audienceKey: normalizeAudienceKey(options.audienceKey),
        angleKey: normalizeAngleKey(options.angleKey),
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
      maximumObservedScore: scores.length ? Math.max(...scores) : null,
      profileSignalCount: Number(options.profileContext?.signalCount || 0),
      audienceKey: normalizeAudienceKey(options.audienceKey),
      angleKey: normalizeAngleKey(options.angleKey)
    }
  };
}

export function publicSourceRelevanceSummary() {
  return {
    presetQueryMapping: true,
    audienceAwareScoring: true,
    profileAffinityScoring: true,
    providerMinimumScores: {
      rss: minimumRelevanceScore('rss', 'ai_technology'),
      hackerNews: minimumRelevanceScore('hacker_news', 'ai_technology'),
      githubReleases: minimumRelevanceScore('github_releases', 'ai_technology'),
      newsdata: minimumRelevanceScore('newsdata', 'ai_technology')
    },
    promotionalContentPolicy: 'reject_high_confidence_non_primary',
    authorityPolicy: 'domain_tiers_plus_primary_source_preference',
    rankingPolicy: 'authority_relevance_profile_audience_angle_primary_freshness_trend'
  };
}
