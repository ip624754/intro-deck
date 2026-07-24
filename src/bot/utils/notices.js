import { normalizeInterfaceLanguage } from '../../lib/i18n/language.js';
import { memberReasonText } from '../../lib/telegram/memberCopy.js';

const DM_REQUEST_EN = Object.freeze({
  connect_linkedin_before_dm_request: 'Connect LinkedIn before starting private-chat requests.',
  cannot_message_self: 'You cannot open a private-chat request to your own profile.',
  target_profile_missing: 'The target profile is no longer available.',
  target_profile_not_public: 'This profile is not publicly listed right now.',
  target_profile_not_paid_unlock_mode: 'This member accepts intro requests only. Paid Telegram-contact and private-chat requests are disabled.',
  dm_thread_already_exists: 'A private-chat request is already open for this profile.',
  dm_thread_already_active: 'An active private chat already exists with this member.',
  dm_thread_blocked: 'This private-chat path is blocked right now.',
  dm_request_throttled: 'Please wait a moment before opening the same private-chat request again.',
  dm_payment_already_confirmed: 'This private-chat request was already paid. Open the latest request state; do not pay again.',
  dm_thread_not_ready_for_payment: 'Save your first message before paying for this private-chat request.',
  dm_thread_not_owned_by_user: 'This private-chat payment belongs to another account.',
  dm_payment_charge_missing: 'Telegram did not provide a payment charge reference. Contact support before retrying.',
  dm_request_sent_via_pro: 'This private-chat request is included in active Pro and is already waiting for recipient approval.',
  dm_thread_not_active: 'This conversation is not active yet.',
  dm_thread_declined: 'This private-chat request was declined. You can try again after the recipient cooldown.',
  dm_request_cooldown_active: 'This member recently declined a contact request. Try again after the shared recipient cooldown.',
  pro_outreach_daily_limit_reached: 'Your Pro fair-use allowance for the rolling 24-hour window is used. Try again later or pay per request.',
  contact_contract_requires_migration: 'Contact requests are temporarily unavailable. Try again later.',
  dm_checkout_already_in_progress: 'Another checkout for this private-chat request is already in progress. Wait briefly before retrying.',
  dm_checkout_authorization_missing_or_expired: 'This payment request expired. Open the latest request and start payment again.',
  payment_charge_replay_detected: 'This payment charge is already linked to another purchase. Contact support before retrying.',
  payment_currency_mismatch: 'This payment uses an unexpected currency. Do not retry; contact support.',
  payment_amount_mismatch: 'This payment amount does not match the request. Do not retry; contact support.'
});

const DM_REQUEST_RU = Object.freeze({
  connect_linkedin_before_dm_request: 'Подключите LinkedIn перед созданием запроса в приватный чат.',
  cannot_message_self: 'Нельзя отправить запрос в приватный чат собственному профилю.',
  target_profile_missing: 'Целевой профиль больше недоступен.',
  target_profile_not_public: 'Этот профиль сейчас не опубликован в каталоге.',
  target_profile_not_paid_unlock_mode: 'Этот участник принимает только запросы на знакомство. Платные запросы Telegram-контакта и приватного чата отключены.',
  dm_thread_already_exists: 'Для этого профиля уже открыт запрос в приватный чат.',
  dm_thread_already_active: 'С этим участником уже есть активный приватный чат.',
  dm_thread_blocked: 'Этот путь приватного чата сейчас заблокирован.',
  dm_request_throttled: 'Подождите немного перед повторным созданием такого же запроса.',
  dm_payment_already_confirmed: 'Этот запрос уже оплачен. Откройте его актуальное состояние и не платите повторно.',
  dm_thread_not_ready_for_payment: 'Сначала сохраните первое сообщение, затем оплачивайте доставку запроса.',
  dm_thread_not_owned_by_user: 'Эта оплата приватного чата относится к другому аккаунту.',
  dm_payment_charge_missing: 'Telegram не передал идентификатор платежа. Перед повторной попыткой обратитесь в поддержку.',
  dm_request_sent_via_pro: 'Запрос включён в активный Pro и уже ожидает решения получателя.',
  dm_thread_not_active: 'Этот диалог ещё не активен.',
  dm_thread_declined: 'Запрос в приватный чат отклонён. Повторить можно после периода ожидания получателя.',
  dm_request_cooldown_active: 'Этот участник недавно отклонил контактный запрос. Повторите после общего периода ожидания.',
  pro_outreach_daily_limit_reached: 'Лимит Pro за скользящие 24 часа использован. Попробуйте позже или оплатите отдельный запрос.',
  contact_contract_requires_migration: 'Контактные запросы временно недоступны. Попробуйте позже.',
  dm_checkout_already_in_progress: 'Для этого запроса уже выполняется оплата. Немного подождите перед повторной попыткой.',
  dm_checkout_authorization_missing_or_expired: 'Платёжный запрос истёк. Откройте актуальный запрос и начните оплату снова.',
  payment_charge_replay_detected: 'Этот платёж уже связан с другой покупкой. Перед повторной попыткой обратитесь в поддержку.',
  payment_currency_mismatch: 'Платёж использует неожиданную валюту. Не повторяйте оплату и обратитесь в поддержку.',
  payment_amount_mismatch: 'Сумма платежа не соответствует запросу. Не повторяйте оплату и обратитесь в поддержку.'
});

