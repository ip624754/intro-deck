import crypto from 'node:crypto';
import {
  getAiNewsDraftConfig,
  getLinkedInShareConfig,
  isOperatorTelegramUser
} from '../../config/env.js';
import { createAdminAuditEvent } from '../../db/adminRepo.js';
import {
  acquireAiNewsUserLock,
  attachAiNewsDraftShareIntent,
  beginAiNewsInputSession,
  cancelAiNewsDraft,
  calculateAiNewsSearchUsage,
  claimAiNewsSourceSearch,
  releaseAiNewsSourceSearchClaim,
  clearAiNewsInputSession,
  countAiNewsDraftsSince,
  createGeneratingAiNewsDraft,
  finalizeAiNewsDraftFailed,
  finalizeAiNewsDraftGenerated,
  getAiNewsDraftByToken,
  getAiNewsDraftByUserAndSource,
  getAiNewsInputSession,
  getAiNewsPreferences,
  getAiNewsSourceByToken,
  insertAiNewsProviderUsageEvent,
  getBlockingAiNewsDraft,
  getLatestAiNewsDraftForUser,
  listRecentAiNewsSources,
  patchAiNewsPreferences,
  updateAiNewsDraftText,
  upsertAiNewsPreferences,
  upsertAiNewsSource
} from '../../db/aiNewsRepo.js';
import { getUserEntitlements } from '../../db/monetizationRepo.js';
import { listAiNewsPresets } from '../../db/aiNewsPresetRepo.js';
import { withDbTransaction, isDatabaseConfigured } from '../../db/pool.js';
import { getProfileSnapshotByUserId } from '../../db/profileRepo.js';
import { getSchemaCompat } from '../../db/schemaCompat.js';
import { upsertTelegramUser } from '../../db/usersRepo.js';
import { isProviderDraftError, generateNewsDraft } from '../ai/newsDraftGenerator.js';
import { estimateFixedRequestCostMicrousd, estimateTokenCostMicrousd } from '../ai/newsCost.js';
import {
  AI_NEWS_PRESETS,
  buildSourceEvidence,
  normalizePostLanguage,
  normalizePresetKey,
  normalizeTone,
  normalizeTopicQuery,
  resolvePreferenceQuery,
  sha256,
  validateDraftText
} from '../ai/newsDraftContract.js';
import {
  buildProfileAffinityContext,
  normalizeAngleKey,
  normalizeAudienceKey,
  normalizeCustomAudience
} from '../ai/newsDiscoveryContract.js';
import { discoverNewsSources } from '../news/multiSource.js';
import { createLinkedInTextShareIntentWithClient } from './linkedinShareStore.js';



function calculateSearchCooldownState(preferences, cooldownSeconds, nowMs = Date.now()) {
  const lastSearchAt = preferences?.last_search_started_at ? new Date(preferences.last_search_started_at).getTime() : 0;
  const readyAtMs = lastSearchAt ? lastSearchAt + (Math.max(0, Number(cooldownSeconds) || 0) * 1000) : 0;
  const active = Boolean(readyAtMs && readyAtMs > nowMs);
  return {
    active,
    retryAfterSeconds: active ? Math.max(1, Math.ceil((readyAtMs - nowMs) / 1000)) : 0,
    readyAt: active ? new Date(readyAtMs) : null
  };
}

async function recordProviderUsageBestEffort(event) {
  if (!isDatabaseConfigured()) return null;
  try {
    return await withDbTransaction(async (client) => {
      const compat = await getSchemaCompat(client);
      if (!compat.hasAiNewsProviderUsageEventsTable) return null;
      return insertAiNewsProviderUsageEvent(client, event);
    });
  } catch (error) {
    console.warn('[ai news] provider telemetry skipped', {
      provider: event?.provider || null,
      operation: event?.operation || null,
      outcome: event?.outcome || null,
      error: String(error?.message || error).slice(0, 200)
    });
    return null;
  }
}

