import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  inferInterfaceLanguageFromTelegramLocale,
  normalizeDefaultPostLanguage,
  normalizeInterfaceLanguage,
  resolveLanguagePreferences
} from '../src/lib/i18n/language.js';
import {
  renderHelpKeyboard,
  renderHelpText,
  renderHomeKeyboard,
  renderHomeText,
  renderLanguageSettingsKeyboard,
  renderLanguageSettingsText,
  renderProfileMenuKeyboard,
  renderProfileMenuText,
  renderProfilePreviewKeyboard,
  renderProfilePreviewText
} from '../src/lib/telegram/render.js';
import { setUserLanguagePreference, upsertTelegramUser } from '../src/db/usersRepo.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';

assert.ok(['STEP064B4A', 'STEP064B4B', 'STEP064B4C', 'STEP064B4C1', 'STEP064B4D1', 'STEP064B4D1A', 'STEP064B4D2', 'STEP064B4D2A', 'STEP065A1', 'STEP065A2'].includes(CURRENT_SOURCE_STEP));
assert.equal(inferInterfaceLanguageFromTelegramLocale('ru'), 'ru');
assert.equal(inferInterfaceLanguageFromTelegramLocale('ru-RU'), 'ru');
assert.equal(inferInterfaceLanguageFromTelegramLocale('en-GB'), 'en');
assert.equal(normalizeInterfaceLanguage('unexpected'), 'en');
assert.equal(normalizeDefaultPostLanguage('RU'), 'ru');
assert.deepEqual(resolveLanguagePreferences({ interface_language: 'ru', default_post_language: 'en', language_schema_ready: true }), {
  interfaceLanguage: 'ru',
  defaultPostLanguage: 'en',
  schemaReady: true
});

const profile = {
  linkedin_sub: 'member-1',
  linkedin_name: 'Test Member',
  display_name: 'Test Member',
  visibility_status: 'hidden',
  profile_state: 'active',
  headline_user: 'Founder',
  industry_user: 'Technology',
  about_user: 'Builds products.',
  skills: [{ skill_slug: 'founder', skill_label: 'Founder' }],
  completion: {
    fields: [
      { key: 'dn', filled: true, value: 'Test Member' },
      { key: 'hl', filled: true, value: 'Founder' },
      { key: 'in', filled: true, value: 'Technology' },
      { key: 'ab', filled: true, value: 'Builds products.' }
    ],
    hasRequiredSkills: true
  }
};

const ruHome = renderHomeText({ profileSnapshot: profile, persistenceEnabled: true, interfaceLanguage: 'ru' });
assert.match(ruHome, /Находите профессионалов/);
assert.match(ruHome, /Профиль:/);
assert.doesNotMatch(ruHome, /Find professionals/);
const enHome = renderHomeText({ profileSnapshot: profile, persistenceEnabled: true, interfaceLanguage: 'en' });
assert.match(enHome, /Find professionals/);

const ruHomeKeyboard = JSON.stringify(renderHomeKeyboard({
  appBaseUrl: 'https://example.com',
  telegramUserId: 42,
  profileSnapshot: profile,
  persistenceEnabled: true,
  interfaceLanguage: 'ru'
}).inline_keyboard);
for (const callback of ['p:menu', 'dir:list:0', 'contact:inbox', 'plans:root', 'invite:root', 'help:root', 'lang:root']) {
  assert.match(ruHomeKeyboard, new RegExp(callback.replaceAll(':', '\\:')));
}
assert.match(ruHomeKeyboard, /Главная|Язык|Помощь/);

const ruHelp = renderHelpText({ aiNewsVisible: true, interfaceLanguage: 'ru' });
assert.match(ruHelp, /Как начать/);
assert.match(ruHelp, /Поиск инфоповодов/);
const helpKeyboard = JSON.stringify(renderHelpKeyboard({ aiNewsVisible: true, interfaceLanguage: 'ru' }).inline_keyboard);
assert.match(helpKeyboard, /lang:root/);
assert.match(helpKeyboard, /home:root/);

