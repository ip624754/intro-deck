import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  getTransactionButtons,
  getTransactionDisclosures,
  paymentSheetOpenedNotice
} from '../src/lib/telegram/transactionCopy.js';
import {
  buildContactUnlockOwnerNotification,
  buildDmRequestNotification,
  buildScheduledNewsDraftNotification
} from '../src/lib/telegram/transactionNotificationCopy.js';
import {
  renderContactUnlockDetailKeyboard,
  renderContactUnlockDetailText,
  renderDmThreadKeyboard,
  renderDmThreadText,
  renderIntroDetailKeyboard,
  renderIntroDetailText
} from '../src/lib/telegram/render.js';
import {
  renderAiNewsDraftKeyboard,
  renderAiNewsDraftText,
  renderAiNewsPublishAuthorizationKeyboard,
  renderAiNewsPublishAuthorizationText
} from '../src/lib/telegram/aiNewsRender.js';
import {
  buildSignedLinkedInLaunchTicket,
  buildSignedState,
  verifySignedLinkedInLaunchTicket,
  verifySignedState
} from '../src/lib/linkedin/oidc.js';
import { buildProfileSharePostText } from '../src/lib/linkedin/share.js';
import { renderLinkedInOAuthHtml } from '../src/lib/linkedin/oauthLanguage.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';

assert.ok(['STEP064B4C', 'STEP064B4C1'].includes(CURRENT_SOURCE_STEP));

const enButtons = getTransactionButtons('en');
const ruButtons = getTransactionButtons('ru');
assert.equal(enButtons.acceptIntro, '✅ Accept intro');
assert.equal(ruButtons.acceptIntro, '✅ Принять знакомство');
assert.equal(enButtons.authorizeAndPublishPost, '↗ Authorize and publish this post');
assert.equal(ruButtons.authorizeAndPublishPost, '↗ Авторизовать и опубликовать этот пост');
assert.match(getTransactionDisclosures('ru').requestDeliveryPayment, /не запускают автоматический возврат/);
assert.equal(paymentSheetOpenedNotice(75, 'ru'), 'Окно оплаты открыто · 75⭐');

const intro = {
  intro_request_id: 11,
  role: 'received',
  status: 'pending',
  display_name: 'Alice',
  headline_user: 'Founder',
  profile_id: 7,
  linkedin_public_url: 'https://www.linkedin.com/in/alice',
  created_at: '2026-07-24T00:00:00.000Z',
  updated_at: '2026-07-24T00:00:00.000Z'
};
assert.match(renderIntroDetailText({ persistenceEnabled: true, introRequest: intro, interfaceLanguage: 'ru' }), /Telegram username не раскрывается/);
const ruIntroButtons = renderIntroDetailKeyboard({ introRequest: intro, interfaceLanguage: 'ru' }).inline_keyboard.flat();
assert.ok(ruIntroButtons.some((button) => button.text === ruButtons.acceptIntro && button.callback_data === 'intro:acc:11'));

const contact = {
  contact_unlock_request_id: 22,
  role: 'received',
  status: 'paid_pending_approval',
  display_name: 'Bob',
  headline_user: 'Engineer',
  profile_id: 8,
  pro_covered: false,
  payment_state: 'confirmed',
  price_stars_snapshot: 75,
  requested_at: '2026-07-24T00:00:00.000Z'
};
assert.match(renderContactUnlockDetailText({ persistenceEnabled: true, request: contact, interfaceLanguage: 'ru' }), /немедленно раскроет/);
const ruContactButtons = renderContactUnlockDetailKeyboard({ request: contact, interfaceLanguage: 'ru' }).inline_keyboard.flat();
assert.ok(ruContactButtons.some((button) => button.text === ruButtons.shareTelegramContact && button.callback_data === 'cu:acc:22'));

