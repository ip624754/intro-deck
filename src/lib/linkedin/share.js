import { normalizeDefaultPostLanguage } from '../i18n/language.js';

const DEFAULT_MAX_POST_LENGTH = 3000;
const COMPACT_FOCUS_LIMIT = 3;
const COMPACT_LABEL_CHARACTER_BUDGET = 72;
const ATTRIBUTION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compactLabels(values, { limit = COMPACT_FOCUS_LIMIT, characterBudget = COMPACT_LABEL_CHARACTER_BUDGET } = {}) {
  const selected = [];
  let used = 0;
  for (const value of values) {
    const label = text(value);
    if (!label || selected.includes(label)) continue;
    const nextCost = label.length + (selected.length ? 2 : 0);
    if (selected.length >= limit || used + nextCost > characterBudget) break;
    selected.push(label);
    used += nextCost;
  }
  return selected;
}

function buildCompactMemberLine({ profileSnapshot, russian = false } = {}) {
  const skills = compactLabels(
    Array.isArray(profileSnapshot.skills)
      ? profileSnapshot.skills.map((skill) => skill?.skill_label)
      : []
  );
  if (skills.length) {
    return `${russian ? 'Мой фокус' : 'My focus'}: ${skills.join(', ')}.`;
  }

  const industry = text(profileSnapshot.industry_user);
  if (industry && industry.length <= COMPACT_LABEL_CHARACTER_BUDGET) {
    return russian ? `Работаю в сфере ${industry}.` : `I work in ${industry}.`;
  }

  return russian
    ? 'Открыт к релевантным профессиональным знакомствам.'
    : 'Open to relevant professional introductions.';
}

export function buildProfileSharePostText({ profileSnapshot = null, botUsername = 'introdeckbot', postLanguage = 'en', shareAttributionToken = null } = {}) {
  if (!profileSnapshot) {
    throw new Error('profile_snapshot_required');
  }

  const language = normalizeDefaultPostLanguage(postLanguage);
  const russian = language === 'ru';
  const username = String(botUsername || 'introdeckbot').trim().replace(/^@+/, '') || 'introdeckbot';
  const profileId = profileSnapshot.profile_id != null ? String(profileSnapshot.profile_id).trim() : '';
  const normalizedAttributionToken = String(shareAttributionToken || '').trim();
  const shareUrl = ATTRIBUTION_TOKEN_PATTERN.test(normalizedAttributionToken)
    ? `https://t.me/${username}?start=ls_${normalizedAttributionToken}`
    : profileId && /^\d+$/.test(profileId)
      ? `https://t.me/${username}?start=profile_${profileId}`
      : `https://t.me/${username}`;
  const memberLine = buildCompactMemberLine({ profileSnapshot, russian });

  const valueLine = russian
    ? 'Профессиональные знакомства с согласия владельца профиля, а не открытый доступ к приватным контактам.'
    : 'Professional networking built around permission, not open access to private contacts.';

  const post = [
    `${russian ? 'Открыть мой профиль в Intro Deck' : 'Open my Intro Deck profile'} → ${shareUrl}`,
    '',
    memberLine ? `${valueLine} ${memberLine}` : valueLine
  ].join('\n');

  if (post.length > DEFAULT_MAX_POST_LENGTH) {
    throw new Error('linkedin_share_post_too_long');
  }

  return post;
}

export class LinkedInShareApiError extends Error {
  constructor(message, {
    status = null,
    code = null,
    requestId = null,
    outcomeUnknown = false,
    endpoint = 'posts'
  } = {}) {
    super(message);
    this.name = 'LinkedInShareApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.outcomeUnknown = Boolean(outcomeUnknown);
    this.endpoint = endpoint;
  }
}

function safeProviderCode(payload) {
  return payload?.serviceErrorCode ?? payload?.code ?? payload?.status ?? null;
}

export async function publishLinkedInTextPost({
  accessToken,
  authorId,
  commentary,
  visibility = 'PUBLIC',
  apiVersion,
  timeoutMs = 8000,
  media = null,
  fetchImpl = fetch
}) {
  if (!accessToken) throw new Error('linkedin_share_access_token_required');
  if (!authorId) throw new Error('linkedin_share_author_id_required');
  if (!commentary || typeof commentary !== 'string') throw new Error('linkedin_share_commentary_required');
  if (!['PUBLIC', 'CONNECTIONS'].includes(visibility)) throw new Error('linkedin_share_visibility_invalid');
  if (!/^\d{6}$/.test(String(apiVersion || ''))) throw new Error('linkedin_share_api_version_invalid');
  if (media != null) {
    if (!/^urn:li:image:/i.test(String(media?.id || ''))) throw new Error('linkedin_share_media_id_invalid');
    if (typeof media?.altText !== 'string' || !media.altText.trim()) throw new Error('linkedin_share_media_alt_text_required');
    if (media.altText.length > 4086) throw new Error('linkedin_share_media_alt_text_too_long');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-restli-protocol-version': '2.0.0',
        'linkedin-version': String(apiVersion)
      },
      body: JSON.stringify({
        author: `urn:li:person:${authorId}`,
        commentary,
        visibility,
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        ...(media ? {
          content: {
            media: {
              id: String(media.id),
              altText: media.altText.trim()
            }
          }
        } : {}),
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      }),
      signal: controller.signal
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    throw new LinkedInShareApiError(
      isTimeout ? 'LinkedIn post request timed out; publication outcome is unknown.' : 'LinkedIn post request failed before a confirmed response.',
      { code: isTimeout ? 'linkedin_share_timeout' : 'linkedin_share_network_error', outcomeUnknown: true }
    );
  } finally {
    clearTimeout(timer);
  }

  const requestId = response.headers.get('x-linkedin-id')
    || response.headers.get('x-restli-request-id')
    || response.headers.get('x-li-request-id')
    || null;
  const postId = response.headers.get('x-restli-id') || null;
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new LinkedInShareApiError(
      `LinkedIn post creation failed with HTTP ${response.status}.`,
      {
        status: response.status,
        code: safeProviderCode(payload),
        requestId,
        outcomeUnknown: response.status >= 500
      }
    );
  }

  if (response.status !== 201 || !postId) {
    throw new LinkedInShareApiError(
      'LinkedIn returned a success response without a confirmed post id; publication outcome is unknown.',
      {
        status: response.status,
        requestId,
        outcomeUnknown: true,
        code: 'linkedin_share_missing_post_id'
      }
    );
  }

  return {
    postId,
    requestId,
    httpStatus: response.status
  };
}
