import crypto from 'node:crypto';
import {
  getAiNewsDraftConfig,
  getOperatorConfig,
  getTelegramConfig,
  isOperatorTelegramUser
} from '../../config/env.js';
import { createAdminAuditEvent } from '../../db/adminRepo.js';
import {
  createRunNowAiNewsPresetRun,
  createScheduledAiNewsPresetRun,
  createAiNewsPreset,
  countAiNewsPresets,
  getAiNewsPresetByToken,
  getAiNewsPresetOperatorSummary,
  getAiNewsPresetRunEnvelope,
  listAiNewsPresets,
  listDueAiNewsPresetsForClaim,
  listRetryableAiNewsPresetRunsForClaim,
  markAiNewsPresetError,
  markAiNewsPresetRunDraftReady,
  markAiNewsPresetRunStatus,
  markAiNewsPresetSuccess,
  setAiNewsPresetStatus,
  softDeleteAiNewsPreset,
  updateAiNewsPresetSchedule
} from '../../db/aiNewsPresetRepo.js';
import { acquireAiNewsUserLock, getAiNewsPreferences, getAiNewsRolloutSummary } from '../../db/aiNewsRepo.js';
import { getUserEntitlements } from '../../db/monetizationRepo.js';
import { isDatabaseConfigured, withDbTransaction } from '../../db/pool.js';
import { getProfileSnapshotByUserId } from '../../db/profileRepo.js';
import { getSchemaCompat } from '../../db/schemaCompat.js';
import { upsertTelegramUser } from '../../db/usersRepo.js';
import {
  buildPresetName,
  computeNextPresetRunAt,
  normalizeDeliveryHourUtc,
  normalizeScheduleKind
} from '../ai/newsPresetSchedule.js';
import { audienceLabel, angleLabel } from '../ai/newsDiscoveryContract.js';
import { sendTelegramMessage } from '../telegram/botApi.js';
import {
  findAiNewsSourcesForTelegramUser,
  generateAiNewsDraftForTelegramUser
} from './aiNewsStore.js';

function persistenceUnavailable() {
  return { persistenceEnabled: false, reason: 'DATABASE_URL is not configured' };
}

function hasAccess({ config, telegramUserId, entitlements }) {
  const operator = isOperatorTelegramUser(telegramUserId);
  if (!config.enabled || config.configurationValid === false) return { allowed: false, reason: 'ai_news_disabled' };
  if (config.rolloutStage === 'operator_acceptance' && !operator) {
    return { allowed: false, reason: 'ai_news_operator_acceptance_in_progress' };
  }
  if (config.mode === 'operator') return { allowed: operator, reason: operator ? 'operator_access' : 'operator_only' };
  if (config.mode === 'pro') {
    const pro = Boolean(entitlements?.proActive);
    return { allowed: operator || pro, reason: operator ? 'operator_access' : pro ? 'pro_access' : 'pro_required' };
  }
  return { allowed: false, reason: 'ai_news_disabled' };
}

function preferenceOverrideFromPreset(preset) {
  return {
    preset_key: preset.preset_key,
    custom_query: preset.custom_query,
    source_language: preset.source_language,
    source_country: preset.source_country,
    source_category: preset.source_category,
    post_language: preset.post_language,
    tone: preset.tone,
    audience_key: preset.audience_key,
    custom_audience: preset.custom_audience,
    angle_key: preset.angle_key,
    profile_affinity_enabled: preset.profile_affinity_enabled !== false
  };
}

function safeErrorCode(reason) {
  return String(reason || 'ai_news_preset_failed').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').slice(0, 160);
}

function scheduleHour(config, requestedHour) {
  return config.schedule.driver === 'vercel_daily'
    ? config.schedule.dailyHourUtc
    : normalizeDeliveryHourUtc(requestedHour, config.schedule.dailyHourUtc);
}

async function loadPresetAccessContext(client, { telegramUserId, telegramUsername = null }) {
  const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
  const profile = await getProfileSnapshotByUserId(client, user.id);
  const entitlements = await getUserEntitlements(client, { userId: user.id });
  return { user, profile, entitlements };
}