const DM_DECISION_EN = Object.freeze({
  dm_thread_missing: 'This private chat is no longer available.',
  dm_thread_not_actionable_by_user: 'Only the recipient can act on this private-chat request.',
  dm_invalid_decision: 'That private-chat decision is not supported.',
  dm_thread_already_active: 'This button is no longer active. The private chat is already open.',
  dm_thread_already_declined: 'This button is no longer active. The chat request was already declined.',
  dm_thread_blocked: 'This private-chat path is blocked.',
  dm_thread_not_ready_for_decision: 'This private-chat request is not ready for review yet.',
  dm_thread_reported: 'This private-chat request was reported and blocked.'
});

const DM_DECISION_RU = Object.freeze({
  dm_thread_missing: 'Этот приватный чат больше недоступен.',
  dm_thread_not_actionable_by_user: 'Решение по этому запросу может принять только получатель.',
  dm_invalid_decision: 'Такое решение для приватного чата не поддерживается.',
  dm_thread_already_active: 'Кнопка устарела: приватный чат уже открыт.',
  dm_thread_already_declined: 'Кнопка устарела: запрос уже отклонён.',
  dm_thread_blocked: 'Этот путь приватного чата заблокирован.',
  dm_thread_not_ready_for_decision: 'Запрос ещё не готов к рассмотрению.',
  dm_thread_reported: 'Запрос был отмечен жалобой и заблокирован.'
});

const CONTACT_REQUEST_EN = Object.freeze({
  connect_linkedin_before_contact_unlock: 'Connect LinkedIn before requesting Telegram contact.',
  cannot_request_direct_contact_to_self: 'You cannot request Telegram contact to your own profile.',
  target_profile_missing: 'The target profile is no longer available.',
  target_profile_not_public: 'This profile is not publicly listed right now.',
  target_profile_not_paid_unlock_mode: 'This profile does not accept paid Telegram-contact requests right now.',
  target_profile_no_hidden_telegram_username: 'This profile has no hidden Telegram username configured right now.',
  contact_unlock_request_already_exists: 'A Telegram contact request is already active for this profile.',
  contact_unlock_already_revealed: 'Telegram contact is already revealed for this profile.',
  contact_unlock_request_throttled: 'Please wait a moment before sending the same Telegram contact request again.',
  contact_unlock_payment_already_confirmed: 'This Telegram contact request was already paid. Open the latest request state; do not pay again.',
  contact_unlock_request_not_ready_for_payment: 'This Telegram contact request is not ready for payment.',
  contact_unlock_request_not_owned_by_user: 'This Telegram contact payment belongs to another account.',
  contact_payment_charge_missing: 'Telegram did not provide a payment charge reference. Contact support before retrying.',
  contact_unlock_covered_by_pro: 'This Telegram contact request used your Pro fair-use allowance and is waiting for approval.',
  contact_request_cooldown_active: 'This member recently declined a contact request. Try again after the shared recipient cooldown.',
  contact_path_blocked: 'This contact pair is blocked. No new Telegram-contact request can be opened.',
  pro_outreach_daily_limit_reached: 'Your Pro fair-use allowance for the rolling 24-hour window is used. Try again later or pay per request.',
  contact_contract_requires_migration: 'Contact requests are temporarily unavailable. Try again later.',
  contact_checkout_already_in_progress: 'Another checkout for this Telegram-contact request is already in progress. Wait briefly before retrying.',
  contact_checkout_authorization_missing_or_expired: 'This payment request expired. Open the latest request and start payment again.',
  payment_charge_replay_detected: 'This payment charge is already linked to another purchase. Contact support before retrying.',
  payment_currency_mismatch: 'This payment uses an unexpected currency. Do not retry; contact support.',
  payment_amount_mismatch: 'This payment amount does not match the request. Do not retry; contact support.'
});

