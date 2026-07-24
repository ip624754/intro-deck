import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import { getMemberButtons } from '../src/lib/telegram/memberCopy.js';
import { publishLinkedInTextPost } from '../src/lib/linkedin/share.js';
import {
  getProfileShareAssetDescriptor,
  initializeLinkedInImageUpload,
  loadBrandedProfileShareImage,
  prepareBrandedProfileShareMedia,
  publishProfileShareWithOptionalImage,
  uploadLinkedInImageBytes
} from '../src/lib/linkedin/profileShareMedia.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(['STEP064B4D2', 'STEP064B4D2A', 'STEP065A1'].includes(CURRENT_SOURCE_STEP));
assert.ok(['0.65.0', '0.65.1', '0.66.0'].includes(packageJson.version));

assert.equal(getMemberButtons('en').editProfile, '👤 Profile');
assert.equal(getMemberButtons('ru').editProfile, '👤 Профиль');

const enDescriptor = getProfileShareAssetDescriptor('en');
const ruDescriptor = getProfileShareAssetDescriptor('ru');
assert.match(enDescriptor.filename, /-en-/);
assert.match(ruDescriptor.filename, /-ru-/);
assert.notEqual(enDescriptor.altText, ruDescriptor.altText);

const enAsset = await loadBrandedProfileShareImage({ postLanguage: 'en' });
const ruAsset = await loadBrandedProfileShareImage({ postLanguage: 'ru' });
assert.equal(enAsset.contentType, 'image/png');
assert.equal(ruAsset.contentType, 'image/png');
assert.ok(enAsset.byteLength === undefined || enAsset.byteLength >= 0);
assert.ok(enAsset.bytes.length > 100000);
assert.ok(ruAsset.bytes.length > 100000);
assert.equal(enAsset.bytes.subarray(1, 4).toString('ascii'), 'PNG');
assert.equal(ruAsset.bytes.subarray(1, 4).toString('ascii'), 'PNG');

const calls = [];
const imageFetch = async (url, options) => {
  calls.push({ url, options });
  if (String(url).includes('/rest/images?action=initializeUpload')) {
    const body = JSON.parse(options.body);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.authorization, 'Bearer image-token');
    assert.equal(options.headers['linkedin-version'], '202606');
    assert.equal(body.initializeUploadRequest.owner, 'urn:li:person:member-sub');
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'x-restli-request-id': 'init-request' }),
      json: async () => ({
        value: {
          uploadUrl: 'https://www.linkedin.com/dms-uploads/image-upload',
          uploadUrlExpiresAt: Date.now() + 60000,
          image: 'urn:li:image:test-image'
        }
      })
    };
  }
  assert.equal(url, 'https://www.linkedin.com/dms-uploads/image-upload');
  assert.equal(options.method, 'PUT');
  assert.equal(options.headers.authorization, 'Bearer image-token');
  assert.equal(options.headers['content-type'], 'image/png');
  assert.ok(Buffer.isBuffer(options.body));
  return {
    ok: true,
    status: 201,
    headers: new Headers({ 'x-li-uuid': 'upload-request' })
  };
};

const initialized = await initializeLinkedInImageUpload({
  accessToken: 'image-token',
  authorId: 'member-sub',
  apiVersion: '202606',
  fetchImpl: imageFetch
});
assert.equal(initialized.imageUrn, 'urn:li:image:test-image');
await uploadLinkedInImageBytes({
  uploadUrl: initialized.uploadUrl,
  accessToken: 'image-token',
  imageBytes: enAsset.bytes,
  fetchImpl: imageFetch
});
assert.equal(calls.length, 2);

const prepared = await prepareBrandedProfileShareMedia({
  accessToken: 'image-token',
  authorId: 'member-sub',
  postLanguage: 'ru',
  apiVersion: '202606',
  fetchImpl: imageFetch
});
assert.equal(prepared.id, 'urn:li:image:test-image');
assert.equal(prepared.language, 'ru');
assert.match(prepared.filename, /-ru-/);
assert.match(prepared.altText, /профессиональные знакомства/);

