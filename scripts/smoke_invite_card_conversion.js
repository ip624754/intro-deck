import { readFileSync } from 'node:fs';
import {
  buildInviteMediaCard,
  buildInlineInviteResult,
  renderInviteCardKeyboard,
  renderInviteKeyboard,
  renderInvitePublicCaption
} from '../src/lib/telegram/render.js';

const composerSource = readFileSync(new URL('../src/bot/composers/inviteComposer.js', import.meta.url), 'utf8');
const surfacesSource = readFileSync(new URL('../src/bot/surfaces/appSurfaces.js', import.meta.url), 'utf8');
const renderSource = readFileSync(new URL('../src/lib/telegram/render.js', import.meta.url), 'utf8');

const state = {
  persistenceEnabled: true,
  inviteLink: 'https://t.me/introdeckbot?start=il_DEMO',
  inlineInviteLink: 'https://t.me/introdeckbot?start=ii_DEMO',
  inviteCardLink: 'https://t.me/introdeckbot?start=ic_DEMO',
  shareInlineQuery: 'invite',
  invitePhotoUrl: 'https://intro-deck.vercel.app/assets/social/intro-deck-og-1200x630.jpg'
};

const caption = renderInvitePublicCaption();
if (caption.includes('Join Intro Deck') || caption.includes('https://')) {
  throw new Error('Public invite caption must carry value copy only, not a duplicate text link');
}
for (const token of ['Discover professionals', 'LinkedIn-connected identity', 'after approval']) {
  if (!caption.includes(token)) throw new Error(`Public invite caption missing ${token}`);
}

const publicKeyboard = renderInviteCardKeyboard({ inviteState: state }).inline_keyboard;
if (publicKeyboard.length !== 1 || publicKeyboard[0].length !== 1) {
  throw new Error('Public invite card must have exactly one CTA');
}
const publicButton = publicKeyboard[0][0];
if (publicButton.text !== 'Open Intro Deck' || publicButton.url !== state.inviteCardLink || publicButton.callback_data) {
  throw new Error('Public invite CTA must open the attributed invite_card deep link only');
}

const inlineMedia = buildInviteMediaCard({ inviteState: state, shareMode: 'inline' });
const forwardingMedia = buildInviteMediaCard({ inviteState: state, shareMode: 'forwarding' });
if (inlineMedia.caption !== forwardingMedia.caption || inlineMedia.photoUrl !== forwardingMedia.photoUrl) {
  throw new Error('Inline and forwarding flows must use one canonical media card renderer');
}
if (!inlineMedia.inviteUrl.includes('ii_DEMO') || !forwardingMedia.inviteUrl.includes('ic_DEMO')) {
  throw new Error('Canonical renderer must preserve source-specific attribution');
}

const inlineResult = buildInlineInviteResult({ inviteState: state });
if (inlineResult.type !== 'photo' || inlineResult.caption !== caption) {
  throw new Error('Inline share must produce the canonical photo card');
}
if (!JSON.stringify(inlineResult.reply_markup).includes('ii_DEMO')) {
  throw new Error('Inline share CTA must preserve inline_share attribution');
}

for (const token of ['buildInviteMediaCard', "shareMode: 'forwarding'"]) {
  if (!surfacesSource.includes(token)) throw new Error(`Forwarding surface missing ${token}`);
}
for (const token of ['replyWithPhoto', 'forwarding photo card failed; using text fallback']) {
  if (!composerSource.includes(token)) throw new Error(`Forwarding delivery missing ${token}`);
}
for (const token of ['renderInvitePublicCaption', 'buildInviteMediaCard']) {
  if (!renderSource.includes(token)) throw new Error(`Renderer missing canonical card token ${token}`);
}

const offKeyboard = JSON.stringify(renderInviteKeyboard({ inviteState: { ...state, rewardsSummary: { mode: 'off' } } }).inline_keyboard);
const earnOnlyKeyboard = JSON.stringify(renderInviteKeyboard({ inviteState: { ...state, rewardsSummary: { mode: 'earn_only' } } }).inline_keyboard);
const liveKeyboard = JSON.stringify(renderInviteKeyboard({ inviteState: { ...state, rewardsSummary: { mode: 'live' } } }).inline_keyboard);
const pausedKeyboard = JSON.stringify(renderInviteKeyboard({ inviteState: { ...state, rewardsSummary: { mode: 'paused' } } }).inline_keyboard);
if (offKeyboard.includes('invite:points')) throw new Error('Points must be hidden when rewards are off');
if (!earnOnlyKeyboard.includes('Points preview') || !liveKeyboard.includes('🎯 Points') || !pausedKeyboard.includes('Points paused')) {
  throw new Error('Points entry must reflect rewards mode');
}
for (const forbidden of ['invite:hist:1', '🔄 Refresh']) {
  if (liveKeyboard.includes(forbidden)) throw new Error(`Invite root must not expose ${forbidden}`);
}

console.log('OK: STEP064A invite card conversion and menu simplification');
