const ADMIN_STATE_LABELS = Object.freeze({
  none: 'нет',
  active: 'активен',
  inactive: 'неактивен',
  ready: 'готов',
  empty: 'пусто',
  draft: 'черновик',
  sending: 'отправляется',
  sent: 'отправлен',
  partial: 'частично',
  failed: 'ошибка',
  sent_with_failures: 'отправлен с ошибками',
  pending: 'в ожидании',
  retry_due: 'готов к повтору',
  exhausted: 'попытки исчерпаны',
  skipped: 'пропущен',
  completed: 'завершён',
  running: 'выполняется',
  available: 'доступно',
  redeemed: 'использовано',
  rejected: 'отклонено',
  joined: 'присоединился',
  activated: 'активирован',
  accepted: 'принято',
  declined: 'отклонено',
  stale: 'просрочено',
  listed: 'опубликован',
  hidden: 'скрыт',
  direct: 'личное сообщение',
  broadcast: 'рассылка',
  notice: 'уведомление'
});

const ADMIN_EVENT_TYPE_LABELS = Object.freeze({
  direct: 'Личное сообщение',
  broadcast: 'Рассылка',
  notice: 'Уведомление',
  invite: 'Инвайт',
  audit: 'Аудит'
});

export const ADMIN_COPY = Object.freeze({
  home: '🏠 Главная',
  adminHome: '👑 Админка',
  back: '← Назад',
  refresh: '🔄 Обновить',
  open: 'Открыть'
});

export function normalizeAdminRawCode(value, fallback = 'none') {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

export function adminCode(value, fallback = 'none') {
  return `\`${normalizeAdminRawCode(value, fallback)}\``;
}

export function adminStateLabel(value, fallback = 'нет') {
  const raw = normalizeAdminRawCode(value, 'none');
  return ADMIN_STATE_LABELS[raw] || fallback;
}

export function adminStateWithCode(value, fallback = 'нет') {
  const raw = normalizeAdminRawCode(value, 'none');
  return `${ADMIN_STATE_LABELS[raw] || fallback} · код: ${adminCode(raw)}`;
}

export function adminEventTypeLabel(value) {
  const raw = normalizeAdminRawCode(value, 'unknown');
  return ADMIN_EVENT_TYPE_LABELS[raw] || 'Событие';
}

export function adminEventTypeWithCode(value) {
  return `${adminEventTypeLabel(value)} · код: ${adminCode(value, 'unknown')}`;
}

export function adminBooleanLabel(value) {
  return value ? 'да' : 'нет';
}

export function adminOperatorError(reason, fallback = 'Не удалось выполнить действие.') {
  const raw = String(reason || '').trim();
  return raw ? `${fallback}\nКод: ${adminCode(raw, 'unknown_error')}` : fallback;
}

export function adminTechnicalLine(label, value, fallback = 'none') {
  return `${label}: ${adminStateWithCode(value, fallback)}`;
}