function safeGenerationErrorCode(provider, error) {
  const prefix = ['openai', 'groq', 'template'].includes(provider) ? provider : 'generator';
  if (isProviderDraftError(error)) {
    const code = String(error.code || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').slice(0, 100);
    if (code) return `${prefix}_${code}`;
    if (Number.isFinite(Number(error.status))) return `${prefix}_http_${Number(error.status)}`;
    const message = String(error.message || '').trim().toLowerCase();
    if (new RegExp(`^${prefix}_[a-z0-9_.-]+$`, 'i').test(message)) return message;
    return `${prefix}_provider_error`;
  }
  const message = String(error?.message || error || '').trim().toLowerCase();
  if (new RegExp(`^${prefix}_[a-z0-9_.-]+$`, 'i').test(message)) return message;
  return `${prefix}_internal_error`;
}

function generatorContract(config) {
  const mode = config?.generator?.mode || 'openai';
  if (mode === 'groq') return { provider: 'groq', model: config.groq.model };
  if (mode === 'template') return { provider: 'template', model: 'introdeck-template-v1' };
  if (mode === 'off') return { provider: null, model: null };
  return { provider: 'openai', model: config.openai.model };
}

function persistenceUnavailable() {
  return {
    persistenceEnabled: false,
    enabled: false,
    eligible: false,
    reason: 'DATABASE_URL is not configured'
  };
}

function defaultPreferences() {
  return {
    preset_key: 'for_you',
    custom_query: null,
    audience_key: 'professional_network',
    custom_audience: null,
    angle_key: 'expert_take',
    profile_affinity_enabled: true,
    source_language: 'en',
    source_country: null,
    source_category: null,
    post_language: 'en',
    tone: 'professional'
  };
}

function normalizePreferences(row) {
  return { ...defaultPreferences(), ...(row || {}) };
}

function checkEligibility({ config, telegramUserId, entitlements, profile }) {
  if (!config.enabled || config.configurationValid === false) {
    return { eligible: false, reason: config.configurationError?.code || 'ai_news_disabled' };
  }
  if (!profile?.linkedin_sub) return { eligible: false, reason: 'linkedin_not_connected' };
  if (profile?.profile_state !== 'active' || profile?.visibility_status !== 'listed') {
    return { eligible: false, reason: 'profile_not_listed' };
  }
  const operator = isOperatorTelegramUser(telegramUserId);
  if (config.rolloutStage === 'operator_acceptance' && !operator) {
    return { eligible: false, reason: 'ai_news_operator_acceptance_in_progress' };
  }
  if (config.mode === 'operator') return { eligible: operator, reason: operator ? 'operator_access' : 'operator_only' };
  if (config.mode === 'pro') {
    const pro = Boolean(entitlements?.proActive);
    return { eligible: operator || pro, reason: operator ? 'operator_access' : pro ? 'pro_access' : 'pro_required' };
  }
  return { eligible: false, reason: 'ai_news_disabled' };
}

async function loadUserContext(client, { telegramUserId, telegramUsername = null, multiSourceSchema = false }) {
  const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
  // One checked-out pg client must execute queries sequentially. Parallel client.query()
  // calls are deprecated in pg and can interleave transaction state.
  const profile = await getProfileSnapshotByUserId(client, user.id);
  const entitlements = await getUserEntitlements(client, { userId: user.id });
  const preferences = await getAiNewsPreferences(client, user.id);
  const latestDraft = await getLatestAiNewsDraftForUser(client, user.id);
  const recentSources = await listRecentAiNewsSources(client, { userId: user.id, limit: 5, multiSourceSchema });
  return { user, profile, entitlements, preferences: normalizePreferences(preferences), latestDraft, recentSources };
}

export async function loadAiNewsHubState({ telegramUserId, telegramUsername = null }) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return { ...persistenceUnavailable(), config, preferences: defaultPreferences(), recentSources: [], latestDraft: null };
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPreferencesTable || !compat.hasAiNewsSourcesTable || !compat.hasAiNewsDraftsTable) {
      return { persistenceEnabled: true, enabled: config.enabled, eligible: false, reason: 'migration_030_required', config, preferences: defaultPreferences(), recentSources: [], latestDraft: null };
    }
    if (!compat.hasAiNewsProviderUsageEventsTable || !compat.aiNewsDraftsHasOpenAiUsage) {
      return { persistenceEnabled: true, enabled: config.enabled, eligible: false, reason: 'migration_032_required', config, preferences: defaultPreferences(), recentSources: [], latestDraft: null };
    }
    if (config.source?.mode === 'multi_source' && !compat.aiNewsSourcesHasQualityMetadata) {
      return { persistenceEnabled: true, enabled: config.enabled, eligible: false, reason: 'migration_033_required', config, preferences: defaultPreferences(), recentSources: [], latestDraft: null };
    }
    if (['groq', 'template'].includes(config.generator?.mode)
      && (!compat.aiNewsDraftsHasGeneratorProviders || !compat.aiNewsTelemetryHasGeneratorProviders)) {
      return { persistenceEnabled: true, enabled: config.enabled, eligible: false, reason: 'migration_034_required', config, preferences: defaultPreferences(), recentSources: [], latestDraft: null };
    }
    if (!compat.aiNewsPreferencesHasAudienceContract || !compat.aiNewsPresetsHasAudienceContract) {
      return { persistenceEnabled: true, enabled: config.enabled, eligible: false, reason: 'migration_035_required', config, preferences: defaultPreferences(), recentSources: [], latestDraft: null };
    }
    const context = await loadUserContext(client, { telegramUserId, telegramUsername, multiSourceSchema: compat.aiNewsSourcesHasQualityMetadata });
    const eligibility = checkEligibility({ config, telegramUserId, entitlements: context.entitlements, profile: context.profile });
    const used = await countAiNewsDraftsSince(client, {
      userId: context.user.id,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000)
    });
    const presets = compat.hasAiNewsPresetsTable
      ? await listAiNewsPresets(client, { userId: context.user.id })
      : [];
    return {
      persistenceEnabled: true,
      enabled: config.enabled,
      ...eligibility,
      config,
      ...context,
      personalization: buildProfileAffinityContext(context.profile),
      presets,
      presetPersistenceReady: Boolean(compat.hasAiNewsPresetsTable && compat.hasAiNewsPresetRunsTable && compat.aiNewsDraftsHasPresetRunId),
      presetUsage: { used: presets.length, limit: config.presetLimit, remaining: Math.max(0, config.presetLimit - presets.length) },
      dailyUsage: { used, limit: config.dailyLimit, remaining: Math.max(0, config.dailyLimit - used) },
      searchUsage: calculateAiNewsSearchUsage(context.preferences, config.searchDailyLimit),
      searchCooldown: calculateSearchCooldownState(context.preferences, config.searchCooldownSeconds)
    };
  });
}

