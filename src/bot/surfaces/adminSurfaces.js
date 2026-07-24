import { getLinkedInVerificationConfig, getOperatorConfig, getPublicFlags, getRuntimeGuardConfig } from '../../config/env.js';
import { describeLinkedInPublicBadgeGate, describeLinkedInTrustSnapshotStatus, resolveLinkedInTrustState } from '../../lib/linkedin/trust.js';
import { ADMIN_COPY, adminBooleanLabel, adminCode, adminEventTypeLabel, adminEventTypeWithCode, adminStateLabel, adminStateWithCode } from '../../lib/telegram/adminCopy.js';
import { ADMIN_AUDIT_SEGMENTS, ADMIN_BROADCAST_AUDIENCES, ADMIN_BROADCAST_TEMPLATES, ADMIN_DELIVERY_SEGMENTS, ADMIN_DIRECT_MESSAGE_TEMPLATES, ADMIN_INTRO_SEGMENTS, ADMIN_NOTICE_AUDIENCES, ADMIN_NOTICE_TEMPLATES, ADMIN_QUALITY_SEGMENTS, ADMIN_SEARCH_SCOPES, ADMIN_USER_SEGMENTS, normalizeAdminAuditSegment, normalizeAdminBroadcastAudience, normalizeAdminBroadcastTemplate, normalizeAdminDeliverySegment, normalizeAdminIntroSegment, normalizeAdminNoticeAudience, normalizeAdminNoticeTemplate, normalizeAdminQualitySegment, normalizeAdminSearchScope, normalizeAdminUserSegment } from '../../db/adminRepo.js';
function buildInlineKeyboard(rows = []) {
  return { inline_keyboard: rows.filter((row) => Array.isArray(row) && row.length > 0) };
}
function buildBackHomeRow(backText = '← Назад', backCallback = 'adm:home') {
  return [
    { text: backText, callback_data: backCallback },
    { text: ADMIN_COPY.home, callback_data: 'home:root' }
  ];
}
function chunkButtons(buttons = [], size = 2) {
  const rows = [];
  for (let index = 0; index < buttons.length; index += size) {
    const row = buttons.slice(index, index + size);
    if (row.length) {
      rows.push(row);
    }
  }
  return rows;
}
function toDisplayValue(value, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function truncate(value, maxLength = 80) {
  const normalized = toDisplayValue(value, '');
  if (!normalized) {
    return '—';
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}
function formatDateTimeShort(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return `${date.toISOString().slice(0, 16).replace('T', ' ')}Z`;
}
function formatShortStatus(value, fallback = 'none') {
  const normalized = typeof value === 'string' && value.trim() ? value.trim().replaceAll('_', ' ') : fallback;
  if (!normalized) {
    return fallback;
  }
  return normalized;
}
function compactBooleanLabel(value, yesLabel, noLabel) {
  return value ? yesLabel : noLabel;
}
function countLine(label, value) {
  return `${label}: ${value ?? 0}`;
}
function adminSearchScopeLabel(scopeKey) {
  return ADMIN_SEARCH_SCOPES[normalizeAdminSearchScope(scopeKey)]?.label || 'Поиск';
}
function adminSearchBackCallback(scopeKey) {
  switch (normalizeAdminSearchScope(scopeKey)) {
    case 'users': return 'adm:usr:list';
    case 'intros': return 'adm:intro:list';
    case 'delivery': return 'adm:dlv';
    case 'outbox': return 'adm:outbox';
    case 'audit': return 'adm:audit';
    default: return 'adm:home';
  }
}
function profileReadinessLabel(card) {
  if (!card?.profile_id) {
    return 'профиля ещё нет';
  }
  if (card.profile_state === 'active' && card.visibility_status === 'listed') {
    return 'готов • опубликован';
  }
  if (card.profile_state === 'active') {
    return 'готов • скрыт';
  }
  return 'не завершён';
}
function buildAdminStatusLabel(value, fallback = 'нет') {
  return adminStateLabel(value, fallback);
}
function buildAdminHomeText({ summary = null } = {}) {
  const connectedNoProfile = summary?.connectedNoProfile != null
    ? summary.connectedNoProfile
    : Math.max(0, (summary?.connectedUsers || 0) - (summary?.profileStartedUsers || 0));
  const readyNotListed = summary?.readyNotListed || 0;
  const pendingOlder24h = summary?.pendingOlder24h || 0;
  const deliveryIssues = summary?.deliveryIssues != null ? summary.deliveryIssues : (summary?.failedDeliveries || 0);
  return [
    '👑 Админка',
    '',
    'Сначала выберите раздел. Затем проверьте сигналы, требующие внимания.',
    '',
    'Разделы:',
    '🧰 Операции — пользователи, профили, каталог, интро и качество',
    '💬 Коммуникации — уведомления, рассылки, шаблоны и исходящие',
    '💳 Монетизация — Pro, раскрытие контактов и личные чаты',
    '⚙️ Система — повторы, доставка, аудит и состояние сервиса',
    '',
    'Быстрые сигналы:',
    countLine('Подключили, без профиля', connectedNoProfile),
    countLine('Готовы, но не опубликованы', readyNotListed),
    countLine('В ожидании >24 ч', pendingOlder24h),
    countLine('Ошибки доставки', deliveryIssues),
    '',
    `Уведомление: ${summary?.activeNotice ? 'активно' : 'неактивно'} • Последняя рассылка: ${buildAdminStatusLabel(summary?.latestBroadcastStatus, 'нет')}`
  ].join('\n');
}
function buildAdminHomeKeyboard({ summary = null } = {}) {
  const connectedNoProfile = summary?.connectedNoProfile != null
    ? summary.connectedNoProfile
    : Math.max(0, (summary?.connectedUsers || 0) - (summary?.profileStartedUsers || 0));
  const readyNotListed = summary?.readyNotListed || 0;
  const pendingOlder24h = summary?.pendingOlder24h || 0;
  const deliveryIssues = summary?.deliveryIssues != null ? summary.deliveryIssues : (summary?.failedDeliveries || 0);
  return buildInlineKeyboard([
    [
      { text: '🧰 Операции', callback_data: 'adm:ops' },
      { text: '💬 Коммуникации', callback_data: 'adm:comms' }
    ],
    [
      { text: '💳 Монетизация', callback_data: 'adm:money' },
      { text: '⚙️ Система', callback_data: 'adm:sys' }
    ],
    [
      { text: `🧩 Без профиля: ${connectedNoProfile}`, callback_data: 'adm:ops:funnel:conn_noprofile' },
      { text: `✅ Не опубликованы: ${readyNotListed}`, callback_data: 'adm:ops:funnel:ready_not_listed' }
    ],
    [
      { text: `⏳ В ожидании >24 ч: ${pendingOlder24h}`, callback_data: 'adm:ops:funnel:intro_p24' },
      { text: `🧾 Ошибки доставки: ${deliveryIssues}`, callback_data: 'adm:ops:funnel:delivery_issue' }
    ],
    [{ text: ADMIN_COPY.home, callback_data: 'home:root' }]
  ]);
}
function buildAdminMonetizationText({ state = null, notice = null } = {}) {
  const summary = state?.summary || {};
  const pricing = state?.pricing || {};
  const recentReceipts = Array.isArray(state?.recentReceipts) ? state.recentReceipts.slice(0, 6) : [];
  const lines = [
    '💳 Монетизация',
    '',
    `Pro: активно ${summary.activePro || 0} • истекло ${summary.expiredPro || 0}`,
    `Выручка: ${summary.revenue7dStars || 0}⭐ за 7 дней • ${summary.revenue30dStars || 0}⭐ за 30 дней`,
    `Покупки Pro за 7 дней: ${summary.proPurchases7d || 0}`,
    '',
    'Раскрытие Telegram-контакта за 7 дней:',
    `Запросы: ${summary.contactRequests7d || 0} • оплачено: ${summary.contactPaid7d || 0}`,
    `Контакт раскрыт: ${summary.contactRevealed7d || 0} • отклонено: ${summary.contactDeclined7d || 0}`,
    '',
    'Личные чаты за 7 дней:',
    `Создано: ${summary.dmCreated7d || 0} • оплачено: ${summary.dmPaid7d || 0}`,
    `Доставлено: ${summary.dmDelivered7d || 0} • принято: ${summary.dmAccepted7d || 0}`,
    `Блокировки: ${summary.dmBlocked7d || 0} • жалобы: ${summary.dmReported7d || 0} • активны сейчас: ${summary.dmActiveNow || 0}`,
    '',
    `Цены: Pro ${pricing.proMonthlyPriceStars || 0}⭐ • раскрытие контакта ${pricing.contactUnlockPriceStars || 0}⭐ • личный чат ${pricing.dmOpenPriceStars || 0}⭐`
  ];
  if (recentReceipts.length) {
    lines.push('', 'Последние покупки:');
    for (const receipt of recentReceipts) {
      const rawType = receipt.receiptType || 'receipt';
      lines.push(`• ${truncate(receipt.displayName || receipt.telegramUsername || 'Пользователь', 22)} — ${receipt.amountStars || 0}⭐ • ${adminStateLabel(rawType, 'покупка')} • код: ${adminCode(rawType, 'receipt')} • ${formatDateTimeShort(receipt.confirmedAt || receipt.purchasedAt)}`);
    }
  }
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminMonetizationKeyboard({ state = null } = {}) {
  const summary = state?.summary || {};
  return buildInlineKeyboard([
    [
      { text: `⭐ Выручка за 7 дней: ${summary.revenue7dStars || 0}`, callback_data: 'adm:money' },
      { text: `👑 Активные Pro: ${summary.activePro || 0}`, callback_data: 'adm:money' }
    ],
    [
      { text: `🔓 Оплачено контактов: ${summary.contactPaid7d || 0}`, callback_data: 'adm:money' },
      { text: `💬 Оплачено чатов: ${summary.dmPaid7d || 0}`, callback_data: 'adm:money' }
    ],
    [
      { text: `✅ Контакт раскрыт: ${summary.contactRevealed7d || 0}`, callback_data: 'adm:money' },
      { text: `✅ Чаты приняты: ${summary.dmAccepted7d || 0}`, callback_data: 'adm:money' }
    ],
    [
      { text: `⛔ Блокировки: ${summary.dmBlocked7d || 0}`, callback_data: 'adm:money' },
      { text: `🚩 Жалобы: ${summary.dmReported7d || 0}`, callback_data: 'adm:money' }
    ],
    buildBackHomeRow('← Назад в админку', 'adm:home')
  ]);
}
function buildOperationsHubText({ summary = null } = {}) {
  return [
    '🧰 Операции',
    '',
    'Пользовательская воронка: LinkedIn → профиль → каталог → интро.',
    '',
    'Сводка:',
    countLine('Пользователи', summary?.totalUsers || 0),
    countLine('Подключили LinkedIn', summary?.connectedUsers || 0),
    countLine('Готовые профили', summary?.readyProfiles || 0),
    countLine('Готовые, но не опубликованы', summary?.readyNotListed || 0),
    countLine('Опубликованы в каталоге', summary?.listedActive || 0),
    countLine('Опубликованы, но неактивны', summary?.listedInactive || 0),
    '',
    'Узкие места:',
    `Подключили, без профиля: ${summary?.connectedNoProfile || 0}`,
    `Готовые без навыков: ${summary?.readyNoSkills || 0}`,
    `Ещё без интро: ${summary?.noIntroYet || 0}`,
    `Есть принятые интро: ${summary?.acceptedIntroUsers || 0}`,
    `В ожидании >24 ч: ${summary?.pendingOlder24h || 0} • >72 ч: ${summary?.staleIntros || 0}`,
    `Проблемы доставки: ${summary?.deliveryIssues || 0} • повторные привязки за 7 дней: ${summary?.recentRelinks7d || 0}`
  ].join('\n');
}
function buildOperationsHubKeyboard({ summary = null } = {}) {
  return buildInlineKeyboard([
    [
      { text: `🔗 Подключили LinkedIn: ${summary?.connectedUsers || 0}`, callback_data: 'adm:ops:funnel:connected' },
      { text: `🧩 Без профиля: ${summary?.connectedNoProfile || 0}`, callback_data: 'adm:ops:funnel:conn_noprofile' }
    ],
    [
      { text: `🛠 Без навыков: ${summary?.readyNoSkills || 0}`, callback_data: 'adm:ops:funnel:ready_no_skills' },
      { text: `✅ Не опубликованы: ${summary?.readyNotListed || 0}`, callback_data: 'adm:ops:funnel:ready_not_listed' }
    ],
    [
      { text: `📭 Без интро: ${summary?.noIntroYet || 0}`, callback_data: 'adm:ops:funnel:no_intro' },
      { text: `🤝 Принятые: ${summary?.acceptedIntroUsers || 0}`, callback_data: 'adm:ops:funnel:accepted' }
    ],
    [
      { text: `⏳ В ожидании >24 ч: ${summary?.pendingOlder24h || 0}`, callback_data: 'adm:ops:funnel:intro_p24' },
      { text: `🧾 Ошибки доставки: ${summary?.deliveryIssues || 0}`, callback_data: 'adm:ops:funnel:delivery_issue' }
    ],
    [
      { text: '👥 Пользователи', callback_data: 'adm:usr:list' },
      { text: '📨 Интро', callback_data: 'adm:intro:list' }
    ],
    [
      { text: '🚩 Качество', callback_data: 'adm:qual' },
      { text: '🧾 Доставка', callback_data: 'adm:dlv' }
    ],
    [{ text: '📨 Инвайты', callback_data: 'adm:invite' }],
    buildBackHomeRow('← Назад в админку', 'adm:home')
  ]);
}
function normalizeAdminInviteView(view = 'overview') {
  const normalized = typeof view === 'string' ? view.trim().toLowerCase() : 'overview';
  if (['overview', 'rewards', 'settlement', 'audit'].includes(normalized)) {
    return normalized;
  }
  return 'overview';
}
function adminInviteModeLabel(mode = 'off') {
  switch (String(mode || 'off').trim().toLowerCase()) {
    case 'earn_only':
      return '🟡 Начисление';
    case 'live':
      return '🟢 Активен';
    case 'paused':
      return '⏸️ Пауза';
    case 'off':
    default:
      return '🔴 Выкл';
  }
}
function adminInviteModeEffect(mode = 'off') {
  switch (String(mode || 'off').trim().toLowerCase()) {
    case 'earn_only':
      return 'Начисление включено, использование баллов выключено.';
    case 'live':
      return 'Начисление и использование баллов включены.';
    case 'paused':
      return 'Новые начисления и использование баллов временно остановлены.';
    case 'off':
    default:
      return 'Новые начисления и использование баллов выключены.';
  }
}
function adminInviteModeButtonText(currentMode = 'off', targetMode = 'off', baseLabel = 'Выкл') {
  return `${String(currentMode || 'off').trim().toLowerCase() === String(targetMode || 'off').trim().toLowerCase() ? '✅' : '▫️'} ${baseLabel}`;
}
function adminInviteSourceLabel(source = null) {
  switch (String(source || '').trim().toLowerCase()) {
    case 'inline_share':
      return 'встроенная отправка';
    case 'invite_card':
      return 'карточка';
    case 'raw_link':
    case 'link':
    default:
      return 'ссылка';
  }
}
function adminInviteJoinStatusLabel(status = null) {
  return String(status || '').trim().toLowerCase() === 'activated' ? 'активирован' : 'присоединился';
}
function adminInviteRewardEventStatusLabel(status = null) {
  switch (String(status || '').trim().toLowerCase()) {
    case 'available':
      return 'доступно';
    case 'redeemed':
      return 'использовано';
    case 'rejected':
      return 'отклонено';
    case 'pending':
    default:
      return 'ожидает';
  }
}
function adminInviteSettlementStatusLabel(status = null) {
  switch (String(status || '').trim().toLowerCase()) {
    case 'completed':
      return 'завершено';
    case 'failed':
      return 'ошибка';
    case 'running':
    default:
      return 'выполняется';
  }
}
function buildAdminInviteText({ state = null, notice = null, view = 'overview' } = {}) {
  const currentView = normalizeAdminInviteView(view);
  const summary = state?.snapshot?.summary || {};
  const topInviters = Array.isArray(state?.snapshot?.topInviters) ? state.snapshot.topInviters : [];
  const recentInvites = Array.isArray(state?.snapshot?.recentInvites) ? state.snapshot.recentInvites : [];
  const rewards = state?.rewards || {};
  const rewardsTotals = rewards?.totals || {};
  const topRewardInviters = Array.isArray(rewards?.topRewardInviters) ? rewards.topRewardInviters : [];
  const recentRewardEvents = Array.isArray(rewards?.recentRewardEvents) ? rewards.recentRewardEvents : [];
  const modeAudit = Array.isArray(rewards?.modeAudit) ? rewards.modeAudit : [];
  const settlement = rewards?.lastSettlementRun || null;
  const reconciliation = rewards?.reconciliation || {};
  const sampleWarnings = Array.isArray(reconciliation?.sampleWarnings) ? reconciliation.sampleWarnings : [];
  const mode = String(rewards?.mode || 'off').trim().toLowerCase();
  const lines = ['✉️ Приглашения', ''];

  if (currentView === 'overview') {
    lines.push('Вход, активация и источники приглашений.');
    lines.push('', 'Сводка:');
    lines.push(`• Режим программы: ${adminInviteModeLabel(mode)} · код: ${adminCode(mode, 'off')}`);
    lines.push(`• Эффект: ${adminInviteModeEffect(mode)}`);
    lines.push(`• Приглашено: ${summary.totalInvites || 0}`);
    lines.push(`• Активировано: ${summary.activatedInvites || 0}`);
    lines.push(`• Конверсия: ${summary.activationRate || 0}%`);
    lines.push(`• За 7 дней: приглашено ${summary.joined7d || 0} • активировано ${summary.activated7d || 0}`);
    lines.push('', 'Источники:');
    lines.push(`• Отправка в чат: ${summary.inlineShareCount || 0} · код: ${adminCode('inline_share')}`);
    lines.push(`• Скопированная ссылка: ${summary.rawLinkCount || 0} · код: ${adminCode('raw_link')}`);
    lines.push(`• Карточка приглашения: ${summary.inviteCardCount || 0} · код: ${adminCode('invite_card')}`);
    if (state?.activationHint) lines.push('', 'Правило активации:', `• ${state.activationHint}`);
    lines.push('', 'Топ приглашающих:');
    if (topInviters.length) topInviters.slice(0, 5).forEach((item, index) => lines.push(`${index + 1}. ${truncate(item.displayName, 28)} — приглашено ${item.invitedCount || 0} • активировано ${item.activatedCount || 0} • конверсия ${item.activationRate || 0}%`));
    else lines.push('• Пока нет данных.');
    lines.push('', 'Последние приглашения:');
    if (recentInvites.length) recentInvites.slice(0, 5).forEach((item, index) => lines.push(`${index + 1}. ${truncate(item.referrerDisplayName, 24)} → ${truncate(item.displayName, 22)} • ${adminInviteJoinStatusLabel(item.status)} · ${adminCode(item.status, 'joined')} • ${adminInviteSourceLabel(item.source)} · ${adminCode(item.source, 'link')} • ${formatDateTimeShort(item.joinedAt)}`));
    else lines.push('• Пока нет данных.');
  } else if (currentView === 'rewards') {
    lines.push('Режим и балансы программы наград.');
    lines.push('', `Режим: ${adminInviteModeLabel(mode)} · код: ${adminCode(mode, 'off')}`);
    lines.push(`Эффект: ${adminInviteModeEffect(mode)}`);
    lines.push('', 'Балансы:');
    lines.push(`• Ожидает: ${rewardsTotals.pendingPoints || 0} баллов • ${rewardsTotals.pendingEntries || 0} записей`);
    lines.push(`• Доступно: ${rewardsTotals.availablePoints || 0} баллов • ${rewardsTotals.availableEntries || 0} записей`);
    lines.push(`• Использовано: ${rewardsTotals.redeemedPoints || 0} баллов • ${rewardsTotals.redeemedEntries || 0} записей`);
    lines.push(`• Кандидаты на подтверждение: ${rewardsTotals.pendingCandidates || 0} • просрочено ${rewardsTotals.pendingDue || 0}`);
    if (rewards?.config) lines.push(`• Правило: ${rewards.config.activationPoints || 0} баллов за активацию • окно ${rewards.config.activationConfirmHours || 24} ч`);
    lines.push('', 'Топ по наградам:');
    if (topRewardInviters.length) topRewardInviters.slice(0, 5).forEach((item, index) => lines.push(`${index + 1}. ${truncate(item.displayName, 28)} — всего ${item.totalPoints || 0} • ожидает ${item.pendingPoints || 0} • доступно ${item.availablePoints || 0}`));
    else lines.push('• Пока нет данных.');
    lines.push('', 'Последние события:');
    if (recentRewardEvents.length) recentRewardEvents.slice(0, 6).forEach((item, index) => lines.push(`${index + 1}. ${truncate(item.referrerDisplayName, 18)} → ${truncate(item.invitedDisplayName, 18)} • ${adminInviteRewardEventStatusLabel(item.status)} · ${adminCode(item.status, 'pending')} • ${item.points || 0} баллов • подтверждение после ${formatDateTimeShort(item.confirmAfter)}`));
    else lines.push('• Событий пока нет.');
  } else if (currentView === 'settlement') {
    lines.push('Подтверждение ожидающих наград и сверка.');
    lines.push('', 'Кандидаты:');
    lines.push(`• Ожидают подтверждения: ${rewardsTotals.pendingCandidates || 0}`);
    lines.push(`• Просрочено: ${rewardsTotals.pendingDue || 0}`);
    lines.push(`• Подтверждено сегодня: ${rewardsTotals.confirmedToday || 0}`);
    lines.push(`• Отклонено сегодня: ${rewardsTotals.rejectedToday || 0}`);
    lines.push('', 'Последний запуск:');
    if (settlement) {
      lines.push(`• Идентификатор: ${truncate(settlement.settlementRunId, 30)}`);
      lines.push(`• Статус: ${adminInviteSettlementStatusLabel(settlement.status)} · ${adminCode(settlement.status, 'running')}`);
      lines.push(`• Режим: ${adminInviteModeLabel(settlement.modeSnapshot)} · ${adminCode(settlement.modeSnapshot, 'off')}`);
      lines.push(`• Обработано ${settlement.processedCount || 0} • подтверждено ${settlement.confirmedCount || 0} • отклонено ${settlement.rejectedCount || 0} • пропущено ${settlement.skippedCount || 0}`);
      lines.push(`• Начало: ${formatDateTimeShort(settlement.startedAt)}`);
      lines.push(`• Завершение: ${formatDateTimeShort(settlement.finishedAt)}`);
    } else lines.push('• Пакетная обработка ещё не запускалась.');
    lines.push('', 'Сверка:');
    lines.push(`• Предупреждения: ${reconciliation.warningCount || 0}`);
    lines.push(`• Завершённые использования баллов: ${reconciliation.completedRedemptions || 0}`);
    if (sampleWarnings.length) sampleWarnings.slice(0, 3).forEach((item, index) => lines.push(`${index + 1}. ${truncate(item.warningType, 24)} · ${adminCode(item.warningType, 'warning')} • ${truncate(item.referrerDisplayName, 14)} → ${truncate(item.invitedDisplayName, 14)} • ${adminInviteRewardEventStatusLabel(item.status)} · ${adminCode(item.status, 'pending')}`));
    else lines.push('• Явных расхождений не найдено.');
  } else {
    lines.push('История переключений режима программы наград.');
    lines.push('', `Текущий режим: ${adminInviteModeLabel(mode)} · код: ${adminCode(mode, 'off')}`);
    lines.push(`Эффект: ${adminInviteModeEffect(mode)}`);
    lines.push('', 'Последние изменения:');
    if (modeAudit.length) modeAudit.slice(0, 8).forEach((item, index) => lines.push(`${index + 1}. ${truncate(item.changedByDisplayName, 22)} • ${adminInviteModeLabel(item.fromMode)} ${adminCode(item.fromMode, 'off')} → ${adminInviteModeLabel(item.toMode)} ${adminCode(item.toMode, 'off')} • ${formatDateTimeShort(item.createdAt)}`));
    else lines.push('• Пока нет записей.');
  }

  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminInviteKeyboard({ state = null, view = 'overview' } = {}) {
  const currentView = normalizeAdminInviteView(view);
  const currentMode = String(state?.rewards?.mode || 'off').trim().toLowerCase();
  const rows = [
    [{ text: ADMIN_COPY.refresh, callback_data: `adm:invite:${currentView}` }],
    [
      { text: `${currentView === 'overview' ? '✅' : '▫️'} Обзор`, callback_data: 'adm:invite:overview' },
      { text: `${currentView === 'rewards' ? '✅' : '▫️'} Награды`, callback_data: 'adm:invite:rewards' }
    ],
    [
      { text: `${currentView === 'settlement' ? '✅' : '▫️'} Подтверждение`, callback_data: 'adm:invite:settlement' },
      { text: `${currentView === 'audit' ? '✅' : '▫️'} История режима`, callback_data: 'adm:invite:audit' }
    ]
  ];
  if (currentView === 'rewards') {
    rows.push([
      { text: adminInviteModeButtonText(currentMode, 'off', 'Выключено'), callback_data: 'adm:invite:mode:off' },
      { text: adminInviteModeButtonText(currentMode, 'earn_only', 'Только начисление'), callback_data: 'adm:invite:mode:earn_only' }
    ]);
    rows.push([
      { text: adminInviteModeButtonText(currentMode, 'live', 'Активно'), callback_data: 'adm:invite:mode:live' },
      { text: adminInviteModeButtonText(currentMode, 'paused', 'Пауза'), callback_data: 'adm:invite:mode:paused' }
    ]);
  }
  if (currentView === 'settlement') rows.push([
    { text: '✅ Запустить пакет', callback_data: 'adm:invite:settlement:run' },
    { text: '🧷 Проверить сверку', callback_data: 'adm:invite:settlement:reconcile' }
  ]);
  rows.push(buildBackHomeRow('← Назад в операции', 'adm:ops'));
  return buildInlineKeyboard(rows);
}

function buildCommunicationsHubText({ state = null, notice = null } = {}) {
  const broadcastRaw = state?.latestBroadcastStatus || 'none';
  const lines = [
    '💬 Коммуникации',
    '',
    'Уведомления, рассылки, личные сообщения и исходящие операции.',
    '',
    `Уведомление: ${state?.notice?.isActive ? 'активно' : 'неактивно'} • аудитория: ${ADMIN_NOTICE_AUDIENCES[normalizeAdminNoticeAudience(state?.notice?.audienceKey || 'ALL')]?.label || 'Все пользователи'}`,
    `Охват уведомления: ${state?.noticeVisibilityEstimate || 0}`,
    `Черновик рассылки: ${state?.broadcastDraft?.body ? 'готов' : 'пуст'}`,
    `Последняя рассылка: ${adminStateWithCode(broadcastRaw, 'нет')}`,
    `Получателей: ${state?.latestBroadcastRecipients || 0} • доставлено: ${state?.latestBroadcastDelivered || 0} • ошибок: ${state?.latestBroadcastFailed || 0}`,
    countLine('Личные сообщения за 24 часа', state?.directMessages24h || 0),
    countLine('Личные сообщения за 7 дней', state?.directMessages7d || 0),
    countLine('Ошибки исходящих за 24 часа', state?.outboxFailures24h || 0),
    countLine('Ошибки исходящих за 7 дней', state?.outboxFailures7d || 0)
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildCommunicationsHubKeyboard({ state = null } = {}) {
  return buildInlineKeyboard([
    [
      { text: `📣 Охват уведомления: ${state?.noticeVisibilityEstimate || 0}`, callback_data: 'adm:comms:funnel:notice_visibility' },
      { text: `📬 Получателей рассылки: ${state?.latestBroadcastRecipients || 0}`, callback_data: 'adm:comms:funnel:last_bc' }
    ],
    [
      { text: `❌ Ошибки исходящих: ${state?.recentOutboxFailures || 0}`, callback_data: 'adm:comms:funnel:outbox_fail' },
      { text: `✉️ Личные сообщения: ${state?.directMessages24h || 0}`, callback_data: 'adm:comms:funnel:direct_recent' }
    ],
    [
      { text: '📣 Уведомление', callback_data: 'adm:not' },
      { text: '📬 Рассылка', callback_data: 'adm:bc' }
    ],
    [
      { text: '📌 Шаблоны', callback_data: 'adm:tpl' },
      { text: '📤 Исходящие', callback_data: 'adm:outbox' }
    ],
    buildBackHomeRow('← Назад в админку', 'adm:home')
  ]);
}
function buildSystemHubText({ summary = null } = {}) {
  return [
    '⚙️ Система',
    '',
    'Состояние сервиса, повторные попытки, аудит и действия операторов.',
    '',
    countLine('Готовы к повтору', summary?.retryDue || 0),
    countLine('Попытки исчерпаны', summary?.exhausted || 0),
    countLine('Ошибки доставки', summary?.failedDeliveries || 0),
    countLine('События аудита за 7 дней', summary?.recentAuditEvents || 0),
    '',
    `Ошибки: ${summary?.failures24h || 0} за 24 часа • ${summary?.failures7d || 0} за 7 дней`,
    `Доставлено: ${summary?.delivered24h || 0} за 24 часа • ${summary?.delivered7d || 0} за 7 дней`,
    `Действия операторов: ${summary?.operatorActions24h || 0} за 24 часа • ${summary?.operatorActions7d || 0} за 7 дней`,
    `Изменения публикации: ${summary?.listingChanges7d || 0} • повторные привязки: ${summary?.relinks7d || 0}`
  ].join('\n');
}
function buildSystemHubKeyboard({ summary = null } = {}) {
  return buildInlineKeyboard([
    [
      { text: `🔁 Готовы к повтору: ${summary?.retryDue || 0}`, callback_data: 'adm:sys:funnel:retry_due' },
      { text: `🧯 Попытки исчерпаны: ${summary?.exhausted || 0}`, callback_data: 'adm:sys:funnel:exhausted' }
    ],
    [
      { text: `📜 Аудит 7д: ${summary?.recentAuditEvents || 0}`, callback_data: 'adm:sys:funnel:audit_recent' },
      { text: `📝 Изменения публикаций: ${summary?.listingChanges7d || 0}`, callback_data: 'adm:sys:funnel:listing_changes' }
    ],
    [{ text: `🔄 Повторные привязки: ${summary?.relinks7d || 0}`, callback_data: 'adm:sys:funnel:relinks' }],
    [
      { text: '🧭 Регламент запуска', callback_data: 'adm:runbook' },
      { text: '🧊 Заморозка', callback_data: 'adm:freeze' }
    ],
    [
      { text: '✅ Проверка продакшена', callback_data: 'adm:verify' },
      { text: '🎭 Репетиция запуска', callback_data: 'adm:rehearse' }
    ],
    [
      { text: '🩺 Состояние сервиса', callback_data: 'adm:health' },
      { text: '📜 Аудит', callback_data: 'adm:audit' }
    ],
    [{ text: '👮 Операторы', callback_data: 'adm:opscope' }],
    buildBackHomeRow('← Назад в админку', 'adm:home')
  ]);
}
function buildPlaceholderText({ title, description, nextStep }) {
  const lines = [title, '', description];
  if (nextStep) {
    lines.push('', `Следующий шаг: ${nextStep}`);
  }
  return lines.join('\n');
}
function buildDetailFooter(backCallback) {
  return buildInlineKeyboard([
    buildBackHomeRow('← Назад', backCallback)
  ]);
}
function buildUsersSegmentRow(currentSegmentKey) {
  const ordered = ['all', 'conn', 'noprof', 'inc', 'noskills', 'ready', 'listd', 'listact', 'listinact', 'nointro', 'pend', 'relink'];
  const buttons = ordered.map((segmentKey) => ({
    text: `${currentSegmentKey === segmentKey ? '✅' : '▫️'} ${ADMIN_USER_SEGMENTS[segmentKey].label}`,
    callback_data: `adm:usr:seg:${segmentKey}`
  }));
  return [buttons.slice(0, 2), buttons.slice(2, 4), buttons.slice(4, 6), buttons.slice(6, 8), buttons.slice(8, 10), buttons.slice(10, 12)];
}
function buildIntroSegmentRows(currentSegmentKey) {
  const ordered = ['all', 'pend', 'p24', 'p72', 'acc', 'arec', 'dec', 'drec', 'fail', 'dprob'];
  const buttons = ordered.map((segmentKey) => ({
    text: `${currentSegmentKey === segmentKey ? '✅' : '▫️'} ${ADMIN_INTRO_SEGMENTS[segmentKey].label}`,
    callback_data: `adm:intro:seg:${segmentKey}`
  }));
  return [buttons.slice(0, 2), buttons.slice(2, 4), buttons.slice(4, 6), buttons.slice(6, 8), buttons.slice(8, 10)];
}
function buildDeliverySegmentRows(currentSegmentKey, introRequestId = null) {
  const ordered = ['all', 'fail', 'due', 'exh', 'ok'];
  const buttons = ordered.map((segmentKey) => ({
    text: `${currentSegmentKey === segmentKey ? '✅' : '▫️'} ${ADMIN_DELIVERY_SEGMENTS[segmentKey].label}`,
    callback_data: introRequestId
      ? `adm:dlv:intro:${introRequestId}:seg:${segmentKey}`
      : `adm:dlv:seg:${segmentKey}`
  }));
  return [buttons.slice(0, 2), buttons.slice(2, 5)];
}
function buildQualitySegmentRows(currentSegmentKey) {
  const ordered = ['listinc', 'ready', 'miss', 'dupe', 'relink'];
  const buttons = ordered.map((segmentKey) => ({
    text: `${currentSegmentKey === segmentKey ? '✅' : '▫️'} ${ADMIN_QUALITY_SEGMENTS[segmentKey].label}`,
    callback_data: `adm:qual:seg:${segmentKey}`
  }));
  return [buttons.slice(0, 2), buttons.slice(2, 4), buttons.slice(4, 5)];
}
function buildAuditSegmentRows(currentSegmentKey) {
  const ordered = ['all', 'not', 'bc', 'user', 'relink'];
  const buttons = ordered.map((segmentKey) => ({
    text: `${currentSegmentKey === segmentKey ? '✅' : '▫️'} ${ADMIN_AUDIT_SEGMENTS[segmentKey].label}`,
    callback_data: `adm:audit:seg:${segmentKey}`
  }));
  return [buttons.slice(0, 2), buttons.slice(2, 4), buttons.slice(4, 5)];
}
function qualityReasonLabel(item) {
  if (item?.listedIncomplete) return 'неполная публикация';
  if (item?.readyNotListed) return 'готов, но не опубликован';
  if (item?.missingCritical) return 'не хватает обязательных полей';
  if (item?.duplicateLike) return 'возможный дубль';
  return 'история повторных привязок';
}
function formatAuditActor(record) {
  if (record?.actor_display_name) return record.actor_display_name;
  if (record?.actor_telegram_username) return `@${record.actor_telegram_username}`;
  if (record?.actor_telegram_user_id) return `Telegram ID ${record.actor_telegram_user_id}`;
  return 'система';
}
function formatAuditTarget(record) {
  if (record?.target_display_name) return record.target_display_name;
  if (record?.target_telegram_username) return `@${record.target_telegram_username}`;
  if (record?.target_telegram_user_id) return `Telegram ID ${record.target_telegram_user_id}`;
  return '—';
}
function renderIntroListLine(item, index, page = 0, pageSize = 8) {
  const ordinal = page * pageSize + index + 1;
  const sender = truncate(item?.requesterDisplayName, 18);
  const target = truncate(item?.targetDisplayName, 18);
  const status = adminStateLabel(item?.status, 'неизвестно');
  const age = formatDateTimeShort(item?.updatedAt || item?.createdAt);
  const warning = item?.deliveryProblemCount > 0 ? ' • проблема доставки' : '';
  return `${ordinal}. ${sender} → ${target} • ${status} · ${adminCode(item?.status, 'unknown')} • ${age}${warning}`;
}
function buildAdminIntrosText({ state = null, notice = null } = {}) {
  if (!state?.persistenceEnabled) {
    return ['📨 Интро', '', notice || '⚠️ Данные интро сейчас недоступны.'].join('\n');
  }
  const lines = [
    '📨 Интро',
    '',
    `Сегмент: ${ADMIN_INTRO_SEGMENTS[state.segmentKey]?.label || 'Все'} • страница ${state.page + 1}`,
    `Записей в сегменте: ${state.totalCount}`,
    `В ожидании: ${state.counts?.pending || 0} • принято: ${state.counts?.accepted || 0} • отклонено: ${state.counts?.declined || 0} • просрочено: ${state.counts?.stale || 0} • ошибки уведомлений: ${state.counts?.failedNotify || 0}`
  ];
  if (notice) lines.push('', notice);
  if (!state.intros?.length) {
    lines.push('', 'В этом сегменте пока нет интро.');
    return lines.join('\n');
  }
  lines.push('', 'Выберите интро:');
  lines.push(...state.intros.map((item, index) => renderIntroListLine(item, index, state.page, state.pageSize)));
  return lines.join('\n');
}
function buildAdminIntrosKeyboard({ state = null } = {}) {
  const segmentKey = normalizeAdminIntroSegment(state?.segmentKey);
  const targetUserId = state?.targetUserId || null;
  const rows = buildIntroSegmentRows(segmentKey).map((row) => row.map((button) => ({
    ...button,
    callback_data: targetUserId ? `adm:intro:user:${targetUserId}:seg:${button.callback_data.split(':').pop()}` : button.callback_data
  })));
  for (const item of state?.intros || []) {
    const label = truncate(`${item?.requesterDisplayName || 'Неизвестно'} → ${item?.targetDisplayName || 'Неизвестно'}`, 42);
    rows.push([{ text: `📄 ${label}`, callback_data: targetUserId ? `adm:intro:user:${targetUserId}:open:${item.introRequestId}:${segmentKey}:${state?.page || 0}` : `adm:intro:open:${item.introRequestId}:${segmentKey}:${state?.page || 0}` }]);
  }
  const pager = [];
  if (state?.hasPrev) {
    pager.push({ text: '‹ Предыдущая', callback_data: targetUserId ? `adm:intro:user:${targetUserId}:page:${segmentKey}:${Math.max(0, (state?.page || 0) - 1)}` : `adm:intro:page:${segmentKey}:${Math.max(0, (state?.page || 0) - 1)}` });
  }
  if (state?.hasNext) {
    pager.push({ text: 'Следующая ›', callback_data: targetUserId ? `adm:intro:user:${targetUserId}:page:${segmentKey}:${(state?.page || 0) + 1}` : `adm:intro:page:${segmentKey}:${(state?.page || 0) + 1}` });
  }
  if (pager.length) {
    rows.push(pager);
  }
  rows.push([{ text: '🔎 Поиск интро', callback_data: 'adm:search:intros' }]);
  rows.push(buildBackHomeRow(targetUserId ? '← Назад в карточку пользователя' : '← Назад в операции', targetUserId ? `adm:usr:open:${targetUserId}:all:0` : 'adm:ops'));
  return buildInlineKeyboard(rows);
}
function buildAdminIntroDetailText({ intro = null, notificationSummary = null, recentReceipts = [], notice = null } = {}) {
  if (!intro) return ['📄 Интро', '', notice || '⚠️ Интро не найдено.'].join('\n');
  const lines = [
    '📄 Интро',
    '',
    `Отправитель: ${toDisplayValue(intro.requester_display_name)}${intro.requester_headline_user ? ` • ${truncate(intro.requester_headline_user, 60)}` : ''}`,
    `Получатель: ${toDisplayValue(intro.target_display_name)}${intro.target_headline_user ? ` • ${truncate(intro.target_headline_user, 60)}` : ''}`,
    `Статус: ${adminStateWithCode(intro.status, 'неизвестно')}`,
    `Создано: ${formatDateTimeShort(intro.created_at)}`,
    `Обновлено: ${formatDateTimeShort(intro.updated_at)}`,
    '',
    `Связка: ${truncate(intro.requester_display_name, 32)} → ${truncate(intro.target_display_name, 32)}`,
    '',
    `Доставка: отправлено ${notificationSummary?.sentCount || 0} • ошибок ${notificationSummary?.failedCount || 0} • готово к повтору ${notificationSummary?.retryDueCount || 0} • попытки исчерпаны ${notificationSummary?.exhaustedCount || 0}`
  ];
  if (recentReceipts?.length) {
    lines.push('', 'Последние события доставки:');
    lines.push(...recentReceipts.slice(0, 3).map((item) => `• ${adminStateLabel(item.operatorBucket, 'событие')} · код: ${adminCode(item.operatorBucket, 'unknown')} • событие: ${adminCode(item.eventType, 'unknown')} • попыток ${item.attemptCount}/${item.maxAttempts}`));
  }
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminIntroDetailKeyboard({ intro = null, backCallback = 'adm:intro:list' } = {}) {
  const rows = [];
  if (intro?.requester_user_id) {
    rows.push([{ text: '👤 Отправитель', callback_data: `adm:usr:open:${intro.requester_user_id}:all:0` }]);
  }
  if (intro?.target_user_id) {
    rows.push([{ text: '👤 Получатель', callback_data: `adm:usr:open:${intro.target_user_id}:all:0` }]);
  }
  rows.push([{ text: '🧾 Доставка', callback_data: `adm:intro:dlv:${intro?.intro_request_id || 0}` }]);
  rows.push(buildBackHomeRow('← Назад к интро', backCallback));
  return buildInlineKeyboard(rows);
}
function renderDeliveryListLine(item, index, page = 0, pageSize = 8) {
  const ordinal = page * pageSize + index + 1;
  const target = truncate(item?.recipientDisplayName || 'Неизвестный получатель', 18);
  const counterpart = truncate(`${item?.requesterDisplayName || 'Неизвестно'} → ${item?.targetDisplayName || 'Неизвестно'}`, 24);
  const state = adminStateLabel(item?.operatorBucket, 'ошибка');
  const errorSuffix = item?.lastErrorCode ? ` • код ошибки: ${adminCode(item.lastErrorCode, 'unknown')}` : '';
  return `${ordinal}. ${target} • ${state} · ${adminCode(item?.operatorBucket, 'failed')} • ${counterpart} • попыток ${item?.attemptCount || 0}/${item?.maxAttempts || 0}${errorSuffix}`;
}
function buildAdminDeliveryText({ state = null, notice = null } = {}) {
  if (!state?.persistenceEnabled) return ['🧾 Доставка', '', notice || '⚠️ Данные доставки сейчас недоступны.'].join('\n');
  const lines = [
    '🧾 Доставка',
    '',
    `Сегмент: ${ADMIN_DELIVERY_SEGMENTS[state.segmentKey]?.label || 'Все'} • страница ${state.page + 1}`,
    state.introRequestId ? `Интро: #${state.introRequestId}` : 'Все уведомления по интро',
    `Записей в сегменте: ${state.totalCount}`,
    `Ошибки: ${state.counts?.failed || 0} • готовы к повтору: ${state.counts?.retryDue || 0} • попытки исчерпаны: ${state.counts?.exhausted || 0} • доставлено: ${state.counts?.sent || 0}`
  ];
  if (notice) lines.push('', notice);
  if (!state.records?.length) {
    lines.push('', 'В этом сегменте пока нет записей доставки.');
    return lines.join('\n');
  }
  lines.push('', 'Выберите запись:');
  lines.push(...state.records.map((item, index) => renderDeliveryListLine(item, index, state.page, state.pageSize)));
  return lines.join('\n');
}
function buildAdminDeliveryKeyboard({ state = null } = {}) {
  const segmentKey = normalizeAdminDeliverySegment(state?.segmentKey);
  const introRequestId = state?.introRequestId || null;
  const rows = [...buildDeliverySegmentRows(segmentKey, introRequestId)];
  for (const item of state?.records || []) {
    const bucketLabel = adminStateLabel(item?.operatorBucket, 'ошибка');
    const label = truncate(`${item?.recipientDisplayName || 'Неизвестно'} • ${bucketLabel} • #${item?.notificationReceiptId}`, 42);
    const callback = introRequestId
      ? `adm:dlv:intro:${introRequestId}:open:${item.notificationReceiptId}`
      : `adm:dlv:open:${item.notificationReceiptId}:${segmentKey}:${state?.page || 0}`;
    rows.push([{ text: `🧾 ${label}`, callback_data: callback }]);
  }
  const pager = [];
  if (state?.hasPrev) pager.push({ text: '‹ Предыдущая', callback_data: introRequestId ? `adm:dlv:intro:${introRequestId}:page:${segmentKey}:${Math.max(0, (state?.page || 0) - 1)}` : `adm:dlv:page:${segmentKey}:${Math.max(0, (state?.page || 0) - 1)}` });
  if (state?.hasNext) pager.push({ text: 'Следующая ›', callback_data: introRequestId ? `adm:dlv:intro:${introRequestId}:page:${segmentKey}:${(state?.page || 0) + 1}` : `adm:dlv:page:${segmentKey}:${(state?.page || 0) + 1}` });
  if (pager.length) rows.push(pager);
  rows.push([{ text: '🔎 Поиск доставки', callback_data: 'adm:search:delivery' }]);
  rows.push(buildBackHomeRow(introRequestId ? '← Назад к интро' : '← Назад в операции', introRequestId ? `adm:intro:open:${introRequestId}:all:0` : 'adm:ops'));
  return buildInlineKeyboard(rows);
}
function buildAdminDeliveryRecordText({ record = null, notice = null } = {}) {
  if (!record) return ['🧾 Доставка', '', notice || 'Запись доставки не найдена.'].join('\n');
  const lines = [
    '🧾 Запись доставки',
    '',
    `Событие: ${adminEventTypeWithCode(record.event_type)}`,
    `Интро: #${record.intro_request_id || '—'}`,
    `Получатель: ${toDisplayValue(record.recipient_display_name)}`,
    `Статус доставки: ${adminStateWithCode(record.delivery_status, 'неизвестно')}`,
    `Операторская группа: ${adminStateWithCode(record.operator_bucket, 'неизвестно')}`,
    `Попытки: ${record.attempt_count || 0}/${record.max_attempts || 0}`,
    `Следующий повтор: ${formatDateTimeShort(record.next_attempt_at)}`,
    `Последняя попытка: ${formatDateTimeShort(record.last_attempt_at)}`,
    `Доставлено: ${formatDateTimeShort(record.delivered_at)}`,
    `Создано: ${formatDateTimeShort(record.created_at)}`,
    `Код ошибки: ${adminCode(record.last_error_code || record.error_message, 'none')}`
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminDeliveryRecordKeyboard({ record = null, backCallback = 'adm:dlv' } = {}) {
  const rows = [];
  if (record?.recipient_user_id) {
    rows.push([{ text: '👤 Открыть пользователя', callback_data: `adm:usr:open:${record.recipient_user_id}:all:0` }]);
  }
  if (record?.intro_request_id) {
    rows.push([{ text: '📄 Открыть интро', callback_data: `adm:intro:open:${record.intro_request_id}:all:0` }]);
  }
  rows.push(buildBackHomeRow('← Назад к доставке', backCallback));
  return buildInlineKeyboard(rows);
}
function renderUsersListLine(item, index, page = 0, pageSize = 8) {
  const ordinal = page * pageSize + index + 1;
  const name = truncate(item?.displayName || item?.linkedinName || item?.telegramUsername || `Пользователь ${item?.telegramUserId}`, 22);
  const linkedIn = compactBooleanLabel(item?.hasLinkedIn, 'LinkedIn подключён', 'без LinkedIn');
  const listing = item?.visibilityStatus === 'listed' ? 'опубликован' : item?.profileId ? 'скрыт' : 'без профиля';
  const readiness = item?.profileState === 'active' ? 'готов' : 'не завершён';
  const intros = item?.pendingIntroCount ? `в ожидании ${item.pendingIntroCount}` : 'без ожидающих интро';
  return `${ordinal}. ${name} • ${linkedIn} • ${listing} • ${readiness} • ${intros}`;
}
function buildUsersListText({ state = null, notice = null } = {}) {
  if (!state?.persistenceEnabled) {
    return [
      '👥 Пользователи',
      '',
      notice || '⚠️ Данные пользователей недоступны в этой среде.'
    ].join('\n');
  }
  const lines = [
    '👥 Пользователи',
    '',
    `Сегмент: ${ADMIN_USER_SEGMENTS[state.segmentKey]?.label || 'Все'} • стр. ${state.page + 1}`,
    countLine('Видно в этом сегменте', state.totalCount),
    `Подключили LinkedIn ${state.counts?.connected || 0} • без профиля ${state.counts?.connectedNoProfile || 0} • неполные ${state.counts?.incomplete || 0}`,
    `Готовы, но скрыты ${state.counts?.readyNotListed || 0} • готовы без навыков ${state.counts?.readyNoSkills || 0}`,
    `Опубликованы ${state.counts?.listed || 0} • активны ${state.counts?.listedActive || 0} • неактивны ${state.counts?.listedInactive || 0}`,
    `Без интро ${state.counts?.noIntroYet || 0} • интро в ожидании ${state.counts?.pendingIntros || 0} • повторные привязки ${state.counts?.relinks || 0}`
  ];
  if (notice) {
    lines.push('', notice);
  }
  if (!state.users?.length) {
    lines.push('', 'В этом сегменте сейчас нет пользователей.');
    return lines.join('\n');
  }
  lines.push('', 'Откройте карточку пользователя:');
  lines.push(...state.users.map((item, index) => renderUsersListLine(item, index, state.page, state.pageSize)));
  return lines.join('\n');
}
function buildUsersListKeyboard({ state = null } = {}) {
  const segmentKey = normalizeAdminUserSegment(state?.segmentKey);
  const rows = [...buildUsersSegmentRow(segmentKey)];
  for (const item of state?.users || []) {
    const label = truncate(item?.displayName || item?.linkedinName || item?.telegramUsername || `Пользователь ${item?.telegramUserId}`, 42);
    rows.push([{ text: `🪪 ${label}`, callback_data: `adm:usr:open:${item.userId}:${segmentKey}:${state?.page || 0}` }]);
  }
  const pager = [];
  if (state?.hasPrev) {
    pager.push({ text: '‹ Предыдущая', callback_data: `adm:usr:page:${segmentKey}:${Math.max(0, (state?.page || 0) - 1)}` });
  }
  if (state?.hasNext) {
    pager.push({ text: 'Следующая ›', callback_data: `adm:usr:page:${segmentKey}:${(state?.page || 0) + 1}` });
  }
  if (pager.length) {
    rows.push(pager);
  }
  rows.push([{ text: '📦 Массовые действия', callback_data: `adm:bulk:user:${segmentKey}:${state?.page || 0}` }]);
  rows.push([{ text: '🔎 Поиск пользователей', callback_data: 'adm:search:users' }]);
  rows.push([{ text: state?.targetUserId ? '← Назад в карточку пользователя' : '← Назад в операции', callback_data: state?.targetUserId ? `adm:usr:open:${state.targetUserId}:all:0` : 'adm:ops' }]);
  rows.push([{ text: ADMIN_COPY.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}
function buildAdminUserCardText({ card = null, notice = null } = {}) {
  if (!card) return ['🪪 Карточка пользователя', '', notice || '⚠️ Пользователь не найден.'].join('\n');
  const trust = resolveLinkedInTrustState({ profileSnapshot: card, verificationConfig: getLinkedInVerificationConfig() });
  const lines = [
    '🪪 Карточка пользователя',
    '',
    `Telegram: ${toDisplayValue(card.telegram_username ? `@${card.telegram_username}` : null, `id ${card.telegram_user_id}`)}`,
    `Имя: ${toDisplayValue(card.display_name, card.linkedin_name || '—')}`,
    `LinkedIn: ${card.linkedin_sub ? `подключён • ${toDisplayValue(card.linkedin_name)}` : 'не подключён'}`,
    `Доверие LinkedIn: личность ${trust.identityVerified ? 'подтверждена' : 'не подтверждена'} • место работы ${trust.workplaceVerified ? 'подтверждено' : 'не подтверждено'}`,
    `Снимок доверия: ${describeLinkedInTrustSnapshotStatus(trust)}`,
    `Публичный значок: ${trust.publicBadgeEligible ? 'доступен' : describeLinkedInPublicBadgeGate(trust)}`,
    `Профиль: ${profileReadinessLabel(card)}`,
    `Публикация: ${card.profile_id ? adminStateWithCode(card.visibility_status, 'скрыт') : '—'}`,
    `Навыки: ${card.skills?.length || 0}`,
    `Заголовок: ${truncate(card.headline_user, 72)}`,
    `Интро: отправлено ${card.intro_sent_count || 0} • получено ${card.intro_received_count || 0} • в ожидании ${card.pending_intro_count || 0}`,
    `Последняя активность: ${formatDateTimeShort(card.last_seen_at)}`,
    'Действия: сообщение • интро • аудит'
  ];
  if (card.operator_note_text) {
    lines.push('', `Заметка оператора: ${truncate(card.operator_note_text, 140)}`);
    lines.push(`Заметка обновлена: ${formatDateTimeShort(card.operator_note_updated_at)}`);
  } else lines.push('', 'Заметка оператора: —');
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminUserCardKeyboard({ card = null, segmentKey = 'all', page = 0 } = {}) {
  const rows = [];
  if (card?.profile_id) {
    rows.push([{ text: '👁 Открыть публичную карточку', callback_data: `adm:card:view:${card.user_id}:${segmentKey}:${page}` }]);
    if (card.profile_state === 'active' && card.visibility_status === 'listed') rows.push([{ text: '🙈 Скрыть из каталога', callback_data: `adm:card:hide:${card.user_id}:${segmentKey}:${page}` }]);
    else if (card.profile_state === 'active') rows.push([{ text: '🌍 Опубликовать в каталоге', callback_data: `adm:card:unhide:${card.user_id}:${segmentKey}:${page}` }]);
  }
  rows.push([
    { text: '✍️ Заметка', callback_data: `adm:card:note:${card?.user_id || 0}:${segmentKey}:${page}` },
    { text: '✉️ Сообщение', callback_data: `adm:card:msg:${card?.user_id || 0}:${segmentKey}:${page}` }
  ]);
  rows.push([
    { text: '📨 Интро', callback_data: `adm:card:intros:${card?.user_id || 0}` },
    { text: '📜 Аудит', callback_data: `adm:card:audit:${card?.user_id || 0}` }
  ]);
  rows.push(buildBackHomeRow('← Назад к пользователям', `adm:usr:page:${segmentKey}:${page}`));
  return buildInlineKeyboard(rows);
}
function buildAdminUserPublicCardText({ card = null, notice = null } = {}) {
  if (!card?.profile_id) return ['👁 Публичная карточка', '', notice || 'У пользователя пока нет профиля.'].join('\n');
  const lines = [
    '👁 Публичная карточка',
    '',
    toDisplayValue(card.display_name, card.linkedin_name || 'Без имени'),
    truncate(card.headline_user, 120),
    '',
    `Компания: ${toDisplayValue(card.company_user)}`,
    `Город: ${toDisplayValue(card.city_user)}`,
    `Отрасль: ${toDisplayValue(card.industry_user)}`,
    `Навыки: ${Array.isArray(card.skills) && card.skills.length ? card.skills.map((skill) => skill.skill_label).join(', ') : '—'}`,
    `LinkedIn: ${toDisplayValue(card.linkedin_public_url)}`,
    '',
    `О себе: ${truncate(card.about_user, 320)}`,
    '',
    `Видимость: ${adminStateWithCode(card.visibility_status, 'неизвестно')}`,
    `Состояние профиля: ${adminStateWithCode(card.profile_state, 'неизвестно')}`
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminUserPublicCardKeyboard({ targetUserId, segmentKey = 'all', page = 0 } = {}) {
  return buildInlineKeyboard([
    buildBackHomeRow('← Назад в карточку пользователя', `adm:usr:open:${targetUserId}:${segmentKey}:${page}`)
  ]);
}
function directTemplateLabel(templateKey) {
  return ADMIN_DIRECT_MESSAGE_TEMPLATES[templateKey]?.label || 'Пустое сообщение';
}
function noticeTemplateLabel(templateKey) {
  return ADMIN_NOTICE_TEMPLATES[normalizeAdminNoticeTemplate(templateKey)]?.label || 'Шаблон уведомления';
}
function broadcastTemplateLabel(templateKey) {
  return ADMIN_BROADCAST_TEMPLATES[normalizeAdminBroadcastTemplate(templateKey)]?.label || 'Шаблон рассылки';
}
function formatOutboxTarget(record) {
  if (record?.event_type === 'direct') {
    return toDisplayValue(record?.target_display_name, record?.target_telegram_username ? `@${record.target_telegram_username}` : record?.target_telegram_user_id ? `id ${record.target_telegram_user_id}` : 'получатель личного сообщения');
  }
  return toDisplayValue(record?.audience_key, '—');
}
function buildAdminUserMessageText({ card = null, state = null, notice = null } = {}) {
  const draft = state?.draft || {};
  const targetLabel = toDisplayValue(card?.display_name, card?.linkedin_name || card?.telegram_username || draft?.targetDisplayName || draft?.targetLinkedinName || 'этот пользователь');
  const lines = [
    '✉️ Личное сообщение',
    '',
    `Получатель: ${targetLabel}`,
    `Telegram: ${toDisplayValue(card?.telegram_username ? `@${card.telegram_username}` : null, card?.telegram_user_id ? `id ${card.telegram_user_id}` : draft?.targetTelegramUserId ? `id ${draft.targetTelegramUserId}` : '—')}`,
    `Шаблон: ${directTemplateLabel(draft?.templateKey || 'blank')}`,
    `Обновлено: ${formatDateTimeShort(draft?.updatedAt)}`,
    '',
    draft?.body ? truncate(draft.body, 500) : 'Текст сообщения пока пуст.'
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminUserMessageKeyboard({ targetUserId, segmentKey = 'all', page = 0 } = {}) {
  return buildInlineKeyboard([
    [{ text: '📌 Выбрать шаблон', callback_data: `adm:msg:tpl:${targetUserId}:${segmentKey}:${page}` }],
    [{ text: '✏️ Изменить текст', callback_data: `adm:msg:edit:${targetUserId}:${segmentKey}:${page}` }],
    [{ text: '👁 Превью', callback_data: `adm:msg:preview:${targetUserId}:${segmentKey}:${page}` }],
    [{ text: '🗑 Очистить черновик', callback_data: `adm:msg:clear:${targetUserId}:${segmentKey}:${page}` }],
    [{ text: '← Назад в карточку пользователя', callback_data: `adm:usr:open:${targetUserId}:${segmentKey}:${page}` }],
    [{ text: ADMIN_COPY.home, callback_data: 'home:root' }]
  ]);
}
function buildAdminDirectTemplatePickerText({ card = null, state = null, notice = null } = {}) {
  const targetLabel = toDisplayValue(card?.display_name, card?.linkedin_name || card?.telegram_username || state?.draft?.targetDisplayName || 'этот пользователь');
  const lines = [
    '📌 Шаблон личного сообщения',
    '',
    `Цель: ${targetLabel}`,
    `Текущий шаблон: ${directTemplateLabel(state?.draft?.templateKey || 'blank')}`
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminDirectTemplatePickerKeyboard({ targetUserId, segmentKey = 'all', page = 0, state = null } = {}) {
  const current = state?.draft?.templateKey || 'blank';
  const rows = Object.values(ADMIN_DIRECT_MESSAGE_TEMPLATES).map((item) => ([{ text: `${current === item.key ? '✅' : '▫️'} ${item.label}`, callback_data: `adm:msg:tplset:${targetUserId}:${segmentKey}:${page}:${item.key}` }]));
  rows.push(buildBackHomeRow('← Назад к сообщению', `adm:card:msg:${targetUserId}:${segmentKey}:${page}`));
  return buildInlineKeyboard(rows);
}
function buildAdminDirectПревьюText({ card = null, state = null, notice = null } = {}) {
  const draft = state?.draft || {};
  const targetLabel = toDisplayValue(card?.display_name, card?.linkedin_name || card?.telegram_username || draft?.targetDisplayName || 'этот пользователь');
  const lines = [
    '👁 Превью личного сообщения',
    '',
    `Получатель: ${targetLabel}`,
    `Шаблон: ${directTemplateLabel(draft?.templateKey || 'blank')}`,
    '',
    draft?.body || 'Текст сообщения пока пуст.'
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminDirectПревьюKeyboard({ targetUserId, segmentKey = 'all', page = 0 } = {}) {
  return buildInlineKeyboard([
    [{ text: '✅ Подтвердить отправку', callback_data: `adm:msg:confirm:${targetUserId}:${segmentKey}:${page}` }],
    buildBackHomeRow('← Назад к сообщению', `adm:card:msg:${targetUserId}:${segmentKey}:${page}`)
  ]);
}
function buildAdminUserNotePromptText({ card = null } = {}) {
  return [
    '✍️ Заметка оператора',
    '',
    `Отправьте текст заметки для пользователя: ${toDisplayValue(card?.display_name, card?.linkedin_name || card?.telegram_username || 'этот пользователь')}.`,
    'Новая заметка заменит предыдущую.',
    '',
    `Текущая заметка: ${truncate(card?.operator_note_text, 220)}`
  ].join('\n');
}
function buildAdminUserNotePromptKeyboard({ targetUserId, segmentKey = 'all', page = 0 } = {}) {
  return buildInlineKeyboard([
    buildBackHomeRow('← Отмена', `adm:card:cancelnote:${targetUserId}:${segmentKey}:${page}`)
  ]);
}
function buildAdminQualityText({ state = null, notice = null } = {}) {
  if (!state?.persistenceEnabled) return ['🚩 Качество', '', notice || '⚠️ Данные качества сейчас недоступны.'].join('\n');
  const lines = [
    '🚩 Качество профилей',
    '',
    `Сегмент: ${ADMIN_QUALITY_SEGMENTS[state.segmentKey]?.label || 'Неполная публикация'} • страница ${state.page + 1}`,
    countLine('Профилей в сегменте', state.totalCount),
    `Неполные публикации: ${state.counts?.listedIncomplete || 0} • готовы, но не опубликованы: ${state.counts?.readyNotListed || 0}`,
    `Не хватает полей: ${state.counts?.missingCritical || 0} • возможные дубли: ${state.counts?.duplicateLike || 0} • повторные привязки: ${state.counts?.relink || 0}`
  ];
  if (notice) lines.push('', notice);
  if (!state.users?.length) {
    lines.push('', 'В этом сегменте качества сейчас нет профилей.');
    return lines.join('\n');
  }
  lines.push('', 'Выберите карточку пользователя:');
  lines.push(...state.users.map((item, index) => `${state.page * state.pageSize + index + 1}. ${truncate(item?.displayName || item?.linkedinName || item?.telegramUsername || `Пользователь ${item?.telegramUserId}`, 22)} • ${qualityReasonLabel(item)} • навыков ${item?.skillsCount || 0} • интро в ожидании ${item?.pendingIntroCount || 0}`));
  return lines.join('\n');
}
function buildAdminQualityKeyboard({ state = null } = {}) {
  const segmentKey = normalizeAdminQualitySegment(state?.segmentKey);
  const rows = [...buildQualitySegmentRows(segmentKey)];
  for (const item of state?.users || []) {
    const label = truncate(item?.displayName || item?.linkedinName || item?.telegramUsername || `Пользователь ${item?.telegramUserId}`, 42);
    rows.push([{ text: `🪪 ${label}`, callback_data: `adm:usr:open:${item.userId}:all:0` }]);
  }
  const pager = [];
  if (state?.hasPrev) pager.push({ text: '‹ Предыдущая', callback_data: `adm:qual:page:${segmentKey}:${Math.max(0, (state?.page || 0) - 1)}` });
  if (state?.hasNext) pager.push({ text: 'Следующая ›', callback_data: `adm:qual:page:${segmentKey}:${(state?.page || 0) + 1}` });
  if (pager.length) rows.push(pager);
  rows.push([{ text: '📦 Массовые действия', callback_data: `adm:bulk:user:${segmentKey}:${state?.page || 0}` }]);
  rows.push([{ text: '🔎 Поиск пользователей', callback_data: 'adm:search:users' }]);
  rows.push([{ text: state?.targetUserId ? '← Назад в карточку пользователя' : '← Назад в операции', callback_data: state?.targetUserId ? `adm:usr:open:${state.targetUserId}:all:0` : 'adm:ops' }]);
  rows.push([{ text: ADMIN_COPY.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}
function buildAdminAuditText({ state = null, notice = null } = {}) {
  if (!state?.persistenceEnabled) return ['📜 Аудит', '', notice || '⚠️ Данные аудита сейчас недоступны.'].join('\n');
  const lines = [
    '📜 Аудит',
    '',
    `Сегмент: ${ADMIN_AUDIT_SEGMENTS[state.segmentKey]?.label || 'Все'} • страница ${state.page + 1}`,
    state.targetUserId ? `Пользователь: #${state.targetUserId}` : 'Действия операторов и системы',
    countLine('Событий в сегменте', state.totalCount)
  ];
  if (notice) lines.push('', notice);
  if (!state.records?.length) {
    lines.push('', 'В этом сегменте аудита пока нет событий.');
    return lines.join('\n');
  }
  lines.push('', 'Последние события:');
  lines.push(...state.records.map((item, index) => `${state.page * state.pageSize + index + 1}. ${adminEventTypeLabel(item.event_type)} · ${adminCode(item.event_type, 'unknown')} • ${truncate(item.summary || '', 36)} • ${formatAuditActor(item)} • ${formatDateTimeShort(item.created_at)}`));
  return lines.join('\n');
}
function buildAdminAuditKeyboard({ state = null } = {}) {
  const segmentKey = normalizeAdminAuditSegment(state?.segmentKey);
  const targetUserId = state?.targetUserId || null;
  const rows = buildAuditSegmentRows(segmentKey).map((row) => row.map((button) => ({
    ...button,
    callback_data: targetUserId
      ? `adm:audit:user:${targetUserId}:seg:${button.callback_data.split(':').pop()}`
      : button.callback_data
  })));
  for (const item of state?.records || []) {
    rows.push([{ text: `📄 ${truncate(item.event_type, 18)} • #${item.id}`, callback_data: targetUserId ? `adm:audit:user:${targetUserId}:open:${item.id}:${segmentKey}:${state?.page || 0}` : `adm:audit:open:${item.id}:${segmentKey}:${state?.page || 0}` }]);
  }
  const pager = [];
  if (state?.hasPrev) pager.push({ text: '‹ Предыдущая', callback_data: targetUserId ? `adm:audit:user:${targetUserId}:page:${segmentKey}:${Math.max(0, (state?.page || 0) - 1)}` : `adm:audit:page:${segmentKey}:${Math.max(0, (state?.page || 0) - 1)}` });
  if (state?.hasNext) pager.push({ text: 'Следующая ›', callback_data: targetUserId ? `adm:audit:user:${targetUserId}:page:${segmentKey}:${(state?.page || 0) + 1}` : `adm:audit:page:${segmentKey}:${(state?.page || 0) + 1}` });
  if (pager.length) rows.push(pager);
  rows.push([{ text: '🔎 Поиск аудита', callback_data: 'adm:search:audit' }]);
  rows.push([{ text: targetUserId ? '← Назад в карточку пользователя' : '← Назад в систему', callback_data: targetUserId ? `adm:usr:open:${targetUserId}:all:0` : 'adm:sys' }]);
  rows.push([{ text: ADMIN_COPY.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}
function buildAdminAuditRecordText({ record = null, notice = null } = {}) {
  if (!record) return ['📄 Событие аудита', '', notice || 'Запись аудита не найдена.'].join('\n');
  const detailText = record.detail ? JSON.stringify(record.detail, null, 2) : '—';
  const lines = [
    '📄 Событие аудита',
    '',
    `Тип: ${adminEventTypeWithCode(record.event_type)}`,
    `Инициатор: ${formatAuditActor(record)}`,
    `Цель: ${formatAuditTarget(record)}`,
    `Создано: ${formatDateTimeShort(record.created_at)}`,
    `Интро: ${record.intro_request_id || '—'}`,
    `Доставка: ${record.notification_receipt_id || '—'}`,
    '',
    `Описание: ${toDisplayValue(record.summary)}`,
    '',
    'Технические данные:',
    detailText
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminAuditRecordKeyboard({ record = null, backCallback = 'adm:audit' } = {}) {
  const rows = [];
  if (record?.target_user_id) {
    rows.push([{ text: '👤 Открыть пользователя', callback_data: `adm:usr:open:${record.target_user_id}:all:0` }]);
  }
  if (record?.intro_request_id) {
    rows.push([{ text: '📄 Открыть интро', callback_data: `adm:intro:open:${record.intro_request_id}:all:0` }]);
  }
  if (record?.detail?.outboxId) {
    rows.push([{ text: '📤 Открыть исходящие', callback_data: `adm:outbox:open:${record.detail.outboxId}` }]);
  }
  rows.push(buildBackHomeRow('← Назад к аудиту', backCallback));
  return buildInlineKeyboard(rows);
}
function adminNoticeAudienceLabel(audienceKey) {
  return ADMIN_NOTICE_AUDIENCES[normalizeAdminNoticeAudience(audienceKey)]?.label || 'Все пользователи';
}
function adminBroadcastAudienceLabel(audienceKey) {
  return ADMIN_BROADCAST_AUDIENCES[normalizeAdminBroadcastAudience(audienceKey)]?.label || 'Все подключённые';
}
function buildAdminNoticeText({ state = null, notice = null } = {}) {
  const current = state?.notice || { body: '', audienceKey: 'ALL', isActive: false };
  const lines = [
    '📣 Уведомление',
    '',
    `Статус: ${current.isActive ? 'активно' : 'неактивно'}`,
    `Аудитория: ${adminNoticeAudienceLabel(current.audienceKey)}`,
    `Оценка охвата: ${state?.estimate || 0}`,
    `Обновлено: ${formatDateTimeShort(current.updatedAt)}`,
    '',
    current.body ? truncate(current.body, 500) : 'Текст уведомления пока пуст.'
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminNoticeKeyboard({ state = null } = {}) {
  const current = state?.notice || { isActive: false };
  return buildInlineKeyboard([
    [
      { text: '✏️ Изменить текст', callback_data: 'adm:not:edit' },
      { text: '📌 Шаблоны', callback_data: 'adm:not:tpl' }
    ],
    [
      { text: '🎯 Аудитория', callback_data: 'adm:not:aud' },
      { text: '👁 Превью', callback_data: 'adm:not:preview' }
    ],
    [{ text: current.isActive ? '⛔ Выключить' : '✅ Включить', callback_data: current.isActive ? 'adm:not:off' : 'adm:not:on' }],
    buildBackHomeRow('← Назад в коммуникации', 'adm:comms')
  ]);
}
function buildAdminNoticeAudienceSurface({ state = null, notice = null } = {}) {
  const current = state?.notice || { audienceKey: 'ALL' };
  const rows = Object.values(ADMIN_NOTICE_AUDIENCES).map((item) => ([{
    text: `${normalizeAdminNoticeAudience(current.audienceKey) === item.key ? '✅' : '▫️'} ${item.label}`,
    callback_data: `adm:not:aud:${item.key}`
  }]));
  rows.push(buildBackHomeRow('← Назад к уведомлению', 'adm:not'));
  const lines = ['🎯 Аудитория уведомления', '', `Выбрано: ${adminNoticeAudienceLabel(current.audienceKey)}`, `Код: ${adminCode(current.audienceKey, 'ALL')}`];
  if (notice) lines.push('', notice);
  return { text: lines.join('\n'), reply_markup: buildInlineKeyboard(rows) };
}
function buildAdminNoticeПревьюSurface({ state = null, notice = null } = {}) {
  const current = state?.notice || { body: '', audienceKey: 'ALL', isActive: false };
  const lines = [
    '👁 Превью уведомления',
    '',
    `Аудитория: ${adminNoticeAudienceLabel(current.audienceKey)}`,
    `Код аудитории: ${adminCode(current.audienceKey, 'ALL')}`,
    '',
    current.body ? current.body : 'Текст уведомления пока пуст.'
  ];
  if (notice) lines.push('', notice);
  return {
    text: lines.join('\n'),
    reply_markup: buildInlineKeyboard([
      [{ text: current.isActive ? '⛔ Выключить' : '✅ Включить', callback_data: current.isActive ? 'adm:not:off' : 'adm:not:on' }],
      buildBackHomeRow('← Назад к уведомлению', 'adm:not')
    ])
  };
}
function adminBroadcastMediaLabel(mediaRef = null) {
  if (!mediaRef) {
    return 'нет';
  }
  return /^https?:\/\//i.test(String(mediaRef)) ? 'Ссылка · код: `url`' : 'Telegram file_id · код: `file_id`';
}
function adminBroadcastButtonLabel(draft = null) {
  if (draft?.buttonText && draft?.buttonUrl) {
    return `${draft.buttonText} → ${truncate(draft.buttonUrl, 42)}`;
  }
  if (draft?.buttonText || draft?.buttonUrl) {
    return 'заполнено не полностью';
  }
  return 'нет';
}
function adminBroadcastHardFailedCount(record = null) {
  return Math.max(0, (record?.failed_count || 0) - (record?.retry_due_count || 0) - (record?.exhausted_count || 0));
}
function buildBroadcastRecoveryActionRows(record = null) {
  const rows = [];
  const failedCount = adminBroadcastHardFailedCount(record);
  const retryDueCount = record?.retry_due_count || 0;
  if (failedCount > 0 || retryDueCount > 0) {
    const row = [];
    if (failedCount > 0) row.push({ text: `🔁 Повторить ошибки: ${failedCount}`, callback_data: `adm:bc:retry:failed:${record.id}` });
    if (retryDueCount > 0) row.push({ text: `🔁 Повторить готовые: ${retryDueCount}`, callback_data: `adm:bc:retry:retry_due:${record.id}` });
    if (row.length) rows.push(row);
  }
  return rows;
}
function adminBroadcastDeliveryModeLabel(draft = null) {
  if (draft?.mediaRef && draft?.body && draft.body.length > 1024) {
    return 'картинка, затем текст';
  }
  if (draft?.mediaRef && draft?.body) {
    return 'картинка + подпись';
  }
  if (draft?.mediaRef) {
    return 'только картинка';
  }
  return 'только текст';
}
function buildAdminBroadcastText({ state = null, notice = null } = {}) {
  const draft = state?.draft || { body: '', audienceKey: 'ALL_CONNECTED', mediaRef: null, buttonText: null, buttonUrl: null };
  const latest = state?.latestRecord || null;
  const lines = [
    '📬 Рассылка',
    '',
    `Аудитория: ${adminBroadcastAudienceLabel(draft.audienceKey)}`,
    `Оценка получателей: ${state?.estimate || 0}`,
    `Режим доставки: ${adminBroadcastDeliveryModeLabel(draft)}`,
    `Изображение: ${adminBroadcastMediaLabel(draft.mediaRef)}`,
    `Кнопка: ${adminBroadcastButtonLabel(draft)}`,
    `Обновлено: ${formatDateTimeShort(draft.updatedAt)}`
  ];
  if (latest) {
    const failedOnly = adminBroadcastHardFailedCount(latest);
    lines.push(`Последняя задача: #${latest.id}`);
    lines.push(`Статус: ${adminStateWithCode(latest.status, 'неизвестно')}`);
    lines.push(`Прогресс: доставлено ${latest.delivered_count || 0}/${latest.estimated_recipient_count ?? 0} • ошибки ${failedOnly} • готово к повтору ${latest.retry_due_count || 0} • попытки исчерпаны ${latest.exhausted_count || 0} • в ожидании ${latest.pending_count || 0}`);
    lines.push(`Начало: ${formatDateTimeShort(latest.started_at)} • завершение: ${formatDateTimeShort(latest.finished_at)}`);
    lines.push(`Размер пакета: ${latest.batch_size || '—'} • курсор: ${latest.cursor || 0}`);
    if (latest.last_error) lines.push(`Последняя ошибка: ${truncate(latest.last_error, 80)}`);
  }
  lines.push('', draft.body ? truncate(draft.body, 420) : 'Текст рассылки пока пуст. Можно отправить только изображение, если оно задано.');
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminBroadcastKeyboard({ state = null } = {}) {
  const latest = state?.latestRecord || null;
  const rows = [
    [
      { text: '✏️ Изменить текст', callback_data: 'adm:bc:edit' },
      { text: '📌 Шаблоны', callback_data: 'adm:bc:tpl' }
    ],
    [
      { text: '🎯 Аудитория', callback_data: 'adm:bc:aud' },
      { text: '👁 Превью', callback_data: 'adm:bc:preview' }
    ],
    [
      { text: '🖼 Картинка', callback_data: 'adm:bc:media' },
      { text: '🔘 Кнопка', callback_data: 'adm:bc:btn' }
    ],
    [
      { text: '📨 Отправить', callback_data: 'adm:bc:send' },
      { text: '🔄 Обновить', callback_data: 'adm:bc:refresh' }
    ]
  ];
  if (state?.draft?.mediaRef) {
    rows.push([{ text: '🗑 Убрать картинку', callback_data: 'adm:bc:media:clear' }]);
  }
  if (latest?.id) {
    const lastTaskRow = [{ text: '📄 Последняя задача', callback_data: 'adm:bc:last' }];
    if (latest?.failed_count > 0 || latest?.retry_due_count > 0 || latest?.exhausted_count > 0) {
      lastTaskRow.push({ text: '🧾 Ошибки', callback_data: `adm:bc:fail:${latest.id}:0` });
    }
    rows.push(lastTaskRow);
    rows.push(...buildBroadcastRecoveryActionRows(latest));
    rows.push([{ text: '📤 Исходящие', callback_data: 'adm:outbox' }]);
    rows.push([{ text: '🗑 Очистить черновик', callback_data: 'adm:bc:clear' }]);
  } else {
    rows.push([
      { text: '📤 Исходящие', callback_data: 'adm:outbox' },
      { text: '🗑 Очистить черновик', callback_data: 'adm:bc:clear' }
    ]);
  }
  rows.push(buildBackHomeRow('← Назад в коммуникации', 'adm:comms'));
  return buildInlineKeyboard(rows);
}
function buildAdminBroadcastAudienceSurface({ state = null, notice = null } = {}) {
  const draft = state?.draft || { audienceKey: 'ALL_CONNECTED' };
  const rows = Object.values(ADMIN_BROADCAST_AUDIENCES).map((item) => ([{
    text: `${normalizeAdminBroadcastAudience(draft.audienceKey) === item.key ? '✅' : '▫️'} ${item.label}`,
    callback_data: `adm:bc:aud:${item.key}`
  }]));
  rows.push(buildBackHomeRow('← Назад к рассылке', 'adm:bc'));
  const lines = ['🎯 Аудитория рассылки', '', `Текущее: ${adminBroadcastAudienceLabel(draft.audienceKey)}`];
  if (notice) {
    lines.push('', notice);
  }
  return { text: lines.join('\n'), reply_markup: buildInlineKeyboard(rows) };
}
function buildAdminBroadcastButtonSurface({ state = null, notice = null } = {}) {
  const draft = state?.draft || { buttonText: null, buttonUrl: null };
  const lines = [
    '🔘 Кнопка рассылки',
    '',
    `Текст: ${draft.buttonText || '—'}`,
    `Ссылка: ${draft.buttonUrl || '—'}`,
    '',
    'Кнопка добавляется только если заполнены и текст, и ссылка.'
  ];
  if (notice) {
    lines.push('', notice);
  }
  return {
    text: lines.join('\n'),
    reply_markup: buildInlineKeyboard([
      [
        { text: '✏️ Текст кнопки', callback_data: 'adm:bc:btn:text' },
        { text: '🔗 Ссылка кнопки', callback_data: 'adm:bc:btn:url' }
      ],
      [{ text: '🗑 Очистить кнопку', callback_data: 'adm:bc:btn:clear' }],
      buildBackHomeRow('← Назад к рассылке', 'adm:bc')
    ])
  };
}
function buildAdminBroadcastPreviewSurface({ state = null, notice = null } = {}) {
  const draft = state?.draft || { body: '', audienceKey: 'ALL_CONNECTED', mediaRef: null, buttonText: null, buttonUrl: null };
  const latest = state?.latestRecord || null;
  const lines = [
    '👁 Превью рассылки',
    '',
    `Аудитория: ${adminBroadcastAudienceLabel(draft.audienceKey)}`,
    `Код аудитории: ${adminCode(draft.audienceKey, 'ALL_CONNECTED')}`,
    `Оценка получателей: ${state?.estimate || 0}`,
    `Режим доставки: ${adminBroadcastDeliveryModeLabel(draft)}`,
    `Изображение: ${adminBroadcastMediaLabel(draft.mediaRef)}`,
    `Кнопка: ${adminBroadcastButtonLabel(draft)}`,
    '',
    draft.body ? draft.body : 'Текст не задан. Если указано изображение, будет отправлено только оно.'
  ];
  if (latest?.id) {
    const failedOnly = adminBroadcastHardFailedCount(latest);
    lines.push('', `Последняя задача: #${latest.id}`);
    lines.push(`Статус: ${adminStateWithCode(latest.status, 'неизвестно')}`);
    lines.push(`Прогресс: доставлено ${latest.delivered_count || 0}/${latest.estimated_recipient_count ?? 0} • ошибки ${failedOnly} • готово к повтору ${latest.retry_due_count || 0} • попытки исчерпаны ${latest.exhausted_count || 0} • в ожидании ${latest.pending_count || 0}`);
  }
  if (notice) lines.push('', notice);
  const rows = [
    [{ text: '🧪 Отправить превью себе', callback_data: 'adm:bc:preview:self' }],
    [{ text: '✅ Подтвердить отправку', callback_data: 'adm:bc:confirm' }]
  ];
  if (latest?.id) {
    const latestRow = [{ text: '📄 Последняя задача', callback_data: 'adm:bc:last' }];
    if (latest?.failed_count > 0 || latest?.retry_due_count > 0 || latest?.exhausted_count > 0) latestRow.push({ text: '🧾 Ошибки', callback_data: `adm:bc:fail:${latest.id}:0` });
    rows.push(latestRow);
    rows.push(...buildBroadcastRecoveryActionRows(latest));
  }
  rows.push(buildBackHomeRow('← Назад к рассылке', 'adm:bc'));
  return { text: lines.join('\n'), reply_markup: buildInlineKeyboard(rows) };
}
function buildAdminTemplatesText({ state = null, notice = null } = {}) {
  const noticeTemplates = state?.noticeTemplates || [];
  const broadcastTemplates = state?.broadcastTemplates || [];
  const directTemplates = state?.directTemplates || [];
  const lines = [
    '📌 Шаблоны',
    '',
    `Шаблоны уведомлений: ${noticeTemplates.length}`,
    `Шаблоны рассылки: ${broadcastTemplates.length}`,
    `Шаблоны личных сообщений: ${directTemplates.length}`,
    '',
    'Шаблоны уведомлений подходят для компактных баннеров, шаблоны рассылки — для массовых касаний. Шаблоны личных сообщений доступны в карточке пользователя → сообщение.'
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminTemplatesKeyboard() {
  return buildInlineKeyboard([
    [
      { text: '📣 Шаблоны уведомлений', callback_data: 'adm:tpl:not' },
      { text: '📬 Шаблоны рассылки', callback_data: 'adm:tpl:bc' }
    ],
    [{ text: '✉️ Шаблоны личных сообщений', callback_data: 'adm:tpl:direct' }],
    buildBackHomeRow('← Назад в коммуникации', 'adm:comms')
  ]);
}
function buildAdminNoticeTemplatePickerText({ state = null, templates = [], notice = null } = {}) {
  const currentAudience = adminNoticeAudienceLabel(state?.notice?.audienceKey || 'ALL');
  const lines = [
    '📣 Шаблоны уведомлений',
    '',
    `Текущая аудитория: ${currentAudience}`,
    `Текущая оценка: ${state?.estimate || 0}`,
    '',
    'Выберите шаблон, чтобы заполнить текст уведомления и рекомендуемую аудиторию.'
  ];
  if (templates.length) {
    lines.push('', ...templates.map((item, index) => `${index + 1}. ${item.label} → ${adminNoticeAudienceLabel(item.audienceKey)}`));
  }
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminNoticeTemplatePickerKeyboard({ templates = [] } = {}) {
  const rows = templates.map((item) => ([{ text: `📌 ${item.label}`, callback_data: `adm:not:tpl:${item.key}` }]));
  rows.push(buildBackHomeRow('← Назад к уведомлению', 'adm:not'));
  return buildInlineKeyboard(rows);
}
function buildAdminBroadcastTemplatePickerText({ state = null, templates = [], notice = null } = {}) {
  const currentAudience = adminBroadcastAudienceLabel(state?.draft?.audienceKey || 'ALL_CONNECTED');
  const lines = [
    '📬 Шаблоны рассылки',
    '',
    `Текущая аудитория: ${currentAudience}`,
    `Текущая оценка: ${state?.estimate || 0}`,
    '',
    'Выберите шаблон, чтобы заполнить текст рассылки и рекомендуемую аудиторию.'
  ];
  if (templates.length) {
    lines.push('', ...templates.map((item, index) => `${index + 1}. ${item.label} → ${adminBroadcastAudienceLabel(item.audienceKey)}`));
  }
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminBroadcastTemplatePickerKeyboard({ templates = [] } = {}) {
  const rows = templates.map((item) => ([{ text: `📌 ${item.label}`, callback_data: `adm:bc:tpl:${item.key}` }]));
  rows.push(buildBackHomeRow('← Назад к рассылке', 'adm:bc'));
  return buildInlineKeyboard(rows);
}
function buildAdminOutboxText({ records = [], notice = null } = {}) {
  const lines = ['📤 Исходящие', ''];
  if (!records.length) {
    lines.push('Исходящих операций пока нет.');
    lines.push('Запись появится после включения уведомления, отправки рассылки или личного сообщения.');
  } else {
    lines.push('Последние операции:');
    lines.push(...records.map((item, index) => `${index + 1}. ${adminEventTypeLabel(item.event_type)} · ${adminCode(item.event_type, 'unknown')} • ${truncate(formatOutboxTarget(item), 20)} • ${adminStateLabel(item.status, 'неизвестно')} · ${adminCode(item.status, 'unknown')} • доставлено ${item.delivered_count ?? 0}/${item.estimated_recipient_count ?? '—'} • ошибок ${item.failed_count ?? 0} • ${formatDateTimeShort(item.sent_at || item.created_at)}`));
  }
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminOutboxKeyboard({ records = [] } = {}) {
  const rows = records.map((item) => ([{ text: `📄 ${adminEventTypeLabel(item.event_type)} • #${item.id}`, callback_data: `adm:outbox:open:${item.id}` }]));
  rows.push([{ text: '🔎 Поиск исходящих', callback_data: 'adm:search:outbox' }]);
  rows.push(buildBackHomeRow('← Назад в коммуникации', 'adm:comms'));
  return buildInlineKeyboard(rows);
}
function buildAdminOutboxRecordText({ record = null, notice = null } = {}) {
  if (!record) return ['📄 Исходящая операция', '', notice || 'Запись не найдена.'].join('\n');
  const lines = [
    '📄 Исходящая операция',
    '',
    `Тип: ${adminEventTypeWithCode(record.event_type)}`,
    `Статус: ${adminStateWithCode(record.status, 'неизвестно')}`,
    `Аудитория: ${record.audience_key ? `${record.audience_key} · код: ${adminCode(record.audience_key, 'none')}` : '—'}`,
    `Получатель: ${formatOutboxTarget(record)}`,
    `Оценка получателей: ${record.estimated_recipient_count ?? '—'}`,
    `Доставлено: ${record.delivered_count ?? '—'}`,
    `Ошибки: ${adminBroadcastHardFailedCount(record)}`,
    `Готовы к повтору: ${record.retry_due_count ?? '—'}`,
    `Попытки исчерпаны: ${record.exhausted_count ?? '—'}`,
    `В ожидании: ${record.pending_count ?? '—'}`,
    `Размер пакета: ${record.batch_size ?? '—'}`,
    `Курсор: ${record.cursor ?? '—'}`,
    `Изображение: ${record.media_ref ? 'да' : 'нет'}`,
    `Кнопка: ${record.button_text && record.button_url ? `${record.button_text} → ${truncate(record.button_url, 42)}` : (record.button_text || record.button_url ? 'заполнена не полностью' : 'нет')}`,
    `Начало: ${formatDateTimeShort(record.started_at)}`,
    `Завершение: ${formatDateTimeShort(record.finished_at)}`,
    `Создано: ${formatDateTimeShort(record.created_at)}`,
    `Отправлено: ${formatDateTimeShort(record.sent_at)}`,
    '',
    record.body || '—'
  ];
  if (record?.last_error) lines.push('', `Последняя ошибка: ${truncate(record.last_error, 220)}`);
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminOutboxRecordKeyboard({ record = null, backCallback = 'adm:outbox' } = {}) {
  const rows = [];
  if (record?.target_user_id) {
    rows.push([{ text: '👤 Открыть пользователя', callback_data: `adm:usr:open:${record.target_user_id}:all:0` }]);
  }
  if (record?.event_type === 'broadcast' && ((record?.failed_count || 0) > 0 || (record?.retry_due_count || 0) > 0 || (record?.exhausted_count || 0) > 0)) {
    rows.push([{ text: '🧾 Открыть ошибки', callback_data: `adm:bc:fail:${record.id}:0` }]);
    rows.push(...buildBroadcastRecoveryActionRows(record));
  }
  rows.push(buildBackHomeRow(backCallback === 'adm:bc' ? '← Назад к рассылке' : '← Назад к исходящим', backCallback));
  return buildInlineKeyboard(rows);
}
function buildAdminBroadcastFailuresText({ state = null, notice = null } = {}) {
  if (!state?.record) return ['🧾 Ошибки рассылки', '', notice || 'Запись рассылки не найдена.'].join('\n');
  const lines = [
    '🧾 Ошибки рассылки',
    '',
    `Рассылка: #${state.record.id}`,
    `Статус: ${adminStateWithCode(state.record.status, 'неизвестно')}`,
    `Записей: ${state.totalCount || 0} • страница ${(state.page || 0) + 1}`
  ];
  if (!state.items?.length) lines.push('', 'Нет получателей с ошибками или готовых к повтору.');
  else {
    lines.push('', 'Получатели, требующие внимания:');
    lines.push(...state.items.map((item, index) => `${(state.page || 0) * (state.pageSize || 10) + index + 1}. ${truncate(item.target_display_name || item.target_telegram_username || `id ${item.target_telegram_user_id}`, 28)} • ${adminStateLabel(item.status, 'ошибка')} · ${adminCode(item.status, 'unknown')} • попыток ${item.attempts} • ${truncate(item.last_error, 64)}`));
  }
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminBroadcastFailuresKeyboard({ state = null } = {}) {
  const rows = [];
  for (const item of state?.items || []) {
    const label = truncate(item.target_display_name || item.target_telegram_username || `id ${item.target_telegram_user_id}`, 42);
    rows.push([{ text: `👤 ${label}`, callback_data: `adm:usr:open:${item.target_user_id}:all:0` }]);
  }
  const pager = [];
  if (state?.hasPrev) pager.push({ text: '‹ Предыдущая', callback_data: `adm:bc:fail:${state.outboxId}:${Math.max(0, (state.page || 0) - 1)}` });
  if (state?.hasNext) pager.push({ text: 'Следующая ›', callback_data: `adm:bc:fail:${state.outboxId}:${(state.page || 0) + 1}` });
  if (pager.length) rows.push(pager);
  if (state?.record) {
    rows.push(...buildBroadcastRecoveryActionRows(state.record));
  }
  rows.push(buildBackHomeRow('← Назад к исходящей операции', `adm:outbox:open:${state?.outboxId || 0}`));
  return buildInlineKeyboard(rows);
}
function buildAdminCommsEditPromptSurface({ title, currentValue, cancelCallback, promptText = 'Отправь новый текст следующим сообщением.', currentLabel = 'Текущее значение' }) {
  return {
    text: [title, '', promptText, '', `${currentLabel}: ${truncate(currentValue, 280)}`].join('\n'),
    reply_markup: buildInlineKeyboard([
      buildBackHomeRow('← Отмена', cancelCallback)
    ])
  };
}
function boolLine(label, value) {
  return `${label}: ${adminBooleanLabel(value)}`;
}
function renderAdminSearchLine(scopeKey, item, index, page = 0, pageSize = 8) {
  const ordinal = page * pageSize + index + 1;
  switch (normalizeAdminSearchScope(scopeKey)) {
    case 'users':
      return `${ordinal}. ${truncate(item.displayName || item.linkedinName || item.telegramUsername || `Пользователь ${item.telegramUserId}`, 26)} • ${item.hasLinkedIn ? 'LinkedIn подключён' : 'без LinkedIn'} • ${item.visibilityStatus === 'listed' ? 'опубликован' : item.profileState === 'active' ? 'скрыт' : 'не завершён'} • интро в ожидании ${item.pendingIntroCount || 0}`;
    case 'intros':
      return `${ordinal}. ${truncate(item.requesterDisplayName, 18)} → ${truncate(item.targetDisplayName, 18)} • ${adminStateLabel(item.status, 'неизвестно')} · ${adminCode(item.status, 'unknown')} • ${formatDateTimeShort(item.updatedAt || item.createdAt)}`;
    case 'delivery':
      return `${ordinal}. ${truncate(item.recipientDisplayName, 18)} • ${adminStateLabel(item.operatorBucket, 'неизвестно')} · ${adminCode(item.operatorBucket, 'unknown')} • ${truncate(item.errorMessage || item.lastErrorCode || '', 28)}`;
    case 'outbox':
      return `${ordinal}. ${adminEventTypeLabel(item.event_type)} • ${truncate(formatOutboxTarget(item), 20)} • ${adminStateLabel(item.status, 'неизвестно')} · ${adminCode(item.status, 'unknown')} • ${formatDateTimeShort(item.sent_at || item.created_at)}`;
    case 'audit':
    default:
      return `${ordinal}. ${adminEventTypeLabel(item.event_type)} · ${adminCode(item.event_type, 'unknown')} • ${truncate(item.summary || '', 28)} • ${formatDateTimeShort(item.created_at)}`;
  }
}
function buildAdminSearchPromptText({ scopeKey, currentQuery = '', notice = null } = {}) {
  const lines = [
    `🔎 ${adminSearchScopeLabel(scopeKey)}`,
    '',
    'Отправьте поисковый запрос следующим сообщением.',
    '',
    `Текущий запрос: ${currentQuery || '—'}`
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminSearchPromptKeyboard({ scopeKey } = {}) {
  return buildInlineKeyboard([
    buildBackHomeRow('← Отмена', adminSearchBackCallback(scopeKey))
  ]);
}
function buildAdminSearchResultsText({ scopeKey, state = null, notice = null } = {}) {
  const lines = [
    `🔎 Результаты: ${adminSearchScopeLabel(scopeKey)}`,
    '',
    `Запрос: ${state?.queryText || '—'}`,
    `Результаты: ${state?.totalCount || 0} • стр. ${(state?.page || 0) + 1}`
  ];
  if (notice) lines.push('', notice);
  if (!state?.results?.length) {
    lines.push('', state?.queryText ? 'По этому запросу ничего не найдено.' : 'Запусти поиск, чтобы увидеть записи.');
    return lines.join('\n');
  }
  lines.push('', 'Выберите результат:');
  lines.push(...state.results.map((item, index) => renderAdminSearchLine(scopeKey, item, index, state?.page || 0, state?.pageSize || 8)));
  return lines.join('\n');
}
function buildAdminSearchResultsKeyboard({ scopeKey, state = null } = {}) {
  const rows = [];
  for (const item of state?.results || []) {
    let callback = 'adm:home';
    let label = 'Открыть';
    if (scopeKey === 'users') {
      callback = `adm:usr:open:${item.userId}:all:0`;
      label = `🪪 ${truncate(item.displayName || item.linkedinName || item.telegramUsername || `Пользователь ${item.telegramUserId}`, 42)}`;
    } else if (scopeKey === 'intros') {
      callback = `adm:intro:open:${item.introRequestId}:all:0`;
      label = `📄 ${truncate(`${item.requesterDisplayName || 'Неизвестно'} → ${item.targetDisplayName || 'Неизвестно'}`, 42)}`;
    } else if (scopeKey === 'delivery') {
      callback = `adm:dlv:open:${item.notificationReceiptId}:all:0`;
      label = `🧾 ${truncate(item.recipientDisplayName || `Квитанция ${item.notificationReceiptId}`, 42)}`;
    } else if (scopeKey === 'outbox') {
      callback = `adm:outbox:open:${item.id}`;
      label = `📤 ${truncate(`${item.event_type} • ${formatOutboxTarget(item)}`, 42)}`;
    } else if (scopeKey === 'audit') {
      callback = `adm:audit:open:${item.id}:all:0`;
      label = `📜 ${truncate(`${adminEventTypeLabel(item.event_type)} • ${item.summary || ''}`, 42)}`;
    }
    rows.push([{ text: label, callback_data: callback }]);
  }
  const pager = [];
  if (state?.hasPrev) pager.push({ text: '‹ Предыдущая', callback_data: `adm:search:${scopeKey}:page:${Math.max(0, (state?.page || 0) - 1)}` });
  if (state?.hasNext) pager.push({ text: 'Следующая ›', callback_data: `adm:search:${scopeKey}:page:${(state?.page || 0) + 1}` });
  if (pager.length) rows.push(pager);
  rows.push([{ text: `🔎 Искать снова`, callback_data: `adm:search:${scopeKey}` }]);
  rows.push(buildBackHomeRow('← Назад', adminSearchBackCallback(scopeKey)));
  return buildInlineKeyboard(rows);
}
function buildHealthText({ step = 'STEP039' } = {}) {
  const flags = getPublicFlags();
  const operators = getOperatorConfig();
  const runtimeGuards = getRuntimeGuardConfig();
  return [
    '🩺 Состояние сервиса',
    '',
    `Версия: ${step}`,
    boolLine('База данных', flags.dbConfigured),
    boolLine('LinkedIn', flags.linkedInConfigured),
    boolLine('Telegram', flags.telegramConfigured),
    boolLine('Секрет вебхука', flags.telegramWebhookSecretConfigured),
    boolLine('Квитанции уведомлений', flags.notificationReceiptsConfigured),
    boolLine('Повтор уведомлений', flags.notificationRetryConfigured),
    boolLine('Операторский слой уведомлений', flags.notificationOpsConfigured),
    boolLine('Операторская диагностика', flags.operatorDiagnosticsSurfaceConfigured),
    `Операторов в списке доступа: ${operators.operatorTelegramUserIds.length}`,
    `Дедупликация обновлений: ${runtimeGuards.updateDedupeTtlSeconds} с`,
    `Ограничение частоты действий: ${runtimeGuards.actionThrottleSeconds} с`
  ].join('\n');
}
function buildHealthKeyboard() {
  return buildInlineKeyboard([
    [
      { text: '🔁 Диагностика повторов', callback_data: 'adm:retry' },
      { text: '👮 Операторы', callback_data: 'adm:opscope' }
    ],
    buildBackHomeRow('← Назад в систему', 'adm:sys')
  ]);
}
function buildOperatorsText({ summary = null } = {}) {
  const operators = getOperatorConfig();
  const lines = [
    '👮 Операторы',
    '',
    `Аккаунтов в списке доступа: ${operators.operatorTelegramUserIds.length}`,
    countLine('Недавние события аудита', summary?.recentAuditEvents || 0),
    countLine('Готовы к повтору', summary?.retryDue || 0),
    countLine('Попытки исчерпаны', summary?.exhausted || 0)
  ];
  if (!operators.operatorTelegramUserIds.length) lines.push('Telegram ID операторов не настроены.');
  else {
    lines.push('', 'Telegram ID операторов:');
    lines.push(...operators.operatorTelegramUserIds.map((value) => `• ${value}`));
  }
  return lines.join('\n');
}
function buildOperatorsKeyboard() {
  return buildInlineKeyboard([
    [{ text: '🩺 Состояние сервиса', callback_data: 'adm:health' }],
    buildBackHomeRow('← Назад в систему', 'adm:sys')
  ]);
}
function buildLaunchRunbookText() {
  return [
    '🧭 Регламент запуска',
    '',
    'Узкий регламент запуска: ручная проверка без новых функций и широких изменений.',
    '',
    'Ежедневная проверка:',
    '1. Откройте «Система»: повторы, исчерпанные попытки и ошибки.',
    '2. Откройте «Операции»: пользователи без профиля, неопубликованные профили и интро в ожидании.',
    '3. Откройте «Коммуникации»: уведомление, последнюю рассылку и ошибки исходящих.',
    '4. Откройте «Аудит»: повторные привязки, изменения публикаций и массовые действия.',
    '5. Только после этого готовьте уведомление, рассылку или личное сообщение.',
    '',
    'Проверка перед отправкой:',
    '• нет свежего инцидента callback или deployment;',
    '• нет всплеска ошибок доставки и исчерпанных попыток;',
    '• аудитория и текст проверены вручную;',
    '• после отправки будет проверка через «Исходящие» и «Доставка».',
    '',
    'Стоп-сигналы:',
    '• ошибка LinkedIn callback — остановить коммуникации и проверить `ENV`, `health` и `callback`;',
    '• растут ошибки доставки — остановить новые рассылки;',
    '• растут неполные публикации — сначала очистить качество профилей.',
    '',
    'Это регламент только для чтения. Статус продакшена подтверждается вручную.'
  ].join('\n');
}
function buildLaunchRunbookKeyboard() {
  return buildInlineKeyboard([
    [{ text: '🧰 Операции', callback_data: 'adm:ops' }],
    [{ text: '💬 Коммуникации', callback_data: 'adm:comms' }],
    [{ text: '💳 Монетизация', callback_data: 'adm:money' }],
    [{ text: '⚙️ Система', callback_data: 'adm:sys' }],
    [{ text: '✅ Проверка продакшена', callback_data: 'adm:verify' }],
    [{ text: '🎭 Репетиция запуска', callback_data: 'adm:rehearse' }],
    [{ text: '🧊 Заморозка', callback_data: 'adm:freeze' }],
    [{ text: ADMIN_COPY.home, callback_data: 'home:root' }]
  ]);
}
function buildLaunchFreezeText() {
  return [
    '🧊 Заморозка',
    '',
    'Назначение: сохранить исходную версию стабильной перед запуском и ручной проверкой.',
    '',
    'Что замораживаем:',
    '• маршрутизацию Telegram;',
    '• LinkedIn OIDC;',
    '• публикацию профилей;',
    '• интро и решения по запросам;',
    '• уведомления, рассылки и отправку;',
    '• список доступа операторов.',
    '',
    'Что разрешено:',
    '• документация;',
    '• узкое исправление подтверждённой ошибки;',
    '• синхронизация smoke/QA;',
    '• проверка ENV и deployment.',
    '',
    'Что запрещено:',
    '• новые продуктовые области;',
    '• широкое расширение админки и аналитики;',
    '• широкие изменения схемы;',
    '• неконтролируемый рост callback-маршрутов.',
    '',
    'Перед merge/deploy:',
    '1. check и актуальные smoke-тесты;',
    '2. синхронизация docsStep/currentStep;',
    '3. список изменённых файлов и QA checklist;',
    '4. честный статус без неподтверждённых claims.',
    '',
    'Выход из заморозки — только после успешной ручной проверки.'
  ].join('\n');
}
function buildLaunchFreezeKeyboard() {
  return buildInlineKeyboard([
    [{ text: '🧭 Регламент запуска', callback_data: 'adm:runbook' }],
    [{ text: '✅ Проверка продакшена', callback_data: 'adm:verify' }],
    [{ text: '🎭 Репетиция запуска', callback_data: 'adm:rehearse' }],
    [{ text: '🩺 Состояние сервиса', callback_data: 'adm:health' }],
    [{ text: '⚙️ Система', callback_data: 'adm:sys' }],
    [{ text: ADMIN_COPY.home, callback_data: 'home:root' }]
  ]);
}
function buildLiveVerificationText() {
  return [
    '✅ Проверка продакшена',
    '',
    'Ручная проверка развернутой версии без расширения объёма работ.',
    '',
    'Порядок:',
    '1. Открыть landing, privacy и terms; проверить ссылку на @introdeckbot.',
    '2. Открыть `/api/health` и `/api/health?full=1`; сверить `step`, `docsStep` и `flags`.',
    '3. В Telegram проверить /start, /menu, вход в админку и список доступа /ops /admin.',
    '4. Открыть «Админка», «Операции», «Коммуникации» и «Система».',
    '5. Проверить начало LinkedIn connect и callback до сохранения identity/profile state.',
    '6. Проверить личное сообщение, уведомление, превью рассылки и аудит доставки.',
    '',
    'Зафиксировать отдельно:',
    '• подтверждено по исходному коду;',
    '• подтверждено в продакшене;',
    '• заблокировано или не подтверждено;',
    '• решение: запускать или остановить.',
    '',
    'Допустимый итог — честный запрет запуска. Нельзя заявлять готовность продакшена, пока не закрыты критические проверки.'
  ].join('\n');
}
function buildLiveVerificationKeyboard() {
  return buildInlineKeyboard([
    [{ text: '🎭 Репетиция запуска', callback_data: 'adm:rehearse' }],
    [{ text: '🩺 Состояние сервиса', callback_data: 'adm:health' }],
    [{ text: '🧊 Заморозка', callback_data: 'adm:freeze' }],
    [{ text: '⚙️ Система', callback_data: 'adm:sys' }],
    [{ text: ADMIN_COPY.home, callback_data: 'home:root' }]
  ]);
}
function buildLaunchRehearsalText() {
  return [
    '🎭 Репетиция запуска',
    '',
    'Узкий операторский сценарий до решения о запуске.',
    '',
    'Порядок:',
    '1. Проверить состояние сервиса: повторы, исчерпанные попытки и ошибки.',
    '2. Проверить аккаунт основателя: `/start` → `/menu` → 👑 Админка.',
    '3. Открыть все основные разделы админки.',
    '4. Открыть безопасный сегмент пользователей и проверить переходы.',
    '5. Подготовить уведомление или превью рассылки без широкого охвата.',
    '6. Отправить одно тестовое личное сообщение тестовому получателю.',
    '7. Проверить «Исходящие», «Доставка», «Аудит» и «Качество».',
    '',
    'Критерии прохождения:',
    '• callback и маршрутизация работают;',
    '• LinkedIn connect не сломан;',
    '• коммуникации не создают неожиданных ошибок;',
    '• админские экраны и русские подписи согласованы.',
    '',
    'Если репетиция не проходит, заморозка сохраняется. Выполняется узкое исправление без расширения работ.'
  ].join('\n');
}
function buildLaunchRehearsalKeyboard() {
  return buildInlineKeyboard([
    [{ text: '✅ Проверка продакшена', callback_data: 'adm:verify' }],
    [{ text: '💬 Коммуникации', callback_data: 'adm:comms' }],
    [{ text: '💳 Монетизация', callback_data: 'adm:money' }],
    [{ text: '⚙️ Система', callback_data: 'adm:sys' }],
    [{ text: ADMIN_COPY.home, callback_data: 'home:root' }]
  ]);
}
function buildOperatorOnlyText() {
  return [
    '⚠️ Только для оператора',
    '',
    'Эта зона доступна только операторскому аккаунту.'
  ].join('\n');
}
function buildOperatorOnlyKeyboard() {
  return buildInlineKeyboard([
    [{ text: ADMIN_COPY.home, callback_data: 'home:root' }]
  ]);
}
function buildAdminBulkActionsText({ state = null, page = 0, notice = null } = {}) {
  const lines = [
    '📦 Массовые действия',
    '',
    `Сегмент: ${state?.segmentLabel || ADMIN_USER_SEGMENTS[normalizeAdminUserSegment(state?.segmentKey)]?.label || 'Сегмент'} • страница ${page + 1}`,
    `Пользователей: ${state?.totalCount || 0}`,
    '',
    'Безопасный режим: только подготовка шаблона. Отправка требует отдельного подтверждения.'
  ];
  const noticeAction = state?.noticeAction || { supported: false, estimate: 0 };
  const broadcastAction = state?.broadcastAction || { supported: false, estimate: 0 };
  lines.push('', 'Уведомление:');
  if (noticeAction.supported) {
    lines.push(`Шаблон: ${noticeAction.templateLabel}`);
    lines.push(`Аудитория: ${noticeAction.audienceLabel}`);
    lines.push(`Оценка охвата: ${noticeAction.estimate || 0}`);
    if (noticeAction.activeGuard) lines.push('Ограничение: сначала вручную выключите активное уведомление.');
  } else lines.push('Для этого сегмента нет безопасного шаблона уведомления.');
  lines.push('', 'Рассылка:');
  if (broadcastAction.supported) {
    lines.push(`Шаблон: ${broadcastAction.templateLabel}`);
    lines.push(`Аудитория: ${broadcastAction.audienceLabel}`);
    lines.push(`Оценка охвата: ${broadcastAction.estimate || 0}`);
  } else lines.push('Для этого сегмента нет безопасного шаблона рассылки.');
  if (notice) lines.push('', notice);
  return lines.join('\n');
}
function buildAdminBulkActionsKeyboard({ state = null, page = 0 } = {}) {
  const segmentKey = normalizeAdminUserSegment(state?.segmentKey);
  const rows = [];
  if (state?.noticeAction?.supported) rows.push([{ text: `📣 Подготовить уведомление (${state.noticeAction.estimate || 0})`, callback_data: `adm:bulk:user:${segmentKey}:${page}:not` }]);
  if (state?.broadcastAction?.supported) rows.push([{ text: `📬 Подготовить рассылку (${state.broadcastAction.estimate || 0})`, callback_data: `adm:bulk:user:${segmentKey}:${page}:bc` }]);
  rows.push(buildBackHomeRow('← Назад к пользователям', `adm:usr:page:${segmentKey}:${page}`));
  return buildInlineKeyboard(rows);
}
export function createAdminSurfaceBuilders({ currentStep = 'STEP048.2' } = {}) {
  return {
    buildAdminHomeSurface: async ({ summary = null } = {}) => ({
      text: buildAdminHomeText({ summary }),
      reply_markup: buildAdminHomeKeyboard({ summary })
    }),
    buildAdminOperationsSurface: async ({ summary = null } = {}) => ({
      text: buildOperationsHubText({ summary }),
      reply_markup: buildOperationsHubKeyboard({ summary })
    }),
    buildAdminInviteSurface: async ({ state = null, notice = null, view = 'overview' } = {}) => ({
      text: buildAdminInviteText({ state, notice, view }),
      reply_markup: buildAdminInviteKeyboard({ state, view })
    }),
    buildAdminCommunicationsSurface: async ({ state = null, notice = null } = {}) => ({
      text: buildCommunicationsHubText({ state, notice }),
      reply_markup: buildCommunicationsHubKeyboard({ state })
    }),
    buildAdminMonetizationSurface: async ({ state = null, notice = null } = {}) => ({
      text: buildAdminMonetizationText({ state, notice }),
      reply_markup: buildAdminMonetizationKeyboard({ state })
    }),
    buildAdminSystemSurface: async ({ summary = null } = {}) => ({
      text: buildSystemHubText({ summary }),
      reply_markup: buildSystemHubKeyboard({ summary })
    }),
    buildAdminHealthSurface: async () => ({
      text: buildHealthText({ step: currentStep }),
      reply_markup: buildHealthKeyboard()
    }),
    buildAdminOperatorsSurface: async ({ summary = null } = {}) => ({
      text: buildOperatorsText({ summary }),
      reply_markup: buildOperatorsKeyboard()
    }),
    buildAdminRunbookSurface: async () => ({
      text: buildLaunchRunbookText(),
      reply_markup: buildLaunchRunbookKeyboard()
    }),
    buildAdminFreezeSurface: async () => ({
      text: buildLaunchFreezeText(),
      reply_markup: buildLaunchFreezeKeyboard()
    }),
    buildAdminLiveVerificationSurface: async () => ({
      text: buildLiveVerificationText(),
      reply_markup: buildLiveVerificationKeyboard()
    }),
    buildAdminLaunchRehearsalSurface: async () => ({
      text: buildLaunchRehearsalText(),
      reply_markup: buildLaunchRehearsalKeyboard()
    }),
    buildAdminUsersSurface: async ({ state, notice = null }) => ({
      text: buildUsersListText({ state, notice }),
      reply_markup: buildUsersListKeyboard({ state })
    }),
    buildAdminBulkActionsSurface: async ({ state = null, page = 0, notice = null } = {}) => ({
      text: buildAdminBulkActionsText({ state, page, notice }),
      reply_markup: buildAdminBulkActionsKeyboard({ state, page })
    }),
    buildAdminUserCardSurface: async ({ card, segmentKey = 'all', page = 0, notice = null }) => ({
      text: buildAdminUserCardText({ card, notice }),
      reply_markup: buildAdminUserCardKeyboard({ card, segmentKey, page })
    }),
    buildAdminUserPublicCardSurface: async ({ card, segmentKey = 'all', page = 0, notice = null }) => ({
      text: buildAdminUserPublicCardText({ card, notice }),
      reply_markup: buildAdminUserPublicCardKeyboard({ targetUserId: card?.user_id || 0, segmentKey, page })
    }),
    buildAdminUserMessageSurface: async ({ card, state = null, segmentKey = 'all', page = 0, notice = null }) => ({
      text: buildAdminUserMessageText({ card, state, notice }),
      reply_markup: buildAdminUserMessageKeyboard({ targetUserId: card?.user_id || state?.draft?.targetUserId || 0, segmentKey, page })
    }),
    buildAdminUserNotePromptSurface: async ({ card, segmentKey = 'all', page = 0 }) => ({
      text: buildAdminUserNotePromptText({ card }),
      reply_markup: buildAdminUserNotePromptKeyboard({ targetUserId: card?.user_id || 0, segmentKey, page })
    }),
    buildAdminIntrosSurface: async ({ state, notice = null }) => ({
      text: buildAdminIntrosText({ state, notice }),
      reply_markup: buildAdminIntrosKeyboard({ state })
    }),
    buildAdminIntroDetailSurface: async ({ intro, notificationSummary = null, recentReceipts = [], backCallback = 'adm:intro:list', notice = null }) => ({
      text: buildAdminIntroDetailText({ intro, notificationSummary, recentReceipts, notice }),
      reply_markup: buildAdminIntroDetailKeyboard({ intro, backCallback })
    }),
    buildAdminDeliverySurface: async ({ state, notice = null }) => ({
      text: buildAdminDeliveryText({ state, notice }),
      reply_markup: buildAdminDeliveryKeyboard({ state })
    }),
    buildAdminDeliveryRecordSurface: async ({ record = null, backCallback = 'adm:dlv', notice = null }) => ({
      text: buildAdminDeliveryRecordText({ record, notice }),
      reply_markup: buildAdminDeliveryRecordKeyboard({ record, backCallback })
    }),
    buildAdminQualitySurface: async ({ state, notice = null }) => ({
      text: buildAdminQualityText({ state, notice }),
      reply_markup: buildAdminQualityKeyboard({ state })
    }),
    buildAdminAuditSurface: async ({ state, notice = null }) => ({
      text: buildAdminAuditText({ state, notice }),
      reply_markup: buildAdminAuditKeyboard({ state })
    }),
    buildAdminAuditRecordSurface: async ({ record = null, backCallback = 'adm:audit', notice = null }) => ({
      text: buildAdminAuditRecordText({ record, notice }),
      reply_markup: buildAdminAuditRecordKeyboard({ record, backCallback })
    }),
    buildAdminNoticeSurface: async ({ state = null, notice = null } = {}) => ({
      text: buildAdminNoticeText({ state, notice }),
      reply_markup: buildAdminNoticeKeyboard({ state })
    }),
    buildAdminNoticeAudienceSurface: async ({ state = null, notice = null } = {}) => buildAdminNoticeAudienceSurface({ state, notice }),
    buildAdminNoticePreviewSurface: async ({ state = null, notice = null } = {}) => buildAdminNoticeПревьюSurface({ state, notice }),
    buildAdminBroadcastSurface: async ({ state = null, notice = null } = {}) => ({
      text: buildAdminBroadcastText({ state, notice }),
      reply_markup: buildAdminBroadcastKeyboard({ state })
    }),
    buildAdminBroadcastAudienceSurface: async ({ state = null, notice = null } = {}) => buildAdminBroadcastAudienceSurface({ state, notice }),
    buildAdminBroadcastButtonSurface: async ({ state = null, notice = null } = {}) => buildAdminBroadcastButtonSurface({ state, notice }),
    buildAdminBroadcastPreviewSurface: async ({ state = null, notice = null } = {}) => buildAdminBroadcastPreviewSurface({ state, notice }),
    buildAdminTemplatesSurface: async ({ state = null, notice = null } = {}) => ({
      text: buildAdminTemplatesText({ state, notice }),
      reply_markup: buildAdminTemplatesKeyboard()
    }),
    buildAdminNoticeTemplatePickerSurface: async ({ state = null, templates = [], notice = null } = {}) => ({
      text: buildAdminNoticeTemplatePickerText({ state, templates, notice }),
      reply_markup: buildAdminNoticeTemplatePickerKeyboard({ templates })
    }),
    buildAdminBroadcastTemplatePickerSurface: async ({ state = null, templates = [], notice = null } = {}) => ({
      text: buildAdminBroadcastTemplatePickerText({ state, templates, notice }),
      reply_markup: buildAdminBroadcastTemplatePickerKeyboard({ templates })
    }),
    buildAdminBroadcastFailuresSurface: async ({ state = null, notice = null } = {}) => ({
      text: buildAdminBroadcastFailuresText({ state, notice }),
      reply_markup: buildAdminBroadcastFailuresKeyboard({ state })
    }),
    buildAdminOutboxSurface: async ({ records = [], notice = null } = {}) => ({
      text: buildAdminOutboxText({ records, notice }),
      reply_markup: buildAdminOutboxKeyboard({ records })
    }),
    buildAdminOutboxRecordSurface: async ({ record = null, notice = null, backCallback = 'adm:outbox' } = {}) => ({
      text: buildAdminOutboxRecordText({ record, notice }),
      reply_markup: buildAdminOutboxRecordKeyboard({ record, backCallback })
    }),
    buildAdminDirectTemplatePickerSurface: async ({ card, state = null, segmentKey = 'all', page = 0, notice = null } = {}) => ({
      text: buildAdminDirectTemplatePickerText({ card, state, notice }),
      reply_markup: buildAdminDirectTemplatePickerKeyboard({ targetUserId: card?.user_id || state?.draft?.targetUserId || 0, segmentKey, page, state })
    }),
    buildAdminDirectPreviewSurface: async ({ card, state = null, segmentKey = 'all', page = 0, notice = null } = {}) => ({
      text: buildAdminDirectПревьюText({ card, state, notice }),
      reply_markup: buildAdminDirectПревьюKeyboard({ targetUserId: card?.user_id || state?.draft?.targetUserId || 0, segmentKey, page })
    }),
    buildAdminSearchPromptSurface: async ({ scopeKey = 'users', currentQuery = '', notice = null } = {}) => ({
      text: buildAdminSearchPromptText({ scopeKey, currentQuery, notice }),
      reply_markup: buildAdminSearchPromptKeyboard({ scopeKey })
    }),
    buildAdminSearchResultsSurface: async ({ scopeKey = 'users', state = null, notice = null } = {}) => ({
      text: buildAdminSearchResultsText({ scopeKey, state, notice }),
      reply_markup: buildAdminSearchResultsKeyboard({ scopeKey, state })
    }),
    buildAdminCommsEditPromptSurface: async ({ title, currentValue = '', cancelCallback, promptText, currentLabel }) => buildAdminCommsEditPromptSurface({ title, currentValue, cancelCallback, promptText, currentLabel }),
    buildAdminPlaceholderSurface: async ({ title, description, backCallback, nextStep }) => ({
      text: buildPlaceholderText({ title, description, nextStep }),
      reply_markup: buildDetailFooter(backCallback)
    }),
    buildOperatorOnlySurface: async () => ({
      text: buildOperatorOnlyText(),
      reply_markup: buildOperatorOnlyKeyboard()
    })
  };
}
