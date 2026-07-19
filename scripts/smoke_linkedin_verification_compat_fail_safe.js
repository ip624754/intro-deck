import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getLinkedInVerificationConfig } from '../src/config/env.js';
import { syncVerifiedOnLinkedIn } from '../src/lib/linkedin/verified.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function withEnv(values, fn) {
  const keys = Object.keys(values);
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (before[key] == null) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
}

const invalidConfig = withEnv({
  LINKEDIN_VERIFIED_MODE: 'development',
  LINKEDIN_VERIFIED_SCOPES: 'r_profile_basicinfo r_verify_details',
  LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED: '1'
}, () => getLinkedInVerificationConfig());
assert.equal(invalidConfig.configurationValid, false);
assert.equal(invalidConfig.enabled, false);
assert.equal(invalidConfig.publicBadgesEnabled, false);
assert.equal(invalidConfig.configurationError.code, 'linkedin_verified_config_invalid');

assert.throws(() => withEnv({
  LINKEDIN_VERIFIED_MODE: 'development',
  LINKEDIN_VERIFIED_SCOPES: 'r_profile_basicinfo r_verify_details'
}, () => getLinkedInVerificationConfig({ strict: true })), /must include r_verify/);

const { default: healthHandler } = await import('../api/health.js');
await withEnv({
  LINKEDIN_VERIFIED_MODE: 'development',
  LINKEDIN_VERIFIED_SCOPES: 'r_profile_basicinfo r_verify_details',
  LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED: '1'
}, async () => {
  let statusCode = null;
  let body = null;
  const response = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; }
  };
  await healthHandler({}, response);
  assert.equal(statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.flags.linkedInVerificationConfigured, false);
  assert.equal(body.linkedInVerification.enabled, false);
  assert.equal(body.linkedInVerification.configurationValid, false);
  assert.equal(body.linkedInVerification.publicBadgesEnabled, false);
});

const config = withEnv({
  LINKEDIN_VERIFIED_MODE: 'development',
  LINKEDIN_VERIFIED_SCOPES: 'r_profile_basicinfo r_verify',
  LINKEDIN_VERIFIED_IDENTITY_API_VERSION: '202510.03',
  LINKEDIN_VERIFIED_REPORT_API_VERSION: '202510',
  LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED: '0'
}, () => getLinkedInVerificationConfig());
assert.equal(config.configurationValid, true);
assert.equal(config.verificationScope, 'r_verify');

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  const text = String(url);
  calls.push(text);
  if (text.includes('/identityMe')) {
    return new Response(JSON.stringify({ id: 'member-058b1', basicInfo: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  if (text.includes('verificationCriteria=')) {
    return new Response(JSON.stringify({ status: 400, message: 'criteria rejected' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'x-li-uuid': 'primary-request-id' }
    });
  }
  return new Response(JSON.stringify({ id: 'member-058b1', verifications: ['IDENTITY'] }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-li-uuid': 'fallback-request-id' }
  });
};
try {
  const result = await syncVerifiedOnLinkedIn({ accessToken: 'token', verificationConfig: config });
  assert.equal(result.status, 'success');
  assert.equal(result.snapshot.identityVerified, true);
  assert.equal(result.diagnostics.verificationReportStrategy, 'no_criteria_fallback');
  assert.equal(result.diagnostics.fallbackAttempted, true);
  assert.equal(result.diagnostics.primaryStatus, 400);
  assert.equal(result.diagnostics.primaryRequestId, 'primary-request-id');
  assert.equal(result.diagnostics.requestId, 'fallback-request-id');
  const reportCalls = calls.filter((item) => item.includes('/verificationReport'));
  assert.equal(reportCalls.length, 2);
  assert.deepEqual(new URL(reportCalls[0]).searchParams.getAll('verificationCriteria'), ['IDENTITY', 'WORKPLACE']);
  assert.equal(new URL(reportCalls[1]).searchParams.has('verificationCriteria'), false);
} finally {
  globalThis.fetch = originalFetch;
}

const failedCalls = [];
globalThis.fetch = async (url) => {
  const text = String(url);
  failedCalls.push(text);
  if (text.includes('/identityMe')) {
    return new Response(JSON.stringify({ id: 'member-058b1', basicInfo: {} }), { status: 200 });
  }
  const fallback = !text.includes('verificationCriteria=');
  return new Response(JSON.stringify({ status: 400 }), {
    status: 400,
    headers: { 'x-li-uuid': fallback ? 'fallback-failed-id' : 'primary-failed-id' }
  });
};
try {
  const result = await syncVerifiedOnLinkedIn({ accessToken: 'token', verificationConfig: config });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.error.compatibilityFallbackAttempted, true);
  assert.equal(result.error.requestId, 'fallback-failed-id');
  assert.equal(result.error.primaryRequestId, 'primary-failed-id');
  assert.equal(result.error.attempt, 'no_criteria_fallback');
} finally {
  globalThis.fetch = originalFetch;
}

const health = read('api/health.js');
const start = read('api/oauth/start/linkedin.js');
const inviteStore = read('src/lib/storage/inviteStore.js');
const callback = read('api/oauth/callback/linkedin.js');
const verified = read('src/lib/linkedin/verified.js');

assert.equal(health.includes('configurationValid'), true);
assert.equal(health.includes('configurationError'), true);
assert.equal(start.includes('verificationConfig.configurationValid !== false'), true);
assert.equal(callback.includes('Compatibility retry without verification criteria also failed.'), true);
assert.equal(callback.includes('LinkedIn request ID:'), true);
assert.equal(verified.includes("strategy: 'no_criteria_fallback'"), true);
assert.equal(verified.includes('compatibilityFallbackAttempted'), true);
assert.equal(inviteStore.includes('node-postgres does not support concurrent queries on the same checked-out client'), true);
assert.equal(inviteStore.includes('const [mode, config, activationState] = await Promise.all(['), false);
assert.equal(['STEP058B1', 'STEP059', 'STEP060'].includes(CURRENT_SOURCE_STEP), true);

console.log('OK: STEP058B1 LinkedIn verification compatibility and fail-safe contract');
