import { normalizeInterfaceLanguage } from '../i18n/language.js';
import { getTransactionButtons, getTransactionDisclosures } from './transactionCopy.js';

function isRu(language) {
  return normalizeInterfaceLanguage(language) === 'ru';
}

export function buildContactUnlockOwnerNotification(request, interfaceLanguage = 'en') {
  const ru = isRu(interfaceLanguage);
  const buttons = getTransactionButtons(interfaceLanguage);
  const disclosures = getTransactionDisclosures(interfaceLanguage);
  const member = request?.requester_display_name || (ru ? 'Участник' : 'A member');
  return {
    text: [
      ru ? '🔐 Новый запрос Telegram-контакта' : '🔐 New Telegram contact request',
      '',
      request?.pro_covered
        ? (ru ? `${member} использовал Pro для отправки прямого запроса Telegram-контакта.` : `${member} used Pro to send a direct Telegram contact request.`)
        : (ru ? `${member} оплатил доставку прямого запроса Telegram-контакта.` : `${member} paid to deliver a direct Telegram contact request.`),
      request?.requester_headline_user ? `${ru ? 'Заголовок' : 'Headline'}: ${request.requester_headline_user}` : null,
      '',
      disclosures.telegramContactAcceptance
    ].filter(Boolean).join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [
          { text: buttons.shareTelegramContact, callback_data: `cu:acc:${request?.contact_unlock_request_id}` },
          { text: buttons.declineTelegramContact, callback_data: `cu:dec:${request?.contact_unlock_request_id}` }
        ],
        [{ text: ru ? '🧾 Открыть запрос' : '🧾 Open request', callback_data: `cu:view:${request?.contact_unlock_request_id}` }]
      ]
    }
  };
}

export function buildContactUnlockRequesterPaidNotification(request, interfaceLanguage = 'en') {
  const ru = isRu(interfaceLanguage);
  const target = request?.target_display_name || (ru ? 'этого участника' : 'this member');
  return {
    text: [
      request?.pro_covered
        ? (ru ? '⭐ Запрос Telegram-контакта отправлен через Pro' : '⭐ Telegram contact request sent via Pro')
        : (ru ? '⭐ Запрос Telegram-контакта доставлен' : '⭐ Telegram contact request delivered'),
      '',
      ru ? `Ваш запрос для ${target} ожидает одобрения.` : `Your request for ${target} is now waiting for approval.`,
      request?.pro_covered
        ? (ru ? 'Лимит Pro покрывает только доставку запроса. Получатель сам решает, раскрывать ли контакт. Одобрение не гарантируется.' : 'Your Pro allowance covers request delivery only. The recipient still decides whether to reveal contact. Approval is not guaranteed.')
        : (ru ? 'Оплата покрывает только доставку запроса. Получатель сам решает, раскрывать ли контакт. Одобрение не гарантируется, а отказ сам по себе не запускает автоматический возврат.' : 'The fee pays for request delivery only. The recipient still decides whether to reveal contact. Approval is not guaranteed, and decline alone does not trigger an automatic refund.')
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: ru ? '🧾 Открыть запрос' : '🧾 View request', callback_data: `cu:view:${request?.contact_unlock_request_id}` }],
        [{ text: ru ? '📥 Входящие' : '📥 Inbox', callback_data: 'intro:inbox' }]
      ]
    }
  };
}

export function buildContactUnlockRequesterRevealNotification(request, interfaceLanguage = 'en') {
  const ru = isRu(interfaceLanguage);
  const buttons = getTransactionButtons(interfaceLanguage);
  const username = String(request?.revealed_contact_value || '').trim().replace(/^@+/, '');
  return {
    text: [
      ru ? '✅ Telegram-контакт одобрен' : '✅ Telegram contact approved',
      '',
      `${ru ? 'Telegram username' : 'Telegram username'}: @${username}`,
      ru
        ? 'Откройте Telegram-контакт ниже. Это одобрение не открывает чат внутри Intro Deck.'
        : 'Open Telegram contact below. This approval does not open a chat inside Intro Deck.'
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: buttons.openTelegramContact, url: `https://t.me/${username}` }],
        [{ text: ru ? '🧾 Открыть запрос' : '🧾 View request', callback_data: `cu:view:${request?.contact_unlock_request_id}` }]
      ]
    }
  };
}

export function buildContactUnlockRequesterDeclineNotification(request, interfaceLanguage = 'en') {
  const ru = isRu(interfaceLanguage);
  const member = request?.display_name || (ru ? 'Участник' : 'This member');
  return {
    text: [
      ru ? 'ℹ️ Запрос Telegram-контакта отклонён' : 'ℹ️ Telegram contact request declined',
      '',
      ru ? `${member} отклонил ваш запрос Telegram-контакта.` : `${member} declined your Telegram contact request.`,
      ru
        ? 'Telegram username не был раскрыт. Отказ не запускает автоматический возврат оплаты за доставку запроса.'
        : 'No Telegram username was revealed. A decline does not trigger an automatic refund of the request-delivery fee.'
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: ru ? '🧾 Открыть запрос' : '🧾 View request', callback_data: `cu:view:${request?.contact_unlock_request_id}` }],
        [{ text: ru ? '📥 Входящие' : '📥 Inbox', callback_data: 'intro:inbox' }]
      ]
    }
  };
}

