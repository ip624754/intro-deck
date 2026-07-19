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
  claimAiNewsSourceSearch,
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
import { generateOpenAiNewsDraft, OpenAiDraftError } from '../ai/openaiNewsDraft.js';
import { estimateFixedRequestCostMicrousd, estimateOpenAiCostMicrousd } from '../ai/newsCost.js';
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
import { fetchNewsDataLatest, NewsDataApiError } from '../news/newsdata.js';
import { createLinkedInTextShareIntentWithClient } from './linkedinShareStore.js';



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

function safeGenerationErrorCode(error) {
  if (error instanceof OpenAiDraftError) {
    const code = String(error.code || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').slice(0, 100);
    if (code) return `openai_${code}`;
    if (Number.isFinite(Number(error.status))) return `openai_http_${Number(error.status)}`;
    const message = String(error.message || '').trim();
    if (/^openai_[a-z0-9_.-]+$/i.test(message)) return message.toLowerCase();
    return 'openai_provider_error';
  }
  return 'openai_internal_error';
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
    preset_key: 'ai_technology',
    custom_query: null,
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

async function loadUserContext(client, { telegramUserId, telegramUsername = null }) {
  const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
  // One checked-out pg client must execute queries sequentially. Parallel client.query()
  // calls are deprecated in pg and can interleave transaction state.
  const profile = await getProfileSnapshotByUserId(client, user.id);
  const entitlements = await getUserEntitlements(client, { userId: user.id });
  const preferences = await getAiNewsPreferences(client, user.id);
  const latestDraft = await getLatestAiNewsDraftForUser(client, user.id);
  const recentSources = await listRecentAiNewsSources(client, { userId: user.id, limit: 5 });
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
    const context = await loadUserContext(client, { telegramUserId, telegramUsername });
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
      presets,
      presetPersistenceReady: Boolean(compat.hasAiNewsPresetsTable && compat.hasAiNewsPresetRunsTable && compat.aiNewsDraftsHasPresetRunId),
      presetUsage: { used: presets.length, limit: config.presetLimit, remaining: Math.max(0, config.presetLimit - presets.length) },
      dailyUsage: { used, limit: config.dailyLimit, remaining: Math.max(0, config.dailyLimit - used) }
    };
  });
}

export async function updateAiNewsPresetForTelegramUser({ telegramUserId, telegramUsername = null, presetKey }) {
  const normalized = normalizePresetKey(presetKey);
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  return withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsPreferencesTable) return { persistenceEnabled: true, changed: false, reason: 'migration_030_required' };
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const preferences = await patchAiNewsPreferences(client, {
      userId: user.id,
      patch: { presetKey: normalized, customQuery: normalized === 'custom' ? null : undefined }
    });
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
    const context = await loadUserContext(client, { telegramUserId, telegramUsername });
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
    if (used >= config.dailyLimit) return { ok: false, reason: 'ai_news_daily_limit_reached', ...context, used };
    return { ok: true, ...context, preferences, query: resolvePreferenceQuery(preferences), used };
  });
  if (!prepared.ok) return { persistenceEnabled: true, found: false, articles: [], config, ...prepared };

  let provider;
  try {
    provider = await fetchNewsDataLatest({
      apiKey: config.newsdata.apiKey,
      baseUrl: config.newsdata.baseUrl,
      query: prepared.query,
      language: prepared.preferences.source_language,
      country: prepared.preferences.source_country,
      category: prepared.preferences.source_category,
      timeoutMs: config.newsdata.timeoutMs,
      maxSourceAgeHours: config.maxSourceAgeHours,
      maxArticles: config.maxArticles,
      fetchImpl
    });
  } catch (error) {
    const providerError = error instanceof NewsDataApiError;
    await recordProviderUsageBestEffort({
      userId: prepared.user.id,
      presetRunId,
      provider: 'newsdata',
      operation: 'search_latest',
      outcome: 'failed',
      requestId: providerError ? error.requestId : null,
      durationMs: providerError ? error.durationMs : null,
      estimatedCostMicrousd: estimateFixedRequestCostMicrousd(config.newsdata.estimatedRequestCostUsd),
      errorCode: providerError ? (error.code || `http_${error.status || 'unknown'}`) : 'newsdata_internal_error'
    });
    return {
      persistenceEnabled: true,
      found: false,
      articles: [],
      reason: providerError ? 'newsdata_request_failed' : 'newsdata_internal_error',
      error: { status: providerError ? error.status : null, code: providerError ? error.code : null, requestId: providerError ? error.requestId : null }
    };
  }

  if (!provider.articles.length) {
    await recordProviderUsageBestEffort({
      userId: prepared.user.id,
      presetRunId,
      provider: 'newsdata',
      operation: 'search_latest',
      outcome: 'no_result',
      requestId: provider.requestId,
      resultCount: 0,
      durationMs: provider.durationMs,
      estimatedCostMicrousd: estimateFixedRequestCostMicrousd(config.newsdata.estimatedRequestCostUsd)
    });
    return { persistenceEnabled: true, found: false, articles: [], reason: 'ai_news_no_fresh_sources' };
  }
  const expiresAt = new Date(Date.now() + config.sourceSelectionTtlSeconds * 1000);
  const stored = await withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, { telegramUserId, telegramUsername });
    const rows = [];
    for (const article of provider.articles) {
      const evidence = buildSourceEvidence(article);
      rows.push(await upsertAiNewsSource(client, {
        publicToken: crypto.randomUUID(),
        userId: user.id,
        providerArticleId: article.providerArticleId,
        sourceUrl: article.url,
        sourceUrlHash: sha256(article.url),
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
        expiresAt
      }));
    }
    return rows;
  });
  await recordProviderUsageBestEffort({
    userId: prepared.user.id,
    sourceId: stored[0]?.id || null,
    presetRunId,
    provider: 'newsdata',
    operation: 'search_latest',
    outcome: 'success',
    requestId: provider.requestId,
    resultCount: stored.length,
    durationMs: provider.durationMs,
    estimatedCostMicrousd: estimateFixedRequestCostMicrousd(config.newsdata.estimatedRequestCostUsd),
    detail: { rawResultCount: provider.rawResultCount, storedResultCount: stored.length }
  });
  return { persistenceEnabled: true, found: true, articles: stored, query: prepared.query, preferences: prepared.preferences };
}

