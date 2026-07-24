import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import {
  renderLanguageSettingsKeyboard,
  renderProfilePreviewText
} from '../src/lib/telegram/render.js';
import {
  buildLinkedInShareResultMessage,
  renderLinkedInShareResultPage
} from '../api/oauth/callback/linkedin.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(CURRENT_SOURCE_STEP, 'STEP064B4C1');
assert.equal(packageJson.version, '0.64.7');

const ruPreferences = {
  interfaceLanguage: 'ru',
  defaultPostLanguage: 'en'
};
const ruKeyboard = renderLanguageSettingsKeyboard({
  preferences: ruPreferences,
  persistenceEnabled: true,
  schemaReady: true
});
const ruButtonTexts = ruKeyboard.inline_keyboard.flat().map((button) => button.text);
const ruCallbackData = ruKeyboard.inline_keyboard.flat().map((button) => button.callback_data);

assert.deepEqual(ruCallbackData, [
  'lang:interface:en',
  'lang:interface:ru',
  'lang:post:en',
  'lang:post:ru',
  'home:root'
]);
assert.ok(ruButtonTexts.includes('▫️ Интерфейс: Английский'));
assert.ok(ruButtonTexts.includes('✅ Интерфейс: Русский'));
assert.ok(ruButtonTexts.includes('✅ Публикации: Английский'));
assert.ok(ruButtonTexts.includes('▫️ Публикации: Русский'));
assert.equal(ruButtonTexts.some((text) => /\b(?:UI|Post):/.test(text)), false);

const enKeyboard = renderLanguageSettingsKeyboard({
  preferences: { interfaceLanguage: 'en', defaultPostLanguage: 'ru' },
  persistenceEnabled: true,
  schemaReady: true
});
const enButtonTexts = enKeyboard.inline_keyboard.flat().map((button) => button.text);
assert.ok(enButtonTexts.includes('✅ UI: English'));
assert.ok(enButtonTexts.includes('▫️ UI: Russian'));
assert.ok(enButtonTexts.includes('▫️ Posts: English'));
assert.ok(enButtonTexts.includes('✅ Posts: Russian'));

const profileSnapshot = {
  linkedin_sub: 'member-1',
  display_name: 'Rustam Lukmanov',
  headline_user: 'Product builder',
  company_user: null,
  city_user: null,
  industry_user: 'Software Development',
  about_user: 'User-authored English profile content.',
  skills: [],
  telegram_username_hidden: null,
  contact_mode: 'intro_request',
  visibility_status: 'listed'
};
const ruProfile = renderProfilePreviewText({
  profileSnapshot,
  persistenceEnabled: true,
  interfaceLanguage: 'ru'
});
assert.match(ruProfile, /Имя пользователя Telegram: не указан/);
assert.match(ruProfile, /Режим контакта: Только запросы через Intro Deck/);
assert.doesNotMatch(ruProfile, /Username Telegram|not set|Intro requests only/);
assert.match(ruProfile, /User-authored English profile content\./, 'user content must remain unchanged');

const enProfile = renderProfilePreviewText({
  profileSnapshot,
  persistenceEnabled: true,
  interfaceLanguage: 'en'
});
assert.match(enProfile, /Telegram username: not set/);
assert.match(enProfile, /Contact mode: Intro requests only/);

const result = {
  published: true,
  provider: { postId: 'urn:li:share:123' },
  intent: { source_kind: 'profile_share' }
};
const ruReceipt = buildLinkedInShareResultMessage(result, 'ru');
assert.match(ruReceipt, /ID публикации: urn:li:share:123/);
assert.doesNotMatch(ruReceipt, /Post ID:/);
assert.match(ruReceipt, /urn:li:share:123/, 'raw provider identifier must remain unchanged');

const enReceipt = buildLinkedInShareResultMessage(result, 'en');
assert.match(enReceipt, /Post ID: urn:li:share:123/);

const ruPage = renderLinkedInShareResultPage(result, 'ru');
assert.match(ruPage, /<html lang="ru">/);
assert.match(ruPage, /ID публикации: <code>urn:li:share:123<\/code>/);
assert.doesNotMatch(ruPage, />Post ID:/);

const unknownResult = {
  outcomeUnknown: true,
  provider: { postId: 'urn:li:share:456' },
  intent: { source_kind: 'profile_share' }
};
const ruUnknown = buildLinkedInShareResultMessage(unknownResult, 'ru');
assert.match(ruUnknown, /LinkedIn вернул ID публикации/);
assert.match(ruUnknown, /ID публикации провайдера: urn:li:share:456/);
assert.doesNotMatch(ruUnknown, /Provider post ID|Post ID/);

console.log('OK: STEP064B4C1 member mixed-language copy polish');