const CONTACT_REQUEST_RU = Object.freeze({
  connect_linkedin_before_contact_unlock: 'Подключите LinkedIn перед запросом Telegram-контакта.',
  cannot_request_direct_contact_to_self: 'Нельзя запросить Telegram-контакт собственного профиля.',
  target_profile_missing: 'Целевой профиль больше недоступен.',
  target_profile_not_public: 'Этот профиль сейчас не опубликован в каталоге.',
  target_profile_not_paid_unlock_mode: 'Этот профиль сейчас не принимает платные запросы Telegram-контакта.',
  target_profile_no_hidden_telegram_username: 'У этого профиля сейчас не настроен скрытый Telegram username.',
  contact_unlock_request_already_exists: 'Для этого профиля уже активен запрос Telegram-контакта.',
  contact_unlock_already_revealed: 'Telegram-контакт этого профиля уже раскрыт.',
  contact_unlock_request_throttled: 'Подождите немного перед повторной отправкой такого же запроса.',
  contact_unlock_payment_already_confirmed: 'Этот запрос уже оплачен. Откройте его актуальное состояние и не платите повторно.',
  contact_unlock_request_not_ready_for_payment: 'Этот запрос ещё не готов к оплате.',
  contact_unlock_request_not_owned_by_user: 'Эта оплата Telegram-контакта относится к другому аккаунту.',
  contact_payment_charge_missing: 'Telegram не передал идентификатор платежа. Перед повторной попыткой обратитесь в поддержку.',
  contact_unlock_covered_by_pro: 'Запрос использовал лимит Pro и ожидает решения получателя.',
  contact_request_cooldown_active: 'Этот участник недавно отклонил контактный запрос. Повторите после общего периода ожидания.',
  contact_path_blocked: 'Эта пара контактов заблокирована. Новый запрос Telegram-контакта открыть нельзя.',
  pro_outreach_daily_limit_reached: 'Лимит Pro за скользящие 24 часа использован. Попробуйте позже или оплатите отдельный запрос.',
  contact_contract_requires_migration: 'Контактные запросы временно недоступны. Попробуйте позже.',
  contact_checkout_already_in_progress: 'Для этого запроса уже выполняется оплата. Немного подождите перед повторной попыткой.',
  contact_checkout_authorization_missing_or_expired: 'Платёжный запрос истёк. Откройте актуальный запрос и начните оплату снова.',
  payment_charge_replay_detected: 'Этот платёж уже связан с другой покупкой. Перед повторной попыткой обратитесь в поддержку.',
  payment_currency_mismatch: 'Платёж использует неожиданную валюту. Не повторяйте оплату и обратитесь в поддержку.',
  payment_amount_mismatch: 'Сумма платежа не соответствует запросу. Не повторяйте оплату и обратитесь в поддержку.'
});

const CONTACT_DECISION_EN = Object.freeze({
  contact_unlock_request_missing: 'This Telegram contact request is no longer available.',
  contact_unlock_request_not_actionable_by_user: 'Only the recipient can approve or decline this Telegram contact request.',
  contact_unlock_invalid_decision: 'That Telegram contact decision is not supported.',
  contact_unlock_already_revealed: 'This button is no longer active. The Telegram contact was already shared.',
  contact_unlock_already_declined: 'This button is no longer active. The Telegram contact request was already declined.',
  contact_unlock_request_not_ready_for_decision: 'This Telegram contact request is not ready for approval yet.',
  target_profile_not_paid_unlock_mode: 'This profile no longer accepts paid Telegram-contact requests.',
  target_profile_no_hidden_telegram_username: 'No hidden Telegram username is available to reveal right now.'
});

