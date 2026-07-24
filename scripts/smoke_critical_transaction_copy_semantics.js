import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import {
  renderContactUnlockDetailKeyboard,
  renderContactUnlockDetailText,
  renderDmThreadKeyboard,
  renderDmThreadText,
  renderIntroDetailKeyboard,
  renderIntroDetailText,
  renderIntroInboxKeyboard,
  renderLinkedInSharePreviewKeyboard,
  renderLinkedInSharePreviewText,
  renderPricingKeyboard
} from '../src/lib/telegram/render.js';
import {
  renderAiNewsDraftKeyboard,
  renderAiNewsDraftText,
  renderAiNewsPublishAuthorizationKeyboard,
  renderAiNewsPublishAuthorizationText
} from '../src/lib/telegram/aiNewsRender.js';
import {
  TRANSACTION_BUTTONS,
  TRANSACTION_DISCLOSURES,
  payPrivateChatDeliveryButton,
  paymentSheetOpenedNotice
} from '../src/lib/telegram/transactionCopy.js';
import {
  formatContactUnlockDecisionReason,
  formatDmDecisionReason,
  formatDmRequestReason,
  formatIntroDecisionReason
} from '../src/bot/utils/notices.js';

assert.ok(['STEP064B2', 'STEP064B3', 'STEP064B4A', 'STEP064B4B', 'STEP064B4C', 'STEP064B4C1', 'STEP064B4D1', 'STEP064B4D1A', 'STEP064B4D2', 'STEP064B4D2A', 'STEP065A1'].includes(CURRENT_SOURCE_STEP));

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
const introText = renderIntroDetailText({ persistenceEnabled: true, introRequest: intro });
assert.match(introText, /lets the requester open your public LinkedIn URL/i);
assert.match(introText, /does not reveal your Telegram username/i);
const introButtons = renderIntroDetailKeyboard({ introRequest: intro }).inline_keyboard.flat();
assert.ok(introButtons.some((button) => button.text === TRANSACTION_BUTTONS.acceptIntro && button.callback_data === 'intro:acc:11'));
assert.ok(introButtons.some((button) => button.text === TRANSACTION_BUTTONS.declineIntro && button.callback_data === 'intro:dec:11'));

const inboxButtons = renderIntroInboxKeyboard({ inboxState: { received: [intro], sent: [] }, contactUnlockInbox: { received: [], sent: [] } }).inline_keyboard.flat();
assert.ok(inboxButtons.some((button) => button.text === TRANSACTION_BUTTONS.acceptIntro && button.callback_data === 'intro:acc:11'));

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
const contactText = renderContactUnlockDetailText({ persistenceEnabled: true, request: contact });
assert.match(contactText, /immediately reveals your hidden Telegram username/i);
assert.match(contactText, /Payment covers delivery/i);
const contactButtons = renderContactUnlockDetailKeyboard({ request: contact }).inline_keyboard.flat();
assert.ok(contactButtons.some((button) => button.text === TRANSACTION_BUTTONS.shareTelegramContact && button.callback_data === 'cu:acc:22'));
assert.ok(contactButtons.some((button) => button.text === TRANSACTION_BUTTONS.declineTelegramContact && button.callback_data === 'cu:dec:22'));

const thread = {
  dm_thread_id: 33,
  role: 'received',
  status: 'pending_recipient',
  display_name: 'Carol',
  headline_user: 'Product lead',
  pro_covered: false,
  payment_state: 'confirmed',
  price_stars_snapshot: 100,
  first_message_text: 'Can we discuss the product?',
  created_at: '2026-07-24T00:00:00.000Z',
  messages: []
};
const dmText = renderDmThreadText({ persistenceEnabled: true, thread, viewerTelegramUserId: 1 });
assert.match(dmText, /opens a private conversation inside Intro Deck/i);
assert.match(dmText, /does not reveal your Telegram username/i);
const dmButtons = renderDmThreadKeyboard({ thread }).inline_keyboard.flat();
assert.ok(dmButtons.some((button) => button.text === TRANSACTION_BUTTONS.acceptPrivateChat && button.callback_data === 'dm:acc:33'));
assert.ok(dmButtons.some((button) => button.text === TRANSACTION_BUTTONS.declinePrivateChat && button.callback_data === 'dm:dec:33'));
assert.ok(dmButtons.some((button) => button.text === TRANSACTION_BUTTONS.blockRequester && button.callback_data === 'dm:blk:33'));
assert.ok(dmButtons.some((button) => button.text === TRANSACTION_BUTTONS.reportAndBlock && button.callback_data === 'dm:rpt:33'));

