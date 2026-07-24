import { normalizeInterfaceLanguage } from '../i18n/language.js';

const TRANSACTION_COPY = Object.freeze({
  en: Object.freeze({
    buttons: Object.freeze({
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
    }),
    disclosures: Object.freeze({
      introAcceptance: 'Accepting this intro lets the requester open your public LinkedIn URL if you added one. It does not reveal your Telegram username or open a private chat.',
      telegramContactAcceptance: 'Sharing approves this request and immediately reveals your hidden Telegram username to the requester.',
      privateChatAcceptance: 'Accepting opens a private conversation inside Intro Deck. It does not reveal your Telegram username.',
      requestDeliveryPayment: 'Payment covers delivery of this permission request. The recipient still decides whether to accept. Approval or a reply is not guaranteed, and decline or no reply does not trigger an automatic refund.',
      draftApproval: 'Approving the draft only prepares a separate LinkedIn authorization. It does not publish the post.',
      linkedinAuthorization: 'Opening LinkedIn starts the final authorization. If you approve it there, Intro Deck will publish exactly this post once.'
    })
  }),
  ru: Object.freeze({
    buttons: Object.freeze({
      acceptIntro: '✅ Принять знакомство',
      declineIntro: '❌ Отклонить знакомство',
      shareTelegramContact: '✅ Открыть Telegram-контакт',
      declineTelegramContact: '❌ Отклонить запрос контакта',
      openSharedLinkedIn: '🔗 Открыть переданный LinkedIn',
      openTelegramContact: '🔓 Открыть Telegram-контакт',
      acceptPrivateChat: '✅ Принять запрос в чат',
      declinePrivateChat: '❌ Отклонить запрос в чат',
      blockRequester: '⛔ Заблокировать отправителя',
      reportAndBlock: '🚩 Пожаловаться и заблокировать',
      approveDraftForLinkedIn: '✅ Подтвердить черновик для LinkedIn',
      cancelDraft: '🗑 Отменить черновик',
      authorizeAndPublishPost: '↗ Авторизовать и опубликовать этот пост',
      cancelLinkedInShare: '✖️ Отменить публикацию'
    }),
    disclosures: Object.freeze({
      introAcceptance: 'Принятие знакомства позволит отправителю открыть вашу публичную ссылку LinkedIn, если вы её добавили. Telegram username не раскрывается, и приватный чат не открывается.',
      telegramContactAcceptance: 'Одобрение запроса немедленно раскроет отправителю ваш скрытый Telegram username.',
      privateChatAcceptance: 'Принятие запроса откроет приватный диалог внутри Intro Deck. Ваш Telegram username не раскрывается.',
      requestDeliveryPayment: 'Оплата покрывает доставку запроса на согласие. Решение по-прежнему принимает получатель. Одобрение или ответ не гарантируются, а отказ или отсутствие ответа не запускают автоматический возврат.',
      draftApproval: 'Подтверждение черновика только подготовит отдельную авторизацию LinkedIn. Публикации ещё не будет.',
      linkedinAuthorization: 'Открытие LinkedIn запускает финальную авторизацию. Если вы подтвердите действие там, Intro Deck опубликует ровно этот пост один раз.'
    })
  })
});

export const TRANSACTION_BUTTONS = TRANSACTION_COPY.en.buttons;
export const TRANSACTION_DISCLOSURES = TRANSACTION_COPY.en.disclosures;

export function getTransactionButtons(interfaceLanguage = 'en') {
  return TRANSACTION_COPY[normalizeInterfaceLanguage(interfaceLanguage)].buttons;
}

export function getTransactionDisclosures(interfaceLanguage = 'en') {
  return TRANSACTION_COPY[normalizeInterfaceLanguage(interfaceLanguage)].disclosures;
}

export function payPrivateChatDeliveryButton(amountStars = null, interfaceLanguage = 'en') {
  const amount = Number(amountStars);
  const russian = normalizeInterfaceLanguage(interfaceLanguage) === 'ru';
  if (Number.isFinite(amount) && amount > 0) {
    return russian ? `⭐ Оплатить ${amount}⭐ и отправить запрос` : `⭐ Pay ${amount}⭐ and send request`;
  }
  return russian ? '⭐ Оплатить и отправить запрос' : '⭐ Pay and send request';
}

export function paymentSheetOpenedNotice(amountStars = null, interfaceLanguage = 'en') {
  const amount = Number(amountStars);
  const russian = normalizeInterfaceLanguage(interfaceLanguage) === 'ru';
  if (Number.isFinite(amount) && amount > 0) {
    return russian ? `Окно оплаты открыто · ${amount}⭐` : `Payment sheet opened · ${amount}⭐`;
  }
  return russian ? 'Окно оплаты открыто' : 'Payment sheet opened';
}
