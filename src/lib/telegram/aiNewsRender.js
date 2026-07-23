import { AI_NEWS_PRESETS, AI_NEWS_TONES } from '../ai/newsDraftContract.js';
import {
  AI_NEWS_AUDIENCES,
  AI_NEWS_ANGLES,
  audienceLabel,
  angleLabel,
  normalizeAudienceKey,
  normalizeAngleKey
} from '../ai/newsDiscoveryContract.js';
import { AI_NEWS_DELIVERY_HOURS_UTC, scheduleLabel } from '../ai/newsPresetSchedule.js';

function value(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function parseSourceMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function isoTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function searchAvailable(usage) {
  return !usage || Number(usage.remaining) > 0;
}


function reasonText(reason) {
  const map = {
    ai_news_disabled: 'AI/news drafts are disabled in this environment.',
    ai_news_draft_config_invalid: 'AI/news draft configuration is invalid.',
    operator_only: 'This foundation is currently limited to Intro Deck operators.',
    pro_required: 'AI/news drafts require Pro.',
    ai_news_operator_acceptance_in_progress: 'AI/news rollout is currently limited to operator acceptance testing.',
    linkedin_not_connected: 'Connect LinkedIn first.',
    profile_not_listed: 'Complete and publish your profile first.',
    migration_030_required: 'Migration 030 has not been applied yet.',
    ai_news_daily_limit_reached: 'Your rolling 24-hour draft allowance is used.',
    ai_news_search_daily_limit_reached: 'Your rolling 24-hour news-search allowance is used.',
    ai_news_search_cooldown: 'A search is already running or the short search cooldown is still active.',
    ai_news_source_already_used: 'A draft already exists for this source. Choose another article.',
    ai_news_no_fresh_sources: 'No fresh matching sources were found.',
    ai_news_source_expired: 'This source selection expired. Search again.',
    ai_news_source_not_found: 'This source is no longer available.',
    ai_news_generator_disabled: 'Draft generation is off. You can still browse and open configured sources.',
    openai_generation_failed: 'OpenAI could not produce a valid evidence-bound draft. Try another source later.',
    openai_internal_error: 'OpenAI draft generation is temporarily unavailable.',
    groq_generation_failed: 'Groq could not produce a valid evidence-bound draft. Try another source later.',
    groq_internal_error: 'Groq draft generation is temporarily unavailable.',
    template_generation_failed: 'The deterministic template could not produce a valid draft from this source.',
    template_internal_error: 'Template draft generation is temporarily unavailable.',
    newsdata_request_failed: 'The news provider request failed. Try again later.',
    linkedin_share_unavailable: 'LinkedIn publishing is not available right now.',
    migration_031_required: 'Migration 031 has not been applied yet.',
    migration_032_required: 'Migration 032 has not been applied yet.',
    migration_033_required: 'Migration 033 has not been applied yet. Multi-source discovery remains unavailable.',
    migration_034_required: 'Migration 034 has not been applied yet. Groq/template draft generation remains fail-closed.',
    migration_035_required: 'Migration 035 has not been applied yet. Audience-aware discovery and personalized presets remain fail-closed.',
    ai_news_all_providers_failed: 'All enabled source providers failed. Your allowance is restored when the claim can be safely released.',
    ai_news_search_internal_error: 'The source search ended unexpectedly. Try again later.',
    ai_news_preset_limit_reached: 'Your saved-preset limit is used.',
    ai_news_preset_duplicate: 'This preset is already saved.',
    ai_news_preferences_not_found: 'Choose topic, audience, angle, language, and tone before saving a preset.',
    ai_news_preset_not_found: 'This saved preset is no longer available.',
    ai_news_schedule_disabled: 'Scheduled delivery is disabled in this environment.',
    ai_news_preset_paused: 'This preset is paused.',
    ai_news_preset_deleted: 'This preset was deleted.',
    ai_news_preset_run_not_found: 'This preset run is no longer available.'
  };
  return map[reason] || `Unavailable: ${reason || 'unknown_reason'}`;
}

export function renderAiNewsHubText({ state, notice = null }) {
  const preferences = state?.preferences || {};
  const preset = AI_NEWS_PRESETS[preferences.preset_key] || AI_NEWS_PRESETS.for_you;
  const tone = AI_NEWS_TONES[preferences.tone] || AI_NEWS_TONES.professional;
  const generatorMode = state?.config?.generator?.mode || 'openai';
  const browseOnly = generatorMode === 'off';
  const personalization = state?.personalization || {};
  const lines = [
    browseOnly ? '🗞 LinkedIn source browser' : '🧠 LinkedIn news drafts',
    '',
    browseOnly
      ? 'Find professionally relevant stories for your network. Nothing is generated or published automatically.'
      : 'Create an evidence-bound LinkedIn draft for a selected professional audience. Nothing is published automatically.',
    '',
    `Topic: ${preset.label}${preferences.preset_key === 'custom' ? ` · ${value(preferences.custom_query)}` : ''}`,
    `Audience: ${audienceLabel(preferences)}`,
    `Angle: ${angleLabel(preferences)}`,
    `Profile match: ${preferences.profile_affinity_enabled === false ? 'off' : personalization.available ? `${personalization.signalCount || 0} public profile signals` : 'on · no public signals yet'}`,
    `Post language: ${String(preferences.post_language || 'en').toUpperCase()}`,
    `Tone: ${tone}`,
    browseOnly
      ? 'Draft allowance: not used in browse-only mode'
      : `Draft allowance: ${state?.dailyUsage?.remaining ?? 0}/${state?.dailyUsage?.limit ?? state?.config?.dailyLimit ?? 0} remaining in 24h`,
    `Search allowance: ${state?.searchUsage?.remaining ?? state?.config?.searchDailyLimit ?? 0}/${state?.searchUsage?.limit ?? state?.config?.searchDailyLimit ?? 0} remaining in 24h`,
    state?.searchUsage?.remaining === 0 && isoTime(state?.searchUsage?.resetsAt)
      ? `Search resets at: ${isoTime(state.searchUsage.resetsAt)}`
      : null,
    `Saved presets: ${state?.presetUsage?.used ?? state?.presets?.length ?? 0}/${state?.presetUsage?.limit ?? state?.config?.presetLimit ?? 0}`,
    `Generator: ${generatorMode}`,
    `Scheduled delivery: ${state?.config?.schedule?.enabled ? 'drafts only · no auto-posting' : 'off'}`,
    `Rollout stage: ${state?.config?.rolloutStage || 'operator_acceptance'}`,
    `Source mode: ${state?.config?.source?.mode || 'newsdata_only'}`,
    '',
    browseOnly
      ? 'Flow: professional context → source → evidence → open original.'
      : 'Flow: professional context → source → evidence → draft → preview/edit → explicit LinkedIn approval.'
  ];
  const cleanedLines = lines.filter((line) => line !== null);
  if (!state?.eligible) cleanedLines.push('', `⚠️ ${reasonText(state?.reason)}`);
  if (state?.latestDraft && (!browseOnly || ['draft', 'editing', 'share_ready', 'unknown'].includes(state.latestDraft.status))) {
    cleanedLines.push('', `Latest draft: ${state.latestDraft.status}`);
  }
  if (browseOnly && state?.searchUsage?.remaining === 0) {
    cleanedLines.push('', '⚠️ News search is paused until the rolling allowance resets.');
  }
  if (notice) cleanedLines.push('', notice);
  return cleanedLines.join('\n');
}

export function renderAiNewsHubKeyboard({ state }) {
  const p = state?.preferences || {};
  const rows = [
    [{ text: `${p.preset_key === 'for_you' ? '✓ ' : ''}✨ For you`, callback_data: 'news:preset:for_you' }],
    [
      { text: `${p.preset_key === 'ai_technology' ? '✓ ' : ''}🤖 AI & Tech`, callback_data: 'news:preset:ai_technology' },
      { text: `${p.preset_key === 'startups_product' ? '✓ ' : ''}🚀 Startups`, callback_data: 'news:preset:startups_product' }
    ],
    [
      { text: `${p.preset_key === 'business_markets' ? '✓ ' : ''}📈 Business`, callback_data: 'news:preset:business_markets' },
      { text: `${p.preset_key === 'career_leadership' ? '✓ ' : ''}🧭 Career`, callback_data: 'news:preset:career_leadership' }
    ],
    [
      { text: `${p.preset_key === 'crypto_web3' ? '✓ ' : ''}⛓ Crypto`, callback_data: 'news:preset:crypto_web3' },
      { text: `${p.preset_key === 'custom' ? '✓ ' : ''}✍️ Custom`, callback_data: 'news:topic' }
    ],
    [
      { text: `👥 ${audienceLabel(p).slice(0, 28)}`, callback_data: 'news:audience' },
      { text: `🎯 ${angleLabel(p).slice(0, 28)}`, callback_data: 'news:angle' }
    ],
    [
      { text: `Language: ${String(p.post_language || 'en').toUpperCase()}`, callback_data: `news:lang:${p.post_language === 'ru' ? 'en' : 'ru'}` },
      { text: `Tone: ${AI_NEWS_TONES[p.tone] || 'Professional'}`, callback_data: `news:tone:${p.tone === 'professional' ? 'analytical' : p.tone === 'analytical' ? 'concise' : 'professional'}` }
    ]
  ];
  if (state?.eligible && searchAvailable(state?.searchUsage)) {
    rows.push([{ text: '🔎 Find relevant stories', callback_data: 'news:find' }]);
  }
  if (state?.latestDraft && ['draft', 'editing', 'share_ready', 'unknown'].includes(state.latestDraft.status)) {
    rows.push([{ text: '📝 Open current draft', callback_data: `news:draft:${state.latestDraft.public_token}` }]);
  }
  if (state?.presetPersistenceReady) {
    rows.push([
      { text: `⚙️ Saved presets (${state?.presets?.length || 0})`, callback_data: 'news:presets' },
      { text: '➕ Save current', callback_data: 'news:psave' }
    ]);
  }
  if (!state?.eligible && state?.reason === 'pro_required') {
    rows.push([{ text: '⭐ Get Pro', callback_data: 'plans:root' }]);
  }
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return { inline_keyboard: rows };
}

export function renderAiNewsSearchProgressText({ state = {} }) {
  const preferences = state?.preferences || {};
  const preset = AI_NEWS_PRESETS[preferences.preset_key] || AI_NEWS_PRESETS.for_you;
  const providers = Array.isArray(state?.config?.source?.enabledProviders)
    ? state.config.source.enabledProviders
    : ['configured providers'];
  return [
    '🔎 Finding relevant stories…',
    '',
    `Topic: ${preset.label}${preferences.preset_key === 'custom' ? ` · ${value(preferences.custom_query)}` : ''}`,
    `Audience: ${audienceLabel(preferences)}`,
    `Angle: ${angleLabel(preferences)}`,
    '',
    'Checking configured source providers:',
    ...providers.map((provider) => `• ${sourceProviderLabel(provider)}`),
    '',
    'Search status: searching',
    'This message will stay visible and update with results or a clear failure state.'
  ].join('\n');
}

export function renderAiNewsSearchProgressKeyboard() {
  return {
    inline_keyboard: [[{ text: '⏳ Search in progress', callback_data: 'news:searching' }]]
  };
}

export function renderAiNewsSearchFailureText({ result = {} }) {
  const usage = result?.searchUsage || {};
  const noClaimReasons = new Set([
    'ai_news_disabled',
    'ai_news_draft_config_invalid',
    'operator_only',
    'pro_required',
    'ai_news_operator_acceptance_in_progress',
    'linkedin_not_connected',
    'profile_not_listed',
    'migration_030_required',
    'migration_032_required',
    'migration_033_required',
    'migration_035_required',
    'ai_news_search_daily_limit_reached',
    'ai_news_search_cooldown'
  ]);
  const allowanceLine = result?.searchClaimReleased
    ? 'Search allowance: restored because the configured providers failed.'
    : noClaimReasons.has(result?.reason)
      ? 'Search allowance: no new search claim was consumed.'
      : 'Search allowance: this completed search attempt counts toward the rolling limit.';
  const lines = [
    '⚠️ Search could not be completed',
    '',
    aiNewsReasonText(result?.reason),
    '',
    allowanceLine,
    Number.isFinite(Number(usage.remaining)) && Number.isFinite(Number(usage.limit))
      ? `Remaining searches: ${Number(usage.remaining)}/${Number(usage.limit)}`
      : null,
    result?.errorCode ? `Diagnostic code: ${value(result.errorCode)}` : null,
    '',
    'The failure remains visible. No draft or LinkedIn publication was created.'
  ];
  return lines.filter((line) => line !== null).join('\n');
}

export function renderAiNewsSearchFailureKeyboard({ result = {} }) {
  const rows = [];
  if (result?.searchClaimReleased && searchAvailable(result?.searchUsage)) {
    rows.push([{ text: '🔄 Try again', callback_data: 'news:find' }]);
  }
  rows.push([{ text: '← News settings', callback_data: 'news:home' }]);
  return { inline_keyboard: rows };
}

export function renderAiNewsAudienceText({ preferences = {} }) {
  return [
    '👥 LinkedIn audience',
    '',
    'Choose who should find the story professionally relevant. This guides discovery and draft framing; it does not target or message anyone.',
    '',
    `Selected: ${audienceLabel(preferences)}`,
    'Custom audience text is bounded to 120 characters and saved only in your preset settings.'
  ].join('\n');
}

export function renderAiNewsAudienceKeyboard({ preferences = {} }) {
  const selected = normalizeAudienceKey(preferences.audience_key);
  const row = (key) => [{
    text: `${selected === key ? '✓ ' : ''}${AI_NEWS_AUDIENCES[key].label}`,
    callback_data: `news:aud:${key}`
  }];
  return {
    inline_keyboard: [
      row('professional_network'),
      row('founders_executives'),
      row('product_engineering'),
      row('sales_marketing'),
      row('investors_finance'),
      row('recruiters_talent'),
      [{ text: `${selected === 'custom' ? '✓ ' : ''}Custom audience`, callback_data: 'news:aud:custom' }],
      [{ text: '← News settings', callback_data: 'news:home' }]
    ]
  };
}

export function renderAiNewsAngleText({ preferences = {} }) {
  return [
    '🎯 Editorial angle',
    '',
    'Choose the professional lens for source ranking and draft framing. Facts remain bounded to the original evidence.',
    '',
    `Selected: ${angleLabel(preferences)}`
  ].join('\n');
}

export function renderAiNewsAngleKeyboard({ preferences = {} }) {
  const selected = normalizeAngleKey(preferences.angle_key);
  return {
    inline_keyboard: [
      ...Object.values(AI_NEWS_ANGLES).map((angle) => ([{
        text: `${selected === angle.key ? '✓ ' : ''}${angle.label}`,
        callback_data: `news:ang:${angle.key}`
      }])),
      [{ text: '← News settings', callback_data: 'news:home' }]
    ]
  };
}

export function renderAiNewsAudiencePromptText() {
  return '👥 Send a focused professional audience (2–120 characters). Example: SaaS founders building developer tools';
}

function sourceProviderLabel(provider) {
  return {
    rss: 'Official RSS',
    hacker_news: 'Hacker News signal',
    github_releases: 'GitHub release',
    newsdata: 'NewsData'
  }[provider] || value(provider, 'Source');
}

export function renderAiNewsSourcesText({ result }) {
  const canDraft = Boolean(result?.draftGenerationAvailable);
  const generatorMode = result?.generatorMode || 'openai';
  const lines = [
    '📰 Fresh source candidates',
    '',
    `Query: ${value(result?.query)}`,
    `Audience: ${audienceLabel(result?.preferences || { audience_key: result?.audienceKey })}`,
    `Angle: ${angleLabel(result?.preferences || { angle_key: result?.angleKey })}`,
    result?.personalization?.available ? `Profile affinity: ${result.personalization.signalCount || 0} public signals` : 'Profile affinity: no public signals',
    `Source mode: ${result?.sourceMode || 'newsdata_only'}`,
    `Generator: ${generatorMode}`,
    canDraft
      ? 'Choose Draft to use one source as evidence, or Open to inspect the original first.'
      : generatorMode === 'off'
        ? 'Browse-only mode: open an original source. Draft generation is disabled.'
        : 'Draft allowance is currently used. You can still inspect original sources.'
  ];
  for (const [index, article] of (result?.articles || []).entries()) {
    const authority = Number.isFinite(Number(article.source_authority_score)) ? Number(article.source_authority_score) : null;
    const metadata = parseSourceMetadata(article.source_metadata_json || article.sourceMetadata || article.metadata);
    const relevance = Number.isFinite(Number(metadata.relevanceScore)) ? Number(metadata.relevanceScore) : null;
    const qualityTier = value(metadata.qualityTier, null);
    const quality = [
      sourceProviderLabel(article.provider),
      article.source_is_primary ? 'primary' : qualityTier ? `quality ${qualityTier}` : null,
      authority !== null ? `authority ${authority}/100` : null,
      relevance !== null ? `relevance ${relevance}/100` : null,
      Number.isFinite(Number(metadata.profileAffinityScore)) ? `profile ${Number(metadata.profileAffinityScore)}/100` : null,
      Number.isFinite(Number(metadata.audienceFitScore)) ? `audience ${Number(metadata.audienceFitScore)}/100` : null,
      Number.isFinite(Number(metadata.angleFitScore)) ? `angle ${Number(metadata.angleFitScore)}/100` : null
    ].filter(Boolean).join(' · ');
    lines.push(
      '',
      `${index + 1}. ${value(article.source_title)}`,
      `${value(article.source_name, value(article.source_domain))} · ${new Date(article.published_at).toISOString()}`,
      quality
    );
  }
  const failed = (result?.providerSummary || []).filter((item) => item.outcome === 'failed');
  if (failed.length) {
    const labels = failed.map((item) => `${sourceProviderLabel(item.provider)}${item.errorCode ? ` [${item.errorCode}]` : ''}`);
    lines.push('', `Provider isolation: ${labels.join(', ')} unavailable; remaining sources still returned.`);
  }
  if (result?.newsdataFallbackUsed) lines.push('', 'NewsData fallback was used because primary/free providers did not fill the candidate pool.');
  const validUntil = result?.articles?.[0]?.expires_at;
  if (validUntil) lines.push(`Selection valid until: ${new Date(validUntil).toISOString()}`);
  return lines.join('\n');
}

export function renderAiNewsSourcesKeyboard({ result }) {
  const rows = [];
  const canDraft = Boolean(result?.draftGenerationAvailable);
  for (const [index, article] of (result?.articles || []).entries()) {
    const row = [];
    if (canDraft) {
      row.push({
        text: `Draft ${index + 1}`,
        callback_data: `news:generate:${article.public_token}`
      });
    }
    row.push({
      text: canDraft ? 'Open source ↗' : `Open ${index + 1} ↗`,
      url: article.source_url
    });
    rows.push(row);
  }
  if (searchAvailable(result?.searchUsage) && !result?.searchCooldown?.active) {
    rows.push([{ text: '↻ Search again', callback_data: 'news:find' }]);
  }
  rows.push([{ text: '← News settings', callback_data: 'news:home' }]);
  return { inline_keyboard: rows };
}

export function renderAiNewsDraftText({ draft, notice = null }) {
  if (!draft) return '⚠️ Draft not found.';
  const lines = [
    '📝 LinkedIn news draft',
    '',
    `Source: ${value(draft.source_title)}`,
    `${value(draft.source_name, value(draft.source_domain))} · ${draft.published_at ? new Date(draft.published_at).toISOString() : 'unknown date'}`,
    value(draft.source_url),
    '',
    'Exact post text:',
    '──────────',
    value(draft.post_text),
    '──────────',
    '',
    `Status: ${value(draft.status)}`,
    `Generator: ${value(draft.model_provider, 'unknown')}`,
    `Model/template: ${value(draft.model_name)}`,
    `Edited by member: ${draft.edited_by_user ? 'yes' : 'no'}`,
    '',
    'Review every claim. Publishing still requires a separate explicit LinkedIn authorization.'
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}

export function renderAiNewsDraftKeyboard({ draft }) {
  const rows = [];
  if (draft?.status === 'draft') {
    rows.push([
      { text: '✏️ Edit text', callback_data: `news:edit:${draft.public_token}` },
      { text: '✅ Approve', callback_data: `news:approve:${draft.public_token}` }
    ]);
    rows.push([{ text: '🗑 Cancel draft', callback_data: `news:cancel:${draft.public_token}` }]);
  }
  if (draft?.status === 'share_ready') rows.push([{ text: 'Continue LinkedIn authorization', callback_data: `news:approve:${draft.public_token}` }]);
  rows.push([{ text: '← News drafts', callback_data: 'news:home' }]);
  return { inline_keyboard: rows };
}

export function renderAiNewsPublishAuthorizationText({ draft, shareIntent }) {
  return [
    '✅ Draft approved for LinkedIn authorization',
    '',
    'This is still not published.',
    'Open LinkedIn, review the permission request, and explicitly authorize this one post.',
    '',
    `Source: ${value(draft?.source_title)}`,
    `Visibility: ${value(shareIntent?.visibility, 'PUBLIC')}`,
    'Automatic publishing: disabled',
    'OAuth token persistence: none'
  ].join('\n');
}

export function renderAiNewsPublishAuthorizationKeyboard({ publishUrl, draftToken }) {
  return {
    inline_keyboard: [
      [{ text: '↗ Authorize one LinkedIn post', url: publishUrl }],
      [{ text: '← Back to draft', callback_data: `news:draft:${draftToken}` }]
    ]
  };
}

export function renderAiNewsTopicPromptText() {
  return '✍️ Send a focused topic or keyword query (2–120 characters). Example: AI agents for small business';
}

export function renderAiNewsEditPromptText() {
  return '✏️ Send the complete replacement post text. Keep the source URL and do not add unsupported numbers or quotations.';
}

export function aiNewsReasonText(reason) {
  return reasonText(reason);
}


function presetTopicLabel(preset) {
  const base = AI_NEWS_PRESETS[preset?.preset_key]?.label || 'News';
  return preset?.preset_key === 'custom' ? `${base}: ${value(preset?.custom_query)}` : base;
}

export function renderAiNewsPresetsText({ state, notice = null }) {
  const presets = Array.isArray(state?.presets) ? state.presets : [];
  const generatorEnabled = state?.config?.generator?.mode
    ? state.config.generator.mode !== 'off'
    : state?.config?.generator?.enabled !== false;
  const lines = [
    '⚙️ Personalized news presets',
    '',
    generatorEnabled
      ? 'Saved presets reuse your topic, audience, angle, language, and tone. Scheduled delivery creates a Telegram draft only; every LinkedIn post still needs preview and explicit approval.'
      : 'Saved presets reuse your source settings. Draft generation and scheduled delivery are disabled in browse-only mode.',
    '',
    `Access: ${state?.eligible ? (state?.reason === 'operator_access' ? 'operator' : 'Pro') : 'locked'}`,
    `Presets: ${state?.usage?.used ?? presets.length}/${state?.usage?.limit ?? state?.config?.presetLimit ?? 0}`,
    `Generator: ${state?.config?.generator?.mode || 'openai'}`,
    `Scheduler: ${state?.config?.schedule?.enabled ? `${state.config.schedule.driver} · live` : 'off'}`
  ];
  if (state?.config?.schedule?.enabled) {
    lines.push('Delivery guard: at most one scheduled draft per member per scheduler execution; multiple due presets rotate oldest-first.');
  }
  if (!state?.eligible) lines.push('', `⚠️ ${reasonText(state?.reason)}`);
  if (!presets.length) {
    lines.push('', 'No saved presets yet.', 'Configure the topic, audience, angle, language, and tone on the main news screen, then tap “Save current”.');
  } else {
    lines.push('', 'Saved presets:');
    presets.forEach((preset, index) => {
      lines.push(`${index + 1}. ${value(preset.name)} · ${preset.status} · ${scheduleLabel({ scheduleKind: preset.schedule_kind, deliveryHourUtc: preset.delivery_hour_utc })}`);
    });
  }
  if (notice) lines.push('', notice);
  return lines.join('\n');
}

export function renderAiNewsPresetsKeyboard({ state }) {
  const rows = (state?.presets || []).map((preset, index) => ([{
    text: `${index + 1}. ${String(preset.name || 'Preset').slice(0, 42)}`,
    callback_data: `news:ps:${preset.public_token}`
  }]));
  if (state?.eligible && (state?.usage?.remaining ?? 0) > 0) rows.push([{ text: '➕ Save current settings', callback_data: 'news:psave' }]);
  if (!state?.eligible && state?.reason === 'pro_required') rows.push([{ text: '⭐ Get Pro', callback_data: 'plans:root' }]);
  rows.push([{ text: '← AI/news drafts', callback_data: 'news:home' }]);
  return { inline_keyboard: rows };
}

export function renderAiNewsPresetText({ state, notice = null }) {
  const preset = state?.preset;
  const generatorEnabled = state?.config?.generator?.mode
    ? state.config.generator.mode !== 'off'
    : state?.config?.generator?.enabled !== false;
  if (!preset) return `⚠️ ${reasonText(state?.reason || 'ai_news_preset_not_found')}`;
  const lines = [
    '⚙️ News preset',
    '',
    `Name: ${value(preset.name)}`,
    `Topic: ${presetTopicLabel(preset)}`,
    `Audience: ${audienceLabel(preset)}`,
    `Angle: ${angleLabel(preset)}`,
    `Profile match: ${preset.profile_affinity_enabled === false ? 'off' : 'on'}`,
    `Post language: ${String(preset.post_language || 'en').toUpperCase()}`,
    `Tone: ${AI_NEWS_TONES[preset.tone] || value(preset.tone)}`,
    `Status: ${value(preset.status)}`,
    `Delivery: ${scheduleLabel({ scheduleKind: preset.schedule_kind, deliveryHourUtc: preset.delivery_hour_utc })}`,
    `Next run: ${preset.next_run_at ? new Date(preset.next_run_at).toISOString() : '—'}`,
    `Last success: ${preset.last_success_at ? new Date(preset.last_success_at).toISOString() : '—'}`,
    '',
    'Scheduled delivery creates a reviewable Telegram draft. It never authorizes or publishes a LinkedIn post.',
    'Delivery guard: at most one scheduled draft per member per scheduler execution; multiple due presets rotate oldest-first.'
  ];
  if (preset.last_error_code) lines.push(`Last issue: ${preset.last_error_code}`);
  if (!generatorEnabled) lines.push('', '⚠️ Browse-only mode: Run now and scheduled draft delivery are disabled.');
  else if (!state?.config?.schedule?.enabled) lines.push('', '⚠️ Scheduler is off. Run now still works.');
  if (state?.config?.schedule?.driver === 'vercel_daily') {
    lines.push(`Daily scheduler window: ${String(state.config.schedule.dailyHourUtc).padStart(2, '0')}:00 UTC.`);
  }
  if (notice) lines.push('', notice);
  return lines.join('\n');
}

export function renderAiNewsPresetKeyboard({ state }) {
  const preset = state?.preset;
  const generatorEnabled = state?.config?.generator?.mode
    ? state.config.generator.mode !== 'off'
    : state?.config?.generator?.enabled !== false;
  if (!preset) return { inline_keyboard: [[{ text: '← Presets', callback_data: 'news:presets' }]] };
  const token = preset.public_token;
  const rows = [];
  if (generatorEnabled) rows.push([{ text: '▶️ Run now', callback_data: `news:psrun:${token}` }]);
  if (state?.config?.schedule?.enabled) {
    rows.push([
      { text: `${preset.schedule_kind === 'manual' ? '✓ ' : ''}Manual`, callback_data: `news:pskind:${token}:manual` },
      { text: `${preset.schedule_kind === 'daily' ? '✓ ' : ''}Daily`, callback_data: `news:pskind:${token}:daily` },
      { text: `${preset.schedule_kind === 'weekdays' ? '✓ ' : ''}Weekdays`, callback_data: `news:pskind:${token}:weekdays` }
    ]);
    if (state.config.schedule.driver === 'external_hourly' && preset.schedule_kind !== 'manual') {
      const hours = AI_NEWS_DELIVERY_HOURS_UTC;
      rows.push(hours.slice(0, 3).map((hour) => ({ text: `${preset.delivery_hour_utc === hour ? '✓ ' : ''}${String(hour).padStart(2, '0')}:00`, callback_data: `news:pshour:${token}:${hour}` })));
      rows.push(hours.slice(3).map((hour) => ({ text: `${preset.delivery_hour_utc === hour ? '✓ ' : ''}${String(hour).padStart(2, '0')}:00`, callback_data: `news:pshour:${token}:${hour}` })));
    }
  }
  rows.push([{ text: preset.status === 'paused' ? '▶️ Resume preset' : '⏸ Pause preset', callback_data: `news:${preset.status === 'paused' ? 'psresume' : 'pspause'}:${token}` }]);
  rows.push([{ text: '🗑 Delete preset', callback_data: `news:psdelete:${token}` }]);
  rows.push([{ text: '← Presets', callback_data: 'news:presets' }]);
  return { inline_keyboard: rows };
}
