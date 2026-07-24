import { readFile } from 'node:fs/promises';
import { normalizeDefaultPostLanguage } from '../i18n/language.js';

const PROFILE_SHARE_ASSETS = Object.freeze({
  en: Object.freeze({
    url: new URL('../../../assets/social/intro-deck-profile-share-en-1200x630.png', import.meta.url),
    filename: 'intro-deck-profile-share-en-1200x630.png',
    altText: 'Intro Deck: professional networking built around permission.'
  }),
  ru: Object.freeze({
    url: new URL('../../../assets/social/intro-deck-profile-share-ru-1200x630.png', import.meta.url),
    filename: 'intro-deck-profile-share-ru-1200x630.png',
    altText: 'Intro Deck: профессиональные знакомства на основе согласия.'
  })
});

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class LinkedInImagePreparationError extends Error {
  constructor(message, {
    phase,
    status = null,
    code = null,
    requestId = null,
    cause = null
  } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'LinkedInImagePreparationError';
    this.phase = phase || 'unknown';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.safeTextFallback = true;
  }
}

function safeProviderCode(payload) {
  return payload?.serviceErrorCode ?? payload?.code ?? payload?.status ?? null;
}

async function fetchWithTimeout(url, options, { timeoutMs, fetchImpl, phase }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    const timeout = error?.name === 'AbortError';
    throw new LinkedInImagePreparationError(
      timeout ? `LinkedIn image ${phase} timed out.` : `LinkedIn image ${phase} request failed.`,
      {
        phase,
        code: timeout ? `linkedin_image_${phase}_timeout` : `linkedin_image_${phase}_network_error`,
        cause: error
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

export function getProfileShareAssetDescriptor(postLanguage = 'en') {
  return PROFILE_SHARE_ASSETS[normalizeDefaultPostLanguage(postLanguage)];
}

export async function loadBrandedProfileShareImage({ postLanguage = 'en', readFileImpl = readFile } = {}) {
  const descriptor = getProfileShareAssetDescriptor(postLanguage);
  let bytes;
  try {
    bytes = await readFileImpl(descriptor.url);
  } catch (error) {
    throw new LinkedInImagePreparationError('Branded profile-share image asset is unavailable.', {
      phase: 'asset_load',
      code: 'linkedin_image_asset_unavailable',
      cause: error
    });
  }
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new LinkedInImagePreparationError('Branded profile-share image asset is not a valid PNG.', {
      phase: 'asset_load',
      code: 'linkedin_image_asset_invalid'
    });
  }
  return {
    bytes: buffer,
    contentType: 'image/png',
    filename: descriptor.filename,
    altText: descriptor.altText,
    language: normalizeDefaultPostLanguage(postLanguage)
  };
}

export async function initializeLinkedInImageUpload({
  accessToken,
  authorId,
  apiVersion,
  timeoutMs = 8000,
  fetchImpl = fetch
}) {
  if (!accessToken) throw new Error('linkedin_image_access_token_required');
  if (!authorId) throw new Error('linkedin_image_author_id_required');
  if (!/^\d{6}$/.test(String(apiVersion || ''))) throw new Error('linkedin_image_api_version_invalid');

  const response = await fetchWithTimeout(
    'https://api.linkedin.com/rest/images?action=initializeUpload',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-restli-protocol-version': '2.0.0',
        'linkedin-version': String(apiVersion)
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: `urn:li:person:${authorId}`
        }
      })
    },
    { timeoutMs, fetchImpl, phase: 'initialize' }
  );
  const requestId = response.headers.get('x-linkedin-id')
    || response.headers.get('x-restli-request-id')
    || response.headers.get('x-li-request-id')
    || null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new LinkedInImagePreparationError(`LinkedIn image initialization failed with HTTP ${response.status}.`, {
      phase: 'initialize',
      status: response.status,
      code: safeProviderCode(payload),
      requestId
    });
  }
  const uploadUrl = payload?.value?.uploadUrl;
  const imageUrn = payload?.value?.image;
  if (!uploadUrl || !/^https:\/\//i.test(uploadUrl) || !/^urn:li:image:/i.test(String(imageUrn || ''))) {
    throw new LinkedInImagePreparationError('LinkedIn image initialization returned an invalid upload contract.', {
      phase: 'initialize',
      status: response.status,
      code: 'linkedin_image_initialize_invalid_response',
      requestId
    });
  }
  return {
    uploadUrl,
    imageUrn: String(imageUrn),
    uploadUrlExpiresAt: payload?.value?.uploadUrlExpiresAt || null,
    requestId
  };
}

