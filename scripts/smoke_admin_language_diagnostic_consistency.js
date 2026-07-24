import { readFileSync } from 'node:fs';
import { createAdminSurfaceBuilders } from '../src/bot/surfaces/adminSurfaces.js';
import { adminCode, adminStateWithCode, normalizeAdminRawCode } from '../src/lib/telegram/adminCopy.js';

function requireIncludes(value, fragments, label) {
  for (const fragment of fragments) {
    if (!String(value).includes(fragment)) {
      throw new Error(`${label} missing: ${fragment}`);
    }
  }
}

function requireExcludes(value, fragments, label) {
  for (const fragment of fragments) {
    if (String(value).includes(fragment)) {
      throw new Error(`${label} exposes mixed/internal copy: ${fragment}`);
    }
  }
}

const surfaces = createAdminSurfaceBuilders({ currentStep: 'STEP064B3' });

const home = await surfaces.buildAdminHomeSurface({
  summary: {
    connectedNoProfile: 2,
    readyNotListed: 3,
    pendingOlder24h: 4,
    deliveryIssues: 1,
    activeNotice: true,
    latestBroadcastStatus: 'sent_with_failures'
  }
});
requireIncludes(home.text, ['👑 Админка', 'Сначала выберите раздел.', 'В ожидании >24 ч', 'Последняя рассылка: отправлен с ошибками'], 'admin home');
requireExcludes(home.text, ['founder/operator root', 'drilldown', 'Pending >24'], 'admin home');

const homeKeyboard = JSON.stringify(home.reply_markup.inline_keyboard);
requireIncludes(homeKeyboard, ['🧰 Операции', '💬 Коммуникации', '💳 Монетизация', '⚙️ Система', '🏠 Главная'], 'admin home keyboard');
requireExcludes(homeKeyboard, ['Live verification', 'Freeze', 'View public card'], 'admin home keyboard');

const userCard = await surfaces.buildAdminUserCardSurface({
  card: {
    user_id: 7,
    telegram_user_id: 42,
    telegram_username: 'rustam',
    display_name: 'Rustam Lukmanov',
    linkedin_name: 'Rustam Lukmanov',
    linkedin_sub: 'sub',
    profile_id: 11,
    profile_state: 'active',
    visibility_status: 'listed',
    headline_user: 'Founder',
    skills: [{ skill_label: 'Founder' }],
    intro_sent_count: 1,
    intro_received_count: 2,
    pending_intro_count: 1,
    last_seen_at: '2026-07-24T00:00:00Z',
    operator_note_text: 'Проверить качество профиля'
  },
  segmentKey: 'listd',
  page: 0
});
requireIncludes(userCard.text, ['🪪 Карточка пользователя', 'Публикация: опубликован · код: `listed`', 'Интро: отправлено 1 • получено 2 • в ожидании 1', 'Заметка оператора: Проверить качество профиля'], 'user card');
requireIncludes(JSON.stringify(userCard.reply_markup.inline_keyboard), ['👁 Открыть публичную карточку', '🙈 Скрыть из каталога', '✉️ Сообщение', '← Назад к пользователям'], 'user card keyboard');

const notePrompt = await surfaces.buildAdminUserNotePromptSurface({
  card: { user_id: 7, display_name: 'Rustam Lukmanov', operator_note_text: 'Текущая заметка' },
  segmentKey: 'all',
  page: 0
});
requireIncludes(notePrompt.text, ['Отправьте текст заметки для пользователя: Rustam Lukmanov.', 'Новая заметка заменит предыдущую.'], 'note prompt');
requireExcludes(notePrompt.text, ['Send the note text', 'The latest note'], 'note prompt');

const system = await surfaces.buildAdminSystemSurface({ summary: { retryDue: 1, exhausted: 2, recentAuditEvents: 3, failedDeliveries: 4 } });
requireIncludes(system.text, ['⚙️ Система', 'Готовы к повтору: 1', 'Попытки исчерпаны: 2'], 'system');
requireIncludes(JSON.stringify(system.reply_markup.inline_keyboard), ['✅ Проверка продакшена', '🎭 Репетиция запуска', '🧊 Заморозка', '🩺 Состояние сервиса'], 'system keyboard');

const health = await surfaces.buildAdminHealthSurface();
requireIncludes(health.text, ['🩺 Состояние сервиса', 'Версия: STEP064B3', 'да'], 'health');
requireExcludes(health.text, ['yes', 'no'], 'health');

const outbox = await surfaces.buildAdminOutboxRecordSurface({
  record: {
    id: 10,
    event_type: 'broadcast',
    status: 'failed',
    audience_key: 'ALL_CONNECTED',
    estimated_recipient_count: 5,
    delivered_count: 3,
    failed_count: 2,
    retry_due_count: 1,
    exhausted_count: 1,
    pending_count: 0,
    created_at: '2026-07-24T00:00:00Z'
  }
});
requireIncludes(outbox.text, ['Тип: Рассылка · код: `broadcast`', 'Статус: ошибка · код: `failed`', 'Аудитория: ALL_CONNECTED · код: `all_connected`'], 'outbox record');

if (normalizeAdminRawCode('SQL constraint failed: users!') !== 'sql_constraint_failed:_users') {
  throw new Error('raw diagnostic codes must be bounded and sanitized');
}
if (adminCode('retry due') !== '`retry_due`') throw new Error('adminCode must format raw code separately');
if (adminStateWithCode('retry_due') !== 'готов к повтору · код: `retry_due`') throw new Error('state label/code contract drifted');

const adminSource = readFileSync(new URL('../src/bot/surfaces/adminSurfaces.js', import.meta.url), 'utf8');
const composerSource = readFileSync(new URL('../src/bot/composers/operatorComposer.js', import.meta.url), 'utf8');
for (const callback of ['adm:home', 'adm:ops', 'adm:comms', 'adm:money', 'adm:sys', 'adm:verify', 'adm:freeze', 'adm:outbox']) {
  if (!adminSource.includes(callback) && !composerSource.includes(callback)) {
    throw new Error(`critical admin callback missing: ${callback}`);
  }
}
for (const forbidden of [
  'founder/operator root',
  'Could not hide this listing right now.',
  'Direct message text',
  'Notice text',
  'Broadcast text',
  'Broadcast completed.',
  'Broadcast sent to '
]) {
  if (adminSource.includes(forbidden) || composerSource.includes(forbidden)) {
    throw new Error(`mixed-language operator copy remains: ${forbidden}`);
  }
}

const healthSource = readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
requireIncludes(healthSource, [
  'adminCopyPolicy',
  "uiLanguage: 'ru'",
  "rawCodes: 'english_code_separate_from_label'",
  'mixedLanguageButtons: false',
  'callbackIdsChanged: false',
  'adminMutationsChanged: false'
], 'health policy');

console.log('OK: STEP064B3 admin language and diagnostic consistency');
