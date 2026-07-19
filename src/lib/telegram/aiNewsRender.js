import { AI_NEWS_PRESETS, AI_NEWS_TONES } from '../ai/newsDraftContract.js';

function value(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}


function reasonText(reason) {
  const map = {
    ai_news_disabled: 'AI/news drafts are disabled in this environment.',
    ai_news_draft_config_invalid: 'AI/news draft configuration is invalid.',
    operator_only: 'This foundation is currently limited to Intro Deck operators.',
    pro_required: 'AI/news drafts require Pro.',
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
    openai_generation_failed: 'The AI provider could not produce a valid evidence-bound draft. Try another source later.',
    openai_internal_error: 'Draft generation is temporarily unavailable.',
    newsdata_request_failed: 'The news provider request failed. Try again later.',
    linkedin_share_unavailable: 'LinkedIn publishing is not available right now.'
  };
  return map[reason] || `Unavailable: ${reason || 'unknown_reason'}`;
}

export function renderAiNewsHubText({ state, notice = null }) {
  const preferences = state?.preferences || {};
  const preset = AI_NEWS_PRESETS[preferences.preset_key] || AI_NEWS_PRESETS.ai_technology;
  const tone = AI_NEWS_TONES[preferences.tone] || AI_NEWS_TONES.professional;
  const lines = [
    '🧠 AI/news drafts',
    '',
    'Create an evidence-bound LinkedIn draft from a current news source. Nothing is published automatically.',
    '',
    `Topic: ${preset.label}${preferences.preset_key === 'custom' ? ` · ${value(preferences.custom_query)}` : ''}`,
    `Post language: ${String(preferences.post_language || 'en').toUpperCase()}`,
    `Tone: ${tone}`,
    `Allowance: ${state?.dailyUsage?.remaining ?? 0}/${state?.dailyUsage?.limit ?? state?.config?.dailyLimit ?? 0} remaining in 24h`,
    '',
    'Flow: source → evidence → draft → preview/edit → explicit LinkedIn approval.'
  ];
  if (!state?.eligible) lines.push('', `⚠️ ${reasonText(state?.reason)}`);
  if (state?.latestDraft) lines.push('', `Latest draft: ${state.latestDraft.status}`);
  if (notice) lines.push('', notice);
  return lines.join('\n');
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
  if (state?.eligible && (state?.dailyUsage?.remaining ?? 0) > 0) rows.push([{ text: '🔎 Find fresh news', callback_data: 'news:find' }]);
  if (state?.latestDraft && ['draft', 'editing', 'share_ready', 'unknown'].includes(state.latestDraft.status)) {
    rows.push([{ text: '📝 Open current draft', callback_data: `news:draft:${state.latestDraft.public_token}` }]);
  }
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return { inline_keyboard: rows };
}

export function renderAiNewsSourcesText({ result }) {
  const lines = [
    '📰 Fresh source candidates',
    '',
    `Query: ${value(result?.query)}`,
    'Choose one source. Intro Deck will save its evidence snapshot before generating a draft.'
  ];
  for (const [index, article] of (result?.articles || []).entries()) {
    lines.push('', `${index + 1}. ${value(article.source_title)}`, `${value(article.source_name, value(article.source_domain))} · ${new Date(article.published_at).toISOString()}`);
  }
  return lines.join('\n');
}

export function renderAiNewsSourcesKeyboard({ result }) {
  const rows = (result?.articles || []).map((article, index) => ([{
    text: `${index + 1}. ${String(article.source_title || '').slice(0, 46)}`,
    callback_data: `news:generate:${article.public_token}`
  }]));
  rows.push([{ text: '↻ Search again', callback_data: 'news:find' }]);
  rows.push([{ text: '← Draft settings', callback_data: 'news:home' }]);
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
    `AI model: ${value(draft.model_name)}`,
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
