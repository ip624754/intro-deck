import { readFileSync } from 'node:fs';
import {
  renderHelpKeyboard,
  renderHomeKeyboard,
  renderInviteCardKeyboard,
  buildInviteMediaCard,
  buildInlineInviteResult,
  renderInviteKeyboard,
  renderInviteHistoryKeyboard,
  renderInviteHistoryText,
  renderInviteLinkText,
  renderInvitePerformanceKeyboard,
  renderInvitePerformanceText,
  renderInviteText,
  renderInvitePublicCaption,
  renderInlineInviteCaption,
  renderInlineInviteShareText
} from '../src/lib/telegram/render.js';
import { buildInviteCodeFromTelegramUserId, buildInviteLink, buildInviteStartParam, parseInviteStartParam } from '../src/db/inviteRepo.js';

const inviteComposerSource = readFileSync(new URL('../src/bot/composers/inviteComposer.js', import.meta.url), 'utf8');
const createBotSource = readFileSync(new URL('../src/bot/createBot.js', import.meta.url), 'utf8');
const appSurfacesSource = readFileSync(new URL('../src/bot/surfaces/appSurfaces.js', import.meta.url), 'utf8');
const renderSource = readFileSync(new URL('../src/lib/telegram/render.js', import.meta.url), 'utf8');

for (const token of ["composer.command('invite'", "composer.callbackQuery('invite:root'", 'invite:(?:perf|activity)', 'composer.inlineQuery(', 'replyWithPhoto']) {
  if (!inviteComposerSource.includes(token)) throw new Error(`Invite composer missing token: ${token}`);
}
for (const token of ['createInviteComposer', 'buildInvitePerformanceSurface', 'buildInviteHistorySurface']) {
  if (!createBotSource.includes(token)) throw new Error(`Missing invite module wiring: ${token}`);
}
for (const token of ['buildInviteMediaCard', 'intro-deck-og-1200x630.jpg']) {
  if (!appSurfacesSource.includes(token)) throw new Error(`Invite surfaces missing canonical media-card token: ${token}`);
}
for (const token of ['photo_file_id', 'thumbnail_url', 'renderInvitePublicCaption', 'buildInviteMediaCard']) {
  if (!renderSource.includes(token)) throw new Error(`Invite renderer missing token: ${token}`);
}

const inviteCode = buildInviteCodeFromTelegramUserId(123456789);
const rawStart = buildInviteStartParam({ inviteCode, source: 'raw_link' });
const inlineStart = buildInviteStartParam({ inviteCode, source: 'inline_share' });
const cardStart = buildInviteStartParam({ inviteCode, source: 'invite_card' });
if (!rawStart?.startsWith('il_') || !inlineStart?.startsWith('ii_') || !cardStart?.startsWith('ic_')) {
  throw new Error('Invite start-param prefixes must differentiate source paths');
}
const parsed = parseInviteStartParam(inlineStart);
if (!parsed || parsed.source !== 'inline_share' || String(parsed.referrerTelegramUserId) !== '123456789') {
  throw new Error('Invite start-param parsing must recover source and telegram user id');
}

const rawUrl = buildInviteLink({ botUsername: 'introdeckbot', inviteCode, source: 'raw_link' });
const inlineUrl = buildInviteLink({ botUsername: 'introdeckbot', inviteCode, source: 'inline_share' });
const cardUrl = buildInviteLink({ botUsername: 'introdeckbot', inviteCode, source: 'invite_card' });

const inviteState = {
  persistenceEnabled: true,
  inviteCode,
  inviteLink: rawUrl,
  inlineInviteLink: inlineUrl,
  inviteCardLink: cardUrl,
  shareInlineQuery: 'invite',
  invitedCount: 2,
  activatedCount: 1,
  inlineShareCount: 1,
  rawLinkCount: 0,
  inviteCardCount: 1,
  joined7d: 2,
  activated7d: 1,
  rewardsSummary: { mode: 'earn_only', pendingPoints: 10, availablePoints: 0, redeemedPoints: 0 },
  invited: [{ displayName: 'Alice', headlineUser: 'Founder', joinedAt: '2026-04-10T10:00:00Z', source: 'inline_share', status: 'activated' }]
};

const inviteText = renderInviteText({ inviteState });
for (const token of ['Invite people', 'Share your personal Intro Deck invite', 'Activity and rewards are tracked automatically']) {
  if (!inviteText.includes(token)) throw new Error(`Invite root text missing ${token}`);
}
if (inviteText.includes('Open next') || inviteText.includes('Invite & rewards')) {
  throw new Error('Invite root must not retain the old dense navigation copy');
}

const inviteKeyboard = JSON.stringify(renderInviteKeyboard({ inviteState }).inline_keyboard);
for (const token of ['switch_inline_query', 'invite:show_link', 'invite:send_card', 'invite:activity', 'invite:points']) {
  if (!inviteKeyboard.includes(token)) throw new Error(`Invite keyboard missing ${token}`);
}
for (const forbidden of ['invite:hist:1', '🔄 Refresh']) {
  if (inviteKeyboard.includes(forbidden)) throw new Error(`Invite root keyboard must not expose ${forbidden}`);
}

const offKeyboard = JSON.stringify(renderInviteKeyboard({ inviteState: { ...inviteState, rewardsSummary: { mode: 'off' } } }).inline_keyboard);
if (offKeyboard.includes('invite:points')) throw new Error('Points entry must be hidden when rewards mode is off');

