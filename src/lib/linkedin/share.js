const DEFAULT_MAX_POST_LENGTH = 3000;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compactLines(lines) {
  return lines.map((line) => text(line)).filter(Boolean);
}

export function buildProfileSharePostText({ profileSnapshot = null, botUsername = 'introdeckbot' } = {}) {
  if (!profileSnapshot) {
    throw new Error('profile_snapshot_required');
  }

  const username = String(botUsername || 'introdeckbot').trim().replace(/^@+/, '') || 'introdeckbot';
  const displayName = text(profileSnapshot.display_name) || text(profileSnapshot.linkedin_name) || 'Intro Deck member';
  const headline = text(profileSnapshot.headline_user);
  const company = text(profileSnapshot.company_user);
  const industry = text(profileSnapshot.industry_user);
  const skills = Array.isArray(profileSnapshot.skills)
    ? profileSnapshot.skills.map((skill) => text(skill?.skill_label)).filter(Boolean).slice(0, 6)
    : [];

  const identityLines = compactLines([
    displayName,
    headline,
    company ? `Company: ${company}` : null,
    industry ? `Industry: ${industry}` : null,
    skills.length ? `Focus: ${skills.join(', ')}` : null
  ]);

  const profileId = profileSnapshot.profile_id != null ? String(profileSnapshot.profile_id).trim() : '';
  const shareUrl = profileId && /^\d+$/.test(profileId)
    ? `https://t.me/${username}?start=profile_${profileId}`
    : `https://t.me/${username}`;

  const post = [
    'I’ve published my professional profile on Intro Deck.',
    '',
    ...identityLines,
    '',
    'Intro Deck is a permission-based professional directory inside Telegram. Profile details are member-provided, and private contact details stay hidden until the profile owner approves a contact request.',
    '',
    `View my profile and request contact: ${shareUrl}`
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