export async function generateAiNewsDraftForTelegramUser({ telegramUserId, telegramUsername = null, sourceToken, preferenceOverride = null, presetId = null, presetRunId = null, deliveryKind = 'manual', fetchImpl = fetch }) {
  const config = getAiNewsDraftConfig();
  if (!isDatabaseConfigured()) return persistenceUnavailable();
  const prepared = await withDbTransaction(async (client) => {
    const compat = await getSchemaCompat(client);
    if (!compat.hasAiNewsDraftsTable || !compat.hasAiNewsSourcesTable) return { ok: false, reason: 'migration_030_required' };
    if (!compat.hasAiNewsProviderUsageEventsTable || !compat.aiNewsDraftsHasOpenAiUsage) return { ok: false, reason: 'migration_032_required' };
    const context = await loadUserContext(client, { telegramUserId, telegramUsername });
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
      model: config.openai.model
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

  let generated;
  try {
    generated = await generateOpenAiNewsDraft({
      apiKey: config.openai.apiKey,
      baseUrl: config.openai.baseUrl,
      model: config.openai.model,
      timeoutMs: config.openai.timeoutMs,
      source: prepared.source,
      sourceEvidence: prepared.sourceEvidence,
      profile: prepared.profile,
      postLanguage: prepared.preferences.post_language,
      tone: prepared.preferences.tone,
      fetchImpl
    });
  } catch (error) {
    const providerError = error instanceof OpenAiDraftError;
    const errorCode = safeGenerationErrorCode(error);
    await withDbTransaction(async (client) => finalizeAiNewsDraftFailed(client, {
      draftId: prepared.draft.id,
      errorCode
    })).catch(() => null);
    await recordProviderUsageBestEffort({
      userId: prepared.user.id,
      sourceId: prepared.source.id,
      draftId: prepared.draft.id,
      presetRunId,
      provider: 'openai',
      operation: 'generate_draft',
      outcome: 'failed',
      requestId: providerError ? error.requestId : null,
      modelName: config.openai.model,
      durationMs: providerError ? error.durationMs : null,
      errorCode
    });
    return {
      persistenceEnabled: true,
      generated: false,
      reason: providerError ? 'openai_generation_failed' : 'openai_internal_error',
      error: {
        status: providerError ? error.status : null,
        code: providerError ? error.code : null,
        requestId: providerError ? error.requestId : null,
        retryable: providerError ? error.retryable : false
      }
    };
  }

  const estimatedCostMicrousd = estimateOpenAiCostMicrousd({
    inputTokens: generated.usage?.inputTokens,
    outputTokens: generated.usage?.outputTokens,
    inputUsdPerMillion: config.openai.inputCostUsdPerMillion,
    outputUsdPerMillion: config.openai.outputCostUsdPerMillion
  });
  const finalized = await withDbTransaction(async (client) => {
    const row = await finalizeAiNewsDraftGenerated(client, {
      draftId: prepared.draft.id,
      postText: generated.postText,
      evidenceClaims: generated.evidenceClaims,
      modelProvider: 'openai',
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
      summary: 'Member generated an evidence-bound AI news draft.',
      detail: {
        draftId: prepared.draft.id,
        sourceId: prepared.source.id,
        sourceDomain: prepared.source.source_domain,
        model: generated.model,
        providerRequestId: generated.providerRequestId,
        postLanguage: prepared.preferences.post_language,
        tone: prepared.preferences.tone,
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
    provider: 'openai',
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
  return { persistenceEnabled: true, generated: true, draft: { ...prepared.draft, ...finalized, ...prepared.source }, source: prepared.source };
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
