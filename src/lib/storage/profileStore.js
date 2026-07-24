import { withDbClient, isDatabaseConfigured } from '../../db/pool.js';
import { upsertTelegramUser } from '../../db/usersRepo.js';
import { getProfileSnapshotByTelegramUserId } from '../../db/profileRepo.js';
import { resolveLanguagePreferences } from '../i18n/language.js';

export async function touchTelegramUserAndLoadProfile({
  telegramUserId,
  telegramUsername = null,
  telegramLanguageCode = null
}) {
  if (!isDatabaseConfigured()) {
    return {
      persistenceEnabled: false,
      user: null,
      profile: null,
      languagePreferences: resolveLanguagePreferences(null),
      reason: 'DATABASE_URL is not configured'
    };
  }

  return withDbClient(async (client) => {
    const user = await upsertTelegramUser(client, {
      telegramUserId,
      telegramUsername,
      telegramLanguageCode
    });

    const profile = await getProfileSnapshotByTelegramUserId(client, telegramUserId);

    return {
      persistenceEnabled: true,
      user,
      profile,
      languagePreferences: resolveLanguagePreferences(user),
      reason: profile ? 'profile_loaded' : 'profile_not_found'
    };
  });
}
