import { AI_NEWS_PRESETS, AI_NEWS_TONES } from '../ai/newsDraftContract.js';
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
    ai_news_search_cooldown: 'Please wait before searching the news provider again.',
    ai_news_source_already_used: 'A draft already exists for this source. Choose another article.',
    ai_news_no_fresh_sources: 'No fresh matching sources were found.',
    ai_news_source_expired: 'This source selection expired. Search again.',
    ai_news_source_not_found: 'This source is no longer available.',
    ai_news_generator_disabled: 'Draft generation is off. You can still browse and open trusted sources.',
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
    ai_news_all_providers_failed: 'All enabled source providers failed. Try again later or return to NewsData-only mode.',
    ai_news_preset_limit_reached: 'Your saved-preset limit is used.',
    ai_news_preset_duplicate: 'This preset is already saved.',
    ai_news_preferences_not_found: 'Choose topic, language, and tone before saving a preset.',
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
  const preset = AI_NEWS_PRESETS[preferences.preset_key] || AI_NEWS_PRESETS.ai_technology;
  const tone = AI_NEWS_TONES[preferences.tone] || AI_NEWS_TONES.professional;
  const generatorMode = state?.config?.generator?.mode || 'openai';
  const browseOnly = generatorMode === 'off';
  const lines = [
    browseOnly ? '📰 AI/news source browser' : '🧠 AI/news drafts',
    '',
    browseOnly
      ? 'Browse current evidence sources without an AI provider. Nothing is generated or published automatically.'
      : 'Create an evidence-bound LinkedIn draft from a current news source. Nothing is published automatically.',
    '',
    `Topic: ${preset.label}${preferences.preset_key === 'custom' ? ` · ${value(preferences.custom_query)}` : ''}`,
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
      ? 'Flow: source → evidence → open original.'
      : 'Flow: source → evidence → draft → preview/edit → explicit LinkedIn approval.'
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
    [
      { text: `${p.preset_key === 'ai_technology' ? '✓ ' : ''}AI & Tech`, callback_data: 'news:preset:ai_technology' },
      { text: `${p.preset_key === 'business_growth' ? '✓ ' : ''}Business`, callback_data: 'news:preset:business_growth' }
    ],
    [
      { text: `${p.preset_key === 'crypto_web3' ? '✓ ' : ''}Crypto`, callback_data: 'news:preset:crypto_web3' },
      { text: `${p.preset_key === 'custom' ? '✓ ' : ''}Custom topic`, callback_data: 'news:topic' }
    ],
    [
      { text: `Language: ${String(p.post_language || 'en').toUpperCase()}`, callback_data: `news:lang:${p.post_language === 'ru' ? 'en' : 'ru'}` },
      { text: `Tone: ${AI_NEWS_TONES[p.tone] || 'Professional'}`, callback_data: `news:tone:${p.tone === 'professional' ? 'analytical' : p.tone === 'analytical' ? 'concise' : 'professional'}` }
    ]
  ];
  if (state?.eligible && searchAvailable(state?.searchUsage)) {
    rows.push([{ text: '🔎 Find fresh news', callback_data: 'news:find' }]);
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
      relevance !== null ? `relevance ${relevance}/100` : null
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
  if (searchAvailable(result?.searchUsage)) {
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
      ? 'Saved presets reuse your topic, language, and tone. Scheduled delivery creates a Telegram draft only; every LinkedIn post still needs preview and explicit approval.'
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
    lines.push('', 'No saved presets yet.', 'Configure the topic, language, and tone on the main news screen, then tap “Save current”.');
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