export async function updateAiNewsPresetForTelegramUser({ telegramUserId, telegramUsername = null, presetKey }) {
  const normalized = normalizePresetKey(presetKey);
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPreferencesTable) return { persistenceEnabled: true, changed: false, reason: 'migration_030_required' };
    if (!compat.aiNewsPreferencesHasAudienceContract) return { persistenceEnabled: true, changed: false, reason: 'migration_035_required' };
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const preferences = await patchAiNewsPreferences(client, {
      userId: user.id,
      patch: { presetKey: normalized, customQuery: normalized === 'custom' ? null : undefined }
    });
    return { persistenceEnabled: true, changed: true, preferences };
  });
}

export async function updateAiNewsAudienceForTelegramUser({ telegramUserId, telegramUsername = null, audienceKey }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  const normalized = normalizeAudienceKey(audienceKey);
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.aiNewsPreferencesHasAudienceContract) return { persistenceEnabled: true, changed: false, reason: 'migration_035_required' };
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const preferences = await patchAiNewsPreferences(client, {
      userId: user.id,
      patch: { audienceKey: normalized, customAudience: normalized === 'custom' ? null : undefined }
    });
    return { persistenceEnabled: true, changed: true, preferences };
  });
}

export async function updateAiNewsAngleForTelegramUser({ telegramUserId, telegramUsername = null, angleKey }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  const normalized = normalizeAngleKey(angleKey);
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.aiNewsPreferencesHasAudienceContract) return { persistenceEnabled: true, changed: false, reason: 'migration_035_required' };
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const preferences = await patchAiNewsPreferences(client, { userId: user.id, patch: { angleKey: normalized } });
    return { persistenceEnabled: true, changed: true, preferences };
  });
}

export async function updateAiNewsLanguageForTelegramUser({ telegramUserId, telegramUsername = null, postLanguage }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  const language = normalizePostLanguage(postLanguage);
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPreferencesTable) return { persistenceEnabled: true, changed: false, reason: 'migration_030_required' };
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const preferences = await patchAiNewsPreferences(client, { userId: user.id, patch: { postLanguage: language } });
    return { persistenceEnabled: true, changed: true, preferences };
  });
}

export async function updateAiNewsToneForTelegramUser({ telegramUserId, telegramUsername = null, tone }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  const normalized = normalizeTone(tone);
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPreferencesTable) return { persistenceEnabled: true, changed: false, reason: 'migration_030_required' };
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const preferences = await patchAiNewsPreferences(client, { userId: user.id, patch: { tone: normalized } });
    return { persistenceEnabled: true, changed: true, preferences };
  });
}

export async function beginAiNewsTopicInputForTelegramUser({ telegramUserId, telegramUsername = null }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsInputSessionsTable) return { persistenceEnabled: true, started: false, reason: 'migration_030_required' };
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    await beginAiNewsInputSession(client, {
      userId: user.id,
      inputKind: 'topic_query',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    return { persistenceEnabled: true, started: true, reason: 'topic_input_started' };
  });
}

export async function beginAiNewsAudienceInputForTelegramUser({ telegramUserId, telegramUsername = null }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsInputSessionsTable || !compat.aiNewsPreferencesHasAudienceContract) {
      return { persistenceEnabled: true, started: false, reason: compat.hasAiNewsInputSessionsTable ? 'migration_035_required' : 'migration_030_required' };
    }
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    await beginAiNewsInputSession(client, {
      userId: user.id,
      inputKind: 'audience_query',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    return { persistenceEnabled: true, started: true, reason: 'audience_input_started' };
  });
}

export async function beginAiNewsDraftEditForTelegramUser({ telegramUserId, telegramUsername = null, publicToken }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsInputSessionsTable || !compat.hasAiNewsDraftsTable) return { persistenceEnabled: true, started: false, reason: 'migration_030_required' };
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const draft = await getAiNewsDraftByToken(client, { publicToken, userId: user.id, forUpdate: true });
    if (!draft || draft.status !== 'draft') return { persistenceEnabled: true, started: false, reason: draft ? `ai_news_draft_${draft.status}` : 'ai_news_draft_not_found' };
    await client.query(`update ai_news_drafts set status='editing', updated_at=now() where id=$1`, [draft.id]);
    await beginAiNewsInputSession(client, {
      userId: user.id,
      inputKind: 'edit_draft',
      draftId: draft.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });
    return { persistenceEnabled: true, started: true, draft: { ...draft, status: 'editing' } };
  });
}

