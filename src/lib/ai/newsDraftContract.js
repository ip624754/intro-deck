import crypto from 'node:crypto';

export const AI_NEWS_PRESETS = Object.freeze({
  ai_technology: {
    key: 'ai_technology',
    label: 'AI & Technology',
    query: 'artificial intelligence OR AI technology'
  },
  business_growth: {
    key: 'business_growth',
    label: 'Business & Growth',
    query: 'business growth OR startups OR entrepreneurship'
  },
  crypto_web3: {
    key: 'crypto_web3',
    label: 'Crypto & Web3',
    query: 'crypto OR blockchain OR web3'
  },
  custom: {
    key: 'custom',
    label: 'Custom topic',
    query: null
  }
});

export const AI_NEWS_TONES = Object.freeze({
  professional: 'Professional',
  analytical: 'Analytical',
  concise: 'Concise'
});

export function normalizePresetKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return AI_NEWS_PRESETS[key] ? key : 'ai_technology';
}

export function normalizePostLanguage(value) {
  return String(value || '').trim().toLowerCase() === 'ru' ? 'ru' : 'en';
}

export function normalizeTone(value) {
  const tone = String(value || '').trim().toLowerCase();
  return AI_NEWS_TONES[tone] ? tone : 'professional';
}

export function normalizeTopicQuery(value) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length < 2 || normalized.length > 120) {
    throw new Error('news_topic_query_invalid');
  }
  return normalized;
}

export function resolvePreferenceQuery(preferences = {}) {
  const presetKey = normalizePresetKey(preferences.preset_key || preferences.presetKey);
  if (presetKey === 'custom') {
    return normalizeTopicQuery(preferences.custom_query || preferences.customQuery || '');
  }
  return AI_NEWS_PRESETS[presetKey].query;
}

export function buildSourceEvidence(article) {
  const title = String(article?.title || '').trim();
  const description = String(article?.description || article?.source_description || '').trim();
  const contentExcerpt = String(article?.contentExcerpt || article?.content_excerpt || '').trim();
  const sourceName = String(article?.sourceName || article?.source_name || '').trim();
  const publishedAt = article?.publishedAt || article?.published_at || null;
  const sourceUrl = String(article?.url || article?.source_url || '').trim();

  return [
    `Title: ${title}`,
    sourceName ? `Source: ${sourceName}` : null,
    publishedAt ? `Published at: ${new Date(publishedAt).toISOString()}` : null,
    description ? `Description: ${description}` : null,
    contentExcerpt ? `Content excerpt: ${contentExcerpt}` : null,
    `Source URL: ${sourceUrl}`
  ].filter(Boolean).join('\n');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

export function normalizeSourceUrl(value) {
  const raw = String(value || '').trim();
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('news_source_url_invalid');
  }
  if (url.username || url.password) {
    throw new Error('news_source_url_credentials_forbidden');
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const blockedHost = hostname === 'localhost'
    || hostname === '::1'
    || hostname.endsWith('.local')
    || /^127\./.test(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname);
  if (blockedHost) {
    throw new Error('news_source_url_private_host_forbidden');
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

export function extractNumbers(value) {
  return [...new Set((String(value || '').match(/\b\d+(?:[.,]\d+)?%?\b/g) || []).map((part) => part.replace(',', '.')))];
}

function extractQuotedSegments(value) {
  const text = String(value || '');
  const segments = [];
  const regexes = [/“([^”]{2,200})”/g, /"([^"\n]{2,200})"/g, /«([^»]{2,200})»/g];
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      segments.push(match[1].trim());
    }
  }
  return [...new Set(segments.filter(Boolean))];
}

export function validateDraftText({ postText, sourceEvidence, profileSnapshot = null, sourceUrl }) {
  const normalized = String(postText || '').trim();
  if (normalized.length < 80 || normalized.length > 3000) {
    return { valid: false, reason: 'news_draft_length_invalid' };
  }
  if (!normalized.includes(String(sourceUrl || '').trim())) {
    return { valid: false, reason: 'news_draft_source_link_required' };
  }

  const allowedNumericContext = [
    sourceEvidence,
    profileSnapshot?.headline_user,
    profileSnapshot?.company_user,
    profileSnapshot?.industry_user,
    profileSnapshot?.about_user,
    ...(profileSnapshot?.skills || []).map((item) => item.skill_label || item.label || '')
  ].filter(Boolean).join('\n');
  const allowedNumbers = new Set(extractNumbers(allowedNumericContext));
  const unsupportedNumbers = extractNumbers(normalized).filter((number) => !allowedNumbers.has(number));
  if (unsupportedNumbers.length) {
    return { valid: false, reason: 'news_draft_unsupported_numeric_claim', unsupportedNumbers };
  }

  const sourceLower = String(sourceEvidence || '').toLowerCase();
  const unsupportedQuotes = extractQuotedSegments(normalized).filter((quote) => !sourceLower.includes(quote.toLowerCase()));
  if (unsupportedQuotes.length) {
    return { valid: false, reason: 'news_draft_unsupported_quote', unsupportedQuotes };
  }

  return { valid: true, normalized };
}

export function validateEvidenceClaims({ claims, sourceEvidence }) {
  if (!Array.isArray(claims) || claims.length < 1 || claims.length > 6) {
    return { valid: false, reason: 'news_draft_evidence_claims_invalid' };
  }
  const sourceLower = String(sourceEvidence || '').toLowerCase();
  const normalized = [];
  for (const item of claims) {
    const claim = String(item?.claim || '').trim();
    const supportingText = String(item?.supporting_text || '').trim();
    if (!claim || !supportingText || supportingText.length < 3 || !sourceLower.includes(supportingText.toLowerCase())) {
      return { valid: false, reason: 'news_draft_evidence_support_missing' };
    }
    normalized.push({ claim, supporting_text: supportingText });
  }
  return { valid: true, claims: normalized };
}