export async function loadAiNewsPresetsForTelegramUser({ telegramUserId, telegramUsername = null }) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return { ...persistenceUnavailable(), config, presets: [] };
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPresetsTable || !compat.hasAiNewsPresetRunsTable || !compat.aiNewsDraftsHasPresetRunId) {
      return { persistenceEnabled: true, config, eligible: false, reason: 'migration_031_required', presets: [] };
    }
    if (!compat.aiNewsAudienceContractReady) {
      return { persistenceEnabled: true, config, eligible: false, reason: 'migration_036_required', presets: [] };
    }
    const context = await loadPresetAccessContext(client, { telegramUserId, telegramUsername });
    const access = hasAccess({ config, telegramUserId, entitlements: context.entitlements });
    const presets = await listAiNewsPresets(client, { userId: context.user.id });
    return {
      persistenceEnabled: true,
      config,
      eligible: access.allowed,
      reason: access.reason,
      ...context,
      presets,
      usage: { used: presets.length, limit: config.presetLimit, remaining: Math.max(0, config.presetLimit - presets.length) }
    };
  });
}

export async function loadAiNewsPresetForTelegramUser({ telegramUserId, telegramUsername = null, publicToken }) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return { ...persistenceUnavailable(), config, preset: null };
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPresetsTable) return { persistenceEnabled: true, config, preset: null, reason: 'migration_031_required' };
    if (!compat.aiNewsAudienceContractReady) return { persistenceEnabled: true, config, preset: null, reason: 'migration_036_required' };
    const context = await loadPresetAccessContext(client, { telegramUserId, telegramUsername });
    const access = hasAccess({ config, telegramUserId, entitlements: context.entitlements });
    const preset = await getAiNewsPresetByToken(client, { userId: context.user.id, publicToken });
    return { persistenceEnabled: true, config, eligible: access.allowed, reason: preset ? access.reason : 'ai_news_preset_not_found', preset, ...context };
  });
}

export async function saveCurrentAiNewsPreferencesAsPreset({ telegramUserId, telegramUsername = null }) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPresetsTable || !compat.hasAiNewsPresetRunsTable || !compat.aiNewsDraftsHasPresetRunId) {
      return { persistenceEnabled: true, created: false, reason: 'migration_031_required' };
    }
    if (!compat.aiNewsAudienceContractReady) {
      return { persistenceEnabled: true, created: false, reason: 'migration_036_required' };
    }
    const context = await loadPresetAccessContext(client, { telegramUserId, telegramUsername });
    const access = hasAccess({ config, telegramUserId, entitlements: context.entitlements });
    if (!access.allowed) return { persistenceEnabled: true, created: false, reason: access.reason };
    if (!context.profile?.linkedin_sub) return { persistenceEnabled: true, created: false, reason: 'linkedin_not_connected' };
    await acquireAiNewsUserLock(client, context.user.id);
    const count = await countAiNewsPresets(client, { userId: context.user.id });
    if (count >= config.presetLimit) return { persistenceEnabled: true, created: false, reason: 'ai_news_preset_limit_reached' };
    const preferences = await getAiNewsPreferences(client, context.user.id);
    if (!preferences) return { persistenceEnabled: true, created: false, reason: 'ai_news_preferences_not_found' };
    const name = buildPresetName({
      presetKey: preferences.preset_key,
      customQuery: preferences.custom_query,
      postLanguage: preferences.post_language,
      tone: preferences.tone,
      audienceLabel: audienceLabel(preferences),
      angleLabel: angleLabel(preferences)
    });
    try {
      const preset = await createAiNewsPreset(client, {
        publicToken: crypto.randomUUID(),
        userId: context.user.id,
        name,
        presetKey: preferences.preset_key,
        customQuery: preferences.custom_query,
        sourceLanguage: preferences.source_language,
        sourceCountry: preferences.source_country,
        sourceCategory: preferences.source_category,
        postLanguage: preferences.post_language,
        tone: preferences.tone,
        audienceKey: preferences.audience_key,
        customAudience: preferences.custom_audience,
        angleKey: preferences.angle_key,
        profileAffinityEnabled: preferences.profile_affinity_enabled !== false,
        scheduleKind: 'manual',
        deliveryHourUtc: config.schedule.dailyHourUtc,
        nextRunAt: null
      });
      await createAdminAuditEvent(client, {
        eventType: 'ai_news_preset_created',
        actorUserId: context.user.id,
        targetUserId: context.user.id,
        summary: 'Member saved a personalized AI/news preset.',
        detail: {
          presetId: preset.id,
          presetKey: preset.preset_key,
          audienceKey: preset.audience_key,
          angleKey: preset.angle_key,
          profileAffinityEnabled: preset.profile_affinity_enabled !== false,
          scheduleKind: preset.schedule_kind
        }
      });
      return { persistenceEnabled: true, created: true, reason: 'ai_news_preset_created', preset };
    } catch (error) {
      if (error?.code === '23505') return { persistenceEnabled: true, created: false, reason: 'ai_news_preset_duplicate' };
      throw error;
    }
  });
}

