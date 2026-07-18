import { Composer } from 'grammy';
import { getProfileActivationNextAction } from '../../lib/profile/contract.js';
import { renderProfileInputKeyboard, renderProfileInputPrompt } from '../../lib/telegram/render.js';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import { cancelDirectoryFilterInputForTelegramUser } from '../../lib/storage/directoryFilterStore.js';
import {
  beginProfileFieldEdit,
  clearProfileSkillsForTelegramUser,
  loadProfileEditorState,
  setProfileVisibilityForTelegramUser,
  toggleProfileContactModeForTelegramUser,
  toggleProfileSkillForTelegramUser
} from '../../lib/storage/profileEditStore.js';
import { formatUserFacingError } from '../utils/notices.js';

export function createProfileComposer({
  clearAllPendingInputs,
  buildProfileMenuSurface,
  buildProfilePreviewSurface,
  buildProfileSkillsSurface,
  buildProfileOptionalSurface
}) {
  const composer = new Composer();

  const renderProfileMenu = async (ctx, method = 'edit', notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildProfileMenuSurface(ctx, notice);
    if (method === 'reply') {
      await ctx.reply(surface.text, { reply_markup: surface.reply_markup });
      return;
    }
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };

  const renderProfilePreview = async (ctx, notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildProfilePreviewSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };

  const renderProfileSkills = async (ctx, notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildProfileSkillsSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };

  const renderProfileOptional = async (ctx, notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildProfileOptionalSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };

  const openFieldEditor = async (ctx, fieldKey) => {
    await clearAllPendingInputs(ctx.from.id);
    await cancelDirectoryFilterInputForTelegramUser({ telegramUserId: ctx.from.id }).catch(() => null);
    const editState = await beginProfileFieldEdit({
      telegramUserId: ctx.from.id,
      fieldKey
    });

    await safeEditOrReply(ctx, renderProfileInputPrompt({
      fieldKey,
      profileSnapshot: editState.profile
    }), {
      reply_markup: renderProfileInputKeyboard()
    });
  };

  const openNextActivationStep = async (ctx) => {
    await clearAllPendingInputs(ctx.from.id);
    const state = await loadProfileEditorState({ telegramUserId: ctx.from.id });
    const action = getProfileActivationNextAction(state.profile || {});

    if (action.kind === 'field') {
      await openFieldEditor(ctx, action.fieldKey);
      return;
    }

    if (action.kind === 'skills') {
      const surface = await buildProfileSkillsSurface(ctx);
      await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
      return;
    }

    if (action.kind === 'preview' || action.kind === 'listed_preview') {
      const surface = await buildProfilePreviewSurface(ctx);
      await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
      return;
    }

    const surface = await buildProfileMenuSurface(ctx, 'Connect LinkedIn first to continue profile setup.');
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };

  composer.command('profile', async (ctx) => {
    await renderProfileMenu(ctx, 'reply');
  });

  composer.callbackQuery('p:menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderProfileMenu(ctx, 'edit');
  });

  composer.callbackQuery('p:next', async (ctx) => {
    await ctx.answerCallbackQuery();
    await openNextActivationStep(ctx).catch(async (error) => {
      await renderProfileMenu(ctx, 'edit', `⚠️ ${formatUserFacingError(error?.message || error, 'Could not continue profile setup right now.')}`);
    });
  });

  composer.callbackQuery('p:opt', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderProfileOptional(ctx);
  });

  composer.callbackQuery('p:prev', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderProfilePreview(ctx);
  });

  composer.callbackQuery('p:sk', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderProfileSkills(ctx);
  });

  composer.callbackQuery('p:sk:clr', async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await clearProfileSkillsForTelegramUser({
      telegramUserId: ctx.from.id
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      reason: String(error?.message || error)
    }));

    let notice = 'Skills cleared.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ Persistence is disabled in this environment.';
    } else if (!result.changed) {
      notice = `⚠️ ${formatUserFacingError(result.reason, 'Could not clear skills right now.')}`;
    } else {
      notice = '✅ Skills cleared. Choose at least 1 skill to complete the required setup.';
    }

    const surface = await buildProfileSkillsSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^p:skt:([a-z]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const skillSlug = ctx.match?.[1];

    const result = await toggleProfileSkillForTelegramUser({
      telegramUserId: ctx.from.id,
      skillSlug
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      reason: String(error?.message || error)
    }));

    let notice = 'Skill updated.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ Persistence is disabled in this environment.';
    } else if (!result.changed) {
      notice = `⚠️ ${formatUserFacingError(result.reason, 'Could not update this skill right now.')}`;
    } else {
      notice = result.toggledOn
        ? `✅ Added skill: ${result.skillMeta.label}`
        : `✅ Removed skill: ${result.skillMeta.label}`;
    }

    const surface = await buildProfileSkillsSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^p:ed:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const fieldKey = ctx.match?.[1];

    try {
      await openFieldEditor(ctx, fieldKey);
    } catch (error) {
      await renderProfileMenu(ctx, 'edit', `⚠️ ${formatUserFacingError(error?.message || error, 'Could not open this editor right now.')}`);
    }
  });

  composer.callbackQuery('p:cm', async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await toggleProfileContactModeForTelegramUser({
      telegramUserId: ctx.from.id
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      blocked: false,
      reason: String(error?.message || error)
    }));

    let notice = 'Contact mode updated.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ Persistence is disabled in this environment.';
    } else if (result.blocked && result.reason === 'hidden_telegram_username_required_for_paid_unlock') {
      notice = '⚠️ Add your hidden Telegram username first before enabling paid Telegram-contact requests.';
    } else if (result.blocked || !result.changed) {
      notice = `⚠️ ${formatUserFacingError(result.reason, 'Could not update contact mode right now.')}`;
    } else {
      notice = result.profile?.contact_mode === 'paid_unlock_requires_approval'
        ? '✅ Contact mode now offers private-chat and Telegram-contact requests.'
        : '✅ Contact mode is now free intro requests only.';
    }

    const surface = await buildProfileOptionalSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery('p:pub', async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await setProfileVisibilityForTelegramUser({
      telegramUserId: ctx.from.id,
      visibilityStatus: 'listed'
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      blocked: false,
      reason: String(error?.message || error)
    }));

    let notice = 'Profile publication updated.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ Persistence is disabled in this environment.';
    } else if (result.blocked) {
      notice = '⚠️ Complete every required setup step before publishing the profile.';
    } else if (!result.changed && result.reason === 'visibility_unchanged') {
      notice = 'ℹ️ Your profile is already listed.';
    } else if (!result.changed) {
      notice = `⚠️ ${formatUserFacingError(result.reason, 'Could not publish the profile right now.')}`;
    } else {
      notice = '✅ Profile published in the directory.';
    }

    await renderProfilePreview(ctx, notice);
  });

  composer.callbackQuery('p:vis', async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await setProfileVisibilityForTelegramUser({
      telegramUserId: ctx.from.id,
      visibilityStatus: 'hidden'
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      blocked: false,
      reason: String(error?.message || error)
    }));

    let notice = 'Profile visibility updated.';
    if (!result.persistenceEnabled) {
      notice = '⚠️ Persistence is disabled in this environment.';
    } else if (!result.changed && result.reason === 'visibility_unchanged') {
      notice = 'ℹ️ Your profile is already hidden. Use Preview & publish when you are ready to list it.';
    } else if (!result.changed) {
      notice = `⚠️ ${formatUserFacingError(result.reason, 'Could not hide the profile right now.')}`;
    } else {
      notice = '✅ Profile hidden from the directory.';
    }

    await renderProfilePreview(ctx, notice);
  });

  return composer;
}