export async function cancelAiNewsInputForTelegramUser({ telegramUserId }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const userResult = await client.query(`select id from users where telegram_user_id=$1 limit 1`, [telegramUserId]);
    const userId = userResult.rows[0]?.id;
    if (!userId) return { persistenceEnabled: true, changed: false, reason: 'user_not_found' };
    const session = await getAiNewsInputSession(client, { userId, forUpdate: true });
    if (session?.input_kind === 'edit_draft' && session.draft_id) {
      await client.query(`update ai_news_drafts set status='draft', updated_at=now() where id=$1 and status='editing'`, [session.draft_id]);
    }
    await clearAiNewsInputSession(client, { userId });
    return { persistenceEnabled: true, changed: Boolean(session) };
  });
}

export async function applyAiNewsTextInput({ telegramUserId, telegramUsername = null, text }) {
  if (!isDatabaseConfigured()) return { persistenceEnabled: false, consumed: false, reason: 'DATABASE_URL is not configured' };
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsInputSessionsTable) return { persistenceEnabled: true, consumed: false, reason: 'migration_030_required' };
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const session = await getAiNewsInputSession(client, { userId: user.id, forUpdate: true });
    if (!session) return { persistenceEnabled: true, consumed: false, reason: 'no_ai_news_input_session' };

    if (session.input_kind === 'topic_query') {
      const query = normalizeTopicQuery(text);
      const preferences = await patchAiNewsPreferences(client, {
        userId: user.id,
        patch: { presetKey: 'custom', customQuery: query }
      });
      await clearAiNewsInputSession(client, { userId: user.id });
      return { persistenceEnabled: true, consumed: true, inputKind: 'topic_query', preferences };
    }

    if (session.input_kind === 'audience_query') {
      const audience = normalizeCustomAudience(text);
      const preferences = await patchAiNewsPreferences(client, {
        userId: user.id,
        patch: { audienceKey: 'custom', customAudience: audience }
      });
      await clearAiNewsInputSession(client, { userId: user.id });
      return { persistenceEnabled: true, consumed: true, inputKind: 'audience_query', preferences };
    }

    if (session.input_kind === 'edit_draft' && session.draft_id) {
      const draftResult = await client.query(
        `select d.*, s.source_url, s.source_title, s.source_name, s.source_description, s.source_content_excerpt, s.published_at
         from ai_news_drafts d join ai_news_sources s on s.id=d.source_id
         where d.id=$1 and d.user_id=$2 limit 1 for update of d`,
        [session.draft_id, user.id]
      );
      const draft = draftResult.rows[0] || null;
      if (!draft || draft.status !== 'editing') {
        await clearAiNewsInputSession(client, { userId: user.id });
        return { persistenceEnabled: true, consumed: true, changed: false, reason: draft ? `ai_news_draft_${draft.status}` : 'ai_news_draft_not_found' };
      }
      const profile = await getProfileSnapshotByUserId(client, user.id);
      const sourceEvidence = buildSourceEvidence({
        title: draft.source_title,
        url: draft.source_url,
        sourceName: draft.source_name,
        description: draft.source_description,
        contentExcerpt: draft.source_content_excerpt,
        publishedAt: draft.published_at
      });
      const validation = validateDraftText({ postText: text, sourceEvidence, profileSnapshot: profile, sourceUrl: draft.source_url });
      if (!validation.valid) {
        return { persistenceEnabled: true, consumed: true, changed: false, reason: validation.reason, details: validation };
      }
      const updated = await updateAiNewsDraftText(client, { draftId: draft.id, postText: validation.normalized });
      await clearAiNewsInputSession(client, { userId: user.id });
      return { persistenceEnabled: true, consumed: true, changed: true, inputKind: 'edit_draft', draft: { ...draft, ...updated, status: 'draft' } };
    }

    await clearAiNewsInputSession(client, { userId: user.id });
    return { persistenceEnabled: true, consumed: false, reason: 'unsupported_ai_news_input_session' };
  });
}