export async function updateAiNewsPresetScheduleForTelegramUser({
  telegramUserId,
  telegramUsername = null,
  publicToken,
  scheduleKind,
  deliveryHourUtc = null
}) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPresetsTable) return { persistenceEnabled: true, changed: false, reason: 'migration_031_required' };
    if (!compat.aiNewsAudienceContractReady) return { persistenceEnabled: true, changed: false, reason: 'migration_036_required' };
    const context = await loadPresetAccessContext(client, { telegramUserId, telegramUsername });
    const access = hasAccess({ config, telegramUserId, entitlements: context.entitlements });
    if (!access.allowed) return { persistenceEnabled: true, changed: false, reason: access.reason };
    const preset = await getAiNewsPresetByToken(client, { userId: context.user.id, publicToken, forUpdate: true });
    if (!preset) return { persistenceEnabled: true, changed: false, reason: 'ai_news_preset_not_found' };
    const kind = normalizeScheduleKind(scheduleKind);
    if (kind !== 'manual' && (!config.schedule.enabled || config.schedule.configurationValid === false)) {
      return { persistenceEnabled: true, changed: false, reason: 'ai_news_schedule_disabled' };
    }
    const hour = scheduleHour(config, deliveryHourUtc ?? preset.delivery_hour_utc);
    const nextRunAt = computeNextPresetRunAt({ scheduleKind: kind, deliveryHourUtc: hour });
    const changed = await updateAiNewsPresetSchedule(client, {
      presetId: preset.id,
      scheduleKind: kind,
      deliveryHourUtc: hour,
      nextRunAt
    });
    return { persistenceEnabled: true, changed: Boolean(changed), reason: 'ai_news_preset_schedule_updated', preset: changed };
  });
}

export async function setAiNewsPresetPausedForTelegramUser({ telegramUserId, telegramUsername = null, publicToken, paused }) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const context = await loadPresetAccessContext(client, { telegramUserId, telegramUsername });
    const access = hasAccess({ config, telegramUserId, entitlements: context.entitlements });
    if (!access.allowed) return { persistenceEnabled: true, changed: false, reason: access.reason };
    const preset = await getAiNewsPresetByToken(client, { userId: context.user.id, publicToken, forUpdate: true });
    if (!preset) return { persistenceEnabled: true, changed: false, reason: 'ai_news_preset_not_found' };
    if (paused) {
      const changed = await setAiNewsPresetStatus(client, { presetId: preset.id, status: 'paused', errorCode: null });
      return { persistenceEnabled: true, changed: Boolean(changed), reason: 'ai_news_preset_paused', preset: changed };
    }
    const nextRunAt = computeNextPresetRunAt({ scheduleKind: preset.schedule_kind, deliveryHourUtc: preset.delivery_hour_utc });
    const changed = await setAiNewsPresetStatus(client, { presetId: preset.id, status: 'active', nextRunAt, errorCode: null });
    return { persistenceEnabled: true, changed: Boolean(changed), reason: 'ai_news_preset_resumed', preset: changed };
  });
}

export async function deleteAiNewsPresetForTelegramUser({ telegramUserId, telegramUsername = null, publicToken }) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const context = await loadPresetAccessContext(client, { telegramUserId, telegramUsername });
    const access = hasAccess({ config, telegramUserId, entitlements: context.entitlements });
    if (!access.allowed) return { persistenceEnabled: true, changed: false, reason: access.reason };
    const preset = await getAiNewsPresetByToken(client, { userId: context.user.id, publicToken, forUpdate: true });
    if (!preset) return { persistenceEnabled: true, changed: false, reason: 'ai_news_preset_not_found' };
    const changed = await softDeleteAiNewsPreset(client, { presetId: preset.id });
    return { persistenceEnabled: true, changed: Boolean(changed), reason: 'ai_news_preset_deleted', preset: changed };
  });
}