const thread = {
  dm_thread_id: 33,
  role: 'received',
  status: 'pending_recipient',
  display_name: 'Carol',
  headline_user: 'Product lead',
  pro_covered: false,
  payment_state: 'confirmed',
  price_stars_snapshot: 100,
  first_message_text: 'User supplied message',
  created_at: '2026-07-24T00:00:00.000Z',
  messages: []
};
const ruDmText = renderDmThreadText({ persistenceEnabled: true, thread, viewerTelegramUserId: 1, interfaceLanguage: 'ru' });
assert.match(ruDmText, /приватный диалог внутри Intro Deck/);
assert.match(ruDmText, /User supplied message/, 'user-provided text must not be translated');
const ruDmButtons = renderDmThreadKeyboard({ thread, interfaceLanguage: 'ru' }).inline_keyboard.flat();
assert.ok(ruDmButtons.some((button) => button.text === ruButtons.acceptPrivateChat && button.callback_data === 'dm:acc:33'));

const draft = {
  public_token: '00000000-0000-0000-0000-000000000002',
  status: 'draft',
  source_title: 'Source title',
  source_name: 'Publisher',
  source_url: 'https://example.com/source',
  post_text: 'Exact member-approved draft text'
};
assert.match(renderAiNewsDraftText({ draft, interfaceLanguage: 'ru' }), /отдельную авторизацию LinkedIn/);
assert.match(renderAiNewsDraftText({ draft, interfaceLanguage: 'ru' }), /Exact member-approved draft text/);
assert.ok(renderAiNewsDraftKeyboard({ draft, interfaceLanguage: 'ru' }).inline_keyboard.flat().some((button) => button.text === ruButtons.approveDraftForLinkedIn));
assert.match(renderAiNewsPublishAuthorizationText({ draft, shareIntent: { visibility: 'PUBLIC' }, interfaceLanguage: 'ru' }), /ровно этот пост один раз/);
assert.ok(renderAiNewsPublishAuthorizationKeyboard({ publishUrl: 'https://example.com/oauth', draftToken: draft.public_token, interfaceLanguage: 'ru' }).inline_keyboard.flat().some((button) => button.text === ruButtons.authorizeAndPublishPost));

const contactNotification = buildContactUnlockOwnerNotification({
  requester_display_name: 'Alice',
  requester_headline_user: 'Founder',
  contact_unlock_request_id: 22
}, 'ru');
assert.match(contactNotification.text, /оплатил доставку прямого запроса Telegram-контакта/);
assert.match(JSON.stringify(contactNotification.replyMarkup), /cu:acc:22/);
const dmNotification = buildDmRequestNotification({
  initiator_display_name: 'Alice',
  first_message_text: 'Keep this exact message',
  dm_thread_id: 33
}, 'ru');
assert.match(dmNotification.text, /Keep this exact message/);
assert.match(JSON.stringify(dmNotification.replyMarkup), /dm:acc:33/);
const scheduled = buildScheduledNewsDraftNotification({
  draft_public_token: draft.public_token,
  preset_public_token: '00000000-0000-0000-0000-000000000003',
  preset_name: 'AI policy',
  source_title: 'Fresh source'
}, 'ru');
assert.match(scheduled.text, /Черновик по сохранённому поиску готов/);
assert.match(scheduled.text, /AI policy/);

const secret = 'step064b4c-smoke-secret';
const ticket = buildSignedLinkedInLaunchTicket({
  telegramUserId: 42,
  purpose: 'share_profile',
  shareIntentToken: '00000000-0000-0000-0000-000000000001',
  interfaceLanguage: 'ru',
  postLanguage: 'en',
  secret
});
const ticketPayload = verifySignedLinkedInLaunchTicket(ticket, secret);
assert.equal(ticketPayload.interfaceLanguage, 'ru');
assert.equal(ticketPayload.postLanguage, 'en');
assert.throws(() => verifySignedLinkedInLaunchTicket(`${ticket.slice(0, -1)}x`, secret), /signature/i);
const state = buildSignedState({
  telegramUserId: 42,
  purpose: 'share_profile',
  shareRequested: true,
  shareIntentToken: ticketPayload.shareIntentToken,
  interfaceLanguage: ticketPayload.interfaceLanguage,
  postLanguage: ticketPayload.postLanguage,
  ttlSeconds: 300,
  secret
});
const statePayload = verifySignedState(state, secret);
assert.equal(statePayload.interfaceLanguage, 'ru');
assert.equal(statePayload.postLanguage, 'en');
assert.throws(() => verifySignedState(`${state.slice(0, -1)}x`, secret), /signature/i);