export function buildDmRequestNotification(envelope, interfaceLanguage = 'en') {
  const ru = isRu(interfaceLanguage);
  const buttons = getTransactionButtons(interfaceLanguage);
  const disclosures = getTransactionDisclosures(interfaceLanguage);
  const member = envelope?.initiator_display_name || (ru ? 'Участник' : 'A member');
  return {
    text: [
      ru ? '💬 Новый запрос в приватный чат' : '💬 New private-chat request',
      '',
      ru ? `${member} хочет написать вам через Intro Deck.` : `${member} wants to message you through Intro Deck.`,
      envelope?.initiator_headline_user ? `${ru ? 'Заголовок' : 'Headline'}: ${envelope.initiator_headline_user}` : null,
      '',
      `${ru ? 'Сообщение' : 'Message'}: ${envelope?.first_message_text || ''}`,
      '',
      disclosures.privateChatAcceptance
    ].filter(Boolean).join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [
          { text: buttons.acceptPrivateChat, callback_data: `dm:acc:${envelope?.dm_thread_id}` },
          { text: buttons.declinePrivateChat, callback_data: `dm:dec:${envelope?.dm_thread_id}` }
        ],
        [
          { text: buttons.blockRequester, callback_data: `dm:blk:${envelope?.dm_thread_id}` },
          { text: buttons.reportAndBlock, callback_data: `dm:rpt:${envelope?.dm_thread_id}` }
        ],
        [{ text: ru ? '🧾 Открыть запрос' : '🧾 Open request', callback_data: `dm:view:${envelope?.dm_thread_id}` }]
      ]
    }
  };
}

export function buildDmDecisionNotification(thread, reason, interfaceLanguage = 'en') {
  const ru = isRu(interfaceLanguage);
  const member = thread?.display_name || (ru ? 'Этот участник' : 'This member');
  const lines = [ru ? '💬 Статус запроса в приватный чат' : '💬 Private-chat request update', ''];
  if (reason === 'dm_thread_accepted') {
    lines.push(ru ? `${member} принял ваш запрос в чат.` : `${member} accepted your chat request.`);
    lines.push(ru ? 'Диалог теперь активен внутри бота.' : 'The conversation is now active inside the bot.');
  } else if (reason === 'dm_thread_declined') {
    lines.push(ru ? `${member} отклонил ваш запрос в чат.` : `${member} declined your chat request.`);
    lines.push(ru ? 'Диалог не был открыт. Отказ не запускает автоматический возврат оплаты за доставку запроса.' : 'No active conversation was opened. A decline does not trigger an automatic refund of the request-delivery fee.');
  } else if (reason === 'dm_thread_reported') {
    lines.push(ru ? 'На ваш запрос в приватный чат пожаловались, и этот путь связи заблокирован.' : 'Your private-chat request was reported and blocked.');
  } else {
    lines.push(ru ? 'Ваш запрос в приватный чат был заблокирован.' : 'Your private-chat request was blocked.');
  }
  return {
    text: lines.join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: ru ? '🧾 Открыть диалог' : '🧾 View thread', callback_data: `dm:view:${thread?.dm_thread_id}` }],
        [{ text: ru ? '💬 Приватные чаты' : '💬 Private chats', callback_data: 'dm:inbox' }]
      ]
    }
  };
}

export function buildDmMessageNotification({ thread, messageText, interfaceLanguage = 'en' }) {
  const ru = isRu(interfaceLanguage);
  const member = thread?.display_name || (ru ? 'Участник' : 'A member');
  return {
    text: [
      ru ? '💬 Новое сообщение' : '💬 New DM message',
      '',
      ru ? `${member} отправил новое сообщение:` : `${member} sent a new message:`,
      '',
      messageText
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: ru ? '🧾 Открыть диалог' : '🧾 Open thread', callback_data: `dm:view:${thread?.dm_thread_id}` }],
        [{ text: ru ? '💬 Приватные чаты' : '💬 Private chats', callback_data: 'dm:inbox' }]
      ]
    }
  };
}

export function buildScheduledNewsDraftNotification(envelope, interfaceLanguage = 'en') {
  const ru = isRu(interfaceLanguage);
  return {
    text: [
      ru ? '🧠 Черновик по сохранённому поиску готов' : '🧠 Scheduled news draft ready',
      '',
      `${ru ? 'Пресет' : 'Preset'}: ${envelope?.preset_name || '—'}`,
      `${ru ? 'Источник' : 'Source'}: ${envelope?.source_title || (ru ? 'Свежий источник' : 'Fresh news source')}`,
      envelope?.source_name || envelope?.source_domain || '',
      '',
      ru
        ? 'Ничего не опубликовано. Откройте черновик, чтобы проверить, отредактировать или отдельно подтвердить одну публикацию LinkedIn.'
        : 'Nothing was published. Open the draft to review, edit, or explicitly approve one LinkedIn post.'
    ].filter(Boolean).join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: ru ? '📝 Проверить черновик' : '📝 Review draft', callback_data: `news:draft:${envelope?.draft_public_token}` }],
        [{ text: ru ? '⚙️ Настройки пресета' : '⚙️ Preset settings', callback_data: `news:ps:${envelope?.preset_public_token}` }]
      ]
    }
  };
}