export async function findAiNewsSourcesForTelegramUser({ telegramUserId, telegramUsername = null, preferenceOverride = null, presetRunId = null, ignoreCooldown = false, fetchImpl = fetch }) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return { ...persistenceUnavailable(), config, articles: [] };
  const prepared = await withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPreferencesTable || !compat.hasAiNewsSourcesTable || !compat.hasAiNewsDraftsTable) {
      return { ok: false, reason: 'migration_030_required' };
    }
    if (!compat.hasAiNewsProviderUsageEventsTable || !compat.aiNewsDraftsHasOpenAiUsage) {
      return { ok: false, reason: 'migration_032_required' };
    }
    if (config.source?.mode === 'multi_source' && !compat.aiNewsSourcesHasQualityMetadata) {
      return { ok: false, reason: 'migration_033_required' };
    }
    if (!compat.aiNewsPreferencesHasAudienceContract) return { ok: false, reason: 'migration_035_required' };
    const context = await loadUserContext(client, { telegramUserId, telegramUsername, multiSourceSchema: compat.aiNewsSourcesHasQualityMetadata });
    const preferences = normalizePreferences({ ...context.preferences, ...(preferenceOverride || {}) });
    const eligibility = checkEligibility({ config, telegramUserId, entitlements: context.entitlements, profile: context.profile });
    if (!eligibility.eligible) return { ok: false, reason: eligibility.reason, ...context, preferences };
    await acquireAiNewsUserLock(client, context.user.id);
    const searchClaim = await claimAiNewsSourceSearch(client, {
      userId: context.user.id,
      cooldownSeconds: config.searchCooldownSeconds,
      dailyLimit: config.searchDailyLimit,
      ignoreCooldown
    });
    if (!searchClaim.claimed) return { ok: false, reason: searchClaim.reason, searchClaim, ...context };
    const used = await countAiNewsDraftsSince(client, { userId: context.user.id, since: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    const profileContext = preferences.profile_affinity_enabled === false
      ? { terms: [], headline: null, industry: null, skillLabels: [], signalCount: 0, available: false }
      : buildProfileAffinityContext(context.profile);
    return {
      ok: true,
      ...context,
      preferences,
      profileContext,
      query: resolvePreferenceQuery(preferences, profileContext),
      used,
      draftGenerationAvailable: Boolean(config.generator?.enabled) && used < config.dailyLimit,
      searchUsage: {
        used: searchClaim.used,
        limit: searchClaim.limit,
        remaining: searchClaim.remaining,
        resetsAt: searchClaim.resetsAt
      },
      searchClaimStartedAt: searchClaim.preferences?.last_search_started_at || null,
      multiSourceSchema: compat.aiNewsSourcesHasQualityMetadata
    };
  });
  if (!prepared.ok) return { persistenceEnabled: true, found: false, articles: [], config, ...prepared };

  let discovery;
  try {
    discovery = await discoverNewsSources({
      config,
      query: prepared.query,
      preferences: prepared.preferences,
      profileContext: prepared.profileContext,
      fetchImpl
    });
  } catch (error) {
    const released = await withDbTransaction((client) => releaseAiNewsSourceSearchClaim(client, {
      userId: prepared.user.id,
      claimStartedAt: prepared.searchClaimStartedAt,
      dailyLimit: config.searchDailyLimit
    })).catch(() => ({ released: false }));
    return {
      persistenceEnabled: true,
      found: false,
      articles: [],
      reason: 'ai_news_all_providers_failed',
      providerSummary: [],
      searchClaimReleased: Boolean(released.released),
      searchUsage: released.released ? {
        used: released.used,
        limit: released.limit,
        remaining: released.remaining,
        resetsAt: released.resetsAt
      } : prepared.searchUsage,
      errorCode: 'source_discovery_unhandled_failure'
    };
  }
  const providerResults = discovery.providerResults || [];
  const operation = config.source?.mode === 'multi_source' ? 'discover_sources' : 'search_latest';

  if (!discovery.articles.length) {
    for (const result of providerResults) {
      await recordProviderUsageBestEffort({
        userId: prepared.user.id,
        presetRunId,
        provider: result.provider,
        operation,
        outcome: result.outcome || 'no_result',
        requestId: result.requestId,
        resultCount: 0,
        durationMs: result.durationMs,
        estimatedCostMicrousd: result.provider === 'newsdata'
          ? estimateFixedRequestCostMicrousd(config.newsdata.estimatedRequestCostUsd)
          : 0,
        errorCode: result.error?.code || null,
        detail: { rawResultCount: result.rawResultCount || 0, ...(result.detail || {}) }
      });
    }
    const allFailed = providerResults.length > 0 && providerResults.every((result) => result.outcome === 'failed');
    const newsdataOnlyFailure = config.source?.mode === 'newsdata_only' && providerResults[0]?.outcome === 'failed';
    const providerFailure = allFailed || newsdataOnlyFailure;
    const released = providerFailure
      ? await withDbTransaction((client) => releaseAiNewsSourceSearchClaim(client, {
        userId: prepared.user.id,
        claimStartedAt: prepared.searchClaimStartedAt,
        dailyLimit: config.searchDailyLimit
      })).catch(() => ({ released: false }))
      : { released: false };
    return {
      persistenceEnabled: true,
      found: false,
      articles: [],
      reason: newsdataOnlyFailure ? 'newsdata_request_failed' : allFailed ? 'ai_news_all_providers_failed' : 'ai_news_no_fresh_sources',
      providerSummary: providerResults.map(({ provider, outcome, error, detail }) => ({
        provider,
        outcome,
        errorCode: error?.code || null,
        noResultReason: detail?.noResultReason || null
      })),
      searchClaimReleased: Boolean(released.released),
      searchUsage: released.released ? {
        used: released.used,
        limit: released.limit,
        remaining: released.remaining,
        resetsAt: released.resetsAt
      } : prepared.searchUsage
    };
  }

  const expiresAt = new Date(Date.now() + config.sourceSelectionTtlSeconds * 1000);
  const stored = await withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const rows = [];
    for (const article of discovery.articles) {
      const evidence = buildSourceEvidence(article);
      rows.push(await upsertAiNewsSource(client, {
        publicToken: crypto.randomUUID(),
        userId: user.id,
        provider: article.provider,
        providerArticleId: article.providerArticleId,
        sourceUrl: article.url,
        sourceUrlHash: sha256(article.dedupeKey || article.url),
        sourceTitle: article.title,
        sourceName: article.sourceName,
        sourceDomain: article.sourceDomain,
        sourceDescription: article.description,
        sourceContentExcerpt: article.contentExcerpt,
        sourceLanguage: article.language,
        sourceCountry: article.country,
        sourceCategories: article.categories,
        publishedAt: article.publishedAt,
        querySnapshot: prepared.query,
        evidenceHash: sha256(evidence),
        expiresAt,
        sourceKind: article.sourceKind,
        sourceAuthorityScore: article.authorityScore,
        sourceIsPrimary: article.isPrimary,
        trendScore: article.trendScore,
        sourceMetadata: article.metadata,
        multiSourceSchema: prepared.multiSourceSchema
      }));
    }
    return rows;
  });

  const firstSourceByProvider = new Map();
  for (const row of stored) {
    if (!firstSourceByProvider.has(row.provider)) firstSourceByProvider.set(row.provider, row.id);
  }
  for (const result of providerResults) {
    const storedResultCount = stored.filter((row) => row.provider === result.provider).length;
    await recordProviderUsageBestEffort({
      userId: prepared.user.id,
      sourceId: firstSourceByProvider.get(result.provider) || null,
      presetRunId,
      provider: result.provider,
      operation,
      outcome: result.outcome || (result.articles?.length ? 'success' : 'no_result'),
      requestId: result.requestId,
      resultCount: storedResultCount,
      durationMs: result.durationMs,
      estimatedCostMicrousd: result.provider === 'newsdata'
        ? estimateFixedRequestCostMicrousd(config.newsdata.estimatedRequestCostUsd)
        : 0,
      errorCode: result.error?.code || null,
      detail: {
        rawResultCount: result.rawResultCount || 0,
        providerResultCount: result.articles?.length || 0,
        storedResultCount,
        newsdataFallbackUsed: discovery.newsdataFallbackUsed,
        ...(result.detail || {})
      }
    });
  }
  return {
    persistenceEnabled: true,
    found: true,
    articles: stored,
    query: prepared.query,
    preferences: prepared.preferences,
    personalization: prepared.profileContext,
    audienceKey: prepared.preferences.audience_key,
    angleKey: prepared.preferences.angle_key,
    sourceMode: config.source?.mode || 'newsdata_only',
    providerSummary: providerResults.map(({ provider, outcome, error, articles, detail }) => ({
      provider,
      outcome,
      resultCount: articles?.length || 0,
      errorCode: error?.code || null,
      noResultReason: detail?.noResultReason || null,
      relevanceRejectedCount: Number(detail?.relevance?.rejectedCount || 0)
    })),
    newsdataFallbackUsed: discovery.newsdataFallbackUsed,
    generatorMode: config.generator?.mode || 'openai',
    draftGenerationAvailable: prepared.draftGenerationAvailable,
    dailyUsage: {
      used: prepared.used,
      limit: config.dailyLimit,
      remaining: Math.max(0, config.dailyLimit - prepared.used)
    },
    searchUsage: prepared.searchUsage,
    searchCooldown: {
      active: config.searchCooldownSeconds > 0,
      retryAfterSeconds: Math.max(0, Number(config.searchCooldownSeconds) || 0),
      readyAt: config.searchCooldownSeconds > 0
        ? new Date(new Date(prepared.searchClaimStartedAt || Date.now()).getTime() + config.searchCooldownSeconds * 1000)
        : null
    }
  };
}

