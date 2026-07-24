import { Composer } from 'grammy';
import {
  getLinkedInConfig,
  getLinkedInShareConfig,
  getTelegramConfig
} from '../../config/env.js';
import { buildSignedLinkedInLaunchTicket } from '../../lib/linkedin/oidc.js';
import {
  aiNewsReasonText,
  renderAiNewsAudienceKeyboard,
  renderAiNewsAudiencePromptText,
  renderAiNewsAudienceText,
  renderAiNewsAngleKeyboard,
  renderAiNewsAngleText,
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
  renderAiNewsSearchFailureKeyboard,
  renderAiNewsSearchFailureText,
  renderAiNewsSearchProgressKeyboard,
  renderAiNewsSearchProgressText,
  renderAiNewsTopicPromptText
} from '../../lib/telegram/aiNewsRender.js';
import { buildLinkedInStartUrl } from '../../lib/telegram/render.js';
import { localizeMemberKeyboard, localizeMemberSurface, localizeMemberText } from '../../lib/telegram/memberLocalization.js';
import {
  resolveTelegramMessageReference,
  safeEditMessageByReference,
  safeEditOrReply
} from '../../lib/telegram/safeEditOrReply.js';
import {
  approveAiNewsDraftForLinkedIn,
  beginAiNewsAudienceInputForTelegramUser,
  beginAiNewsDraftEditForTelegramUser,
  beginAiNewsTopicInputForTelegramUser,
  cancelAiNewsDraftForTelegramUser,
  findAiNewsSourcesForTelegramUser,
  generateAiNewsDraftForTelegramUser,
  loadAiNewsDraftForTelegramUser,
  loadAiNewsHubState,
  updateAiNewsAngleForTelegramUser,
  updateAiNewsAudienceForTelegramUser,
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

const activeAiNewsSearches = new Set();

async function answer(ctx, options = undefined) {
  if (!ctx.callbackQuery) return;
  const localizedOptions = options?.text
    ? { ...options, text: localizeMemberText(options.text, ctx.interfaceLanguage) }
    : options;
  await ctx.answerCallbackQuery(localizedOptions).catch(() => null);
}

export async function buildAiNewsHubSurface(ctx, notice = null) {
  const state = await loadAiNewsHubState({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null
  }).catch((error) => ({ eligible: false, reason: error?.message || String(error), preferences: {}, config: {}, dailyUsage: { remaining: 0, limit: 0 } }));
  return localizeMemberSurface({ text: renderAiNewsHubText({ state, notice }), reply_markup: renderAiNewsHubKeyboard({ state }) }, ctx.interfaceLanguage);
}

export async function buildAiNewsAudienceSurface(ctx) {
  const state = await loadAiNewsHubState({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null
  }).catch(() => ({ preferences: {} }));
  return localizeMemberSurface({
    text: renderAiNewsAudienceText({ preferences: state.preferences }),
    reply_markup: renderAiNewsAudienceKeyboard({ preferences: state.preferences })
  }, ctx.interfaceLanguage);
}

export async function buildAiNewsAngleSurface(ctx) {
  const state = await loadAiNewsHubState({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null
  }).catch(() => ({ preferences: {} }));
  return localizeMemberSurface({
    text: renderAiNewsAngleText({ preferences: state.preferences }),
    reply_markup: renderAiNewsAngleKeyboard({ preferences: state.preferences })
  }, ctx.interfaceLanguage);
}

export async function buildAiNewsDraftSurface(ctx, publicToken = null, notice = null) {
  const result = await loadAiNewsDraftForTelegramUser({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null,
    publicToken
  }).catch((error) => ({ draft: null, reason: error?.message || String(error) }));
  return localizeMemberSurface({
    text: result.draft ? renderAiNewsDraftText({ draft: result.draft, notice, interfaceLanguage: ctx.interfaceLanguage }) : `⚠️ ${aiNewsReasonText(result.reason)}`,
    reply_markup: result.draft ? renderAiNewsDraftKeyboard({ draft: result.draft, interfaceLanguage: ctx.interfaceLanguage }) : { inline_keyboard: [[{ text: '← Back to story finder', callback_data: 'news:home' }]] }
  }, ctx.interfaceLanguage);
}


export async function buildAiNewsPresetsSurface(ctx, notice = null) {
  const state = await loadAiNewsPresetsForTelegramUser({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null
  }).catch((error) => ({ eligible: false, reason: error?.message || String(error), presets: [], config: {} }));
  return localizeMemberSurface({ text: renderAiNewsPresetsText({ state, notice }), reply_markup: renderAiNewsPresetsKeyboard({ state }) }, ctx.interfaceLanguage);
}

export async function buildAiNewsPresetSurface(ctx, publicToken, notice = null) {
  const state = await loadAiNewsPresetForTelegramUser({
    telegramUserId: ctx.from.id,
    telegramUsername: ctx.from.username || null,
    publicToken
  }).catch((error) => ({ eligible: false, reason: error?.message || String(error), preset: null, config: {} }));
  return localizeMemberSurface({ text: renderAiNewsPresetText({ state, notice }), reply_markup: renderAiNewsPresetKeyboard({ state }) }, ctx.interfaceLanguage);
}

export function createAiNewsComposer({ clearAllPendingInputs, appBaseUrl }) {
  const composer = new Composer();

  async function showHub(ctx, notice = null) {
    const surface = await buildAiNewsHubSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup, disable_web_page_preview: true });
  }

  async function showAudience(ctx) {
    const surface = await buildAiNewsAudienceSurface(ctx);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup, disable_web_page_preview: true });
  }

  async function showAngle(ctx) {
    const surface = await buildAiNewsAngleSurface(ctx);
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

  composer.callbackQuery(/^news:preset:(for_you|ai_technology|startups_product|business_markets|career_leadership|crypto_web3|custom)$/i, async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    const presetKey = ctx.match?.[1];
    if (presetKey === 'custom') {
      await beginAiNewsTopicInputForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null });
      await safeEditOrReply(ctx, localizeMemberText(renderAiNewsTopicPromptText(), ctx.interfaceLanguage), { reply_markup: localizeMemberKeyboard({ inline_keyboard: [[{ text: 'Cancel', callback_data: 'news:home' }]] }, ctx.interfaceLanguage) });
      return;
    }
    await updateAiNewsPresetForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, presetKey });
    await showHub(ctx, '✅ Topic preset updated.');
  });

  composer.callbackQuery('news:audience', async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    await showAudience(ctx);
  });

  composer.callbackQuery(/^news:aud:(professional_network|founders_executives|product_engineering|sales_marketing|investors_finance|recruiters_talent|custom)$/i, async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    const audienceKey = ctx.match?.[1];
    if (audienceKey === 'custom') {
      const result = await beginAiNewsAudienceInputForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null });
      if (!result.started) return showHub(ctx, `⚠️ ${aiNewsReasonText(result.reason)}`);
      await safeEditOrReply(ctx, localizeMemberText(renderAiNewsAudiencePromptText(), ctx.interfaceLanguage), { reply_markup: localizeMemberKeyboard({ inline_keyboard: [[{ text: 'Cancel', callback_data: 'news:home' }]] }, ctx.interfaceLanguage) });
      return;
    }
    const result = await updateAiNewsAudienceForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, audienceKey });
    if (!result.changed) return showHub(ctx, `⚠️ ${aiNewsReasonText(result.reason)}`);
    await showHub(ctx, '✅ LinkedIn audience updated.');
  });

  composer.callbackQuery('news:angle', async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    await showAngle(ctx);
  });

  composer.callbackQuery(/^news:ang:(expert_take|practical_lessons|founder_perspective|explain_simply|contrarian_opinion|industry_impact|career_implications)$/i, async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    const result = await updateAiNewsAngleForTelegramUser({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null, angleKey: ctx.match?.[1] });
    if (!result.changed) return showHub(ctx, `⚠️ ${aiNewsReasonText(result.reason)}`);
    await showHub(ctx, '✅ Editorial angle updated.');
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
    await safeEditOrReply(ctx, localizeMemberText(renderAiNewsTopicPromptText(), ctx.interfaceLanguage), { reply_markup: localizeMemberKeyboard({ inline_keyboard: [[{ text: 'Cancel', callback_data: 'news:home' }]] }, ctx.interfaceLanguage) });
  });

  composer.callbackQuery('news:searching', async (ctx) => {
    await answer(ctx, { text: 'Search is already in progress.' });
  });

  composer.callbackQuery('news:find', async (ctx) => {
    const searchKey = String(ctx.from.id);
    if (activeAiNewsSearches.has(searchKey)) {
      await answer(ctx, { text: 'Search is already in progress.' });
      return;
    }

    const state = await loadAiNewsHubState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch(() => ({ preferences: {}, config: {}, searchCooldown: { active: false } }));

    if (state?.searchCooldown?.active) {
      await answer(ctx, { text: `Search will be ready in ${state.searchCooldown.retryAfterSeconds}s.` });
      await showHub(ctx, `⏳ Search cooldown: try again in ${state.searchCooldown.retryAfterSeconds}s.`);
      return;
    }

    activeAiNewsSearches.add(searchKey);
    await answer(ctx, { text: 'Search started.' });
    try {
      await clearAllPendingInputs(ctx.from.id);
      const progressMessage = await safeEditOrReply(ctx, localizeMemberText(renderAiNewsSearchProgressText({ state }), ctx.interfaceLanguage), {
        reply_markup: localizeMemberKeyboard(renderAiNewsSearchProgressKeyboard(), ctx.interfaceLanguage),
        disable_web_page_preview: true
      });
      const progressReference = resolveTelegramMessageReference(ctx, progressMessage);
      const result = await findAiNewsSourcesForTelegramUser({
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username || null
      }).catch((error) => {
        console.warn('[ai news] source search failed unexpectedly', {
          error: String(error?.message || error).slice(0, 200)
        });
        return {
          found: false,
          reason: 'ai_news_search_internal_error',
          errorCode: 'search_preparation_internal_error',
          searchClaimConsumed: false,
          articles: []
        };
      });

      if (!result.found) {
        if (result.reason === 'ai_news_search_cooldown') return;
        await safeEditMessageByReference(ctx, progressReference, localizeMemberText(renderAiNewsSearchFailureText({ result }), ctx.interfaceLanguage), {
          reply_markup: localizeMemberKeyboard(renderAiNewsSearchFailureKeyboard({ result }), ctx.interfaceLanguage),
          disable_web_page_preview: true
        });
        return;
      }

      await safeEditMessageByReference(ctx, progressReference, localizeMemberText(renderAiNewsSourcesText({ result }), ctx.interfaceLanguage), {
        reply_markup: localizeMemberKeyboard(renderAiNewsSourcesKeyboard({ result }), ctx.interfaceLanguage),
        disable_web_page_preview: true
      });
    } finally {
      activeAiNewsSearches.delete(searchKey);
    }
  });

  composer.callbackQuery(/^news:generate:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    await clearAllPendingInputs(ctx.from.id);
    await safeEditOrReply(ctx, localizeMemberText('📝 Building an evidence-bound draft with the configured generator. Nothing will be published…', ctx.interfaceLanguage));
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
    await safeEditOrReply(ctx, localizeMemberText(renderAiNewsEditPromptText(), ctx.interfaceLanguage), { reply_markup: localizeMemberKeyboard({ inline_keyboard: [[{ text: 'Cancel edit', callback_data: 'news:home' }]] }, ctx.interfaceLanguage) });
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
      interfaceLanguage: ctx.interfaceLanguage || 'en',
      postLanguage: draft?.post_language || ctx.defaultPostLanguage || 'en',
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
    const authorizationSurface = localizeMemberSurface({
      text: renderAiNewsPublishAuthorizationText({ draft, shareIntent, interfaceLanguage: ctx.interfaceLanguage }),
      reply_markup: renderAiNewsPublishAuthorizationKeyboard({ publishUrl, draftToken, interfaceLanguage: ctx.interfaceLanguage })
    }, ctx.interfaceLanguage);
    await safeEditOrReply(ctx, authorizationSurface.text, {
      reply_markup: authorizationSurface.reply_markup,
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
    await showPresets(ctx, result.created ? '✅ Current topic, audience, angle, language, and tone saved as a preset.' : `⚠️ ${aiNewsReasonText(result.reason)}`);
  });

  composer.callbackQuery(/^news:ps:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    await showPreset(ctx, ctx.match?.[1]);
  });

  composer.callbackQuery(/^news:psrun:([0-9a-f-]{36})$/i, async (ctx) => {
    await answer(ctx);
    const token = ctx.match?.[1];
    await safeEditOrReply(ctx, localizeMemberText('🧠 Running this preset now. It will create a draft only…', ctx.interfaceLanguage));
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
