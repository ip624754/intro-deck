import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import { buildProfileSharePostText } from '../src/lib/linkedin/share.js';
import { renderLinkedInSharePreviewText } from '../src/lib/telegram/render.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(['STEP064B4D1', 'STEP064B4D1A', 'STEP064B4D2', 'STEP064B4D2A', 'STEP065A1'].includes(CURRENT_SOURCE_STEP));
assert.ok(['0.64.8', '0.64.9', '0.65.0', '0.65.1', '0.66.0'].includes(packageJson.version));

const profile = {
  display_name: 'Rustam Lukmanov',
  headline_user: 'Product & Systems Builder',
  company_user: 'CogniForge',
  industry_user: 'Software Development',
  about_user: 'I build practical digital products.',
  profile_id: 2,
  skills: [
    { skill_label: 'Crypto' },
    { skill_label: 'Development' },
    { skill_label: 'Founder' }
  ]
};

const enPost = buildProfileSharePostText({ profileSnapshot: profile, botUsername: 'introdeckbot', postLanguage: 'en' });
const ruPost = buildProfileSharePostText({ profileSnapshot: profile, botUsername: 'introdeckbot', postLanguage: 'ru' });
assert.match(enPost, /Intro Deck/);
assert.match(enPost, /permission/i);
assert.match(enPost, /https:\/\/t\.me\/introdeckbot\?start=profile_2/);
assert.match(ruPost, /Intro Deck/);
assert.match(ruPost, /соглас/i);
assert.match(ruPost, /https:\/\/t\.me\/introdeckbot\?start=profile_2/);
assert.ok(enPost.length <= 3000);
assert.ok(ruPost.length <= 3000);
assert.notEqual(enPost, ruPost);

const preview = renderLinkedInSharePreviewText({ intent: { post_text: ruPost, visibility: 'PUBLIC' }, interfaceLanguage: 'ru' });
assert.match(preview, /——— Предпросмотр публикации LinkedIn ———/);
assert.match(preview, /Пока ничего не опубликовано\./);
assert.match(preview, new RegExp(ruPost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
assert.match(healthSource, /profileShareEditorialPolicy/);
assert.match(healthSource, /previewMatchesPublishedPost: true/);
assert.match(healthSource, /imageAttachmentIncluded: true/);

console.log('OK: STEP064B4D1 profile share editorial corridor');