export async function generateAiNewsDraftForTelegramUser({ telegramUserId, telegramUsername = null, sourceToken, preferenceOverride = null, presetId = null, presetRunId = null, deliveryKind = 'manual', fetchImpl = fetch }) {
  const config = getAiNewsDraftConfig();
  if (!config.generator?.enabled) {
    return { persistenceEnabled: isDatabaseConfigured(), generated: false, reason: 'ai_news_generator_disabled' };
  }
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  const prepared = await withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsDraftsTable || !compat.hasAiNewsSourcesTable) return { ok: false, reason: 'migration_030_required' };
    if (!compat.hasAiNewsProviderUsageEventsTable || !compat.aiNewsDraftsHasOpenAiUsage) return { ok: false, reason: 'migration_032_required' };
    if (['groq', 'template'].includes(config.generator?.mode)
      && (!compat.aiNewsDraftsHasGeneratorProviders || !compat.aiNewsTelemetryHasGeneratorProviders)) {
      return { ok: false, reason: 'migration_034_required' };
    }
    if (!compat.aiNewsPreferencesHasAudienceContract) return { ok: false, reason: 'migration_035_required' };
    const context = await loadUserContext(client, { telegramUserId, telegramUsername, multiSourceSchema: compat.aiNewsSourcesHasQualityMetadata });
    const preferences = normalizePreferences({ ...context.preferences, ...(preferenceOverride || {}) });
    const eligibility = checkEligibility({ config, telegramUserId, entitlements: context.entitlements, profile: context.profile });
    if (!eligibility.eligible) return { ok: false, reason: eligibility.reason };
    await acquireAiNewsUserLock(client, context.user.id);
    const blocking = await getBlockingAiNewsDraft(client, context.user.id, { forUpdate: true });
    if (blocking) return { ok: false, reason: `ai_news_draft_${blocking.status}`, blocking };
    const used = await countAiNewsDraftsSince(client, { userId: context.user.id, since: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    if (used >= config.dailyLimit) return { ok: false, reason: 'ai_news_daily_limit_reached' };
    const source = await getAiNewsSourceByToken(client, { publicToken: sourceToken, userId: context.user.id, forUpdate: true });
    if (!source) return { ok: false, reason: 'ai_news_source_not_found' };
    if (new Date(source.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'ai_news_source_expired' };
    const existingForSource = await getAiNewsDraftByUserAndSource(client, { userId: context.user.id, sourceId: source.id });
    if (existingForSource) return { ok: false, reason: 'ai_news_source_already_used', existingDraft: existingForSource };
    const sourceEvidence = buildSourceEvidence(source);
    const generationInputHash = sha256(JSON.stringify({
      sourceEvidence,
      profile: {
        displayName: context.profile.display_name,
        headline: context.profile.headline_user,
        company: context.profile.company_user,
        industry: context.profile.industry_user,
        about: context.profile.about_user,
        skills: context.profile.skills
      },
      postLanguage: preferences.post_language,
      tone: preferences.tone,
      audienceKey: preferences.audience_key,
      customAudience: preferences.custom_audience,
      angleKey: preferences.angle_key,
      profileAffinityEnabled: preferences.profile_affinity_enabled !== false,
      generator: generatorContract(config)
    }));
    const draft = await createGeneratingAiNewsDraft(client, {
      publicToken: crypto.randomUUID(),
      userId: context.user.id,
      profileId: context.profile.profile_id,
      sourceId: source.id,
      postLanguage: preferences.post_language,
      tone: preferences.tone,
      generationInputHash,
      sourceEvidenceHash: source.evidence_hash,
      expiresAt: new Date(Date.now() + config.draftTtlSeconds * 1000),
      presetId,
      presetRunId,
      deliveryKind
    });
    return { ok: true, ...context, preferences, source, sourceEvidence, draft };
  });
  if (!prepared.ok) return { persistenceEnabled: true, generated: false, ...prepared };

  const generator = generatorContract(config);
  let generationResult;
  try {
    generationResult = await generateNewsDraft({
      config,
      source: prepared.source,
      sourceEvidence: prepared.sourceEvidence,
      profile: prepared.profile,
      postLanguage: prepared.preferences.post_language,
      tone: prepared.preferences.tone,
      audienceKey: prepared.preferences.audience_key,
      customAudience: prepared.preferences.custom_audience,
      angleKey: prepared.preferences.angle_key,
      fetchImpl
    });
  } catch (error) {
    const providerError = isProviderDraftError(error);
    const provider = generator.provider || config.generator?.mode || 'generator';
    const errorCode = safeGenerationErrorCode(provider, error);
    await withDbTransaction(async (client) => finalizeAiNewsDraftFailed(client, {
      draftId: prepared.draft.id,
      errorCode
    })).catch(() => null);
    await recordProviderUsageBestEffort({
      userId: prepared.user.id,
      sourceId: prepared.source.id,
      draftId: prepared.draft.id,
      presetRunId,
      provider,
      operation: 'generate_draft',
      outcome: 'failed',
      requestId: providerError ? error.requestId : null,
      modelName: generator.model,
      durationMs: Number.isFinite(Number(error?.durationMs)) ? Number(error.durationMs) : null,
      errorCode
    });
    return {
      persistenceEnabled: true,
      generated: false,
      reason: providerError ? `${provider}_generation_failed` : `${provider}_internal_error`,
      error: {
        status: providerError ? error.status : null,
        code: providerError ? error.code : null,
        requestId: providerError ? error.requestId : null,
        retryable: providerError ? error.retryable : false
      }
    };
  }

  const provider = generationResult.provider;
  const generated = generationResult.generated;
  const providerConfig = provider === 'groq'
    ? config.groq
    : provider === 'openai'
      ? config.openai
      : { inputCostUsdPerMillion: 0, outputCostUsdPerMillion: 0 };
  const estimatedCostMicrousd = estimateTokenCostMicrousd({
    inputTokens: generated.usage?.inputTokens,
    outputTokens: generated.usage?.outputTokens,
    inputUsdPerMillion: providerConfig.inputCostUsdPerMillion,
    outputUsdPerMillion: providerConfig.outputCostUsdPerMillion
  });
  const finalized = await withDbTransaction(async (client) => {
    const row = await finalizeAiNewsDraftGenerated(client, {
      draftId: prepared.draft.id,
      postText: generated.postText,
      evidenceClaims: generated.evidenceClaims,
      modelProvider: provider,
      modelName: generated.model,
      providerResponseId: generated.providerResponseId,
      providerRequestId: generated.providerRequestId,
      inputTokens: generated.usage?.inputTokens ?? null,
      outputTokens: generated.usage?.outputTokens ?? null,
      totalTokens: generated.usage?.totalTokens ?? null,
      estimatedCostMicrousd
    });
    await createAdminAuditEvent(client, {
      eventType: 'ai_news_draft_generated',
      actorUserId: prepared.user.id,
      targetUserId: prepared.user.id,
      summary: 'Member generated an evidence-bound news draft.',
      detail: {
        draftId: prepared.draft.id,
        sourceId: prepared.source.id,
        sourceDomain: prepared.source.source_domain,
        generatorProvider: provider,
        model: generated.model,
        providerRequestId: generated.providerRequestId,
        postLanguage: prepared.preferences.post_language,
        tone: prepared.preferences.tone,
        audienceKey: prepared.preferences.audience_key,
        angleKey: prepared.preferences.angle_key,
        profileAffinityEnabled: prepared.preferences.profile_affinity_enabled !== false,
        inputTokens: generated.usage?.inputTokens ?? null,
        outputTokens: generated.usage?.outputTokens ?? null,
        estimatedCostMicrousd
      }
    });
    return row;
  });
  await recordProviderUsageBestEffort({
    userId: prepared.user.id,
    sourceId: prepared.source.id,
    draftId: prepared.draft.id,
    presetRunId,
    provider,
    operation: 'generate_draft',
    outcome: 'success',
    requestId: generated.providerRequestId,
    modelName: generated.model,
    inputTokens: generated.usage?.inputTokens ?? null,
    outputTokens: generated.usage?.outputTokens ?? null,
    totalTokens: generated.usage?.totalTokens ?? null,
    durationMs: generated.durationMs,
    estimatedCostMicrousd
  });
  return {
    persistenceEnabled: true,
    generated: true,
    generatorProvider: provider,
    draft: { ...prepared.draft, ...finalized, ...prepared.source },
    source: prepared.source
  };
}