const ruProfile = renderProfileMenuText({ profileSnapshot: profile, persistenceEnabled: true, interfaceLanguage: 'ru' });
assert.match(ruProfile, /Нужно для публикации/);
assert.match(ruProfile, /Статус:/);
const profileKeyboard = JSON.stringify(renderProfileMenuKeyboard({
  profileSnapshot: profile,
  persistenceEnabled: true,
  interfaceLanguage: 'ru'
}).inline_keyboard);
assert.match(profileKeyboard, /lang:root/);
assert.match(profileKeyboard, /p:ed:dn/);

const ruPreview = renderProfilePreviewText({ profileSnapshot: profile, persistenceEnabled: true, interfaceLanguage: 'ru' });
assert.match(ruPreview, /Предпросмотр профиля/);
assert.match(ruPreview, /Компания:/);
const previewKeyboard = JSON.stringify(renderProfilePreviewKeyboard({
  profileSnapshot: profile,
  persistenceEnabled: true,
  interfaceLanguage: 'ru'
}).inline_keyboard);
assert.match(previewKeyboard, /p:menu/);
assert.match(previewKeyboard, /home:root/);

const settings = renderLanguageSettingsText({
  preferences: { interfaceLanguage: 'ru', defaultPostLanguage: 'en', schemaReady: true },
  persistenceEnabled: true,
  schemaReady: true
});
assert.match(settings, /Язык интерфейса: Русский/);
assert.match(settings, /Язык публикаций: English/);
assert.match(settings, /Обычная публикация профиля использует выбранный язык публикаций/);
const settingsKeyboard = JSON.stringify(renderLanguageSettingsKeyboard({
  preferences: { interfaceLanguage: 'ru', defaultPostLanguage: 'en', schemaReady: true },
  persistenceEnabled: true,
  schemaReady: true
}).inline_keyboard);
for (const callback of ['lang:interface:en', 'lang:interface:ru', 'lang:post:en', 'lang:post:ru']) {
  assert.match(settingsKeyboard, new RegExp(callback.replaceAll(':', '\\:')));
}

