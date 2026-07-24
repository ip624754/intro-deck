import { getSchemaCompat } from './schemaCompat.js';
import {
  inferInterfaceLanguageFromTelegramLocale,
  normalizeDefaultPostLanguage,
  normalizeInterfaceLanguage
} from '../lib/i18n/language.js';

const PREFERENCE_COLUMNS = Object.freeze({
  interface_language: 'interface_language',
  default_post_language: 'default_post_language'
});

export async function upsertTelegramUser(client, {
  telegramUserId,
  telegramUsername = null,
  telegramLanguageCode = null
}) {
  const compat = await getSchemaCompat(client);

  if (compat.userLanguageContractReady) {
    const initialLanguage = inferInterfaceLanguageFromTelegramLocale(telegramLanguageCode);
    const result = await client.query(
      `
        insert into users (
          telegram_user_id,
          telegram_username,
          interface_language,
          default_post_language
        )
        values ($1, $2, $3, $3)
        on conflict (telegram_user_id)
        do update set
          telegram_username = excluded.telegram_username,
          last_seen_at = now()
        returning
          id,
          telegram_user_id,
          telegram_username,
          first_seen_at,
          last_seen_at,
          interface_language,
          default_post_language,
          true as language_schema_ready,
          (xmax = 0) as inserted
      `,
      [telegramUserId, telegramUsername, initialLanguage]
    );

    return result.rows[0];
  }

  const result = await client.query(
    `
      insert into users (telegram_user_id, telegram_username)
      values ($1, $2)
      on conflict (telegram_user_id)
      do update set
        telegram_username = excluded.telegram_username,
        last_seen_at = now()
      returning
        id,
        telegram_user_id,
        telegram_username,
        first_seen_at,
        last_seen_at,
        'en'::text as interface_language,
        'en'::text as default_post_language,
        false as language_schema_ready,
        (xmax = 0) as inserted
    `,
    [telegramUserId, telegramUsername]
  );

  return result.rows[0];
}

export async function getUserLanguagePreferencesByTelegramUserId(client, telegramUserId) {
  const compat = await getSchemaCompat(client);
  if (!compat.userLanguageContractReady) {
    const existing = await client.query(
      `select id from users where telegram_user_id = $1 limit 1`,
      [telegramUserId]
    );
    if (!existing.rows[0]) return null;
    return {
      interface_language: 'en',
      default_post_language: 'en',
      language_schema_ready: false
    };
  }

  const result = await client.query(
    `
      select
        interface_language,
        default_post_language,
        true as language_schema_ready
      from users
      where telegram_user_id = $1
      limit 1
    `,
    [telegramUserId]
  );
  return result.rows[0] || null;
}

export async function setUserLanguagePreference(client, {
  telegramUserId,
  preferenceKey,
  language
}) {
  const column = PREFERENCE_COLUMNS[preferenceKey];
  if (!column) {
    throw new Error(`Unsupported language preference key: ${preferenceKey}`);
  }

  const compat = await getSchemaCompat(client);
  if (!compat.userLanguageContractReady) {
    return {
      changed: false,
      interface_language: 'en',
      default_post_language: 'en',
      language_schema_ready: false,
      reason: 'migration_037_required'
    };
  }

  const normalizedLanguage = column === 'interface_language'
    ? normalizeInterfaceLanguage(language)
    : normalizeDefaultPostLanguage(language);

  const updated = await client.query(
    `
      update users
      set ${column} = $2,
          last_seen_at = now()
      where telegram_user_id = $1
        and ${column} is distinct from $2
      returning
        interface_language,
        default_post_language,
        true as language_schema_ready,
        true as changed
    `,
    [telegramUserId, normalizedLanguage]
  );

  if (updated.rows[0]) {
    return updated.rows[0];
  }

  const current = await getUserLanguagePreferencesByTelegramUserId(client, telegramUserId);
  if (!current) {
    throw new Error('User not found for language preference update');
  }
  return {
    ...current,
    changed: false
  };
}