const CONTACT_DECISION_RU = Object.freeze({
  contact_unlock_request_missing: 'Этот запрос Telegram-контакта больше недоступен.',
  contact_unlock_request_not_actionable_by_user: 'Одобрить или отклонить запрос может только получатель.',
  contact_unlock_invalid_decision: 'Такое решение по Telegram-контакту не поддерживается.',
  contact_unlock_already_revealed: 'Кнопка устарела: Telegram-контакт уже передан.',
  contact_unlock_already_declined: 'Кнопка устарела: запрос уже отклонён.',
  contact_unlock_request_not_ready_for_decision: 'Запрос ещё не готов к одобрению.',
  target_profile_not_paid_unlock_mode: 'Профиль больше не принимает платные запросы Telegram-контакта.',
  target_profile_no_hidden_telegram_username: 'Скрытый Telegram username сейчас недоступен.'
});

const INTRO_REQUEST_EN = Object.freeze({
  connect_linkedin_before_intro_request: 'Connect LinkedIn before sending intro requests.',
  cannot_request_intro_to_self: 'You cannot request an intro to your own profile.',
  target_profile_missing: 'The target profile is no longer available.',
  target_profile_not_public: 'This profile is not publicly listed right now.',
  target_profile_not_intro_request_mode: 'This profile does not accept intro requests right now.',
  intro_request_already_exists: 'An intro request already exists for this profile.',
  intro_request_throttled: 'Please wait a moment before sending the same intro request again.'
});

const INTRO_REQUEST_RU = Object.freeze({
  connect_linkedin_before_intro_request: 'Подключите LinkedIn перед отправкой запроса на знакомство.',
  cannot_request_intro_to_self: 'Нельзя отправить запрос на знакомство собственному профилю.',
  target_profile_missing: 'Целевой профиль больше недоступен.',
  target_profile_not_public: 'Этот профиль сейчас не опубликован в каталоге.',
  target_profile_not_intro_request_mode: 'Этот профиль сейчас не принимает запросы на знакомство.',
  intro_request_already_exists: 'Для этого профиля уже существует запрос на знакомство.',
  intro_request_throttled: 'Подождите немного перед повторной отправкой такого же запроса.'
});

const INTRO_DECISION_EN = Object.freeze({
  connect_linkedin_before_intro_decision: 'Connect LinkedIn before acting on intro requests.',
  intro_request_missing: 'This intro request is no longer available.',
  intro_request_not_actionable_by_user: 'Only the recipient can accept or decline this intro request.',
  intro_request_invalid_decision: 'That intro decision is not supported.',
  intro_request_already_accepted: 'This button is no longer active. The intro was already accepted.',
  intro_request_already_declined: 'This button is no longer active. The intro was already declined.',
  intro_request_already_cancelled: 'This button is no longer active. The intro request was already cancelled.',
  intro_decision_throttled: 'Please wait a moment before repeating the same intro action.',
  intro_request_decision_failed: 'Could not save the intro decision right now.'
});

const INTRO_DECISION_RU = Object.freeze({
  connect_linkedin_before_intro_decision: 'Подключите LinkedIn перед обработкой запросов на знакомство.',
  intro_request_missing: 'Этот запрос на знакомство больше недоступен.',
  intro_request_not_actionable_by_user: 'Принять или отклонить запрос может только получатель.',
  intro_request_invalid_decision: 'Такое решение по запросу не поддерживается.',
  intro_request_already_accepted: 'Кнопка устарела: запрос уже принят.',
  intro_request_already_declined: 'Кнопка устарела: запрос уже отклонён.',
  intro_request_already_cancelled: 'Кнопка устарела: запрос уже отменён.',
  intro_decision_throttled: 'Подождите немного перед повторением того же действия.',
  intro_request_decision_failed: 'Не удалось сохранить решение по запросу.'
});

function reasonFromMaps(reason, interfaceLanguage, englishMap, russianMap, englishFallback, russianFallback) {
  const russian = normalizeInterfaceLanguage(interfaceLanguage) === 'ru';
  return (russian ? russianMap : englishMap)[reason] || (russian ? russianFallback : englishFallback);
}

export function formatDmRequestReason(reason, interfaceLanguage = 'en') {
  return reasonFromMaps(reason, interfaceLanguage, DM_REQUEST_EN, DM_REQUEST_RU, 'Could not open the private-chat request right now.', 'Не удалось открыть запрос в приватный чат.');
}