export async function uploadLinkedInImageBytes({
  uploadUrl,
  accessToken,
  imageBytes,
  contentType = 'image/png',
  timeoutMs = 8000,
  fetchImpl = fetch
}) {
  if (!uploadUrl || !/^https:\/\//i.test(uploadUrl)) throw new Error('linkedin_image_upload_url_required');
  if (!accessToken) throw new Error('linkedin_image_access_token_required');
  if (!imageBytes || !Buffer.byteLength(imageBytes)) throw new Error('linkedin_image_bytes_required');

  const response = await fetchWithTimeout(
    uploadUrl,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': contentType
      },
      body: imageBytes
    },
    { timeoutMs, fetchImpl, phase: 'upload' }
  );
  const requestId = response.headers.get('x-linkedin-id')
    || response.headers.get('x-restli-request-id')
    || response.headers.get('x-li-request-id')
    || response.headers.get('x-li-uuid')
    || null;
  if (!response.ok) {
    throw new LinkedInImagePreparationError(`LinkedIn image upload failed with HTTP ${response.status}.`, {
      phase: 'upload',
      status: response.status,
      code: 'linkedin_image_upload_failed',
      requestId
    });
  }
  return {
    httpStatus: response.status,
    requestId
  };
}

export async function prepareBrandedProfileShareMedia({
  accessToken,
  authorId,
  postLanguage = 'en',
  apiVersion,
  timeoutMs = 8000,
  fetchImpl = fetch,
  readFileImpl = readFile
}) {
  const asset = await loadBrandedProfileShareImage({ postLanguage, readFileImpl });
  const initialized = await initializeLinkedInImageUpload({
    accessToken,
    authorId,
    apiVersion,
    timeoutMs,
    fetchImpl
  });
  const uploaded = await uploadLinkedInImageBytes({
    uploadUrl: initialized.uploadUrl,
    accessToken,
    imageBytes: asset.bytes,
    contentType: asset.contentType,
    timeoutMs,
    fetchImpl
  });
  return {
    id: initialized.imageUrn,
    altText: asset.altText,
    language: asset.language,
    filename: asset.filename,
    byteLength: asset.bytes.length,
    initializeRequestId: initialized.requestId,
    uploadRequestId: uploaded.requestId,
    uploadHttpStatus: uploaded.httpStatus
  };
}

export async function publishProfileShareWithOptionalImage({
  accessToken,
  authorId,
  commentary,
  visibility,
  postLanguage = 'en',
  apiVersion,
  timeoutMs,
  publishImpl,
  prepareMediaImpl = prepareBrandedProfileShareMedia,
  logger = console
}) {
  let media = null;
  let mediaFallbackReason = null;
  try {
    media = await prepareMediaImpl({
      accessToken,
      authorId,
      postLanguage,
      apiVersion,
      timeoutMs
    });
  } catch (error) {
    mediaFallbackReason = error?.code || 'linkedin_image_preparation_failed';
    logger?.warn?.('[linkedin share] branded image unavailable; using text-only fallback', {
      phase: error?.phase || null,
      status: error?.status || null,
      code: mediaFallbackReason,
      requestId: error?.requestId || null
    });
  }

  const provider = await publishImpl({
    accessToken,
    authorId,
    commentary,
    visibility,
    apiVersion,
    timeoutMs,
    media: media ? { id: media.id, altText: media.altText } : null
  });
  return {
    ...provider,
    mediaAttached: Boolean(media),
    mediaId: media?.id || null,
    mediaLanguage: media?.language || null,
    mediaFallbackReason
  };
}
