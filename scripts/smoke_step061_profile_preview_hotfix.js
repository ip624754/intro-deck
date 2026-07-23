import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const packageJson = JSON.parse(read('package.json'));

assert.equal(packageJson.version, '0.63.1');
assert.equal(
  packageJson.scripts['smoke:step061-profile-preview-hotfix'],
  'node scripts/smoke_step061_profile_preview_hotfix.js'
);

const releaseSource = read('src/config/release.js');
assert.match(releaseSource, /CURRENT_SOURCE_STEP = '(?:STEP061H1|STEP061A|STEP063A|STEP063A-H1)'/);

const surfaceSource = read('src/bot/surfaces/appSurfaces.js');
const previewStart = surfaceSource.indexOf('async function buildProfilePreviewSurface');
const previewEnd = surfaceSource.indexOf('async function buildProfileSkillsSurface', previewStart);
assert.ok(previewStart >= 0 && previewEnd > previewStart, 'profile preview surface block must exist');
const previewBlock = surfaceSource.slice(previewStart, previewEnd);
assert.doesNotMatch(previewBlock, /aiNewsPresetDiagnostics/);
assert.doesNotMatch(previewBlock, /aiNewsPresetSummary/);
assert.doesNotMatch(previewBlock, /aiNewsConfig:/);

const opsStart = surfaceSource.indexOf('async function buildOperatorDiagnosticsSurface');
const opsEnd = surfaceSource.indexOf('async function buildIntroInboxSurface', opsStart);
assert.ok(opsStart >= 0 && opsEnd > opsStart, 'operator diagnostics surface block must exist');
const opsBlock = surfaceSource.slice(opsStart, opsEnd);
assert.match(opsBlock, /const aiNewsPresetDiagnostics = await loadAiNewsPresetOperatorDiagnostics/);
assert.match(opsBlock, /aiNewsPresetSummary: aiNewsPresetDiagnostics\.summary \|\| null/);


const webhookSource = read('api/webhook.js');
assert.match(webhookSource, /buildSafeWebhookErrorLog/);
assert.doesNotMatch(webhookSource, /console\.error\('\[api\/webhook\] failed', error\)/);

const { buildSafeWebhookErrorLog } = await import('../api/webhook.js');
const syntheticToken = '1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';
const safeLog = buildSafeWebhookErrorLog({
  name: 'BotError',
  message: `request failed for ${syntheticToken}`,
  stack: `Error: https://api.telegram.org/bot${syntheticToken}/sendMessage`,
  ctx: {
    update: { update_id: 42, callback_query: {} },
    api: { token: syntheticToken },
    callbackQuery: { data: 'p:prev' },
    match: 'p:prev'
  }
});
assert.equal(safeLog.updateId, 42);
assert.equal(safeLog.updateKind, 'callback_query');
assert.equal(safeLog.callbackData, 'p:prev');
assert.doesNotMatch(JSON.stringify(safeLog), new RegExp(syntheticToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(JSON.stringify(safeLog), /\"api\"|\"ctx\"|\"token\"/);
assert.match(JSON.stringify(safeLog), /REDACTED_TELEGRAM_BOT_TOKEN/);

const savedEnv = { ...process.env };
try {
  process.env.APP_BASE_URL = 'https://example.com';
  process.env.LINKEDIN_VERIFIED_MODE = 'off';
  process.env.LINKEDIN_SHARE_MODE = 'off';
  process.env.AI_NEWS_DRAFT_MODE = 'off';
  delete process.env.DATABASE_URL;

  const { createSurfaceBuilders } = await import('../src/bot/surfaces/appSurfaces.js');
  const builders = createSurfaceBuilders({ appBaseUrl: 'https://example.com' });
  const result = await builders.buildProfilePreviewSurface({
    from: { id: 900000001, username: 'runtime_hotfix_test' }
  });

  assert.equal(typeof result?.text, 'string');
  assert.match(result.text, /Profile preview/);
  assert.ok(result.reply_markup, 'profile preview must return a keyboard');
} finally {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
}

console.log('OK: STEP061H1 profile preview runtime hotfix');
