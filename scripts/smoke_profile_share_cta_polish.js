import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import { buildProfileSharePostText } from '../src/lib/linkedin/share.js';
import { renderLanguageSettingsKeyboard } from '../src/lib/telegram/render.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(['STEP064B4D2A', 'STEP065A1'].includes(CURRENT_SOURCE_STEP));
assert.ok(['0.65.1', '0.66.0'].includes(packageJson.version));

const profile = {
  profile_id: 2,
  industry_user: 'Software Development',
  skills: [{ skill_label: 'Crypto' }, { skill_label: 'Development' }, { skill_label: 'Founder' }, { skill_label: 'Growth' }]
};

const enPost = buildProfileSharePostText({ profileSnapshot: profile, botUsername: 'introdeckbot', postLanguage: 'en' });
assert.equal(enPost.split('\n\n').length, 2);
const [enFirst, enSecond] = enPost.split('\n\n');
assert.equal(enFirst, 'Open my Intro Deck profile → https://t.me/introdeckbot?start=profile_2');
assert.match(enSecond, /^Professional networking built around permission, not open access to private contacts\. My focus: Crypto, Development, Founder\.$/);
assert.ok(enPost.length < 320);

const ruPost = buildProfileSharePostText({ profileSnapshot: profile, botUsername: 'introdeckbot', postLanguage: 'ru' });
const [ruFirst, ruSecond] = ruPost.split('\n\n');
assert.equal(ruFirst, 'Открыть мой профиль в Intro Deck → https://t.me/introdeckbot?start=profile_2');
assert.match(ruSecond, /^Профессиональные знакомства с согласия владельца профиля, а не открытый доступ к приватным контактам\. Мой фокус: Crypto, Development, Founder\.$/);
assert.ok(ruPost.length < 340);

const enKeyboard = renderLanguageSettingsKeyboard({
  preferences: { interfaceLanguage: 'en', defaultPostLanguage: 'ru' },
  persistenceEnabled: true,
  schemaReady: true
});
const labels = enKeyboard.inline_keyboard.flat().map((b) => b.text);
assert.ok(labels.includes('✅ Interface: English'));
assert.ok(labels.includes('▫️ Interface: Russian'));
assert.ok(labels.includes('▫️ Post language: English'));
assert.ok(labels.includes('✅ Post language: Russian'));
assert.equal(labels.some((t) => /\bUI:|\bPosts:/.test(t)), false);

const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
for (const token of [
  "ordinaryProfileTemplate: 'cta_first_permission_focus'",
  "aboveFoldTarget: 'cta_first_two_paragraph_compact'",
  "ctaPosition: 'first_line'",
  "englishLanguageSettingLabels: 'interface_and_post_language'"
]) assert.ok(healthSource.includes(token));

console.log('OK: STEP064B4D2A CTA-first profile share and English settings labels');