const profile = {
  display_name: 'Иван Петров',
  headline_user: 'Founder',
  company_user: 'Example',
  industry_user: 'Technology',
  about_user: 'Builds reliable systems.',
  linkedin_public_url: 'https://www.linkedin.com/in/example'
};
const enPost = buildProfileSharePostText({ profileSnapshot: profile, postLanguage: 'en' });
const ruPost = buildProfileSharePostText({ profileSnapshot: profile, postLanguage: 'ru' });
assert.match(enPost, /I’ve published my professional profile/);
assert.match(ruPost, /Я опубликовал/);
assert.match(enPost, /Иван Петров/);
assert.match(ruPost, /Иван Петров/);
assert.notEqual(enPost, ruPost);

const ruHtml = renderLinkedInOAuthHtml({ interfaceLanguage: 'ru', title: 'Готово', body: '<h1>Готово</h1>' });
assert.match(ruHtml, /<html lang="ru">/);
assert.match(ruHtml, /<title>Готово<\/title>/);

const startSource = readFileSync(new URL('../api/oauth/start/linkedin.js', import.meta.url), 'utf8');
for (const token of ['verifySignedLinkedInLaunchTicket', 'loadUserLanguagePreferences', 'interfaceLanguage', 'postLanguage', 'buildSignedState']) assert.match(startSource, new RegExp(token));
assert.doesNotMatch(startSource, /searchParams\.get\(['"](?:lang|language|interface_language|post_language)/i, 'unsigned query language must not control OAuth rendering');
const callbackSource = readFileSync(new URL('../api/oauth/callback/linkedin.js', import.meta.url), 'utf8');
for (const token of ['statePayload.interfaceLanguage', 'transferPayload.interfaceLanguage', 'renderLinkedInShareResultPage', 'loadInterfaceLanguageForNotification']) assert.match(callbackSource, new RegExp(token.replaceAll('.', '\\.')));
const notificationSource = readFileSync(new URL('../src/lib/storage/notificationStore.js', import.meta.url), 'utf8');
assert.match(notificationSource, /payloadJson\?\.interfaceLanguage/);
assert.match(notificationSource, /interfaceLanguage:\s*envelope\.interfaceLanguage/);
const scheduledSource = readFileSync(new URL('../src/lib/storage/aiNewsPresetStore.js', import.meta.url), 'utf8');
assert.match(scheduledSource, /detail_json\?\.interfaceLanguage/);
const presetRepoSource = readFileSync(new URL('../src/db/aiNewsPresetRepo.js', import.meta.url), 'utf8');
assert.match(presetRepoSource, /detail_json=coalesce\(detail_json/);
const shareComposerSource = readFileSync(new URL('../src/bot/composers/linkedinShareComposer.js', import.meta.url), 'utf8');
assert.match(shareComposerSource, /postLanguage:\s*ctx\.defaultPostLanguage/);

const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
for (const token of [
  'stored_interface_language_plus_signed_oauth_snapshot',
  'users_default_post_language',
  'recipient_preference_with_retry_snapshot',
  'stateSnapshotSigned',
  'replayAndIdempotencyChanged: false'
]) assert.match(healthSource, new RegExp(token));
assert.equal(readdirSync(new URL('../migrations/', import.meta.url)).some((name) => /^038_/i.test(name)), false, 'STEP064B4C must not add migration 038');

console.log('OK: STEP064B4C transaction, notification and OAuth language boundary');
