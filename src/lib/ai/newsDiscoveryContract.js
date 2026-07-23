const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'into', 'your', 'this', 'that', 'our', 'their',
  'или', 'для', 'как', 'это', 'что', 'при', 'над', 'под', 'без', 'его', 'ее', 'их'
]);

export const AI_NEWS_AUDIENCES = Object.freeze({
  professional_network: Object.freeze({
    key: 'professional_network',
    label: 'My professional network',
    queryTerms: Object.freeze(['professional', 'industry', 'business', 'technology']),
    fitTerms: Object.freeze(['professional', 'industry', 'business', 'technology', 'workplace', 'enterprise'])
  }),
  founders_executives: Object.freeze({
    key: 'founders_executives',
    label: 'Founders & executives',
    queryTerms: Object.freeze(['founder', 'startup', 'leadership']),
    fitTerms: Object.freeze(['founder', 'startup', 'leadership', 'executive', 'strategy', 'company', 'growth'])
  }),
  product_engineering: Object.freeze({
    key: 'product_engineering',
    label: 'Product & engineering',
    queryTerms: Object.freeze(['product', 'engineering', 'developer']),
    fitTerms: Object.freeze(['product', 'engineering', 'developer', 'software', 'platform', 'infrastructure', 'release'])
  }),
  sales_marketing: Object.freeze({
    key: 'sales_marketing',
    label: 'Sales & marketing',
    queryTerms: Object.freeze(['sales', 'marketing', 'customer']),
    fitTerms: Object.freeze(['sales', 'marketing', 'customer', 'brand', 'commerce', 'revenue', 'advertising'])
  }),
  investors_finance: Object.freeze({
    key: 'investors_finance',
    label: 'Investors & finance',
    queryTerms: Object.freeze(['investment', 'markets', 'finance']),
    fitTerms: Object.freeze(['investment', 'investor', 'funding', 'finance', 'market', 'valuation', 'revenue', 'profit'])
  }),
  recruiters_talent: Object.freeze({
    key: 'recruiters_talent',
    label: 'Recruiters & talent',
    queryTerms: Object.freeze(['career', 'hiring', 'workforce']),
    fitTerms: Object.freeze(['career', 'hiring', 'workforce', 'skills', 'talent', 'leadership', 'workplace', 'jobs'])
  }),
  custom: Object.freeze({
    key: 'custom',
    label: 'Custom audience',
    queryTerms: Object.freeze([]),
    fitTerms: Object.freeze([])
  })
});

export const AI_NEWS_ANGLES = Object.freeze({
  expert_take: Object.freeze({
    key: 'expert_take',
    label: 'Expert take',
    fitTerms: Object.freeze(['analysis', 'research', 'evidence', 'industry', 'technical'])
  }),
  practical_lessons: Object.freeze({
    key: 'practical_lessons',
    label: 'Practical lessons',
    fitTerms: Object.freeze(['how', 'practice', 'lessons', 'implementation', 'guide', 'workflow', 'case study'])
  }),
  founder_perspective: Object.freeze({
    key: 'founder_perspective',
    label: 'Founder perspective',
    fitTerms: Object.freeze(['founder', 'startup', 'strategy', 'growth', 'execution', 'company'])
  }),
  explain_simply: Object.freeze({
    key: 'explain_simply',
    label: 'Explain simply',
    fitTerms: Object.freeze(['explainer', 'overview', 'basics', 'what is', 'how works'])
  }),
  contrarian_opinion: Object.freeze({
    key: 'contrarian_opinion',
    label: 'Contrarian opinion',
    fitTerms: Object.freeze(['debate', 'criticism', 'risk', 'challenge', 'concern', 'controversy'])
  }),
  industry_impact: Object.freeze({
    key: 'industry_impact',
    label: 'Industry impact',
    fitTerms: Object.freeze(['industry', 'market', 'regulation', 'adoption', 'infrastructure', 'enterprise'])
  }),
  career_implications: Object.freeze({
    key: 'career_implications',
    label: 'Career implications',
    fitTerms: Object.freeze(['career', 'skills', 'jobs', 'hiring', 'workforce', 'education'])
  })
});

