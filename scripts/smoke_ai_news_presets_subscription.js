import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getAiNewsDraftConfig } from '../src/config/env.js';
import {
  buildPresetName,
  computeNextPresetRunAt,
  normalizeScheduleKind,
  scheduleLabel
} from '../src/lib/ai/newsPresetSchedule.js';
import {
  renderAiNewsPresetText,
  renderAiNewsPresetsText
} from '../src/lib/telegram/aiNewsRender.js';
import { renderHelpText, renderPricingText } from '../src/lib/telegram/render.js';
import healthHandler from '../api/health.js';
import cronHandler from '../api/cron/ai-news-drafts.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const vercel = JSON.parse(read('vercel.json'));

assert.equal(CURRENT_SOURCE_STEP, 'STEP061H1');
assert.equal(packageJson.version, '0.59.1');
assert.equal(packageJson.scripts['smoke:ai-news-productization'], 'node scripts/smoke_ai_news_presets_subscription.js');

const migration = read('migrations/031_ai_news_presets_subscription.sql');
for (const table of ['ai_news_presets', 'ai_news_preset_runs']) {
  assert.match(migration, new RegExp(`create table if not exists ${table}`));
}
assert.match(migration, /add column if not exists preset_id/);
assert.match(migration, /add column if not exists preset_run_id/);
assert.match(migration, /delivery_kind in \('manual', 'scheduled', 'run_now'\)/);
assert.match(migration, /uq_ai_news_preset_scheduled_run/);
assert.match(migration, /uq_ai_news_drafts_preset_run/);
assert.match(migration, /Scheduled delivery creates Telegram drafts only/i);

