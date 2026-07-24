export const TRANSACTION_BUTTONS = Object.freeze({
  acceptIntro: '✅ Accept intro',
  declineIntro: '❌ Decline intro',
  shareTelegramContact: '✅ Share Telegram contact',
  declineTelegramContact: '❌ Decline contact request',
  openSharedLinkedIn: '🔗 Open shared LinkedIn',
  openTelegramContact: '🔓 Open Telegram contact',
  acceptPrivateChat: '✅ Accept chat request',
  declinePrivateChat: '❌ Decline chat request',
  blockRequester: '⛔ Block requester',
  reportAndBlock: '🚩 Report and block',
  approveDraftForLinkedIn: '✅ Approve draft for LinkedIn',
  cancelDraft: '🗑 Cancel draft',
  authorizeAndPublishPost: '↗ Authorize and publish this post',
  cancelLinkedInShare: '✖️ Cancel share'
});

export const TRANSACTION_DISCLOSURES = Object.freeze({
  introAcceptance: 'Accepting this intro lets the requester open your public LinkedIn URL if you added one. It does not reveal your Telegram username or open a private chat.',
  telegramContactAcceptance: 'Sharing approves this request and immediately reveals your hidden Telegram username to the requester.',
  privateChatAcceptance: 'Accepting opens a private conversation inside Intro Deck. It does not reveal your Telegram username.',
  requestDeliveryPayment: 'Payment covers delivery of this permission request. The recipient still decides whether to accept. Approval or a reply is not guaranteed, and decline or no reply does not trigger an automatic refund.',
  draftApproval: 'Approving the draft only prepares a separate LinkedIn authorization. It does not publish the post.',
  linkedinAuthorization: 'Opening LinkedIn starts the final authorization. If you approve it there, Intro Deck will publish exactly this post once.'
});

export function payPrivateChatDeliveryButton(amountStars = null) {
  const amount = Number(amountStars);
  return Number.isFinite(amount) && amount > 0
    ? `⭐ Pay ${amount}⭐ and send request`
    : '⭐ Pay and send request';
}

export function paymentSheetOpenedNotice(amountStars = null) {
  const amount = Number(amountStars);
  return Number.isFinite(amount) && amount > 0
    ? `Payment sheet opened · ${amount}⭐`
    : 'Payment sheet opened';
}
