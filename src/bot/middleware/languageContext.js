import { loadUserLanguagePreferences } from '../../lib/storage/languagePreferenceStore.js';
import { resolveLanguagePreferences } from '../../lib/i18n/language.js';

export function createLanguageContextMiddleware() {
  return async (ctx, next) => {
    const telegramUserId = ctx?.from?.id || null;
    if (!telegramUserId) {
      const fallback = resolveLanguagePreferences(null);
      ctx.interfaceLanguage = fallback.interfaceLanguage;
      ctx.defaultPostLanguage = fallback.defaultPostLanguage;
      ctx.languageSchemaReady = false;
      await next();
      return;
    }

    const preferences = await loadUserLanguagePreferences({
      telegramUserId,
      telegramUsername: ctx.from.username || null,
      telegramLanguageCode: ctx.from.language_code || null,
      touch: true
    }).catch(() => ({
      ...resolveLanguagePreferences(null),
      schemaReady: false
    }));

    ctx.interfaceLanguage = preferences.interfaceLanguage || 'en';
    ctx.defaultPostLanguage = preferences.defaultPostLanguage || 'en';
    ctx.languageSchemaReady = Boolean(preferences.schemaReady);
    await next();
  };
}