async function createRunNowClaim({ telegramUserId, telegramUsername, publicToken, config }) {
  if (config.generator?.mode === 'off') return { ok: false, reason: 'ai_news_generator_disabled' };
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPresetRunsTable || !compat.aiNewsDraftsHasPresetRunId) return { ok: false, reason: 'migration_031_required' };
    if (!compat.aiNewsAudienceContractReady) return { ok: false, reason: 'migration_036_required' };
    if (['groq', 'template'].includes(config.generator?.mode)
      && (!compat.aiNewsDraftsHasGeneratorProviders || !compat.aiNewsTelemetryHasGeneratorProviders)) {
      return { ok: false, reason: 'migration_034_required' };
    }
    const context = await loadPresetAccessContext(client, { telegramUserId, telegramUsername });
    const access = hasAccess({ config, telegramUserId, entitlements: context.entitlements });
    if (!access.allowed) return { ok: false, reason: access.reason };
    await acquireAiNewsUserLock(client, context.user.id);
    const preset = await getAiNewsPresetByToken(client, { userId: context.user.id, publicToken, forUpdate: true });
    if (!preset) return { ok: false, reason: 'ai_news_preset_not_found' };
    const run = await createRunNowAiNewsPresetRun(client, {
      publicToken: crypto.randomUUID(),
      presetId: preset.id,
      userId: context.user.id,
      claimToken: crypto.randomUUID(),
      claimExpiresAt: new Date(Date.now() + config.schedule.claimTimeoutSeconds * 1000)
    });
    return { ok: true, preset, run, context };
  });
}

async function finalizeRunFailure({ runId, presetId, status, reason, retry = false, config }) {
  const code = safeErrorCode(reason);
  return withDbTransaction(async (client) => {
    const envelope = await getAiNewsPresetRunEnvelope(client, { runId, forUpdate: true });
    if (!envelope) return null;
    const attempts = Number(envelope.attempt_count || 0);
    const retryAllowed = retry && attempts < config.schedule.maxAttempts;
    const changed = await markAiNewsPresetRunStatus(client, {
      runId,
      status: retryAllowed ? 'retry_due' : status,
      errorCode: code,
      nextAttemptAt: retryAllowed ? new Date(Date.now() + config.schedule.retryDelaySeconds * 1000) : null,
      detail: { reason: code, retryAllowed }
    });
    await markAiNewsPresetError(client, { presetId, errorCode: code });
    return changed;
  });
}

async function deliverPresetDraft({ runId, config }) {
  const envelope = await withDbTransaction((client) => getAiNewsPresetRunEnvelope(client, { runId }));
  if (!envelope?.draft_public_token || !envelope.telegram_user_id) {
    return finalizeRunFailure({ runId, presetId: envelope?.preset_id, status: 'failed', reason: 'ai_news_preset_delivery_envelope_missing', retry: false, config });
  }
  const text = [
    '🧠 Scheduled news draft ready',
    '',
    `Preset: ${envelope.preset_name}`,
    `Source: ${envelope.source_title || 'Fresh news source'}`,
    envelope.source_name || envelope.source_domain || '',
    '',
    'Nothing was published. Open the draft to review, edit, or explicitly approve one LinkedIn post.'
  ].filter(Boolean).join('\n');
  try {
    const { botToken } = getTelegramConfig();
    const response = await sendTelegramMessage({
      botToken,
      chatId: envelope.telegram_user_id,
      text,
      parseMode: null,
      replyMarkup: {
        inline_keyboard: [
          [{ text: '📝 Review draft', callback_data: `news:draft:${envelope.draft_public_token}` }],
          [{ text: '⚙️ Preset settings', callback_data: `news:ps:${envelope.preset_public_token}` }]
        ]
      }
    });
    await withDbTransaction(async (client) => {
      await markAiNewsPresetRunStatus(client, {
        runId,
        status: 'delivered',
        telegramMessageId: response?.result?.message_id || null,
        errorCode: null,
        detail: { delivery: 'telegram', automaticPublishing: false }
      });
      await markAiNewsPresetSuccess(client, { presetId: envelope.preset_id });
    });
    return { delivered: true, runId, draftToken: envelope.draft_public_token };
  } catch (error) {
    return finalizeRunFailure({
      runId,
      presetId: envelope.preset_id,
      status: 'failed',
      reason: String(error?.message || error).includes('429') ? 'telegram_rate_limited' : 'telegram_delivery_failed',
      retry: true,
      config
    });
  }
}