const paymentThreadButtons = renderDmThreadKeyboard({ thread: { ...thread, role: 'sent', status: 'payment_pending' } }).inline_keyboard.flat();
assert.ok(paymentThreadButtons.some((button) => button.text === '⭐ Pay 100⭐ and send request' && button.callback_data === 'dm:pay:33'));
assert.equal(payPrivateChatDeliveryButton(), '⭐ Pay and send request');
assert.equal(paymentSheetOpenedNotice(75), 'Payment sheet opened · 75⭐');

const profileShareText = renderLinkedInSharePreviewText({ intent: { post_text: 'Exact post', visibility: 'PUBLIC' } });
assert.match(profileShareText, /Nothing is published yet/);
assert.match(profileShareText, /publish exactly this post once/i);
const profileShareButtons = renderLinkedInSharePreviewKeyboard({ publishUrl: 'https://example.com/oauth', publicToken: '00000000-0000-0000-0000-000000000001' }).inline_keyboard.flat();
assert.ok(profileShareButtons.some((button) => button.text === TRANSACTION_BUTTONS.authorizeAndPublishPost));
assert.ok(profileShareButtons.some((button) => button.text === TRANSACTION_BUTTONS.cancelLinkedInShare));

const draft = { public_token: '00000000-0000-0000-0000-000000000002', status: 'draft', source_title: 'Source', source_name: 'Publisher', source_url: 'https://example.com', post_text: 'Draft text' };
assert.match(renderAiNewsDraftText({ draft }), /only prepares a separate LinkedIn authorization/i);
const draftButtons = renderAiNewsDraftKeyboard({ draft }).inline_keyboard.flat();
assert.ok(draftButtons.some((button) => button.text === TRANSACTION_BUTTONS.approveDraftForLinkedIn));
assert.ok(draftButtons.some((button) => button.text === TRANSACTION_BUTTONS.cancelDraft));
const authText = renderAiNewsPublishAuthorizationText({ draft, shareIntent: { visibility: 'PUBLIC' } });
assert.match(authText, /publish exactly this post once/i);
const authButtons = renderAiNewsPublishAuthorizationKeyboard({ publishUrl: 'https://example.com/oauth', draftToken: draft.public_token }).inline_keyboard.flat();
assert.ok(authButtons.some((button) => button.text === TRANSACTION_BUTTONS.authorizeAndPublishPost));

const proButtons = renderPricingKeyboard({ pricingState: { persistenceEnabled: true, pricing: { proMonthlyPriceStars: 149 }, subscriptionConfig: { proMonthlyDurationDays: 30 } } }).inline_keyboard.flat();
assert.ok(proButtons.some((button) => button.text === '⭐ Buy 30 days of Pro · 149⭐' && button.callback_data === 'plans:buy:pro'));

assert.match(formatIntroDecisionReason('intro_request_already_accepted'), /button is no longer active/i);
assert.match(formatContactUnlockDecisionReason('contact_unlock_already_revealed'), /already shared/i);
assert.match(formatDmDecisionReason('dm_thread_already_active'), /button is no longer active/i);
assert.match(formatDmRequestReason('dm_checkout_authorization_missing_or_expired'), /payment request expired/i);

for (const file of [
  '../src/lib/telegram/render.js',
  '../src/lib/telegram/aiNewsRender.js',
  '../src/lib/storage/contactUnlockStore.js',
  '../src/lib/storage/dmStore.js'
]) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /text: '✅ (?:Approve|Accept)'/);
  assert.doesNotMatch(source, /text: '❌ Decline'/);
}

const contactComposer = fs.readFileSync(new URL('../src/bot/composers/contactUnlockComposer.js', import.meta.url), 'utf8');
const dmComposer = fs.readFileSync(new URL('../src/bot/composers/dmComposer.js', import.meta.url), 'utf8');
for (const source of [contactComposer, dmComposer]) {
  assert.match(source, /Payment confirmed/);
  assert.match(source, /Do not pay again/);
}

assert.match(TRANSACTION_DISCLOSURES.requestDeliveryPayment, /does not trigger an automatic refund/i);
console.log('OK: STEP064B2 critical transaction copy and CTA semantics');
