import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import { buildProfileSharePostText } from '../src/lib/linkedin/share.js';
import { renderLinkedInSharePreviewText } from '../src/lib/telegram/render.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(CURRENT_SOURCE_STEP, 'STEP064B4D1');
assert.equal(packageJson.version, '0.64.8');

const profile = {
  display_name: 'Rustam Lukmanov',
  headline_user: 'Product & Systems Builder | AI-assisted development, Telegram products and Web3 infrastructure',
  company_user: 'CogniForge',
  industry_user: 'Software Development',
  about_user: 'I build practical digital products at the intersection of AI, Telegram, professional networking and Web3. I value product clarity, mechanism honesty, simple engineering and systems that can actually be shipped and operated.',
  profile_id: 2,
  skills: [
    { skill_label: 'Crypto' },
    { skill_label: 'Development' },
    { skill_label: 'Founder' }
  ]
};

const enPost = buildProfileSharePostText({ profileSnapshot: profile, botUsername: 'introdeckbot', postLanguage: 'en' });
assert.match(enPost, /Most professional directories optimize for reach\. Intro Deck optimizes for permission\./);
assert.match(enPost, /I’ve published my professional profile there\./);
assert.match(enPost, /Rustam Lukmanov/);
assert.match(enPost, /Company: CogniForge/);
assert.match(enPost, /Focus: Crypto, Development, Founder/);
assert.match(enPost, /I build practical digital products at the intersection of AI, Telegram, professional networking and Web3\./);
assert.match(enPost, /Open my profile and request an intro: https:\/\/t\.me\/introdeckbot\?start=profile_2/);
assert.match(enPost, /Private contact details remain hidden until I approve a request\./);

const ruPost = buildProfileSharePostText({ profileSnapshot: profile, botUsername: 'introdeckbot', postLanguage: 'ru' });
assert.match(ruPost, /Большинство профессиональных каталогов оптимизируют охват\. Intro Deck оптимизирует согласие\./);
assert.match(ruPost, /Я опубликовал здесь свой профессиональный профиль\./);
assert.match(ruPost, /Компания: CogniForge/);
assert.match(ruPost, /Фокус: Crypto, Development, Founder/);
assert.match(ruPost, /Открыть мой профиль и запросить связь: https:\/\/t\.me\/introdeckbot\?start=profile_2/);
assert.match(ruPost, /Приватные контакты остаются скрытыми, пока я сам не одобрю запрос\./);
assert.ok(enPost.length <= 3000);
assert.ok(ruPost.length <= 3000);
assert.notEqual(enPost, ruPost);

const preview = renderLinkedInSharePreviewText({ intent: { post_text: ruPost, visibility: 'PUBLIC' }, interfaceLanguage: 'ru' });
assert.match(preview, /——— Предпросмотр публикации LinkedIn ———/);
assert.match(preview, /Большинство профессиональных каталогов оптимизируют охват/);
assert.match(preview, /Пока ничего не опубликовано\./);

const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
for (const token of [
  'profileShareEditorialPolicy',
  'hook_identity_summary_audience_permission_cta',
  'previewMatchesPublishedPost: true',
  'imageAttachmentIncluded: false'
]) assert.match(healthSource, new RegExp(token.replaceAll('.', '\\.')));

console.log('OK: STEP064B4D1 profile share editorial upgrade');
