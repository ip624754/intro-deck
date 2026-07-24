import { Composer } from 'grammy';
import { updateUserLanguagePreference } from '../../lib/storage/languagePreferenceStore.js';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';

function updateNotice(result) {
  const russian = result?.interfaceLanguage === 'ru';
  if (!result?.persistenceEnabled) {
    return russian
      ? '⚠️ Настройки языка временно недоступны.'
      : '⚠️ Language settings are temporarily unavailable.';
  }
  if (result?.blocked) {
    return russian
      ? '⚠️ Настройки языка ещё не готовы. Требуется миграция 037.'
      : '⚠️ Language settings are not ready yet. Migration 037 is required.';
  }
  if (!result?.changed) {
    return russian ? 'ℹ️ Этот язык уже выбран.' : 'ℹ️ This language is already selected.';
  }
  return russian ? '✅ Настройка языка сохранена.' : '✅ Language preference saved.';
}

export function createLanguageComposer({ clearAllPendingInputs, buildLanguageSettingsSurface }) {
  const composer = new Composer();

  const renderSettings = async (ctx, method = 'edit', notice = null) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildLanguageSettingsSurface(ctx, notice);
    if (method === 'reply') {
      await ctx.reply(surface.text, { reply_markup: surface.reply_markup });
      return;
    }
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };

  composer.command('language', async (ctx) => {
    await renderSettings(ctx, 'reply');
  });

  composer.callbackQuery('lang:root', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderSettings(ctx);
  });

  composer.callbackQuery(/^lang:(interface|post):(en|ru)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await updateUserLanguagePreference({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      telegramLanguageCode: ctx.from.language_code || null,
      preferenceKey: ctx.match?.[1] === 'interface' ? 'interface_language' : 'default_post_language',
      language: ctx.match?.[2]
    }).catch((error) => ({
      persistenceEnabled: true,
      schemaReady: false,
      interfaceLanguage: 'en',
      defaultPostLanguage: 'en',
      changed: false,
      blocked: true,
      reason: String(error?.message || error)
    }));

    await renderSettings(ctx, 'edit', updateNotice(result));
  });

  return composer;
}