async function executePresetRun({ runId, deliver, fetchImpl = fetch }) {
  const config = getAiNewsDraftConfig();
  if (config.generator?.mode === 'off') return { ok: false, reason: 'ai_news_generator_disabled' };
  const envelope = await withDbTransaction((client) => getAiNewsPresetRunEnvelope(client, { runId }));
  if (!envelope) return { ok: false, reason: 'ai_news_preset_run_not_found' };
  if (envelope.draft_public_token) {
    if (deliver) return deliverPresetDraft({ runId, config });
    return { ok: true, generated: true, run: envelope, draft: { public_token: envelope.draft_public_token } };
  }

  await withDbTransaction((client) => markAiNewsPresetRunStatus(client, {
    runId,
    status: 'searching',
    clearClaim: false,
    detail: { phase: 'searching' }
  }));

  const preferenceOverride = preferenceOverrideFromPreset(envelope);
  const sources = await findAiNewsSourcesForTelegramUser({
    telegramUserId: Number(envelope.telegram_user_id),
    telegramUsername: envelope.telegram_username || null,
    preferenceOverride,
    presetRunId: envelope.id,
    ignoreCooldown: envelope.trigger_kind === 'scheduled',
    fetchImpl
  });
  if (!sources.found) {
    const pauseReasons = new Set(['pro_required', 'profile_not_listed', 'linkedin_not_connected']);
    if (pauseReasons.has(sources.reason)) {
      await withDbTransaction((client) => setAiNewsPresetStatus(client, {
        presetId: envelope.preset_id,
        status: 'paused',
        errorCode: safeErrorCode(sources.reason)
      }));
    }
    const status = sources.reason === 'ai_news_no_fresh_sources' ? 'no_source' : pauseReasons.has(sources.reason) ? 'blocked' : 'failed';
    await finalizeRunFailure({ runId, presetId: envelope.preset_id, status, reason: sources.reason, retry: false, config });
    return { ok: false, reason: sources.reason };
  }

  await withDbTransaction((client) => markAiNewsPresetRunStatus(client, {
    runId,
    status: 'generating',
    clearClaim: false,
    detail: { phase: 'generating', candidateCount: sources.articles.length }
  }));

  let generated = null;
  let lastReason = 'ai_news_no_usable_source';
  for (const article of sources.articles) {
    const result = await generateAiNewsDraftForTelegramUser({
      telegramUserId: Number(envelope.telegram_user_id),
      telegramUsername: envelope.telegram_username || null,
      sourceToken: article.public_token,
      preferenceOverride,
      presetId: envelope.preset_id,
      presetRunId: envelope.id,
      deliveryKind: envelope.trigger_kind === 'scheduled' ? 'scheduled' : 'run_now',
      fetchImpl
    });
    if (result.generated) {
      generated = result;
      break;
    }
    lastReason = result.reason || lastReason;
    if (!['ai_news_source_already_used', 'ai_news_source_not_found', 'ai_news_source_expired'].includes(lastReason)) break;
  }

  if (!generated?.generated) {
    const status = String(lastReason).startsWith('ai_news_draft_') || lastReason === 'ai_news_daily_limit_reached' ? 'blocked' : 'failed';
    await finalizeRunFailure({ runId, presetId: envelope.preset_id, status, reason: lastReason, retry: false, config });
    return { ok: false, reason: lastReason };
  }

  await withDbTransaction(async (client) => {
    await markAiNewsPresetRunDraftReady(client, { runId, sourceId: generated.source.id });
    await markAiNewsPresetSuccess(client, { presetId: envelope.preset_id });
  });

  if (deliver) return deliverPresetDraft({ runId, config });
  return { ok: true, generated: true, runId, draft: generated.draft, source: generated.source };
}

export async function runAiNewsPresetNowForTelegramUser({ telegramUserId, telegramUsername = null, publicToken, fetchImpl = fetch }) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  const claim = await createRunNowClaim({ telegramUserId, telegramUsername, publicToken, config });
  if (!claim.ok) return { persistenceEnabled: true, generated: false, reason: claim.reason };
  const result = await executePresetRun({ runId: claim.run.id, deliver: false, fetchImpl });
  return { persistenceEnabled: true, ...result };
}

