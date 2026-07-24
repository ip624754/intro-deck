import { isDatabaseConfigured, withDbClient, withDbTransaction } from '../../db/pool.js';
import {
  getUserLanguagePreferencesByTelegramUserId,
  setUserLanguagePreference,
  upsertTelegramUser
} from '../../db/usersRepo.js';
import {
  DEFAULT_INTERFACE_LANGUAGE,
  DEFAULT_POST_LANGUAGE,
  resolveLanguagePreferences
} from '../i18n/language.js';

function unavailablePreferences(reason, persistenceEnabled = false) {
  return {
    persistenceEnabled,
    schemaReady: false,
    interfaceLanguage: DEFAULT_INTERFACE_LANGUAGE,
    defaultPostLanguage: DEFAULT_POST_LANGUAGE,
    reason
  };
}

function normalizeRepoResult(result, reason = null) {
  const preferences = resolveLanguagePreferences(result);
  return {
    persistenceEnabled: true,
    schemaReady: preferences.schemaReady,
    interfaceLanguage: preferences.interfaceLanguage,
    defaultPostLanguage: preferences.defaultPostLanguage,
    reason: reason || (preferences.schemaReady ? 'language_preferences_loaded' : 'migration_037_required')
  };
}

export async function loadUserLanguagePreferences({
  telegramUserId,
  telegramUsername = null,
  telegramLanguageCode = null,
  touch = true
}) {
  if (!isDatabaseConfigured()) {
    return unavailablePreferences('DATABASE_URL is not configured');
  }

  return withDbClient(async (client) => {
    if (touch) {
      const user = await upsertTelegramUser(client, {
        telegramUserId,
        telegramUsername,
        telegramLanguageCode
      });
      return normalizeRepoResult(user, user.language_schema_ready ? 'language_preferences_loaded' : 'migration_037_required');
    }

    const preferences = await getUserLanguagePreferencesByTelegramUserId(client, telegramUserId);
    if (!preferences) {
      return unavailablePreferences('user_not_found', true);
    }
    return normalizeRepoResult(preferences);
  });
}

export async function updateUserLanguagePreference({
  telegramUserId,
  telegramUsername = null,
  telegramLanguageCode = null,
  preferenceKey,
  language
}) {
  if (!isDatabaseConfigured()) {
    return {
      ...unavailablePreferences('DATABASE_URL is not configured'),
      changed: false,
      blocked: true
    };
  }

  return withDbTransaction(async (client) => {
    const user = await upsertTelegramUser(client, {
      telegramUserId,
      telegramUsername,
      telegramLanguageCode
    });

    if (!user.language_schema_ready) {
      return {
        ...normalizeRepoResult(user, 'migration_037_required'),
        changed: false,
        blocked: true
      };
    }

    const updated = await setUserLanguagePreference(client, {
      telegramUserId,
      preferenceKey,
      language
    });
    const preferences = normalizeRepoResult(updated, updated.changed ? 'language_preference_updated' : 'language_preference_unchanged');
    return {
      ...preferences,
      changed: Boolean(updated.changed),
      blocked: false,
      preferenceKey
    };
  });
}

export async function loadInterfaceLanguageForNotification(telegramUserId) {
  if (!telegramUserId) return DEFAULT_INTERFACE_LANGUAGE;
  const preferences = await loadUserLanguagePreferences({
    telegramUserId,
    touch: false
  }).catch(() => null);
  return preferences?.interfaceLanguage || DEFAULT_INTERFACE_LANGUAGE;
}