const compatRow = {
  users_has_language_columns: true,
  users_has_interface_language_constraint: true,
  users_has_default_post_language_constraint: true
};
const upsertQueries = [];
const upsertClient = {
  async query(sql, params = []) {
    upsertQueries.push({ sql, params });
    if (String(sql).includes('information_schema.columns')) return { rows: [compatRow] };
    if (String(sql).includes('insert into users')) {
      return { rows: [{ id: 1, telegram_user_id: 42, interface_language: params[2], default_post_language: params[2], language_schema_ready: true, inserted: true }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  }
};
const seeded = await upsertTelegramUser(upsertClient, { telegramUserId: 42, telegramLanguageCode: 'ru-RU' });
assert.equal(seeded.interface_language, 'ru');
assert.equal(seeded.default_post_language, 'ru');
assert.match(upsertQueries[1].sql, /on conflict \(telegram_user_id\)/i);
assert.doesNotMatch(upsertQueries[1].sql, /interface_language\s*=\s*excluded/i, 'existing preferences must not be reseeded');

const updateQueries = [];
const updateClient = {
  async query(sql, params = []) {
    updateQueries.push({ sql, params });
    if (String(sql).includes('information_schema.columns')) return { rows: [compatRow] };
    if (String(sql).includes('update users')) {
      return { rows: [{ interface_language: 'ru', default_post_language: 'en', language_schema_ready: true, changed: true }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  }
};
const updated = await setUserLanguagePreference(updateClient, {
  telegramUserId: 42,
  preferenceKey: 'default_post_language',
  language: 'en'
});
assert.equal(updated.changed, true);
assert.match(updateQueries[1].sql, /default_post_language/);
assert.doesNotMatch(updateQueries[1].sql, /interface_language\s*=/, 'post language update must not mutate interface language');


const missingCompatRow = {
  users_has_language_columns: false,
  users_has_interface_language_constraint: false,
  users_has_default_post_language_constraint: false
};
const legacyQueries = [];
const legacyClient = {
  async query(sql, params = []) {
    legacyQueries.push({ sql, params });
    if (String(sql).includes('information_schema.columns')) return { rows: [missingCompatRow] };
    if (String(sql).includes('insert into users')) {
      return { rows: [{ id: 2, telegram_user_id: 43, interface_language: 'en', default_post_language: 'en', language_schema_ready: false, inserted: true }] };
    }
    throw new Error(`Unexpected legacy query: ${sql}`);
  }
};
const legacyUser = await upsertTelegramUser(legacyClient, { telegramUserId: 43, telegramLanguageCode: 'ru' });
assert.equal(legacyUser.interface_language, 'en');
assert.equal(legacyUser.default_post_language, 'en');
assert.equal(legacyUser.language_schema_ready, false);
assert.doesNotMatch(legacyQueries[1].sql.split(/returning/i)[0], /interface_language/i, 'legacy insert must not reference missing columns');

const blockedClient = {
  async query(sql) {
    if (String(sql).includes('information_schema.columns')) return { rows: [missingCompatRow] };
    throw new Error(`Unexpected blocked query: ${sql}`);
  }
};
const blockedUpdate = await setUserLanguagePreference(blockedClient, {
  telegramUserId: 43,
  preferenceKey: 'interface_language',
  language: 'ru'
});
assert.equal(blockedUpdate.changed, false);
assert.equal(blockedUpdate.language_schema_ready, false);
assert.equal(blockedUpdate.reason, 'migration_037_required');

const migration = readFileSync(new URL('../migrations/037_interface_language_boundary.sql', import.meta.url), 'utf8');
for (const token of [
  'ADD COLUMN IF NOT EXISTS interface_language',
  'ADD COLUMN IF NOT EXISTS default_post_language',
  'users_interface_language_check',
  'users_default_post_language_check',
  "DEFAULT 'en'"
]) {
  assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}
assert.doesNotMatch(migration, /alter table ai_news_/i, 'migration 037 must not mutate AI/news language tables');
assert.doesNotMatch(migration, /alter table linkedin_share_/i, 'migration 037 must not mutate LinkedIn publisher tables');

const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
for (const token of ['interfaceLanguagePolicy', 'postLanguagePolicy', 'migration_037', 'first_seen_only', 'independentFromInterfaceLanguage']) {
  assert.match(healthSource, new RegExp(token));
}
const languageComposerSource = readFileSync(new URL('../src/bot/composers/languageComposer.js', import.meta.url), 'utf8');
for (const callback of ['lang:root', 'lang:(interface|post):(en|ru)']) assert.match(languageComposerSource, new RegExp(callback.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));


const homeComposerSource = readFileSync(new URL('../src/bot/composers/homeComposer.js', import.meta.url), 'utf8');
assert.match(homeComposerSource, /createLanguageComposer/);
assert.match(homeComposerSource, /buildLanguageSettingsSurface/);

const aiNewsRepoSource = readFileSync(new URL('../src/db/aiNewsRepo.js', import.meta.url), 'utf8');
assert.match(aiNewsRepoSource, /post_language/);
const aiNewsRenderSource = readFileSync(new URL('../src/lib/telegram/aiNewsRender.js', import.meta.url), 'utf8');
assert.match(aiNewsRenderSource, /news:lang:\$\{p\.post_language === 'ru' \? 'en' : 'ru'\}/);
const aiNewsComposerSource = readFileSync(new URL('../src/bot/composers/aiNewsComposer.js', import.meta.url), 'utf8');
assert.match(aiNewsComposerSource, /news:lang:\(en\|ru\)/);

console.log('OK: STEP064B4A interface language boundary foundation');