export async function processDueAiNewsPresetRuns({ batchSize = null, fetchImpl = fetch } = {}) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return { ok: false, reason: 'database_not_configured' };
  if (!config.enabled || config.configurationValid === false) return { ok: false, reason: 'ai_news_disabled' };
  if (config.generator?.mode === 'off') return { ok: false, reason: 'ai_news_generator_disabled' };
  if (!config.schedule.enabled || config.schedule.configurationValid === false) return { ok: false, reason: config.schedule.configurationError?.code || 'ai_news_schedule_disabled' };

  const effectiveBatch = Number.isFinite(Number(batchSize)) ? Math.min(config.schedule.batchSize, Math.max(1, Number(batchSize))) : config.schedule.batchSize;
  const claimed = await withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPresetsTable || !compat.hasAiNewsPresetRunsTable || !compat.aiNewsDraftsHasPresetRunId) {
      return { migrationRequired: 'migration_031_required', runs: [] };
    }
    if (!compat.aiNewsAudienceContractReady) {
      return { migrationRequired: 'migration_036_required', runs: [] };
    }
    const due = await listDueAiNewsPresetsForClaim(client, { batchSize: effectiveBatch });
    const runs = [];
    for (const preset of due) {
      const hour = config.schedule.driver === 'vercel_daily' ? config.schedule.dailyHourUtc : preset.delivery_hour_utc;
      const nextRunAt = computeNextPresetRunAt({ scheduleKind: preset.schedule_kind, deliveryHourUtc: hour, from: new Date() });
      const run = await createScheduledAiNewsPresetRun(client, {
        preset,
        publicToken: crypto.randomUUID(),
        claimToken: crypto.randomUUID(),
        claimExpiresAt: new Date(Date.now() + config.schedule.claimTimeoutSeconds * 1000),
        nextRunAt
      });
      if (run) runs.push(run);
    }
    const remaining = Math.max(0, effectiveBatch - runs.length);
    if (remaining > 0) {
      const retryClaimToken = crypto.randomUUID();
      const retryRuns = await listRetryableAiNewsPresetRunsForClaim(client, {
        batchSize: remaining,
        claimToken: retryClaimToken,
        claimExpiresAt: new Date(Date.now() + config.schedule.claimTimeoutSeconds * 1000),
        maxAttempts: config.schedule.maxAttempts
      });
      runs.push(...retryRuns);
    }
    return { migrationRequired: false, runs };
  });

  if (claimed.migrationRequired) return { ok: false, reason: claimed.migrationRequired };
  const summary = { ok: true, claimedCount: claimed.runs.length, deliveredCount: 0, failedCount: 0, results: [] };
  for (const run of claimed.runs) {
    const result = await executePresetRun({ runId: run.id, deliver: true, fetchImpl }).catch((error) => ({ ok: false, reason: safeErrorCode(error?.message || error) }));
    summary.results.push({ runId: run.id, status: result?.delivered ? 'delivered' : result?.ok ? 'draft_ready' : 'failed', reason: result?.reason || null });
    if (result?.delivered) summary.deliveredCount += 1;
    else if (!result?.ok) summary.failedCount += 1;
  }
  return summary;
}

export async function loadAiNewsPresetOperatorDiagnostics() {
  if (!isDatabaseConfigured()) return { persistenceEnabled: false, summary: null };
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPresetsTable || !compat.hasAiNewsPresetRunsTable) return { persistenceEnabled: true, summary: null, reason: 'migration_031_required' };
    if (!compat.aiNewsAudienceContractReady) return { persistenceEnabled: true, summary: null, reason: 'migration_036_required' };
    const presetSummary = await getAiNewsPresetOperatorSummary(client);
    const rolloutSummary = compat.hasAiNewsProviderUsageEventsTable
      ? await getAiNewsRolloutSummary(client)
      : null;
    return {
      persistenceEnabled: true,
      summary: { ...presetSummary, ...(rolloutSummary || {}) },
      reason: rolloutSummary ? null : 'migration_032_required'
    };
  });
}

export function getAiNewsScheduleAuthSecret() {
  return getAiNewsDraftConfig().schedule.cronSecret || null;
}

export function getAiNewsOperatorIds() {
  return getOperatorConfig().operatorTelegramUserIds;
}
