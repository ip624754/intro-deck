import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import { buildProfileSharePostText } from '../src/lib/linkedin/share.js';
import { renderLinkedInSharePreviewText } from '../src/lib/telegram/render.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(['STEP064B4D1A', 'STEP064B4D2'].includes(CURRENT_SOURCE_STEP));
assert.ok(['0.64.9', '0.65.0'].includes(packageJson.version));

const profile = {
  display_name: 'Rustam Lukmanov',
  headline_user: 'Product & Systems Builder',
  company_user: 'CogniForge',
  industry_user: 'Software Development',
  about_user: 'This long user-provided summary must not expand the compact ordinary share.',
  profile_id: 2,
  skills: [
    { skill_label: 'Crypto' },
    { skill_label: 'Development' },
    { skill_label: 'Founder' },
    { skill_label: 'Growth' }
  ]
};

const enPost = buildProfileSharePostText({ profileSnapshot: profile, botUsername: '@introdeckbot', postLanguage: 'en' });
assert.equal(enPost.split('\n\n').length, 2);
assert.match(enPost, /^Intro Deck is professional networking built around permission, not open access to private contacts\./);
assert.match(enPost, /My focus: Crypto, Development, Founder\./);
assert.match(enPost, /Open my profile and request an intro → https:\/\/t\.me\/introdeckbot\?start=profile_2$/);
assert.doesNotMatch(enPost, /Rustam Lukmanov|Product & Systems Builder|CogniForge|Growth|This long user-provided summary/);
assert.doesNotMatch(enPost, /🚀|🔥|✨|📣|🤝/);
assert.ok(enPost.length < 320, `English compact post is too long: ${enPost.length}`);

const ruPost = buildProfileSharePostText({ profileSnapshot: profile, botUsername: 'introdeckbot', postLanguage: 'ru' });
assert.equal(ruPost.split('\n\n').length, 2);
assert.match(ruPost, /^Intro Deck — профессиональные знакомства с согласия владельца профиля, а не открытые контакты\./);
assert.match(ruPost, /Мой фокус: Crypto, Development, Founder\./);
assert.match(ruPost, /Открыть профиль и запросить знакомство → https:\/\/t\.me\/introdeckbot\?start=profile_2$/);
assert.doesNotMatch(ruPost, /Rustam Lukmanov|Product & Systems Builder|CogniForge|Growth|This long user-provided summary/);
assert.doesNotMatch(ruPost, /🚀|🔥|✨|📣|🤝/);
assert.ok(ruPost.length < 340, `Russian compact post is too long: ${ruPost.length}`);

const noSkills = buildProfileSharePostText({
  profileSnapshot: { profile_id: 3, industry_user: 'FinTech', skills: [] },
  botUsername: 'introdeckbot',
  postLanguage: 'en'
});
assert.match(noSkills, /I work in FinTech\./);

const fallback = buildProfileSharePostText({
  profileSnapshot: { profile_id: 4, skills: [] },
  botUsername: 'introdeckbot',
  postLanguage: 'ru'
});
assert.match(fallback, /Открыт к релевантным профессиональным знакомствам\./);

const preview = renderLinkedInSharePreviewText({ intent: { post_text: enPost, visibility: 'PUBLIC' }, interfaceLanguage: 'ru' });
assert.match(preview, new RegExp(enPost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
for (const token of [
  "ordinaryProfileTemplate: 'compact_permission_focus_cta'",
  "aboveFoldTarget: 'two_paragraph_compact'",
  'identityDuplicationInsidePost: false',
  'focusLabelLimit: 3',
  "emojiPolicy: 'none_arrow_only'",
  'publisherChanged: true'
]) assert.match(healthSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

console.log('OK: STEP064B4D1A compact above-the-fold profile share');
