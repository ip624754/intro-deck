import { Composer } from 'grammy';
import {
  getLinkedInConfig,
  getLinkedInShareConfig,
  getTelegramConfig
} from '../../config/env.js';
import { buildSignedLinkedInLaunchTicket } from '../../lib/linkedin/oidc.js';
import {
  aiNewsReasonText,
  renderAiNewsDraftKeyboard,
  renderAiNewsDraftText,
  renderAiNewsEditPromptText,
  renderAiNewsHubKeyboard,
  renderAiNewsHubText,
  renderAiNewsPublishAuthorizationKeyboard,
  renderAiNewsPublishAuthorizationText,
  renderAiNewsPresetKeyboard,
  renderAiNewsPresetText,
  renderAiNewsPresetsKeyboard,
  renderAiNewsPresetsText,
  renderAiNewsSourcesKeyboard,
  renderAiNewsSourcesText,
  renderAiNewsTopicPromptText
} from '../../lib/telegram/aiNewsRender.js';
import { buildLinkedInStartUrl } from '../../lib/telegram/render.js';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import {
  approveAiNewsDraftForLinkedIn,
  beginAiNewsDraftEditForTelegramUser,
  beginAiNewsTopicInputForTelegramUser,
  cancelAiNewsDraftForTelegramUser,
  findAiNewsSourcesForTelegramUser,
  generateAiNewsDraftForTelegramUser,
  loadAiNewsDraftForTelegramUser,
  loadAiNewsHubState,
  updateAiNewsLanguageForTelegramUser,
  updateAiNewsPresetForTelegramUser,
  updateAiNewsToneForTelegramUser
} from '../../lib/storage/aiNewsStore.js';
import {
  deleteAiNewsPresetForTelegramUser,
  loadAiNewsPresetForTelegramUser,
  loadAiNewsPresetsForTelegramUser,
  runAiNewsPresetNowForTelegramUser,
  saveCurrentAiNewsPreferencesAsPreset,
  setAiNewsPresetPausedForTelegramUser,
  updateAiNewsPresetScheduleForTelegramUser
} from '../../lib/storage/aiNewsPresetStore.js';

async function answer(ctx) {
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => null);
}

export async function buildAiNewsHubSurface(ctx, notice = null) {
  const state = await loadAiNewsHubState({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null
  }).catch((error) => ({ eligible: false, reason: error?.message || String(error), preferences: {}, config: {}, dailyUsage: { remaining: 0, limit: 0 } }));
  return { text: renderAiNewsHubText({ state, notice }), reply_markup: renderAiNewsHubKeyboard({ state }) };
}

export async function buildAiNewsDraftSurface(ctx, publicToken = null, notice = null) {
  const result = await loadAiNewsDraftForTelegramUser({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null,
    publicToken
  }).catch((error) => ({ draft: null, reason: error?.message || String(error) }));
  return {
    text: result.draft ? renderAiNewsDraftText({ draft: result.draft, notice }) : `⚠️ ${aiNewsReasonText(result.reason)}`,
    reply_markup: result.draft ? renderAiNewsDraftKeyboard({ draft: result.draft }) : { inline_keyboard: [[{ text: '← News drafts', callback_data: 'news:home' }]] }
  };
}


export async function buildAiNewsPresetsSurface(ctx, notice = null) {
  const state = await loadAiNewsPresetsForTelegramUser({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null
  }).catch((error) => ({ eligible: false, reason: error?.message || String(error), presets: [], config: {} }));
  return { text: renderAiNewsPresetsText({ state, notice }), reply_markup: renderAiNewsPresetsKeyboard({ state }) };
}

export async function buildAiNewsPresetSurface(ctx, publicToken, notice = null) {
  const state = await loadAiNewsPresetForTelegramUser({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null,
    publicToken
  }).catch((error) => ({ eligible: false, reason: error?.message || String(error), preset: null, config: {} }));
  return { text: renderAiNewsPresetText({ state, notice }), reply_markup: renderAiNewsPresetKeyboard({ state }) };
}

