import { normalizeDefaultPostLanguage } from '../i18n/language.js';

const DEFAULT_MAX_POST_LENGTH = 3000;
const ABOUT_SNIPPET_LIMIT = 280;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compactLines(lines) {
  return lines.map((line) => text(line)).filter(Boolean);
}

function summarizeAbout(value, maxLength = ABOUT_SNIPPET_LIMIT) {
  const normalized = text(value).replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  const candidate = normalized.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('! '), candidate.lastIndexOf('? '));
  if (sentenceEnd >= Math.floor(maxLength * 0.6)) {
    return candidate.slice(0, sentenceEnd + 1).trim();
  }
  const wordBoundary = candidate.lastIndexOf(' ');
  const trimmed = (wordBoundary > Math.floor(maxLength * 0.6) ? candidate.slice(0, wordBoundary) : candidate.slice(0, maxLength)).trim();
  return `${trimmed}…`;
}

function buildFocusSummary({ russian = false, industry = '', skills = [] } = {}) {
  if (skills.length) {
    return `${russian ? 'Фокус' : 'Focus'}: ${skills.join(', ')}`;
  }
  if (industry) {
    return `${russian ? 'Индустрия' : 'Industry'}: ${industry}`;
  }
  return '';
}

function buildEditorialBody({ profileSnapshot, russian = false } = {}) {
  const headline = text(profileSnapshot.headline_user);
  const company = text(profileSnapshot.company_user);
  const industry = text(profileSnapshot.industry_user);
  const skills = Array.isArray(profileSnapshot.skills)
    ? profileSnapshot.skills.map((skill) => text(skill?.skill_label)).filter(Boolean).slice(0, 6)
    : [];
  const about = summarizeAbout(profileSnapshot.about_user);
  const focusSummary = buildFocusSummary({ russian, industry, skills });

  const identityLines = compactLines([
    text(profileSnapshot.display_name) || text(profileSnapshot.linkedin_name),
    headline,
    company ? `${russian ? 'Компания' : 'Company'}: ${company}` : null,
    focusSummary
  ]);

  const summaryParagraph = about || (
    russian
      ? 'Открыт к содержательным знакомствам, рабочим контактам и релевантным коллаборациям.'
      : 'Open to relevant introductions, practical conversations, and aligned collaborations.'
  );
  const audienceParagraph = skills.length
    ? (russian
      ? `Особенно открыт к диалогу с основателями, билдерами и операторами, работающими в направлениях: ${skills.join(', ')}.`
      : `I’m especially open to conversations with founders, builders, and operators working across: ${skills.join(', ')}.`)
    : (industry
      ? (russian
        ? `Особенно открыт к релевантным знакомствам и рабочим контактам в сфере ${industry}.`
        : `I’m especially open to relevant introductions and practical conversations in ${industry}.`)
      : '');

  return {
    identityLines,
    summaryParagraph,
    audienceParagraph
  };
}

export function buildProfileSharePostText({ profileSnapshot = null, botUsername = 'introdeckbot', postLanguage = 'en' } = {}) {
  if (!profileSnapshot) {
    throw new Error('profile_snapshot_required');
  }

  const language = normalizeDefaultPostLanguage(postLanguage);
  const russian = language === 'ru';
  const username = String(botUsername || 'introdeckbot').trim().replace(/^@+/, '') || 'introdeckbot';
  const displayName = text(profileSnapshot.display_name) || text(profileSnapshot.linkedin_name) || (russian ? 'Участник Intro Deck' : 'Intro Deck member');
  const profileId = profileSnapshot.profile_id != null ? String(profileSnapshot.profile_id).trim() : '';
  const shareUrl = profileId && /^\d+$/.test(profileId)
    ? `https://t.me/${username}?start=profile_${profileId}`
    : `https://t.me/${username}`;
  const { identityLines, summaryParagraph, audienceParagraph } = buildEditorialBody({ profileSnapshot: { ...profileSnapshot, display_name: displayName }, russian });

  const post = [
    russian
      ? 'Большинство профессиональных каталогов оптимизируют охват. Intro Deck оптимизирует согласие.'
      : 'Most professional directories optimize for reach. Intro Deck optimizes for permission.',
    '',
    russian
      ? 'Я опубликовал здесь свой профессиональный профиль.'
      : 'I’ve published my professional profile there.',
    '',
    ...identityLines,
    '',
    summaryParagraph,
    ...(audienceParagraph ? ['', audienceParagraph] : []),
    '',
    russian
      ? 'Intro Deck — профессиональный каталог внутри Telegram, где связь происходит только с разрешения владельца профиля. Данные профиля указывает сам участник, а приватные контакты остаются скрытыми до одобрения запроса.'
      : 'Intro Deck is a permission-based professional directory inside Telegram, where contact happens only with the profile owner’s approval. Profile details are member-provided, and private contact information stays hidden until a request is approved.',
    '',
    `${russian ? 'Открыть мой профиль и запросить связь' : 'Open my profile and request an intro'}: ${shareUrl}`,
    russian
      ? 'Приватные контакты остаются скрытыми, пока я сам не одобрю запрос.'
      : 'Private contact details remain hidden until I approve a request.'
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
  fetchImpl = fetch
}) {
  if (!accessToken) throw new Error('linkedin_share_access_token_required');
  if (!authorId) throw new Error('linkedin_share_author_id_required');
  if (!commentary || typeof commentary !== 'string') throw new Error('linkedin_share_commentary_required');
  if (!['PUBLIC', 'CONNECTIONS'].includes(visibility)) throw new Error('linkedin_share_visibility_invalid');
  if (!/^\d{6}$/.test(String(apiVersion || ''))) throw new Error('linkedin_share_api_version_invalid');

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