function cleanText(value, max = 120) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[^\p{L}\p{N}+#.$&-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function termCandidates(value) {
  return cleanText(value, 400)
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
}

export function normalizeAudienceKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return AI_NEWS_AUDIENCES[key] ? key : 'professional_network';
}

export function normalizeAngleKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return AI_NEWS_ANGLES[key] ? key : 'expert_take';
}

export function normalizeCustomAudience(value) {
  const normalized = cleanText(value, 120);
  if (normalized.length < 2 || normalized.length > 120) throw new Error('news_custom_audience_invalid');
  return normalized;
}

export function audienceLabel(preferences = {}) {
  const key = normalizeAudienceKey(preferences.audience_key || preferences.audienceKey);
  if (key === 'custom') return normalizeCustomAudience(preferences.custom_audience || preferences.customAudience || 'Custom audience');
  return AI_NEWS_AUDIENCES[key].label;
}

export function angleLabel(preferences = {}) {
  return AI_NEWS_ANGLES[normalizeAngleKey(preferences.angle_key || preferences.angleKey)].label;
}

export function buildProfileAffinityContext(profile = {}) {
  const skills = (profile?.skills || [])
    .map((item) => item?.skill_label || item?.label || item?.skill_slug)
    .filter(Boolean)
    .slice(0, 12);
  const sourceValues = [
    profile?.headline_user,
    profile?.industry_user,
    ...skills
  ].filter(Boolean);
  const terms = [];
  for (const candidate of sourceValues) {
    for (const term of termCandidates(candidate)) {
      if (!terms.includes(term)) terms.push(term);
      if (terms.length >= 16) break;
    }
    if (terms.length >= 16) break;
  }
  return {
    terms,
    headline: cleanText(profile?.headline_user, 160) || null,
    industry: cleanText(profile?.industry_user, 120) || null,
    skillLabels: skills.map((item) => cleanText(item, 80)).filter(Boolean),
    signalCount: terms.length,
    available: terms.length > 0
  };
}

export function audienceTerms({ audienceKey, customAudience = null } = {}) {
  const key = normalizeAudienceKey(audienceKey);
  if (key === 'custom') return [...new Set(termCandidates(customAudience).slice(0, 8))];
  return [...AI_NEWS_AUDIENCES[key].fitTerms];
}

export function angleTerms(angleKey) {
  return [...AI_NEWS_ANGLES[normalizeAngleKey(angleKey)].fitTerms];
}

export function buildPersonalizedDiscoveryQuery({
  profileContext = {},
  audienceKey = 'professional_network',
  customAudience = null,
  angleKey = 'expert_take',
  maxLength = 100
} = {}) {
  const selected = [];
  const add = (term) => {
    const clean = cleanText(term, 40);
    if (!clean || selected.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
    const candidate = [...selected, clean].join(' OR ');
    if (candidate.length <= maxLength) selected.push(clean);
  };
  for (const term of profileContext?.terms || []) add(term);
  for (const term of audienceTerms({ audienceKey, customAudience })) add(term);
  for (const term of angleTerms(angleKey)) add(term);
  if (!selected.length) ['technology', 'business', 'professional'].forEach(add);
  return selected.join(' OR ');
}

export function publicAudienceDiscoverySummary() {
  return {
    personalizedTopic: 'for_you',
    profileSignals: ['headline', 'industry', 'skills'],
    externalQueryPolicy: 'bounded_public_profile_terms_only',
    audiences: Object.keys(AI_NEWS_AUDIENCES),
    angles: Object.keys(AI_NEWS_ANGLES),
    presetContract: 'topic_audience_angle_language_tone'
  };
}