export function createAiNewsComposer({ clearAllPendingInputs, appBaseUrl }) {
  const composer = new Composer();

  async function showHub(ctx, notice = null) {
    const surface = await buildAiNewsHubSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup, disable_web_page_preview: true });
  }

  async function showDraft(ctx, token, notice = null) {
    const surface = await buildAiNewsDraftSurface(ctx, token, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup, disable_web_page_preview: true });
  }

  async function showPresets(ctx, notice = null) {
    const surface = await buildAiNewsPresetsSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup, disable_web_page_preview: true });
  }

  async function showPreset(ctx, token, notice = null) {
    const surface = await buildAiNewsPresetSurface(ctx, token, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup, disable_web_page_preview: true });
  }

  composer.command('news', async (ctx) => {
    await clearAllPendingInputs(ctx.from.id);
    await showHub(ctx);
  });

  composer.callbackQuery('news:home', async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    await showHub(ctx);
  });

  composer.callbackQuery(/^news:preset:(ai_technology|business_growth|crypto_web3|custom)$/i, async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    const presetKey = ctx.match?.[1];
    if (presetKey === 'custom') {
      await beginAiNewsTopicInputForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null });
      await safeEditOrReply(ctx, renderAiNewsTopicPromptText(), { reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'news:home' }]] } });
      return;
    }
    await updateAiNewsPresetForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, presetKey });
    await showHub(ctx, '✅ Topic preset updated.');
  });

  composer.callbackQuery(/^news:lang:(en|ru)$/i, async (ctx) => {
    await answer(ctx);
    await updateAiNewsLanguageForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, postLanguage: ctx.match?.[1] });
    await showHub(ctx, '✅ Post language updated.');
  });

  composer.callbackQuery(/^news:tone:(professional|analytical|concise)$/i, async (ctx) => {
    await answer(ctx);
    await updateAiNewsToneForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, tone: ctx.match?.[1] });
    await showHub(ctx, '✅ Tone updated.');
  });

  composer.callbackQuery('news:topic', async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    const result = await beginAiNewsTopicInputForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null });
    if (!result.started) return showHub(ctx, `⚠️ ${aiNewsReasonText(result.reason)}`);
    await safeEditOrReply(ctx, renderAiNewsTopicPromptText(), { reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'news:home' }]] } });
  });

  composer.callbackQuery('news:find', async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    await safeEditOrReply(ctx, '🔎 Searching trusted source providers for fresh evidence…');
    const result = await findAiNewsSourcesForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null }).catch((error) => ({ found: false, reason: error?.message || String(error), articles: [] }));
    if (!result.found) return showHub(ctx, `⚠️ ${aiNewsReasonText(result.reason)}`);
    await safeEditOrReply(ctx, renderAiNewsSourcesText({ result }), { reply_markup: renderAiNewsSourcesKeyboard({ result }), disable_web_page_preview: true });
  });

  composer.callbackQuery(/^news:generate:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    await safeEditOrReply(ctx, '📝 Building an evidence-bound draft with the configured generator. Nothing will be published…');
    const result = await generateAiNewsDraftForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, sourceToken: ctx.match?.[1] }).catch((error) => ({ generated: false, reason: error?.message || String(error) }));
    if (!result.generated) return showHub(ctx, `⚠️ Draft generation failed: ${aiNewsReasonText(result.reason)}`);
    await showDraft(ctx, result.draft.public_token);
  });

  composer.callbackQuery(/^news:draft:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    await showDraft(ctx, ctx.match?.[1]);
  });

  composer.callbackQuery(/^news:edit:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    const result = await beginAiNewsDraftEditForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, publicToken: ctx.match?.[1] });
    if (!result.started) return showDraft(ctx, ctx.match?.[1], `⚠️ ${aiNewsReasonText(result.reason)}`);
    await safeEditOrReply(ctx, renderAiNewsEditPromptText(), { reply_markup: { inline_keyboard: [[{ text: 'Cancel edit', callback_data: 'news:home' }]] } });
  });

  composer.callbackQuery(/^news:cancel:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    const result = await cancelAiNewsDraftForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, publicToken: ctx.match?.[1] });
    await showHub(ctx, result.changed ? '✅ Draft cancelled.' : `⚠️ ${aiNewsReasonText(result.reason)}`);
  });

  composer.callbackQuery(/^news:approve:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    const draftToken = ctx.match?.[1];
    const { botUsername } = getTelegramConfig();
    const result = await approveAiNewsDraftForLinkedIn({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, publicToken: draftToken, botUsername }).catch((error) => ({ approved: false, reason: error?.message || String(error) }));
    let shareIntent = result.shareIntent;
    let draft = result.draft;
    if (!result.approved && result.reason === 'ai_news_draft_share_ready' && result.draft?.share_public_token) {
      shareIntent = { public_token: result.draft.share_public_token, visibility: result.draft.share_visibility };
      draft = result.draft;
    }
    if (!shareIntent?.public_token) return showDraft(ctx, draftToken, `⚠️ ${aiNewsReasonText(result.reason)}`);

    const linkedinConfig = getLinkedInConfig();
    const shareConfig = getLinkedInShareConfig();
    const launchTicket = buildSignedLinkedInLaunchTicket({
      telegramUserId: ctx.from.id,
      purpose: 'share_profile',
      shareIntentToken: shareIntent.public_token,
      ttlSeconds: Math.min(shareConfig.intentTtlSeconds, linkedinConfig.stateTtlSeconds),
      secret: linkedinConfig.stateSecret
    });
    const publishUrl = buildLinkedInStartUrl({
      appBaseUrl,
      telegramUserId: ctx.from.id,
      returnTo: '/news',
      purpose: 'share_profile',
      launchTicket
    });
    await safeEditOrReply(ctx, renderAiNewsPublishAuthorizationText({ draft, shareIntent }), {
      reply_markup: renderAiNewsPublishAuthorizationKeyboard({ publishUrl, draftToken }),
      disable_web_page_preview: true
    });
  });


  composer.callbackQuery('news:presets', async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    await showPresets(ctx);
  });

  composer.callbackQuery('news:psave', async (ctx) => {
    await answer(ctx);
    const result = await saveCurrentAiNewsPreferencesAsPreset({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => ({ created: false, reason: error?.message || String(error) }));
    await showPresets(ctx, result.created ? '✅ Current topic, language, and tone saved as a preset.' : `⚠️ ${aiNewsReasonText(result.reason)}`);
  });

  composer.callbackQuery(/^news:ps:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    await showPreset(ctx, ctx.match?.[1]);
  });

  composer.callbackQuery(/^news:psrun:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    const token = ctx.match?.[1];
    await safeEditOrReply(ctx, '🧠 Running this preset now. It will create a draft only…');
    const result = await runAiNewsPresetNowForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      publicToken: token
    }).catch((error) => ({ generated: false, reason: error?.message || String(error) }));
    if (!result.generated || !result.draft?.public_token) return showPreset(ctx, token, `⚠️ ${aiNewsReasonText(result.reason)}`);
    await showDraft(ctx, result.draft.public_token, '✅ Draft created from this saved preset. Nothing was published.');
  });

  composer.callbackQuery(/^news:pskind:([0-9a-f-]{36}):(manual|daily|weekdays)$/i, async (ctx) => {
    await answer(ctx);
    const token = ctx.match?.[1];
    const result = await updateAiNewsPresetScheduleForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      publicToken: token,
      scheduleKind: ctx.match?.[2]
    }).catch((error) => ({ changed: false, reason: error?.message || String(error) }));
    await showPreset(ctx, token, result.changed ? '✅ Delivery schedule updated. Draft delivery never publishes automatically.' : `⚠️ ${aiNewsReasonText(result.reason)}`);
  });

  composer.callbackQuery(/^news:pshour:([0-9a-f-]{36}):(6|9|12|15|18|21)$/i, async (ctx) => {
    await answer(ctx);
    const token = ctx.match?.[1];
    const state = await loadAiNewsPresetForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, publicToken: token });
    const result = await updateAiNewsPresetScheduleForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      publicToken: token,
      scheduleKind: state.preset?.schedule_kind || 'daily',
      deliveryHourUtc: Number(ctx.match?.[2])
    }).catch((error) => ({ changed: false, reason: error?.message || String(error) }));
    await showPreset(ctx, token, result.changed ? '✅ UTC delivery hour updated.' : `⚠️ ${aiNewsReasonText(result.reason)}`);
  });

  composer.callbackQuery(/^news:pspause:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    const token = ctx.match?.[1];
    const result = await setAiNewsPresetPausedForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, publicToken: token, paused: true });
    await showPreset(ctx, token, result.changed ? '✅ Preset paused.' : `⚠️ ${aiNewsReasonText(result.reason)}`);
  });

  composer.callbackQuery(/^news:psresume:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    const token = ctx.match?.[1];
    const result = await setAiNewsPresetPausedForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, publicToken: token, paused: false });
    await showPreset(ctx, token, result.changed ? '✅ Preset resumed.' : `⚠️ ${aiNewsReasonText(result.reason)}`);
  });

  composer.callbackQuery(/^news:psdelete:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    const result = await deleteAiNewsPresetForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, publicToken: ctx.match?.[1] });
    await showPresets(ctx, result.changed ? '✅ Preset deleted.' : `⚠️ ${aiNewsReasonText(result.reason)}`);
  });

  return composer;
}