export function formatDmDecisionReason(reason, interfaceLanguage = 'en') {
  return reasonFromMaps(reason, interfaceLanguage, DM_DECISION_EN, DM_DECISION_RU, 'Could not update the private chat right now.', 'Не удалось обновить приватный чат.');
}

export function formatContactUnlockRequestReason(reason, interfaceLanguage = 'en') {
  return reasonFromMaps(reason, interfaceLanguage, CONTACT_REQUEST_EN, CONTACT_REQUEST_RU, 'Could not open the Telegram contact request right now.', 'Не удалось открыть запрос Telegram-контакта.');
}

export function formatContactUnlockDecisionReason(reason, interfaceLanguage = 'en') {
  return reasonFromMaps(reason, interfaceLanguage, CONTACT_DECISION_EN, CONTACT_DECISION_RU, 'Could not update the Telegram contact request right now.', 'Не удалось обновить запрос Telegram-контакта.');
}

export function formatIntroRequestReason(reason, interfaceLanguage = 'en') {
  return reasonFromMaps(reason, interfaceLanguage, INTRO_REQUEST_EN, INTRO_REQUEST_RU, 'Could not send the intro request right now.', 'Не удалось отправить запрос на знакомство.');
}

export function formatIntroDecisionReason(reason, interfaceLanguage = 'en') {
  return reasonFromMaps(reason, interfaceLanguage, INTRO_DECISION_EN, INTRO_DECISION_RU, 'Could not update the intro request right now.', 'Не удалось обновить запрос на знакомство.');
}

export function formatUserFacingError(input, fallback = 'Something went wrong. Please try again.', interfaceLanguage = 'en') {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const russian = language === 'ru';
  const message = String(input || '').trim();
  if (!message) return fallback;

  const validationMap = [
    ['cannot be empty', 'не может быть пустым'],
    ['is too long', 'слишком длинное значение'],
    ['must be a valid URL', 'должно быть корректной ссылкой'],
    ['must start with http:// or https://', 'должно начинаться с http:// или https://'],
    ['must point to linkedin.com', 'должно вести на linkedin.com'],
    ['must be a member profile URL', 'должно быть ссылкой на профиль участника'],
    ['must be 5-32 characters and use only letters, numbers, or underscores', 'должно содержать 5–32 символа: буквы, цифры или подчёркивания']
  ];
  for (const [needle, translated] of validationMap) {
    if (message.includes(needle)) return russian ? translated : message;
  }

  if (
    message.includes('Profile not found for edit session') ||
    message.includes('Profile not found for skill toggle') ||
    message.includes('Profile not found for clear skills')
  ) {
    return russian
      ? 'Сначала завершите подключение LinkedIn, затем снова откройте профиль.'
      : 'Complete LinkedIn connection first, then open your profile again.';
  }

  if (message.includes('DATABASE_URL is not configured')) {
    return russian ? 'Эта функция временно недоступна. Попробуйте позже.' : 'This feature is temporarily unavailable. Try again later.';
  }

  const memberMapped = memberReasonText(message, null, language);
  if (memberMapped) return memberMapped;

  if (message === 'payment_currency_mismatch') return russian ? CONTACT_REQUEST_RU.payment_currency_mismatch : CONTACT_REQUEST_EN.payment_currency_mismatch;
  if (message === 'payment_amount_mismatch') return russian ? 'Сумма платежа не соответствует продукту. Не повторяйте оплату и обратитесь в поддержку.' : 'This payment amount does not match the product. Do not retry; contact support.';
  if (message === 'pro_subscription_already_active') return russian ? 'Pro уже активен для этого аккаунта.' : 'Pro is already active on this account.';

  const internalSignals = [
    'violates', 'constraint', 'relation "', 'SQLSTATE', 'duplicate key', 'syntax error',
    'Cannot find module', 'Unsupported profile field key', 'Unsupported field key', 'column ',
    'insert into', 'update ', 'delete from', 'could not determine data type of parameter',
    'invalid input syntax', 'operator does not exist'
  ];
  if (internalSignals.some((needle) => message.includes(needle))) return fallback;
  if (/^[a-z0-9_]+$/i.test(message) && message.includes('_')) return fallback;
  return message;
}