let postRequest = null;
const provider = await publishLinkedInTextPost({
  accessToken: 'post-token',
  authorId: 'member-sub',
  commentary: 'Compact Intro Deck profile post.',
  visibility: 'PUBLIC',
  apiVersion: '202606',
  media: { id: 'urn:li:image:test-image', altText: 'Intro Deck branded profile card.' },
  fetchImpl: async (url, options) => {
    postRequest = { url, options };
    return {
      ok: true,
      status: 201,
      headers: new Headers({ 'x-restli-id': 'urn:li:share:media-post', 'x-restli-request-id': 'post-request' }),
      json: async () => ({})
    };
  }
});
assert.equal(provider.postId, 'urn:li:share:media-post');
const postBody = JSON.parse(postRequest.options.body);
assert.deepEqual(postBody.content.media, {
  id: 'urn:li:image:test-image',
  altText: 'Intro Deck branded profile card.'
});

let mediaPublishArgs = null;
const withMedia = await publishProfileShareWithOptionalImage({
  accessToken: 'token',
  authorId: 'member-sub',
  commentary: 'text',
  visibility: 'PUBLIC',
  postLanguage: 'en',
  apiVersion: '202606',
  timeoutMs: 8000,
  prepareMediaImpl: async () => ({ id: 'urn:li:image:prepared', altText: 'Prepared card', language: 'en' }),
  publishImpl: async (args) => {
    mediaPublishArgs = args;
    return { postId: 'urn:li:share:1', requestId: 'req-1', httpStatus: 201 };
  },
  logger: { warn() {} }
});
assert.equal(mediaPublishArgs.media.id, 'urn:li:image:prepared');
assert.equal(withMedia.mediaAttached, true);
assert.equal(withMedia.mediaId, 'urn:li:image:prepared');
assert.equal(withMedia.mediaFallbackReason, null);

let fallbackPublishArgs = null;
const fallback = await publishProfileShareWithOptionalImage({
  accessToken: 'token',
  authorId: 'member-sub',
  commentary: 'text',
  visibility: 'PUBLIC',
  postLanguage: 'ru',
  apiVersion: '202606',
  timeoutMs: 8000,
  prepareMediaImpl: async () => {
    const error = new Error('upload failed');
    error.code = 'linkedin_image_upload_failed';
    throw error;
  },
  publishImpl: async (args) => {
    fallbackPublishArgs = args;
    return { postId: 'urn:li:share:2', requestId: 'req-2', httpStatus: 201 };
  },
  logger: { warn() {} }
});
assert.equal(fallbackPublishArgs.media, null);
assert.equal(fallback.mediaAttached, false);
assert.equal(fallback.mediaFallbackReason, 'linkedin_image_upload_failed');

const storeSource = readFileSync(new URL('../src/lib/storage/linkedinShareStore.js', import.meta.url), 'utf8');
assert.match(storeSource, /claim\.intent\.source_kind === 'profile_share'/);
assert.match(storeSource, /publishProfileWithMediaImpl/);
assert.match(storeSource, /mediaFallbackReason/);
const callbackSource = readFileSync(new URL('../api/oauth/callback/linkedin.js', import.meta.url), 'utf8');
assert.match(callbackSource, /postLanguage: statePayload\.postLanguage \|\| 'en'/);
const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
for (const token of [
  'profileShareMediaPolicy',
  "assetStrategy: 'versioned_language_specific_png'",
  "textOnlyFallback: 'before_post_request_only'",
  "unknownOutcomePolicy: 'block_automatic_retry'",
  'idempotencyChanged: false',
  'aiNewsPublisherChanged: false'
]) assert.match(healthSource, new RegExp(token.replaceAll('.', '\\.')));
const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.equal(vercelConfig.functions['api/oauth/callback/linkedin.js'].maxDuration, 60);
assert.match(vercelConfig.functions['api/oauth/callback/linkedin.js'].includeFiles, /profile-share-\*\.png/);
assert.equal(readFileSync(new URL('../migrations/037_interface_language_boundary.sql', import.meta.url), 'utf8').length > 0, true);

console.log('OK: STEP064B4D2 branded LinkedIn image publication and profile CTA polish');