export async function loadAiNewsDraftForTelegramUser({ telegramUserId, telegramUsername = null, publicToken = null }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const draft = publicToken
      ? await getAiNewsDraftByToken(client, { publicToken, userId: user.id })
      : await getLatestAiNewsDraftForUser(client, user.id);
    return { persistenceEnabled: true, draft, reason: draft ? 'ai_news_draft_loaded' : 'ai_news_draft_not_found' };
  });
}

export async function cancelAiNewsDraftForTelegramUser({ telegramUserId, telegramUsername = null, publicToken }) {
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const draft = await getAiNewsDraftByToken(client, { publicToken, userId: user.id, forUpdate: true });
    if (!draft) return { persistenceEnabled: true, changed: false, reason: 'ai_news_draft_not_found' };
    const changed = await cancelAiNewsDraft(client, { draftId: draft.id });
    return { persistenceEnabled: true, changed: Boolean(changed), draft: changed || draft, reason: changed ? 'ai_news_draft_cancelled' : `ai_news_draft_${draft.status}` };
  });
}

export async function approveAiNewsDraftForLinkedIn({ telegramUserId, telegramUsername = null, publicToken }) {
  const config = getAiNewsDraftConfig();
  const shareConfig = getLinkedInShareConfig();
  if (!shareConfig.enabled || shareConfig.configurationValid === false) {
    return { persistenceEnabled: true, approved: false, reason: 'linkedin_share_unavailable' };
  }
  if (!isDatabaseConfigured()) return persistenceUnavailable();

  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsDraftsTable || !compat.linkedInShareHasSourceKind) {
      return { persistenceEnabled: true, approved: false, reason: 'migration_030_required' };
    }
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    // Deterministic lock order: AI draft user lock, then the canonical LinkedIn share user lock.
    // Validation, source-bound share intent creation, and draft attachment commit atomically.
    await acquireAiNewsUserLock(client, user.id);
    const draft = await getAiNewsDraftByToken(client, { publicToken, userId: user.id, forUpdate: true });
    if (!draft) return { persistenceEnabled: true, approved: false, reason: 'ai_news_draft_not_found' };
    if (draft.status === 'share_ready' && draft.share_intent_id) {
      return { persistenceEnabled: true, approved: false, reason: 'ai_news_draft_share_ready', draft };
    }
    if (draft.status !== 'draft') return { persistenceEnabled: true, approved: false, reason: `ai_news_draft_${draft.status}`, draft };
    if (new Date(draft.expires_at).getTime() <= Date.now()) return { persistenceEnabled: true, approved: false, reason: 'ai_news_draft_expired', draft };

    const profile = await getProfileSnapshotByUserId(client, user.id);
    const sourceEvidence = buildSourceEvidence(draft);
    const validation = validateDraftText({ postText: draft.post_text, sourceEvidence, profileSnapshot: profile, sourceUrl: draft.source_url });
    if (!validation.valid) return { persistenceEnabled: true, approved: false, reason: validation.reason, draft };

    const share = await createLinkedInTextShareIntentWithClient(client, {
      telegramUserId,
      telegramUsername,
      postText: validation.normalized,
      visibility: shareConfig.visibility,
      ttlSeconds: shareConfig.intentTtlSeconds,
      sourceKind: 'ai_news_draft',
      sourceRefId: draft.id,
      sourceSnapshotHash: sha256(`${draft.source_evidence_hash}:${sha256(validation.normalized)}`)
    });
    if (!share.created) return { persistenceEnabled: true, approved: false, reason: share.reason, draft, intent: share.intent || null };

    const attached = await attachAiNewsDraftShareIntent(client, { draftId: draft.id, shareIntentId: share.intent.id });
    if (!attached) throw new Error('ai_news_share_attachment_failed');
    return {
      persistenceEnabled: true,
      approved: true,
      reason: 'ai_news_share_ready',
      draft: { ...draft, ...attached },
      shareIntent: share.intent,
      config
    };
  });
}

export { AI_NEWS_PRESETS };