const presetRepo = read('src/db/aiNewsPresetRepo.js');
assert.match(presetRepo, /row_number\(\) over \(partition by p\.user_id/);
assert.match(presetRepo, /for update of p skip locked/);
assert.match(presetRepo, /on conflict \(preset_id, scheduled_for\).*do nothing/s);
assert.match(presetRepo, /status='retry_due'/);
assert.match(presetRepo, /not exists[\s\S]*ai_news_drafts/);

const presetStore = read('src/lib/storage/aiNewsPresetStore.js');
assert.match(presetStore, /findAiNewsSourcesForTelegramUser/);
assert.match(presetStore, /generateAiNewsDraftForTelegramUser/);
assert.match(presetStore, /ignoreCooldown: envelope\.trigger_kind === 'scheduled'/);
assert.match(presetStore, /Nothing was published/);
assert.match(presetStore, /automaticPublishing: false/);
assert.doesNotMatch(presetStore, /publishLinkedIn|createLinkedInPost|postLinkedInShare/i);
assert.match(presetStore, /acquireAiNewsUserLock/);
assert.match(presetStore, /migration_031_required/);

const aiRepo = read('src/db/aiNewsRepo.js');
assert.match(aiRepo, /ignoreCooldown = false/);
assert.match(aiRepo, /!ignoreCooldown && lastSearchAt/);

const cronSource = read('api/cron/ai-news-drafts.js');
assert.match(cronSource, /invalid_ai_news_cron_auth/);
assert.match(cronSource, /processDueAiNewsPresetRuns/);
assert.doesNotMatch(cronSource, /linkedin|publish/i);

const scheduleCron = vercel.crons.find((entry) => entry.path === '/api/cron/ai-news-drafts');
assert.ok(scheduleCron, 'STEP061 Vercel cron is missing');
assert.equal(scheduleCron.schedule, '10 8 * * *');
assert.ok(!scheduleCron.schedule.includes('* * * * *'), 'minute-level cron is forbidden for the default Vercel daily driver');

assert.equal(normalizeScheduleKind('WEEKDAYS'), 'weekdays');
assert.equal(normalizeScheduleKind('invalid'), 'manual');
assert.equal(buildPresetName({ presetKey: 'ai_technology', postLanguage: 'en', tone: 'professional' }), 'AI & Technology · EN · Professional');
assert.equal(scheduleLabel({ scheduleKind: 'daily', deliveryHourUtc: 8 }), 'Daily at 08:00 UTC');
assert.equal(computeNextPresetRunAt({ scheduleKind: 'manual', deliveryHourUtc: 8, from: new Date('2026-07-20T07:00:00Z') }), null);
assert.equal(
  computeNextPresetRunAt({ scheduleKind: 'daily', deliveryHourUtc: 8, from: new Date('2026-07-20T07:00:00Z') }).toISOString(),
  '2026-07-20T08:00:00.000Z'
);
assert.equal(
  computeNextPresetRunAt({ scheduleKind: 'weekdays', deliveryHourUtc: 8, from: new Date('2026-07-24T09:00:00Z') }).toISOString(),
  '2026-07-27T08:00:00.000Z'
);

const savedEnv = { ...process.env };
function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
}
try {
  process.env.AI_NEWS_DRAFT_MODE = 'pro';
  process.env.NEWSDATA_API_KEY = 'news-secret';
  process.env.OPENAI_API_KEY = 'openai-secret';
  process.env.AI_NEWS_PRESET_LIMIT = '3';
  process.env.AI_NEWS_SCHEDULE_MODE = 'live';
  process.env.AI_NEWS_SCHEDULE_DRIVER = 'vercel_daily';
  process.env.AI_NEWS_SCHEDULE_DAILY_HOUR_UTC = '8';
  process.env.CRON_SECRET = 'cron-secret-value';
  delete process.env.AI_NEWS_CRON_SECRET;
  const config = getAiNewsDraftConfig({ strict: true });
  assert.equal(config.mode, 'pro');
  assert.equal(config.presetLimit, 3);
  assert.equal(config.schedule.enabled, true);
  assert.equal(config.schedule.driver, 'vercel_daily');
  assert.equal(config.schedule.dailyHourUtc, 8);
  assert.equal(config.schedule.cronAuthSource, 'CRON_SECRET');
  assert.equal(config.scheduledDeliveryCreatesDraftOnly, true);
  assert.equal(config.automaticPublishing, false);

  const healthResponse = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await healthHandler({}, healthResponse);
  assert.equal(healthResponse.statusCode, 200);
  assert.equal(healthResponse.body.step, 'STEP061H1');
  assert.equal(healthResponse.body.aiNewsDraft.mode, 'pro');
  assert.equal(healthResponse.body.aiNewsDraft.schedule.enabled, true);
  assert.equal(healthResponse.body.aiNewsDraft.schedule.scheduledEffect, 'telegram_draft_only');
  assert.equal(healthResponse.body.aiNewsDraft.subscriptionControlsAccessNotPublishing, true);

  const cronResponse = {
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await cronHandler({ method: 'GET', headers: {} }, cronResponse);
  assert.equal(cronResponse.statusCode, 401);
  assert.equal(cronResponse.body.error, 'invalid_ai_news_cron_auth');
} finally {
  restoreEnv();
}

const invalidEnv = { ...process.env };
try {
  process.env.AI_NEWS_DRAFT_MODE = 'operator';
  process.env.NEWSDATA_API_KEY = 'news-secret';
  process.env.OPENAI_API_KEY = 'openai-secret';
  process.env.AI_NEWS_SCHEDULE_MODE = 'live';
  delete process.env.AI_NEWS_CRON_SECRET;
  delete process.env.CRON_SECRET;
  const failSafe = getAiNewsDraftConfig();
  assert.equal(failSafe.enabled, true, 'invalid optional scheduler must not disable manual AI/news drafts');
  assert.equal(failSafe.schedule.enabled, false);
  assert.equal(failSafe.schedule.configurationValid, false);
  assert.equal(failSafe.automaticPublishing, false);
} finally {
  for (const key of Object.keys(process.env)) if (!(key in invalidEnv)) delete process.env[key];
  Object.assign(process.env, invalidEnv);
}

const presetsText = renderAiNewsPresetsText({
  state: {
    eligible: true,
    reason: 'pro_access',
    config: { presetLimit: 3, schedule: { enabled: true, driver: 'vercel_daily' } },
    usage: { used: 1, limit: 3 },
    presets: [{ name: 'AI & Technology · EN · Professional', status: 'active', schedule_kind: 'daily', delivery_hour_utc: 8 }]
  }
});
assert.match(presetsText, /Scheduled delivery creates a Telegram draft only/i);
assert.match(presetsText, /Access: Pro/);
assert.match(presetsText, /at most one scheduled draft per member per scheduler execution/i);
const presetText = renderAiNewsPresetText({
  state: {
    preset: { name: 'AI', preset_key: 'ai_technology', post_language: 'en', tone: 'professional', status: 'active', schedule_kind: 'daily', delivery_hour_utc: 8 },
    config: { schedule: { enabled: true, driver: 'vercel_daily', dailyHourUtc: 8 } }
  }
});
assert.match(presetText, /never authorizes or publishes a LinkedIn post/i);
assert.match(presetText, /multiple due presets rotate oldest-first/i);
assert.match(renderHelpText({ aiNewsVisible: true }), /save personal presets/i);
const pricingText = renderPricingText({
  pricingState: {
    persistenceEnabled: true,
    pricing: { proMonthlyPriceStars: 149, contactUnlockPriceStars: 75, dmOpenPriceStars: 100 },
    subscriptionConfig: { proMonthlyDurationDays: 30 },
    contactPolicy: { proOutreachDailyLimit: 10 },
    proOutreachAllowance: { supported: true, used: 0, remaining: 10, limit: 10 },
    aiNewsConfig: { mode: 'pro', dailyLimit: 3, presetLimit: 3, schedule: { enabled: true } },
    recentReceipts: []
  }
});
assert.match(pricingText, /saved personalized presets/);
assert.match(pricingText, /never automatic LinkedIn publishing/);
assert.match(pricingText, /separate explicit authorization/);

const terms = read('terms/index.html');
const privacy = read('privacy/index.html');
assert.match(terms, /No subscription, preset, scheduled task, or generated draft authorizes automatic LinkedIn publication/);
assert.match(privacy, /saved preset/i);
assert.match(read('README.md'), /STEP061/);
assert.match(read('doc\/00_CURRENT_STATE.md'), /STEP061/);
assert.match(read('doc\/15_NEW_CHAT_HANDOFF.md'), /STEP061/);

console.log('OK: STEP061 personalized news presets and subscription productization contract');