const perfText = renderInvitePerformanceText({ inviteState });
for (const token of ['Invite activity', 'By source', 'Last 7 days', 'Recent activity']) {
  if (!perfText.includes(token)) throw new Error(`Invite activity text missing ${token}`);
}
const perfKeyboard = JSON.stringify(renderInvitePerformanceKeyboard({ inviteState }).inline_keyboard);
for (const token of ['invite:hist:1', 'invite:root', 'invite:points']) {
  if (!perfKeyboard.includes(token)) throw new Error(`Invite activity keyboard missing ${token}`);
}

const historyText = renderInviteHistoryText({
  inviteState,
  historyState: { totalCount: 1, page: 1, totalPages: 1, startIndex: 0, endIndex: 1, items: inviteState.invited }
});
if (!historyText.includes('History window') || !historyText.includes('Contacts')) throw new Error('Invite history must retain paged history');
const historyKeyboard = JSON.stringify(renderInviteHistoryKeyboard({
  inviteState,
  historyState: { page: 1, hasPrev: false, hasNext: true }
}).inline_keyboard);
for (const token of ['invite:activity', 'invite:hist:2', 'invite:root', 'invite:points']) {
  if (!historyKeyboard.includes(token)) throw new Error(`Invite history keyboard missing ${token}`);
}

const publicCaption = renderInvitePublicCaption();
for (const token of ['Discover professionals and connect by permission in Telegram.', 'LinkedIn-connected identity', 'only after approval']) {
  if (!publicCaption.includes(token)) throw new Error(`Public invite caption missing ${token}`);
}
if (publicCaption.includes('Join Intro Deck') || publicCaption.includes('https://')) {
  throw new Error('Public caption must not duplicate the single CTA with a text anchor');
}
if (renderInlineInviteCaption({ inviteState }) !== publicCaption || renderInlineInviteShareText({ inviteState }) !== publicCaption) {
  throw new Error('Inline caption and text fallback must use the canonical public caption');
}

const cardKeyboard = JSON.stringify(renderInviteCardKeyboard({ inviteState }).inline_keyboard);
if (!cardKeyboard.includes('Open Intro Deck') || !cardKeyboard.includes('ic_')) {
  throw new Error('Forwarding card must preserve invite_card attribution in the single CTA');
}
for (const forbidden of ['callback_data', 'invite:root', 'invite:points', 'home:root']) {
  if (cardKeyboard.includes(forbidden)) throw new Error(`Public invite card must not expose ${forbidden}`);
}

const inlineMedia = buildInviteMediaCard({ inviteState, shareMode: 'inline' });
const forwardingMedia = buildInviteMediaCard({ inviteState, shareMode: 'forwarding' });
if (inlineMedia.caption !== forwardingMedia.caption) throw new Error('Inline and forwarding cards must share one caption renderer');
if (!inlineMedia.inviteUrl.includes('ii_') || !forwardingMedia.inviteUrl.includes('ic_')) {
  throw new Error('Canonical media cards must preserve source-specific attribution links');
}

const photoUrlResult = buildInlineInviteResult({ inviteState: { ...inviteState, invitePhotoUrl: 'https://example.com/assets/social/intro-deck-og-1200x630.jpg' } });
if (photoUrlResult.type !== 'photo' || photoUrlResult.photo_url !== 'https://example.com/assets/social/intro-deck-og-1200x630.jpg') {
  throw new Error('Inline invite result must emit URL photo card');
}
if (!JSON.stringify(photoUrlResult.reply_markup).includes('ii_')) throw new Error('Inline photo CTA must use inline_share attribution');

const cachedPhotoResult = buildInlineInviteResult({ inviteState: { ...inviteState, invitePhotoFileId: 'AgACAgIAAxkBAAIBQ2aFakePhotoFileId' } });
if (cachedPhotoResult.type !== 'photo' || cachedPhotoResult.photo_file_id !== 'AgACAgIAAxkBAAIBQ2aFakePhotoFileId') {
  throw new Error('Inline invite result must support cached Telegram photo');
}

const fallbackArticleResult = buildInlineInviteResult({ inviteState });
if (fallbackArticleResult.type !== 'article' || fallbackArticleResult.input_message_content?.message_text !== publicCaption) {
  throw new Error('Article fallback must preserve the canonical public caption');
}
if (!JSON.stringify(fallbackArticleResult.reply_markup).includes('Open Intro Deck')) throw new Error('Article fallback must retain the single CTA');

const inviteLinkText = renderInviteLinkText({ inviteState });
if (!inviteLinkText.includes(rawUrl)) throw new Error('Invite link text must show raw attributed link');

const homeKeyboard = JSON.stringify(renderHomeKeyboard({
  appBaseUrl: 'https://example.com', telegramUserId: 1, persistenceEnabled: true,
  profileSnapshot: { linkedin_sub: 'abc', completion: { isReady: true } }
}).inline_keyboard);
if (!homeKeyboard.includes('invite:root')) throw new Error('Home keyboard must expose invite entrypoint');
const helpKeyboard = JSON.stringify(renderHelpKeyboard().inline_keyboard);
if (!helpKeyboard.includes('invite:root')) throw new Error('Help keyboard must expose invite entrypoint');

console.log('OK: invite conversion contract');
