import {
  DIRECTORY_INDUSTRY_BUCKETS,
  DIRECTORY_SKILLS,
  PROFILE_FIELDS,
  OPTIONAL_PROFILE_FIELD_KEYS,
  getContactModeLabel,
  getProfileActivationNextAction,
  getProfileActivationState,
  summarizeDirectoryFilters
} from '../profile/contract.js';
import {
  buildProFairUseDisclosure,
  canOpenContactRequestRail,
  canOpenPaidContactRail,
  getContactRequestCoverageLabel
} from '../contact/contract.js';
import {
  buildLinkedInPublicBadgeLines,
  describeLinkedInPublicBadgeGate,
  describeLinkedInTrustSnapshotStatus,
  resolveLinkedInTrustState
} from '../linkedin/trust.js';
import {
  MEMBER_BUTTONS,
  MEMBER_SURFACES,
  getMemberButtons,
  getMemberSurfaces,
  memberUnavailable,
  profileStateLabel,
  profileVisibilityLabel,
  sanitizeMemberNotice
} from './memberCopy.js';
import {
  languageDisplayName,
  normalizeInterfaceLanguage,
  resolveLanguagePreferences
} from '../i18n/language.js';
import {
  TRANSACTION_BUTTONS,
  TRANSACTION_DISCLOSURES,
  getTransactionButtons,
  getTransactionDisclosures,
  payPrivateChatDeliveryButton
} from './transactionCopy.js';

function buildInlineKeyboard(rows) {
  return {
    inline_keyboard: rows
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inviteSourceLabel(source) {
  if (source === 'inline_share') {
    return 'inline';
  }
  if (source === 'invite_card') {
    return 'card';
  }
  return 'link';
}

function renderInviteFriendLine(item, index) {
  const name = toDisplayValue(item?.displayName, 'New contact');
  const headline = item?.headlineUser ? ` — ${truncate(item.headlineUser, 34)}` : '';
  const status = item?.status === 'activated' ? 'activated' : 'joined';
  return `${index + 1}. ${name}${headline} • ${status} via ${inviteSourceLabel(item?.source)} • ${formatDateShort(item?.joinedAt)}`;
}

function renderInviteHistoryLine(item, index, startIndex = 0) {
  const name = toDisplayValue(item?.displayName, 'New contact');
  const headline = item?.headlineUser ? ` — ${truncate(item.headlineUser, 40)}` : '';
  const joined = formatDateShort(item?.joinedAt);
  const activated = item?.status === 'activated' && item?.activatedAt ? formatDateShort(item?.activatedAt) : null;
  const status = item?.status === 'activated' ? 'activated' : 'joined';
  return `${startIndex + index + 1}. ${name}${headline} • ${status} via ${inviteSourceLabel(item?.source)} • joined ${joined}${activated ? ` • activated ${activated}` : ''}`;
}

function getInviteActivationRate(invitedCount = 0, activatedCount = 0) {
  const invited = Number(invitedCount || 0) || 0;
  const activated = Number(activatedCount || 0) || 0;
  if (invited <= 0) {
    return '0%';
  }
  return `${Math.round((activated / invited) * 1000) / 10}%`;
}

function getInvitePointsEntry(rewardsSummary = null) {
  const mode = String(rewardsSummary?.mode || 'off').trim().toLowerCase();
  if (mode === 'earn_only') {
    return { text: '🎯 Points preview', callback_data: 'invite:points' };
  }
  if (mode === 'live') {
    return { text: '🎯 Points', callback_data: 'invite:points' };
  }
  if (mode === 'paused') {
    return { text: '⏸ Points paused', callback_data: 'invite:points' };
  }
  return null;
}

function renderAdminInviteTopLine(item, index) {
  return `${index + 1}. ${toDisplayValue(item?.displayName, 'Member')} — ${Number(item?.invitedCount || 0)} invited • ${Number(item?.activatedCount || 0)} activated • ${Number(item?.activationRate || 0)}%`;
}

function renderAdminInviteRecentLine(item, index) {
  const status = item?.status === 'activated' ? 'activated' : 'joined';
  return `${index + 1}. ${toDisplayValue(item?.referrerDisplayName, 'Member')} → ${toDisplayValue(item?.displayName, 'Member')} • ${status} via ${inviteSourceLabel(item?.source)} • ${formatDateShort(item?.joinedAt)}`;
}

function toDisplayValue(value, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function truncate(value, maxLength = 160) {
  const normalized = toDisplayValue(value, '');
  if (!normalized) {
    return '—';
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function formatSkillSummary(profileSnapshot, fallback = '—') {
  const labels = Array.isArray(profileSnapshot?.skills) ? profileSnapshot.skills.map((skill) => skill.skill_label) : [];
  if (!labels.length) {
    return fallback;
  }

  return labels.join(', ');
}

function completionLine(profileSnapshot) {
  const completion = profileSnapshot?.completion;
  if (!completion) {
    return 'Profile completion: 0/0 fields • Skills 0/1+';
  }

  return `Profile completion: ${completion.filledCount}/${completion.totalCount} fields • Required ${completion.requiredFilledCount}/${completion.requiredCount} • Skills ${completion.skillsCount}/${completion.requiredSkillCount}+`;
}

function readinessLine(profileSnapshot) {
  const completion = profileSnapshot?.completion;
  if (!completion) {
    return 'Directory readiness: not ready yet';
  }

  if (completion.requiredFilledCount < completion.requiredCount) {
    return 'Directory readiness: complete all required fields';
  }

  if (!completion.hasRequiredSkills) {
    return 'Directory readiness: add at least 1 skill';
  }

  if (!completion.isReady) {
    return 'Directory readiness: not ready yet';
  }

  if (profileSnapshot?.visibility_status === 'listed') {
    return 'Directory readiness: ready • currently listed';
  }

  return 'Directory readiness: ready • currently hidden';
}


function activationProgressLine(profileSnapshot) {
  const activation = getProfileActivationState(profileSnapshot || {});
  return `Setup progress: ${activation.completedCount}/${activation.totalCount} required steps • ${activation.progressPercent}%`;
}

function activationNextStepLine(profileSnapshot) {
  const action = getProfileActivationNextAction(profileSnapshot || {});
  if (action.kind === 'linkedin') {
    return 'Next required step: connect LinkedIn';
  }
  if (action.kind === 'listed_preview') {
    return 'Next step: review or update your listed profile';
  }
  if (action.kind === 'preview') {
    return 'Next step: preview the card, then publish it';
  }
  return `Next required step: ${action.label}`;
}

const PROFILE_FIELD_LABELS_RU = Object.freeze({
  dn: 'Имя в каталоге',
  hl: 'Заголовок',
  in: 'Индустрия',
  ab: 'О себе',
  co: 'Компания',
  ci: 'Город',
  li: 'Публичная ссылка LinkedIn',
  tg: 'Скрытый username Telegram'
});

function activationStepLabel(step, interfaceLanguage = 'en') {
  if (normalizeInterfaceLanguage(interfaceLanguage) !== 'ru') return step.label;
  if (step.kind === 'linkedin') return 'Аккаунт LinkedIn';
  if (step.kind === 'skills') return 'Навыки';
  if (step.kind === 'field') return PROFILE_FIELD_LABELS_RU[step.fieldKey] || step.label;
  return step.label;
}

function activationNextLabel(profileSnapshot, interfaceLanguage = 'en') {
  const action = getProfileActivationNextAction(profileSnapshot || {});
  if (normalizeInterfaceLanguage(interfaceLanguage) !== 'ru') return action.label;
  if (action.kind === 'linkedin') return 'Подключить LinkedIn';
  if (action.kind === 'skills') return 'Выбрать минимум один навык';
  if (action.kind === 'field') return `Добавить: ${PROFILE_FIELD_LABELS_RU[action.fieldKey] || 'поле профиля'}`;
  return action.kind === 'listed_preview' ? 'Проверить опубликованный профиль' : 'Проверить и опубликовать профиль';
}

function buildActivationStepLines(profileSnapshot, interfaceLanguage = 'en') {
  return getProfileActivationState(profileSnapshot || {}).steps.map((step) => `${step.complete ? '✅' : '▫️'} ${activationStepLabel(step, interfaceLanguage)}`);
}

function buildOptionalFieldStatusLines(profileSnapshot) {
  return OPTIONAL_PROFILE_FIELD_KEYS.map((fieldKey) => {
    const field = PROFILE_FIELDS[fieldKey];
    const value = profileSnapshot?.[field.column] || null;
    return `${value && String(value).trim() ? '✅' : '▫️'} ${field.label}: ${truncate(value, 90)}`;
  });
}

function linkedinIdentityImportLine(profileSnapshot) {
  if (!profileSnapshot?.linkedin_sub) {
    return null;
  }

  const imported = [];
  if (profileSnapshot?.linkedin_name) imported.push('name');
  if (profileSnapshot?.linkedin_picture_url) imported.push('photo');
  if (profileSnapshot?.linkedin_locale) imported.push(`locale=${profileSnapshot.linkedin_locale}`);

  return imported.length
    ? `LinkedIn import: basic identity synced (${imported.join(' • ')})`
    : 'LinkedIn import: basic identity synced';
}


function buildLinkedInIdentityDetailLines(profileSnapshot, { includeEmail = false } = {}) {
  if (!profileSnapshot?.linkedin_sub) {
    return [];
  }

  const lines = [];
  if (profileSnapshot?.linkedin_name) lines.push(`• Name: ${profileSnapshot.linkedin_name}`);
  if (profileSnapshot?.linkedin_given_name) lines.push(`• Given name: ${profileSnapshot.linkedin_given_name}`);
  if (profileSnapshot?.linkedin_family_name) lines.push(`• Family name: ${profileSnapshot.linkedin_family_name}`);
  if (profileSnapshot?.linkedin_picture_url) lines.push('• Photo: imported');
  if (profileSnapshot?.linkedin_locale) lines.push(`• Locale: ${profileSnapshot.linkedin_locale}`);
  if (includeEmail && profileSnapshot?.linkedin_email) lines.push(`• Email: ${profileSnapshot.linkedin_email}`);
  return lines;
}

function buildBackHomeRow(backText, backCallbackData) {
  return [
    { text: backText, callback_data: backCallbackData },
    { text: MEMBER_BUTTONS.home, callback_data: 'home:root' }
  ];
}

function buildFieldStatusLines(profileSnapshot) {
  const completion = profileSnapshot?.completion;
  if (!completion?.fields?.length) {
    return ['No profile fields yet'];
  }

  const lines = completion.fields.map((field) => `${field.filled ? '✅' : '▫️'} ${field.label}: ${truncate(field.value, 90)}`);
  lines.push(`${completion.hasRequiredSkills ? '✅' : '▫️'} Skills: ${formatSkillSummary(profileSnapshot)}`);
  return lines;
}

function skillButton(profileSnapshot, skill) {
  const selected = Array.isArray(profileSnapshot?.skills) && profileSnapshot.skills.some((item) => item.skill_slug === skill.slug);
  return {
    text: `${selected ? '✅' : '▫️'} ${skill.label}`,
    callback_data: `p:skt:${skill.slug}`
  };
}

function filterSkillButton(filterSummary, skill) {
  const selected = Array.isArray(filterSummary?.selectedSkillSlugs) && filterSummary.selectedSkillSlugs.includes(skill.slug);
  return {
    text: `${selected ? '✅' : '▫️'} ${skill.label}`,
    callback_data: `dir:fs:${skill.slug}`
  };
}

function filterIndustryButton(filterSummary, industryBucket) {
  const selected = filterSummary?.selectedIndustrySlug === industryBucket.slug;
  return {
    text: `${selected ? '✅' : '▫️'} ${industryBucket.label}`,
    callback_data: `dir:fi:${industryBucket.slug}`
  };
}

function directoryProfileLabel(profileSnapshot) {
  const name = toDisplayValue(profileSnapshot.display_name, profileSnapshot.linkedin_name || 'Unnamed profile');
  const headline = toDisplayValue(profileSnapshot.headline_user, 'No headline');
  return `${name} — ${truncate(headline, 28)}`;
}

function profileContactModeSummary(profileSnapshot) {
  const label = getContactModeLabel(profileSnapshot?.contact_mode);
  if (profileSnapshot?.contact_mode === 'paid_unlock_requires_approval') {
    return `${label} • owner approval required`;
  }
  return label;
}

function hiddenTelegramUsernameSummary(profileSnapshot) {
  const value = typeof profileSnapshot?.telegram_username_hidden === 'string' ? profileSnapshot.telegram_username_hidden.trim() : '';
  return value ? `@${value}` : 'not set';
}

function directContactAvailabilityLine(profileSnapshot) {
  if (profileSnapshot?.is_viewer) {
    return `Hidden Telegram username: ${hiddenTelegramUsernameSummary(profileSnapshot)}`;
  }

  if (profileSnapshot?.contact_mode === 'paid_unlock_requires_approval') {
    return 'Contact: private chat or Telegram contact • recipient approval required';
  }

  return 'Contact: free intro request • recipient approval required';
}

function renderDmThreadLine(item, index) {
  const name = toDisplayValue(item?.display_name, 'Unknown member');
  const headline = truncate(item?.headline_user, 36);
  const coverageHint = item?.pro_covered
    ? ' • Pro'
    : Number.isFinite(Number(item?.price_stars_snapshot)) ? ` • ${item.price_stars_snapshot}⭐ delivery fee` : '';
  return `${index + 1}. ${name} — ${headline} • ${item?.status || 'pending'}${coverageHint} • ${formatDateShort(item?.last_message_at || item?.updated_at || item?.created_at)}`;
}

function renderDmMessageLine(message, viewerUserId) {
  const direction = String(message?.sender_user_id) === String(viewerUserId) ? 'You' : 'Them';
  const kind = message?.message_kind === 'request' ? 'request' : 'message';
  return `${direction} • ${kind} • ${formatDateTimeShort(message?.created_at)}
${truncate(message?.message_text, 280)}`;
}

function renderContactUnlockLine(item, index) {
  const name = toDisplayValue(item?.display_name, 'Unknown member');
  const headline = truncate(item?.headline_user, 36);
  const paidHint = item?.pro_covered
    ? ' • Pro'
    : Number.isFinite(Number(item?.price_stars_snapshot)) ? ` • ${item.price_stars_snapshot}⭐ delivery fee` : '';
  const revealHint = item?.status === 'revealed' && item?.revealed_contact_value ? ` • @${String(item.revealed_contact_value).replace(/^@+/, '')}` : '';
  return `${index + 1}. ${name} — ${headline} • ${item?.status || 'pending'}${paidHint}${revealHint} • ${formatDateShort(item?.requested_at || item?.updated_at)}`;
}

function renderFilterSummaryLines(filterSummary = summarizeDirectoryFilters()) {
  return [
    `Search: ${filterSummary.textQueryLabel}`,
    `City: ${filterSummary.cityQueryLabel}`,
    `Industry: ${filterSummary.industryLabel}`,
    `Skills: ${filterSummary.skillLabels}`
  ];
}

function formatDateShort(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toISOString().slice(0, 10);
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

function notificationBucketLabel(bucket) {
  if (bucket === 'retry_due') {
    return 'retry due';
  }
  if (bucket === 'exhausted') {
    return 'exhausted';
  }
  if (bucket === 'failed') {
    return 'failed';
  }
  if (bucket === 'skipped') {
    return 'skipped';
  }
  if (bucket === 'sent') {
    return 'sent';
  }
  return 'all';
}

function renderNotificationReceiptLine(item, index) {
  const introRequestId = item?.introRequestId ? `intro #${item.introRequestId}` : 'intro —';
  const errorCode = item?.lastErrorCode ? ` • ${item.lastErrorCode}` : '';
  const nextAttempt = item?.operatorBucket === 'retry_due' || item?.operatorBucket === 'failed'
    ? ` • next ${formatDateTimeShort(item?.nextAttemptAt)}`
    : '';

  return `${index + 1}. ${introRequestId} • ${item?.eventType || 'event'} • ${notificationBucketLabel(item?.operatorBucket)} • attempt ${item?.attemptCount || 0}/${item?.maxAttempts || 0} • last ${formatDateTimeShort(item?.lastAttemptAt || item?.deliveredAt || item?.createdAt)}${nextAttempt}${errorCode}`;
}

function collectOperatorIntroButtons({ diagnostics = null, hotRetryDue = [], hotFailed = [], hotExhausted = [] } = {}) {
  const unique = new Set();
  const items = [
    ...(diagnostics?.recent || []),
    ...hotRetryDue,
    ...hotFailed,
    ...hotExhausted
  ];

  for (const item of items) {
    if (item?.introRequestId) {
      unique.add(item.introRequestId);
    }

    if (unique.size >= 3) {
      break;
    }
  }

  return Array.from(unique);
}

function renderIntroRequestLine(item, index) {
  const name = toDisplayValue(item?.display_name, 'Unknown member');
  const headline = truncate(item?.headline_user, 36);
  const contactHint = introContactHint(item);
  const historyHint = item?.archived_snapshot_only ? 'archived snapshot' : null;
  return `${index + 1}. ${name} — ${headline} • ${item?.status || 'pending'} • ${formatDateShort(item?.created_at)}${contactHint ? ` • ${contactHint}` : ''}${historyHint ? ` • ${historyHint}` : ''}`;
}

function hasLinkedInUrl(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canViewerOpenDirectoryLinkedIn(profileSnapshot) {
  if (!hasLinkedInUrl(profileSnapshot?.linkedin_public_url)) {
    return false;
  }

  if (profileSnapshot?.is_viewer) {
    return true;
  }

  return profileSnapshot?.contact_mode === 'external_link';
}

function directoryContactLabel(profileSnapshot) {
  const publicLinkedInLabel = profileSnapshot?.is_viewer
    ? `Public LinkedIn URL: ${toDisplayValue(profileSnapshot?.linkedin_public_url)}`
    : profileSnapshot?.contact_mode === 'intro_request'
      ? (hasLinkedInUrl(profileSnapshot?.linkedin_public_url) ? 'Public LinkedIn URL: shared after accepted intro' : 'Public LinkedIn URL: not provided')
      : `Public LinkedIn URL: ${toDisplayValue(profileSnapshot?.linkedin_public_url)}`;

  return `${publicLinkedInLabel}
${directContactAvailabilityLine(profileSnapshot)}`;
}

function canOpenReceivedSenderLinkedIn(item) {
  return item?.role === 'received' && hasLinkedInUrl(item?.linkedin_public_url);
}

function canOpenAcceptedTargetLinkedIn(item) {
  return item?.role === 'sent' && item?.status === 'accepted' && hasLinkedInUrl(item?.linkedin_public_url);
}

function introContactHint(item) {
  if (canOpenReceivedSenderLinkedIn(item)) {
    return item?.status === 'pending' ? 'sender link available for review' : 'sender link available';
  }

  if (canOpenAcceptedTargetLinkedIn(item)) {
    return 'contact unlocked';
  }

  if (item?.role === 'sent' && item?.status === 'accepted') {
    return 'accepted • no shared link set';
  }

  return null;
}


function introRoleLabel(item) {
  return item?.role === 'received' ? 'Received intro' : 'Sent intro';
}

function notificationHeadline(value) {
  const normalized = truncate(value, 72);
  return normalized === '—' ? 'No headline' : normalized;
}

function homeNextStepLine(profileSnapshot) {
  const action = getProfileActivationNextAction(profileSnapshot || {});
  if (action.kind === 'linkedin') {
    return 'Next step: connect LinkedIn to create your profile card.';
  }
  if (action.kind === 'listed_preview') {
    return 'Your profile is live in the directory.';
  }
  if (action.kind === 'preview') {
    return 'Next step: preview your card, then publish it in the directory.';
  }
  return `Next step: ${action.label}.`;
}

export function renderIntroNotificationText({ eventType = null, introRequest = null, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const ru = language === 'ru';
  const disclosures = getTransactionDisclosures(language);
  const member = toDisplayValue(introRequest?.display_name, ru ? 'Неизвестный участник' : 'Unknown member');
  const headlineValue = notificationHeadline(introRequest?.headline_user);
  const headline = ru && headlineValue === 'No headline' ? 'Заголовок не указан' : headlineValue;

  if (eventType === 'intro_request_created') {
    return [
      ru ? '📬 Новый запрос на знакомство' : '📬 New intro request',
      '',
      ru ? `${member} хочет познакомиться.` : `${member} wants to connect.`,
      headline,
      '',
      disclosures.introAcceptance
    ].join('\n');
  }

  if (eventType === 'intro_request_accepted') {
    return [
      ru ? '✅ Знакомство принято' : '✅ Intro accepted',
      '',
      ru ? `${member} принял ваш запрос на знакомство.` : `${member} accepted your intro request.`,
      headline,
      '',
      ru ? 'Откройте детали знакомства, чтобы увидеть, была ли передана публичная ссылка LinkedIn.' : 'Open the intro detail to see whether a public LinkedIn URL was shared.'
    ].join('\n');
  }

  if (eventType === 'intro_request_declined') {
    return [
      ru ? '❌ Знакомство отклонено' : '❌ Intro declined',
      '',
      ru ? `${member} отклонил ваш запрос на знакомство.` : `${member} declined your intro request.`,
      headline,
      '',
      ru ? 'Контактные данные через это знакомство не передавались.' : 'No contact details were shared through this intro.'
    ].join('\n');
  }

  return [
    ru ? '🧾 Квитанция знакомства' : '🧾 Intro receipt',
    '',
    `${member}`,
    headline
  ].join('\n');
}

export function renderIntroNotificationKeyboard({ eventType = null, introRequestId = null, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const ru = language === 'ru';
  const buttons = getMemberButtons(language);
  const rows = [];

  if (introRequestId) {
    rows.push([{ text: ru ? '🧾 Открыть знакомство' : '🧾 View intro', callback_data: `intro:view:${introRequestId}` }]);
  }

  if (eventType === 'intro_request_created') {
    rows.push([{ text: ru ? '📥 Открыть входящие' : '📥 Open inbox', callback_data: 'intro:inbox' }]);
  }

  rows.push([{ text: buttons.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

function introStatusNote(item, interfaceLanguage = 'en') {
  if (item?.role === 'received' && item?.status === 'pending') {
    return getTransactionDisclosures(interfaceLanguage).introAcceptance;
  }

  if (item?.role === 'received' && item?.status === 'accepted') {
    return 'You accepted this intro request. If you submitted a public LinkedIn URL, the requester can now open it from their accepted intro row.';
  }

  if (item?.role === 'received' && item?.status === 'declined') {
    return 'You declined this intro request. No contact is unlocked for the requester.';
  }

  if (item?.role === 'sent' && item?.status === 'pending') {
    return 'Waiting for the recipient to accept or decline this intro request.';
  }

  if (item?.role === 'sent' && item?.status === 'accepted' && canOpenAcceptedTargetLinkedIn(item)) {
    return 'Accepted. The recipient shared a LinkedIn URL and you can open it below.';
  }

  if (item?.role === 'sent' && item?.status === 'accepted') {
    return 'Accepted. The recipient did not provide a public LinkedIn URL.';
  }

  if (item?.role === 'sent' && item?.status === 'declined') {
    return 'Declined. No contact was unlocked.';
  }

  if (item?.archived_snapshot_only) {
    return 'The live counterparty profile is gone, but the intro history snapshot is preserved here.';
  }

  return 'Intro decision state is visible here.';
}

export function buildLinkedInStartUrl({ appBaseUrl, telegramUserId, returnTo = '/menu', purpose = 'connect', launchTicket = null }) {
  const url = new URL('/api/oauth/start/linkedin', appBaseUrl);
  url.searchParams.set('tg_id', String(telegramUserId));
  url.searchParams.set('ret', returnTo);
  if (['verification_refresh', 'share_profile'].includes(purpose)) {
    url.searchParams.set('purpose', purpose);
    if (launchTicket) url.searchParams.set('ticket', launchTicket);
  }
  return url.toString();
}

function formatVerificationSyncedAt(value) {
  if (!value) return 'not synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString().slice(0, 10);
}

function buildLinkedInVerificationPrivateLines(profileSnapshot, access, interfaceLanguage = 'en') {
  if (!access?.enabled) return [];

  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const russian = language === 'ru';
  const trust = resolveLinkedInTrustState({
    profileSnapshot,
    verificationConfig: access
  });
  const tierLabel = access.mode === 'development'
    ? (russian ? 'Тестовый режим' : 'Development testing')
    : 'Lite';
  const lines = [
    '',
    `🛡 ${russian ? 'Проверка LinkedIn' : 'Verified on LinkedIn'} • ${tierLabel}`,
    access.mode === 'development'
      ? (russian ? 'Приватный статус доверия. Тестовые данные не показываются как публичный бейдж.' : 'Private trust status. Development data is not shown as a public badge.')
      : (russian ? 'Приватный статус доверия и доступность публичного бейджа.' : 'Private trust status and public badge eligibility.')
  ];

  if (russian) {
    lines.push(`• Снимок: ${trust.hasSnapshot ? 'получен' : 'не получен'}`);
    if (trust.syncedAt) lines.push(`• Последняя синхронизация: ${formatVerificationSyncedAt(trust.syncedAt)}`);
    lines.push(`• Личность: ${trust.identityVerified ? 'подтверждена LinkedIn' : 'нет подтверждения'}`);
    lines.push(`• Место работы: ${trust.workplaceVerified ? 'подтверждено LinkedIn' : 'нет подтверждения'}`);
    if (trust.verificationUrlOffered && !trust.hasVerifiedCategory) {
      lines.push('• LinkedIn сообщил о доступном действии проверки. Обновите статус, чтобы запросить новую ссылку.');
    }
    lines.push(`• Публичный бейдж: ${trust.publicBadgeEligible ? 'доступен' : 'пока недоступен'}`);
    lines.push('• Роль, компания, навыки, описание и опыт указываются пользователем.');
    return lines;
  }

  lines.push(`• Snapshot: ${describeLinkedInTrustSnapshotStatus(trust)}`);
  if (trust.syncedAt) lines.push(`• Last synced: ${formatVerificationSyncedAt(trust.syncedAt)}`);
  lines.push(`• Identity: ${trust.identityVerified ? 'confirmed by LinkedIn' : 'not present'}`);
  lines.push(`• Workplace: ${trust.workplaceVerified ? 'confirmed by LinkedIn' : 'not present'}`);
  if (trust.verificationUrlOffered && !trust.hasVerifiedCategory) {
    lines.push('• LinkedIn reported that a verification action may be available. Refresh to request a new completion URL.');
  }
  lines.push(`• Public badge: ${trust.publicBadgeEligible ? 'eligible' : describeLinkedInPublicBadgeGate(trust)}`);
  lines.push('• Role, company, skills, bio, and experience remain member-provided.');
  return lines;
}

function buildLinkedInTrustPreviewLines(profileSnapshot, verificationConfig, interfaceLanguage = 'en') {
  if (!verificationConfig?.enabled) return [];

  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const russian = language === 'ru';
  const trust = resolveLinkedInTrustState({ profileSnapshot, verificationConfig });
  if (russian) {
    const lines = ['', '🛡 Доверие LinkedIn'];
    if (trust.publicBadgeEligible) {
      if (trust.identityVerified) lines.push('✅ Личность подтверждена LinkedIn');
      if (trust.workplaceVerified) lines.push('✅ Место работы подтверждено LinkedIn');
      if (trust.syncedAt) lines.push(`Синхронизация: ${formatVerificationSyncedAt(trust.syncedAt)}`);
    } else if (trust.hasVerifiedCategory) {
      lines.push('🧪 Приватный предпросмотр бейджа');
      if (trust.identityVerified) lines.push('• Личность подтверждена LinkedIn');
      if (trust.workplaceVerified) lines.push('• Место работы подтверждено LinkedIn');
      lines.push('• Публичный бейдж пока недоступен.');
    } else {
      lines.push(`• Снимок проверки: ${trust.hasSnapshot ? 'получен' : 'не получен'}`);
      lines.push('• Публичный бейдж пока недоступен.');
    }
    lines.push('• Данные профессиональной карточки указываются пользователем.');
    return lines;
  }

  const lines = ['', '🛡 LinkedIn trust'];
  const badges = buildLinkedInPublicBadgeLines(trust);
  if (badges.length) {
    lines.push(...badges);
    lines.push(`Synced: ${formatVerificationSyncedAt(trust.syncedAt)}`);
  } else if (trust.hasVerifiedCategory) {
    lines.push('🧪 Private badge preview');
    if (trust.identityVerified) lines.push('• Identity verified on LinkedIn');
    if (trust.workplaceVerified) lines.push('• Workplace verified on LinkedIn');
    lines.push(`• ${describeLinkedInPublicBadgeGate(trust)}`);
  } else {
    lines.push(`• ${describeLinkedInTrustSnapshotStatus(trust)}`);
    lines.push(`• ${describeLinkedInPublicBadgeGate(trust)}`);
  }
  lines.push('• Professional card details remain member-provided.');
  return lines;
}

function buildLinkedInPublicTrustLines(profileSnapshot, verificationConfig) {
  const trust = resolveLinkedInTrustState({ profileSnapshot, verificationConfig });
  const badges = buildLinkedInPublicBadgeLines(trust);
  if (!badges.length) return [];
  return [
    '',
    ...badges,
    'Role, company, skills, and expertise remain member-provided.'
  ];
}

export function renderHomeText({ profileSnapshot = null, persistenceEnabled = false, directoryStats = null, introInboxStats = null, isOperator = false, notice = null, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const russian = language === 'ru';
  const surfaces = getMemberSurfaces(language);
  const lines = [
    surfaces.home,
    '',
    russian ? 'Находите профессионалов. Общайтесь только по взаимному согласию.' : 'Find professionals. Connect by permission.'
  ];

  if (!persistenceEnabled) {
    lines.push('', memberUnavailable(russian ? 'Профиль и каталог' : 'Profile and directory access', language));
  } else if (!profileSnapshot?.linkedin_sub) {
    lines.push('', russian ? 'LinkedIn: не подключён' : 'LinkedIn: Not connected');
    lines.push(russian ? 'Следующий шаг: подключите LinkedIn, чтобы создать профиль.' : 'Next: Connect LinkedIn to create your profile.');
  } else {
    const activation = getProfileActivationState(profileSnapshot || {});
    const displayName = profileSnapshot.display_name || profileSnapshot.linkedin_name || (russian ? 'Участник LinkedIn' : 'LinkedIn member');
    lines.push('', displayName);
    lines.push(`${russian ? 'Профиль' : 'Profile'}: ${profileVisibilityLabel(profileSnapshot.visibility_status, language)}`);
    lines.push(russian ? 'LinkedIn: подключён' : 'LinkedIn: Connected');
    if (!activation.isReady) {
      lines.push(russian
        ? `Настройка: выполнено ${activation.completedCount}/${activation.totalCount}`
        : `Setup: ${activation.completedCount}/${activation.totalCount} complete`);
      lines.push(`${russian ? 'Следующий шаг' : 'Next'}: ${activationNextLabel(profileSnapshot || {}, language)}`);
    } else if (!activation.isListed) {
      lines.push(russian ? 'Следующий шаг: проверьте и опубликуйте профиль.' : 'Next: Preview and publish your profile.');
    }
  }

  if (directoryStats) {
    const total = Number(directoryStats.totalCount || 0) || 0;
    if (russian) {
      lines.push(profileSnapshot?.visibility_status === 'listed'
        ? `Другие опубликованные профили: ${total}`
        : `Опубликованные профили: ${total}`);
    } else {
      lines.push(profileSnapshot?.visibility_status === 'listed'
        ? `Other listed profiles: ${total}`
        : `Listed profiles: ${total}`);
    }
  }

  if (introInboxStats) {
    const received = Number(introInboxStats.receivedPending || 0) || 0;
    const sent = Number(introInboxStats.sentPending || 0) || 0;
    lines.push(russian
      ? `Запросы: ${received} входящих · ${sent} отправленных`
      : `Requests: ${received} received · ${sent} sent`);
  }

  if (notice) {
    lines.push('', sanitizeMemberNotice(
      notice,
      russian ? 'Не удалось выполнить действие. Попробуйте позже.' : 'This action could not be completed. Try again later.',
      language
    ));
  }

  return lines.join('\n');
}

export function renderHomeKeyboard({ appBaseUrl, telegramUserId, profileSnapshot = null, persistenceEnabled = false, isOperator = false, aiNewsVisible = false, interfaceLanguage = 'en' }) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const buttons = getMemberButtons(language);
  const russian = language === 'ru';
  const rows = [];
  const isLinkedInConnected = Boolean(profileSnapshot?.linkedin_sub);

  if (!isLinkedInConnected) {
    rows.push([{ text: russian ? '🔐 Подключить LinkedIn' : '🔐 Connect LinkedIn', url: buildLinkedInStartUrl({ appBaseUrl, telegramUserId }) }]);
  } else if (persistenceEnabled) {
    const activation = getProfileActivationState(profileSnapshot || {});
    rows.push([
      { text: activation.isReady ? buttons.editProfile : buttons.continueSetup, callback_data: activation.isReady ? 'p:menu' : 'p:next' },
      { text: buttons.browseDirectory, callback_data: 'dir:list:0' }
    ]);
  }

  if (persistenceEnabled && !isLinkedInConnected) {
    rows.push([
      { text: buttons.browseDirectory, callback_data: 'dir:list:0' },
      { text: buttons.pro, callback_data: 'plans:root' }
    ]);
  }

  if (persistenceEnabled && isLinkedInConnected) {
    rows.push([
      { text: buttons.requests, callback_data: 'contact:inbox' },
      { text: buttons.pro, callback_data: 'plans:root' }
    ]);
    if (aiNewsVisible) {
      rows.push([
        { text: buttons.storyFinder, callback_data: 'news:home' },
        { text: buttons.invitePeople, callback_data: 'invite:root' }
      ]);
    } else {
      rows.push([{ text: buttons.invitePeople, callback_data: 'invite:root' }]);
    }
  }

  rows.push([
    { text: buttons.help, callback_data: 'help:root' },
    { text: buttons.language, callback_data: 'lang:root' }
  ]);
  if (isOperator) rows.push([{ text: '👑 Админка', callback_data: 'adm:home' }]);
  return buildInlineKeyboard(rows);
}

export function renderHelpText({ aiNewsVisible = false, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const russian = language === 'ru';
  const surfaces = getMemberSurfaces(language);
  const lines = russian ? [
    surfaces.help,
    '',
    'Intro Deck помогает находить профессионалов и связываться с ними только по взаимному согласию.',
    '',
    'Как начать',
    '• Подключите LinkedIn.',
    '• Заполните и опубликуйте профиль.',
    '• Откройте каталог.',
    '• Отправьте запрос. Другой человек сам решает, принять его или нет.',
    '',
    'Приватность',
    '• Личные контактные данные скрыты до одобрения.',
    '• LinkedIn подтверждает подключённый аккаунт. Роль, компанию, навыки и описание указываете вы.',
    '• Перед публикацией в LinkedIn всегда показывается точный текст и требуется отдельное подтверждение.'
  ] : [
    surfaces.help,
    '',
    'Intro Deck helps you find professionals and connect by permission.',
    '',
    'Getting started',
    '• Connect LinkedIn.',
    '• Complete and publish your profile.',
    '• Browse the directory.',
    '• Send a request. The other person decides whether to accept.',
    '',
    'Privacy',
    '• Private contact details stay hidden until approval.',
    '• LinkedIn confirms the connected account. You provide your role, company, skills, and bio.',
    '• LinkedIn posts always show an exact preview and need separate approval.'
  ];
  if (aiNewsVisible) {
    if (russian) {
      lines.push('', 'Поиск инфоповодов', '• Находите источники для своей профессиональной аудитории.', '• Сохраняйте тему, аудиторию, угол и тон для повторного использования.', '• В browse-only режиме ничего не генерируется и не публикуется автоматически.');
    } else {
      lines.push('', 'Story finder', '• Find sources for your professional audience.', '• Save searches to reuse your topic, audience, angle, and tone.', '• Nothing is generated or published automatically in browse-only mode.');
    }
  }
  return lines.join('\n');
}

export function renderHelpKeyboard({ aiNewsVisible = false, interfaceLanguage = 'en' } = {}) {
  const buttons = getMemberButtons(interfaceLanguage);
  const rows = [
    [
      { text: buttons.editProfile, callback_data: 'p:menu' },
      { text: buttons.browseDirectory, callback_data: 'dir:list:0' }
    ],
    [{ text: buttons.requests, callback_data: 'contact:inbox' }]
  ];
  if (aiNewsVisible) rows.push([{ text: buttons.storyFinder, callback_data: 'news:home' }]);
  rows.push(
    [
      { text: buttons.pro, callback_data: 'plans:root' },
      { text: buttons.invitePeople, callback_data: 'invite:root' }
    ],
    [{ text: buttons.language, callback_data: 'lang:root' }],
    [{ text: buttons.home, callback_data: 'home:root' }]
  );
  return buildInlineKeyboard(rows);
}

export function renderLanguageSettingsText({ preferences = null, persistenceEnabled = false, schemaReady = false, notice = null } = {}) {
  const resolved = resolveLanguagePreferences(preferences);
  const language = resolved.interfaceLanguage;
  const russian = language === 'ru';
  const surfaces = getMemberSurfaces(language);
  const lines = [
    surfaces.language,
    '',
    russian
      ? 'Язык интерфейса и язык публикаций сохраняются независимо.'
      : 'Interface language and post language are saved independently.',
    '',
    `${russian ? 'Язык интерфейса' : 'Interface language'}: ${languageDisplayName(resolved.interfaceLanguage, language)}`,
    `${russian ? 'Язык публикаций' : 'Default post language'}: ${languageDisplayName(resolved.defaultPostLanguage, language)}`,
    '',
    russian
      ? 'Изменение языка интерфейса не меняет язык публикаций и сохранённых поисков.'
      : 'Changing the interface language does not change post language or saved searches.',
    '',
    russian
      ? 'Обычная публикация профиля использует выбранный язык публикаций. Сохранённые поиски по-прежнему используют собственный язык каждого пресета.'
      : 'Ordinary profile sharing uses the selected post language. Saved searches continue to use each preset’s own language.'
  ];

  if (!persistenceEnabled) {
    lines.push('', russian ? '⚠️ Настройки временно недоступны.' : '⚠️ Settings are temporarily unavailable.');
  } else if (!schemaReady) {
    lines.push('', russian ? '⚠️ Требуется миграция 037. До неё используется English.' : '⚠️ Migration 037 is required. English remains the safe fallback until then.');
  }
  if (notice) lines.push('', sanitizeMemberNotice(notice, russian ? 'Не удалось сохранить настройку.' : 'Could not save the preference.', language));
  return lines.join('\n');
}

export function renderLanguageSettingsKeyboard({ preferences = null, persistenceEnabled = false, schemaReady = false } = {}) {
  const resolved = resolveLanguagePreferences(preferences);
  const language = resolved.interfaceLanguage;
  const buttons = getMemberButtons(language);
  const rows = [];
  if (persistenceEnabled && schemaReady) {
    rows.push([
      { text: `${resolved.interfaceLanguage === 'en' ? '✅' : '▫️'} UI: English`, callback_data: 'lang:interface:en' },
      { text: `${resolved.interfaceLanguage === 'ru' ? '✅' : '▫️'} UI: Русский`, callback_data: 'lang:interface:ru' }
    ]);
    rows.push([
      { text: `${resolved.defaultPostLanguage === 'en' ? '✅' : '▫️'} Post: English`, callback_data: 'lang:post:en' },
      { text: `${resolved.defaultPostLanguage === 'ru' ? '✅' : '▫️'} Post: Русский`, callback_data: 'lang:post:ru' }
    ]);
  }
  rows.push([{ text: buttons.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderPricingText({ pricingState = null } = {}) {
  const state = pricingState || {};
  const pricing = state.pricing || {};
  const subscriptionConfig = state.subscriptionConfig || {};
  const subscription = state.subscription || null;
  const recentReceipts = Array.isArray(state.recentReceipts) ? state.recentReceipts.slice(0, 5) : [];
  const allowance = state.proOutreachAllowance || null;
  const aiNewsConfig = state.aiNewsConfig || null;
  const fairUseLimit = allowance?.limit || state.contactPolicy?.proOutreachDailyLimit || 0;
  const lines = [
    MEMBER_SURFACES.pro,
    '',
    'Pro includes a bounded fair-use allowance for delivering private-chat and Telegram-contact requests.'
  ];

  if (!state.persistenceEnabled) {
    lines.push('', memberUnavailable('Pricing and purchase history'));
  } else if (subscription?.isActive) {
    lines.push('', `Status: Active until ${formatDateShort(subscription.expiresAt)}`);
  } else if (subscription?.expiresAt) {
    lines.push('', `Status: Inactive · expired ${formatDateShort(subscription.expiresAt)}`);
  } else {
    lines.push('', 'Status: Not active');
  }

  lines.push(
    '',
    `${pricing.proMonthlyPriceStars || 0}⭐ for ${subscriptionConfig.proMonthlyDurationDays || 30} days`,
    `Telegram contact request: ${pricing.contactUnlockPriceStars || 0}⭐ without Pro`,
    `Private chat request: ${pricing.dmOpenPriceStars || 0}⭐ without Pro`,
    '',
    'Fair use',
    `• ${buildProFairUseDisclosure({ dailyLimit: fairUseLimit })}`
  );
  if (allowance?.supported) lines.push(`• Current window: ${allowance.used}/${allowance.limit} used · ${allowance.remaining} left`);
  lines.push('• Payment covers request delivery. Recipient approval is always required.');
  lines.push('• Acceptance or a reply is not guaranteed.');
  lines.push('• A decline or no reply does not trigger an automatic refund for a delivered request.');

  if (aiNewsConfig?.mode === 'pro') {
    lines.push('', 'Story finder', `• ${aiNewsConfig.dailyLimit || 0} draft attempts per rolling 24 hours.`, `• ${aiNewsConfig.presetLimit || 0} saved searches.`, '• Every LinkedIn post still needs preview and separate approval.');
  }
  if (recentReceipts.length) {
    lines.push('', 'Recent purchases');
    for (const receipt of recentReceipts) lines.push(`• ${pricingReceiptLabel(receipt)} · ${receipt?.amountStars || 0}⭐ · ${formatDateShort(receipt?.confirmedAt || receipt?.purchasedAt)}`);
  }
  return lines.join('\n');
}

export function renderPricingKeyboard({ pricingState = null } = {}) {
  const state = pricingState || {};
  const pricing = state.pricing || {};
  const subscription = state.subscription || null;
  const rows = [];
  if (state.persistenceEnabled) {
    if (subscription?.isActive) rows.push([{ text: `✅ Pro active until ${formatDateShort(subscription.expiresAt)}`, callback_data: 'plans:root' }]);
    else rows.push([{ text: `⭐ Buy 30 days of Pro · ${pricing.proMonthlyPriceStars || 0}⭐`, callback_data: 'plans:buy:pro' }]);
  }
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderProfileMenuText({ profileSnapshot = null, persistenceEnabled = false, linkedinVerificationAccess = null, notice = null, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const russian = language === 'ru';
  const surfaces = getMemberSurfaces(language);
  const lines = [surfaces.profile];
  if (!persistenceEnabled) {
    lines.push('', memberUnavailable(russian ? 'Редактирование профиля' : 'Profile editing', language));
  } else if (!profileSnapshot?.linkedin_sub) {
    lines.push(
      '',
      russian ? 'Подключите LinkedIn, чтобы создать профиль.' : 'Connect LinkedIn to create your profile.',
      russian ? 'LinkedIn подтверждает подключённый аккаунт. Профессиональные данные указываете вы.' : 'LinkedIn confirms the connected account. You provide your professional details.'
    );
  } else {
    const activation = getProfileActivationState(profileSnapshot);
    lines.push('', profileSnapshot.linkedin_name || profileSnapshot.display_name || (russian ? 'Участник LinkedIn' : 'LinkedIn member'));
    lines.push(`${russian ? 'Статус' : 'Status'}: ${profileVisibilityLabel(profileSnapshot.visibility_status, language)}`);
    lines.push(russian
      ? `Настройка: выполнено ${activation.completedCount}/${activation.totalCount}`
      : `Setup: ${activation.completedCount}/${activation.totalCount} complete`);
    if (!activation.isReady) lines.push(`${russian ? 'Следующий шаг' : 'Next'}: ${activationNextLabel(profileSnapshot || {}, language)}`);
    else if (!activation.isListed) lines.push(russian ? 'Следующий шаг: проверьте и опубликуйте профиль.' : 'Next: Preview and publish your profile.');
    lines.push('', russian ? 'LinkedIn подтверждает подключённый аккаунт. Роль, компанию, навыки и описание указываете вы.' : 'LinkedIn confirms the connected account. You provide your role, company, skills, and bio.');
    lines.push('', russian ? 'Нужно для публикации' : 'Required for listing', ...buildActivationStepLines(profileSnapshot, language));
    lines.push(...buildLinkedInVerificationPrivateLines(profileSnapshot, linkedinVerificationAccess, language));
  }
  if (notice) lines.push('', sanitizeMemberNotice(
    notice,
    russian ? 'Не удалось выполнить действие. Попробуйте позже.' : 'This action could not be completed. Try again later.',
    language
  ));
  return lines.join('\n');
}

export function renderProfileMenuKeyboard({ appBaseUrl = null, telegramUserId = null, profileSnapshot = null, persistenceEnabled = false, linkedinVerificationAccess = null, linkedinVerificationLaunchTicket = null, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const russian = language === 'ru';
  const buttons = getMemberButtons(language);
  if (!persistenceEnabled) {
    return buildInlineKeyboard([
      [{ text: buttons.language, callback_data: 'lang:root' }],
      [{ text: buttons.home, callback_data: 'home:root' }]
    ]);
  }

  if (!profileSnapshot?.linkedin_sub) {
    const rows = [];
    if (appBaseUrl && telegramUserId) {
      rows.push([{ text: russian ? '🔐 Подключить LinkedIn' : '🔐 Connect LinkedIn', url: buildLinkedInStartUrl({ appBaseUrl, telegramUserId }) }]);
    }
    rows.push([{ text: buttons.language, callback_data: 'lang:root' }]);
    rows.push([{ text: buttons.home, callback_data: 'home:root' }]);
    return buildInlineKeyboard(rows);
  }

  const activation = getProfileActivationState(profileSnapshot);
  const primaryButton = activation.isReady
    ? {
        text: activation.isListed
          ? (russian ? '👁 Проверить опубликованный профиль' : '👁 Review listed profile')
          : (russian ? '👁 Проверить и опубликовать' : '👁 Preview & publish'),
        callback_data: 'p:prev'
      }
    : { text: buttons.continueSetup, callback_data: 'p:next' };

  const rows = [
    [primaryButton],
    [
      { text: russian ? '✏️ Имя' : '✏️ Display name', callback_data: 'p:ed:dn' },
      { text: russian ? '✏️ Заголовок' : '✏️ Headline', callback_data: 'p:ed:hl' }
    ],
    [
      { text: russian ? '🏷 Индустрия' : '🏷 Industry', callback_data: 'p:ed:in' },
      { text: russian ? '📝 О себе' : '📝 About', callback_data: 'p:ed:ab' }
    ],
    [{ text: russian ? '🧠 Навыки' : '🧠 Skills', callback_data: 'p:sk' }],
    [{ text: russian ? '⚙️ Дополнительные данные и контакты' : '⚙️ Optional details & contact', callback_data: 'p:opt' }]
  ];

  if (linkedinVerificationAccess?.enabled && linkedinVerificationLaunchTicket && appBaseUrl && telegramUserId) {
    rows.push([{
      text: russian ? '🛡 Обновить проверку LinkedIn' : '🛡 Refresh LinkedIn verification',
      url: buildLinkedInStartUrl({
        appBaseUrl,
        telegramUserId,
        returnTo: '/profile',
        purpose: 'verification_refresh',
        launchTicket: linkedinVerificationLaunchTicket
      })
    }]);
  }

  rows.push([{ text: buttons.language, callback_data: 'lang:root' }]);
  rows.push([{ text: buttons.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderProfilePreviewText({ profileSnapshot = null, persistenceEnabled = false, linkedinVerificationConfig = null, notice = null, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const russian = language === 'ru';
  const surfaces = getMemberSurfaces(language);
  const lines = [surfaces.profilePreview];
  if (!persistenceEnabled) {
    lines.push('', memberUnavailable(russian ? 'Предпросмотр профиля' : 'Profile preview', language));
  } else if (!profileSnapshot?.linkedin_sub) {
    lines.push('', russian ? 'Подключите LinkedIn перед предпросмотром профиля.' : 'Connect LinkedIn before previewing your profile.');
  } else {
    const activation = getProfileActivationState(profileSnapshot);
    lines.push('', toDisplayValue(profileSnapshot.display_name, profileSnapshot.linkedin_name || (russian ? 'Профиль без имени' : 'Unnamed profile')));
    lines.push(toDisplayValue(profileSnapshot.headline_user));
    lines.push(
      '',
      `${russian ? 'Компания' : 'Company'}: ${toDisplayValue(profileSnapshot.company_user)}`,
      `${russian ? 'Город' : 'City'}: ${toDisplayValue(profileSnapshot.city_user)}`,
      `${russian ? 'Индустрия' : 'Industry'}: ${toDisplayValue(profileSnapshot.industry_user)}`,
      `${russian ? 'Навыки' : 'Skills'}: ${formatSkillSummary(profileSnapshot)}`
    );
    if (profileSnapshot.linkedin_public_url) lines.push(`LinkedIn: ${profileSnapshot.linkedin_public_url}`);
    lines.push('', russian ? 'О себе' : 'About', truncate(profileSnapshot.about_user, 320));
    lines.push(...buildLinkedInTrustPreviewLines(profileSnapshot, linkedinVerificationConfig, language));
    lines.push(
      '',
      russian ? 'Приватные настройки' : 'Private settings',
      `• ${russian ? 'Username Telegram' : 'Telegram username'}: ${hiddenTelegramUsernameSummary(profileSnapshot)}`,
      `• ${russian ? 'Режим контакта' : 'Contact mode'}: ${profileContactModeSummary(profileSnapshot)}`
    );
    lines.push('', `${russian ? 'Профиль' : 'Profile'}: ${profileVisibilityLabel(profileSnapshot.visibility_status, language)}`);
    if (!activation.isReady) lines.push(`${russian ? 'Следующий шаг' : 'Next'}: ${activationNextLabel(profileSnapshot || {}, language)}`);
    else if (activation.isListed) lines.push(russian ? 'Профиль опубликован в каталоге.' : 'Your profile is live in the directory.');
    else lines.push(russian ? 'Профиль готов к публикации. Приватные контакты останутся скрыты.' : 'Ready to publish. Private contact details stay hidden.');
  }
  if (notice) lines.push('', sanitizeMemberNotice(
    notice,
    russian ? 'Не удалось выполнить действие. Попробуйте позже.' : 'This action could not be completed. Try again later.',
    language
  ));
  return lines.join('\n');
}

export function renderProfilePreviewKeyboard({ profileSnapshot = null, persistenceEnabled = true, linkedinShareConfig = null, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const russian = language === 'ru';
  const buttons = getMemberButtons(language);
  const rows = [];
  const activation = getProfileActivationState(profileSnapshot || {});

  if (persistenceEnabled && profileSnapshot?.linkedin_sub) {
    if (!activation.isReady) {
      rows.push([{ text: buttons.continueSetup, callback_data: 'p:next' }]);
    } else if (activation.isListed) {
      if (linkedinShareConfig?.enabled) {
        rows.push([{ text: russian ? '📣 Поделиться профилем в LinkedIn' : '📣 Share profile on LinkedIn', callback_data: 'li:share:start' }]);
      }
      rows.push([{ text: russian ? '🙈 Скрыть из каталога' : '🙈 Hide from directory', callback_data: 'p:vis' }]);
    } else {
      rows.push([{ text: russian ? '🌐 Опубликовать в каталоге' : '🌐 Publish in directory', callback_data: 'p:pub' }]);
    }
    rows.push([{ text: russian ? '⚙️ Дополнительные данные и контакты' : '⚙️ Optional details & contact', callback_data: 'p:opt' }]);
  }

  rows.push([
    { text: russian ? '← Назад к профилю' : '← Back to profile', callback_data: 'p:menu' },
    { text: buttons.home, callback_data: 'home:root' }
  ]);

  return buildInlineKeyboard(rows);
}

export function renderLinkedInSharePreviewText({ intent = null, notice = null, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const ru = language === 'ru';
  const disclosures = getTransactionDisclosures(language);
  const lines = [
    ru ? '📣 Публикация профиля в LinkedIn' : '📣 Share profile on LinkedIn',
    '',
    ru ? 'Проверьте точный текст ниже. Пока ничего не опубликовано.' : 'Review the exact post below. Nothing is published yet.',
    '',
    ru ? '——— Предпросмотр публикации LinkedIn ———' : '——— LinkedIn post preview ———',
    intent?.post_text || (ru ? 'Черновик публикации недоступен.' : 'Share draft is unavailable.'),
    ru ? '——— Конец предпросмотра ———' : '——— End preview ———',
    '',
    `${ru ? 'Видимость' : 'Visibility'}: ${intent?.visibility || 'PUBLIC'}`,
    disclosures.linkedinAuthorization,
    ru ? '• Одно подтверждение может создать не более одной публикации у провайдера.' : '• One approval can create at most one provider post.',
    ru ? '• Intro Deck не хранит OAuth access token, использованный для публикации.' : '• Intro Deck does not store the OAuth access token used for publishing.',
    ru ? '• Если LinkedIn вернёт неопределённый результат, автоматический повтор будет заблокирован для защиты от дубликата.' : '• If LinkedIn returns an uncertain result, automatic retry is blocked to prevent duplicates.'
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}

export function renderLinkedInSharePreviewKeyboard({ publishUrl = null, publicToken = null, interfaceLanguage = 'en' } = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const ru = language === 'ru';
  const buttons = getTransactionButtons(language);
  const memberButtons = getMemberButtons(language);
  const rows = [];
  if (publishUrl) rows.push([{ text: buttons.authorizeAndPublishPost, url: publishUrl }]);
  if (publicToken) rows.push([{ text: buttons.cancelLinkedInShare, callback_data: `li:share:cancel:${publicToken}` }]);
  rows.push([
    { text: ru ? '↩️ Предпросмотр профиля' : '↩️ Profile preview', callback_data: 'p:prev' },
    { text: memberButtons.home, callback_data: 'home:root' }
  ]);
  return buildInlineKeyboard(rows);
}

export function renderProfileOptionalText({ profileSnapshot = null, persistenceEnabled = false, notice = null } = {}) {
  const lines = [
    '⚙️ Optional profile details',
    '',
    'These fields improve your card or contact options, but they are not required to publish the profile.',
    ''
  ];

  if (!persistenceEnabled) {
    lines.push('Optional profile editing is unavailable right now.');
  } else if (!profileSnapshot?.linkedin_sub) {
    lines.push('Connect LinkedIn first before editing optional profile details.');
  } else {
    lines.push(...buildOptionalFieldStatusLines(profileSnapshot));
    lines.push('');
    lines.push(`Contact mode: ${profileContactModeSummary(profileSnapshot)}`);
    lines.push('Hidden Telegram username stays private and is revealed only after an approved supported contact request.');
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderProfileOptionalKeyboard({ profileSnapshot = null, persistenceEnabled = false } = {}) {
  if (!persistenceEnabled || !profileSnapshot?.linkedin_sub) {
    return buildInlineKeyboard([
      [
        { text: '← Back to profile', callback_data: 'p:menu' },
        { text: MEMBER_BUTTONS.home, callback_data: 'home:root' }
      ]
    ]);
  }

  return buildInlineKeyboard([
    [
      { text: '🏢 Company', callback_data: 'p:ed:co' },
      { text: '📍 City', callback_data: 'p:ed:ci' }
    ],
    [
      { text: '🔗 LinkedIn URL', callback_data: 'p:ed:li' },
      { text: '🔐 Telegram', callback_data: 'p:ed:tg' }
    ],
    [{ text: '💳 Contact mode', callback_data: 'p:cm' }],
    [{ text: '👁 Preview card', callback_data: 'p:prev' }],
    [
      { text: '← Back to profile', callback_data: 'p:menu' },
      { text: MEMBER_BUTTONS.home, callback_data: 'home:root' }
    ]
  ]);
}

export function renderProfileInputPrompt({ fieldKey, profileSnapshot = null } = {}) {
  const meta = PROFILE_FIELDS[fieldKey];
  if (!meta) {
    throw new Error(`Unsupported field key for prompt: ${fieldKey}`);
  }

  const currentValue = profileSnapshot?.[meta.column] || null;
  const lines = [
    `✏️ Edit ${meta.label}`,
    '',
    meta.prompt,
    '',
    `• Current value: ${toDisplayValue(currentValue)}`,
    `• Limit: ${meta.maxLength} characters`,
    '',
    'Reply with plain text in the chat. Your next text message will update this field.',
    'Use the buttons below to go back or return home.'
  ];

  return lines.join('\n');
}

export function renderProfileInputKeyboard() {
  return buildInlineKeyboard([
    [
      { text: '← Back to profile', callback_data: 'p:menu' },
      { text: MEMBER_BUTTONS.home, callback_data: 'home:root' }
    ]
  ]);
}

export function renderDirectoryFilterInputPrompt({ kind, filterSummary = summarizeDirectoryFilters() } = {}) {
  const label = kind === 'q' ? 'Search text' : 'City';
  const prompt = kind === 'q'
    ? 'Send a short text query for listed profiles. It matches display name, headline, company, industry, and about.'
    : 'Send a city or location fragment to narrow listed profiles.';
  const currentValue = kind === 'q' ? filterSummary.textQueryLabel : filterSummary.cityQueryLabel;
  const limit = kind === 'q' ? 80 : 60;

  return [
    `✏️ Edit ${label}`,
    '',
    prompt,
    '',
    `Current value: ${currentValue}`,
    `Limit: ${limit} characters`,
    '',
    'Reply with plain text in the chat. Your next text message will update this directory filter.',
    'Use the buttons below to go back or return home.'
  ].join('\n');
}

export function renderDirectoryFilterInputKeyboard() {
  return buildInlineKeyboard([
    [{ text: '↩️ Back to filters', callback_data: 'dir:flt' }],
    [{ text: '🌐 Browse directory', callback_data: 'dir:list:0' }],
    [{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]
  ]);
}

export function renderProfileSkillsText({ profileSnapshot = null, persistenceEnabled = false, notice = null } = {}) {
  const lines = [
    '🧠 Skills selection',
    '',
    'Pick the skills or lanes that best describe your work. At least 1 skill is required before the profile can become directory-ready.',
    ''
  ];

  if (!persistenceEnabled) {
    lines.push('Skill selection is temporarily unavailable. Try again later.');
  } else if (!profileSnapshot?.linkedin_sub) {
    lines.push('Connect LinkedIn first before editing skills.');
  } else {
    lines.push(`Selected skills: ${formatSkillSummary(profileSnapshot)}`);
    lines.push(completionLine(profileSnapshot));
    lines.push(readinessLine(profileSnapshot));
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderProfileSkillsKeyboard({ profileSnapshot = null } = {}) {
  const skillRows = [];
  for (let index = 0; index < DIRECTORY_SKILLS.length; index += 2) {
    const chunk = DIRECTORY_SKILLS.slice(index, index + 2).map((skill) => skillButton(profileSnapshot, skill));
    skillRows.push(chunk);
  }

  const activation = getProfileActivationState(profileSnapshot || {});
  const nextRow = activation.isReady
    ? [{ text: activation.isListed ? '👁 Review listed profile' : '👁 Preview & publish', callback_data: 'p:prev' }]
    : activation.nextStep?.kind !== 'skills'
      ? [{ text: '➡️ Continue setup', callback_data: 'p:next' }]
      : null;

  return buildInlineKeyboard([
    ...skillRows,
    [{ text: '🧹 Clear skills', callback_data: 'p:sk:clr' }],
    ...(nextRow ? [nextRow] : []),
    [
      { text: '← Back to profile', callback_data: 'p:menu' },
      { text: MEMBER_BUTTONS.home, callback_data: 'home:root' }
    ]
  ]);
}

export function renderProfileSavedNotice({ fieldLabel, profileSnapshot }) {
  return [
    `✅ ${fieldLabel} saved.`,
    '',
    activationProgressLine(profileSnapshot),
    activationNextStepLine(profileSnapshot)
  ].join('\n');
}

export function renderProfileSavedKeyboard({ profileSnapshot = null } = {}) {
  const activation = getProfileActivationState(profileSnapshot || {});
  const primaryButton = activation.isReady
    ? { text: activation.isListed ? '👁 Review listed profile' : '👁 Preview & publish', callback_data: 'p:prev' }
    : { text: '➡️ Continue setup', callback_data: 'p:next' };

  return buildInlineKeyboard([
    [primaryButton],
    [
      { text: '← Back to profile', callback_data: 'p:menu' },
      { text: MEMBER_BUTTONS.home, callback_data: 'home:root' }
    ]
  ]);
}

export function renderDirectoryListText({ profiles = [], page = 0, totalCount = 0, persistenceEnabled = false, filterSummary = summarizeDirectoryFilters(), viewerProfile = null, notice = null } = {}) {
  const lines = [
    MEMBER_SURFACES.directory,
    '',
    'Browse published professional profiles. Private contact details stay hidden until approval.',
    '',
    ...renderFilterSummaryLines(filterSummary)
  ];
  if (!persistenceEnabled) {
    lines.push('', memberUnavailable('Directory browsing'));
  } else if (!profiles.length) {
    lines.push('');
    if (!filterSummary.isDefault) lines.push('No profiles match these filters.');
    else if (viewerProfile?.linkedin_sub && !viewerProfile?.completion?.isReady) lines.push('No profiles are listed yet. Complete your profile to join the directory.');
    else if (viewerProfile?.completion?.isReady && viewerProfile?.visibility_status !== 'listed') lines.push('No profiles are listed yet. Your profile is ready to publish.');
    else lines.push('No profiles are listed yet. Check back soon.');
  } else {
    lines.push('', `Profiles: ${totalCount} · Page ${page + 1}`, '');
    profiles.forEach((profile, index) => lines.push(`${index + 1}. ${directoryProfileLabel(profile)}${profile.is_viewer ? ' · you' : ''}`));
  }
  if (notice) lines.push('', sanitizeMemberNotice(notice));
  return lines.join('\n');
}

export function renderDirectoryListKeyboard({ profiles = [], page = 0, hasPrev = false, hasNext = false, viewerProfile = null, filterSummary = summarizeDirectoryFilters() } = {}) {
  const rows = profiles.map((profile, index) => [{ text: `${index + 1}. ${truncate(toDisplayValue(profile.display_name, profile.linkedin_name || 'Unnamed'), 28)}`, callback_data: `dir:open:${profile.profile_id}:${page}` }]);
  const pagerRow = [];
  if (hasPrev) pagerRow.push({ text: MEMBER_BUTTONS.previous, callback_data: `dir:list:${page - 1}` });
  if (hasNext) pagerRow.push({ text: MEMBER_BUTTONS.next, callback_data: `dir:list:${page + 1}` });
  if (pagerRow.length) rows.push(pagerRow);
  rows.push([{ text: MEMBER_BUTTONS.filters, callback_data: 'dir:flt' }]);
  if (!profiles.length && viewerProfile?.linkedin_sub) {
    if (!viewerProfile?.completion?.isReady) rows.push([{ text: MEMBER_BUTTONS.continueSetup, callback_data: 'p:next' }]);
    else if (viewerProfile?.visibility_status !== 'listed' && filterSummary.isDefault) rows.push([{ text: '🌐 Publish my profile', callback_data: 'p:vis' }]);
    else rows.push([{ text: '👁 Preview my profile', callback_data: 'p:prev' }]);
  }
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderDirectoryCardText({ profileSnapshot = null, persistenceEnabled = false, linkedinVerificationConfig = null, notice = null } = {}) {
  const lines = [MEMBER_SURFACES.directoryProfile];
  if (!persistenceEnabled) {
    lines.push('', memberUnavailable('This profile'));
  } else if (!profileSnapshot?.profile_id) {
    lines.push('', 'This profile is no longer available.');
  } else {
    lines.push('', `${toDisplayValue(profileSnapshot.display_name, profileSnapshot.linkedin_name || 'Unnamed profile')}${profileSnapshot.is_viewer ? ' · you' : ''}`);
    lines.push(toDisplayValue(profileSnapshot.headline_user));
    lines.push(...buildLinkedInPublicTrustLines(profileSnapshot, linkedinVerificationConfig));
    lines.push('', `Company: ${toDisplayValue(profileSnapshot.company_user)}`, `City: ${toDisplayValue(profileSnapshot.city_user)}`, `Industry: ${toDisplayValue(profileSnapshot.industry_user)}`, `Skills: ${formatSkillSummary(profileSnapshot)}`);
    lines.push('', 'About', truncate(profileSnapshot.about_user, 320));
    lines.push('', directoryContactLabel(profileSnapshot));
  }
  if (notice) lines.push('', sanitizeMemberNotice(notice));
  return lines.join('\n');
}

export function renderDirectoryCardKeyboard({ profileSnapshot = null, page = 0 } = {}) {
  const rows = [];
  if (canViewerOpenDirectoryLinkedIn(profileSnapshot)) rows.push([{ text: profileSnapshot?.is_viewer ? '🔗 Open my LinkedIn' : '🔗 Open LinkedIn', url: profileSnapshot.linkedin_public_url.trim() }]);
  if (canOpenContactRequestRail(profileSnapshot)) rows.push([{ text: '🤝 Contact options', callback_data: `dir:contact:${profileSnapshot.profile_id}:${page}` }]);
  rows.push([{ text: MEMBER_BUTTONS.backToDirectory, callback_data: `dir:list:${page}` }]);
  rows.push([{ text: MEMBER_BUTTONS.filters, callback_data: 'dir:flt' }]);
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderContactRequestText({ profileSnapshot = null, pricingState = null, persistenceEnabled = false, notice = null } = {}) {
  const lines = ['🤝 Request contact', ''];

  if (!persistenceEnabled) {
    lines.push('Contact options are unavailable right now.');
  } else if (!profileSnapshot?.profile_id || profileSnapshot?.is_viewer) {
    lines.push('This contact flow is not available for this profile.');
  } else if (!pricingState?.profile?.linkedin_sub) {
    lines.push('Connect LinkedIn before sending contact requests.');
    lines.push('Your professional profile data remains member-provided.');
  } else {
    lines.push(`${toDisplayValue(profileSnapshot.display_name, profileSnapshot.linkedin_name || 'This member')}`);
    lines.push(truncate(profileSnapshot.headline_user, 120));
    lines.push('');
    lines.push('Every option goes to the profile owner and requires approval.');

    if (profileSnapshot.contact_mode === 'intro_request') {
      lines.push('');
      lines.push('Free intro request');
      lines.push('• Sends a permission request directly to the profile owner.');
      lines.push('• Does not reveal a Telegram username or open a private chat.');
      lines.push('• Approval is not guaranteed.');
    } else if (canOpenPaidContactRail(profileSnapshot)) {
      const pricing = pricingState?.pricing || {};
      const chatCoverage = getContactRequestCoverageLabel({ pricingState, amountStars: pricing.dmOpenPriceStars || 0 });
      const telegramCoverage = getContactRequestCoverageLabel({ pricingState, amountStars: pricing.contactUnlockPriceStars || 0 });
      lines.push('');
      lines.push(`Private chat • ${chatCoverage}`);
      lines.push('• Send a first message with the request.');
      lines.push('• Chat becomes active only after approval.');
      lines.push('');
      lines.push(`Telegram contact • ${telegramCoverage}`);
      lines.push('• Ask the owner to reveal the hidden Telegram username.');
      lines.push('• No private chat is opened inside Intro Deck.');
      lines.push('');
      lines.push('Stars or Pro cover request delivery only. Approval, contact reveal, or reply is not guaranteed. Decline or no reply alone does not trigger an automatic refund.');
    } else {
      lines.push('', 'This profile is not accepting new contact requests right now.');
    }
  }

  if (notice) lines.push('', sanitizeMemberNotice(notice));
  return lines.join('\n');
}

export function renderContactRequestKeyboard({ profileSnapshot = null, pricingState = null, page = 0 } = {}) {
  const rows = [];
  if (profileSnapshot?.profile_id && !profileSnapshot?.is_viewer) {
    if (!pricingState?.profile?.linkedin_sub) {
      rows.push([{ text: '🔗 Connect LinkedIn', callback_data: 'p:menu' }]);
    } else if (profileSnapshot.contact_mode === 'intro_request') {
      rows.push([{ text: '✉️ Send free intro request', callback_data: `dir:intro:${profileSnapshot.profile_id}:${page}` }]);
    } else if (canOpenPaidContactRail(profileSnapshot)) {
      const pricing = pricingState?.pricing || {};
      const chatCoverage = getContactRequestCoverageLabel({ pricingState, amountStars: pricing.dmOpenPriceStars || 0 });
      const telegramCoverage = getContactRequestCoverageLabel({ pricingState, amountStars: pricing.contactUnlockPriceStars || 0 });
      rows.push([{ text: `💬 Private chat • ${chatCoverage}`, callback_data: `dir:dm:${profileSnapshot.profile_id}:${page}` }]);
      rows.push([{ text: `🔐 Telegram contact • ${telegramCoverage}`, callback_data: `dir:unlock:${profileSnapshot.profile_id}:${page}` }]);
      rows.push([{ text: MEMBER_BUTTONS.pro, callback_data: 'plans:root' }]);
    }
  }
  if (profileSnapshot?.profile_id) rows.push([{ text: '← Back to profile', callback_data: `dir:open:${profileSnapshot.profile_id}:${page}` }]);
  rows.push([{ text: MEMBER_BUTTONS.backToDirectory, callback_data: `dir:list:${page}` }]);
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderContactInboxText({ notice = null } = {}) {
  const lines = [
    MEMBER_SURFACES.requests,
    '',
    'Review contact requests and continue approved private conversations.',
    '',
    'Contact requests',
    '• Intro requests',
    '• Telegram contact requests',
    '',
    'Private chats',
    '• New chat requests',
    '• Active conversations'
  ];
  if (notice) lines.push('', sanitizeMemberNotice(notice));
  return lines.join('\n');
}

export function renderContactInboxKeyboard() {
  return buildInlineKeyboard([
    [{ text: '📥 Contact requests', callback_data: 'intro:inbox' }, { text: '💬 Private chats', callback_data: 'dm:inbox' }],
    [{ text: MEMBER_BUTTONS.browseDirectory, callback_data: 'dir:list:0' }, { text: MEMBER_BUTTONS.pro, callback_data: 'plans:root' }],
    [{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]
  ]);
}

export function renderIntroInboxText({ persistenceEnabled = false, inboxState = null, contactUnlockInbox = null, notice = null } = {}) {
  const lines = [
    '📨 Contact requests',
    '',
    'Review free intro requests and Telegram-contact requests.'
  ];

  if (!persistenceEnabled) {
    lines.push('');
    lines.push('Contact requests are unavailable right now.');
  } else {
    const counts = inboxState?.counts || { receivedPending: 0, receivedTotal: 0, sentPending: 0, sentTotal: 0 };
    const receivedItems = Array.isArray(inboxState?.received) ? inboxState.received : [];
    const sentItems = Array.isArray(inboxState?.sent) ? inboxState.sent : [];
    const unlockReceivedItems = Array.isArray(contactUnlockInbox?.received) ? contactUnlockInbox.received : [];
    const unlockSentItems = Array.isArray(contactUnlockInbox?.sent) ? contactUnlockInbox.sent : [];
    const receivedPending = receivedItems.filter((item) => item?.status === 'pending');
    const receivedProcessed = receivedItems.filter((item) => item?.status !== 'pending');

    lines.push('');
    lines.push(`Received: ${counts.receivedPending}/${counts.receivedTotal} pending/total`);
    lines.push(`Sent: ${counts.sentPending}/${counts.sentTotal} pending/total`);

    if (receivedPending.length) {
      lines.push('');
      lines.push('Received pending actions:');
      receivedPending.forEach((item, index) => lines.push(renderIntroRequestLine(item, index)));
    }

    if (receivedProcessed.length) {
      lines.push('');
      lines.push('Received recent decisions:');
      receivedProcessed.forEach((item, index) => lines.push(renderIntroRequestLine(item, index)));
    }

    if (sentItems.length) {
      lines.push('');
      lines.push('Sent recent requests:');
      sentItems.forEach((item, index) => lines.push(renderIntroRequestLine(item, index)));
    }

    if (unlockReceivedItems.length) {
      lines.push('');
      lines.push('Telegram contact requests to review:');
      unlockReceivedItems.forEach((item, index) => lines.push(renderContactUnlockLine(item, index)));
    }

    if (unlockSentItems.length) {
      lines.push('');
      lines.push('Sent Telegram contact requests:');
      unlockSentItems.forEach((item, index) => lines.push(renderContactUnlockLine(item, index)));
    }

    if (!(receivedItems.length || sentItems.length || unlockReceivedItems.length || unlockSentItems.length)) {
      lines.push('');
      lines.push('No contact requests yet. Browse the directory and use Request contact on a listed profile.');
    }
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderIntroInboxKeyboard({ inboxState = null, contactUnlockInbox = null, interfaceLanguage = 'en' } = {}) {
  const rows = [];
  const transactionButtons = getTransactionButtons(interfaceLanguage);
  const receivedItems = Array.isArray(inboxState?.received) ? inboxState.received : [];
  const sentItems = Array.isArray(inboxState?.sent) ? inboxState.sent : [];
  const unlockReceivedItems = Array.isArray(contactUnlockInbox?.received) ? contactUnlockInbox.received : [];
  const unlockSentItems = Array.isArray(contactUnlockInbox?.sent) ? contactUnlockInbox.sent : [];

  for (const [index, item] of receivedItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Received ${index + 1}`), 20);
    rows.push([
      { text: `📥 ${index + 1}. ${label}`, callback_data: `intro:view:${item?.intro_request_id || 0}` },
      { text: '👤 Open profile', callback_data: item?.profile_id ? `intro:open:${item.profile_id}` : 'intro:noop' }
    ]);

    if (canOpenReceivedSenderLinkedIn(item)) {
      rows.push([{ text: '🔗 Sender LinkedIn', url: item.linkedin_public_url.trim() }]);
    }

    if (item?.status === 'pending') {
      rows.push([
        { text: transactionButtons.acceptIntro, callback_data: `intro:acc:${item?.intro_request_id || 0}` },
        { text: transactionButtons.declineIntro, callback_data: `intro:dec:${item?.intro_request_id || 0}` }
      ]);
    }
  }

  for (const [index, item] of sentItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Sent ${index + 1}`), 20);
    rows.push([
      { text: `📤 ${index + 1}. ${label}`, callback_data: `intro:view:${item?.intro_request_id || 0}` },
      { text: '👤 Open profile', callback_data: item?.profile_id ? `intro:open:${item.profile_id}` : 'intro:noop' }
    ]);

    if (canOpenAcceptedTargetLinkedIn(item)) {
      rows.push([{ text: transactionButtons.openSharedLinkedIn, url: item.linkedin_public_url.trim() }]);
    }
  }


  for (const [index, item] of unlockReceivedItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Direct ${index + 1}`), 20);
    rows.push([{ text: `🔐 ${index + 1}. ${label}`, callback_data: `cu:view:${item?.contact_unlock_request_id || 0}` }]);
    if (item?.status === 'paid_pending_approval') {
      rows.push([
        { text: transactionButtons.shareTelegramContact, callback_data: `cu:acc:${item?.contact_unlock_request_id || 0}` },
        { text: transactionButtons.declineTelegramContact, callback_data: `cu:dec:${item?.contact_unlock_request_id || 0}` }
      ]);
    }
  }

  for (const [index, item] of unlockSentItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Direct ${index + 1}`), 20);
    rows.push([{ text: `⭐ ${index + 1}. ${label}`, callback_data: `cu:view:${item?.contact_unlock_request_id || 0}` }]);
    if (item?.status === 'revealed' && item?.revealed_contact_value) {
      const clean = String(item.revealed_contact_value).replace(/^@+/, '');
      rows.push([{ text: transactionButtons.openTelegramContact, url: `https://t.me/${clean}` }]);
    }
  }

  rows.push([{ text: '🔄 Refresh', callback_data: 'intro:inbox' }]);
  rows.push([{ text: '💬 Private chats', callback_data: 'dm:inbox' }]);
  rows.push([{ text: MEMBER_BUTTONS.browseDirectory, callback_data: 'dir:list:0' }]);
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);

  return buildInlineKeyboard(rows);
}

export function renderIntroDetailText({ persistenceEnabled = false, introRequest = null, notice = null, interfaceLanguage = 'en' } = {}) {
  const lines = [
    '🧾 Intro request',
    '',
    'Review this intro and the exact contact outcome.'
  ];

  if (!persistenceEnabled) {
    lines.push('');
    lines.push('This request is temporarily unavailable. Try again later.');
  } else if (!introRequest?.intro_request_id) {
    lines.push('');
    lines.push('Intro request not found.');
  } else {
    lines.push('');
    lines.push(`Perspective: ${introRoleLabel(introRequest)}`);
    lines.push(`Member: ${toDisplayValue(introRequest.display_name, 'Unknown member')}`);
    lines.push(`Headline: ${truncate(introRequest.headline_user, 120)}`);
    lines.push(`Status: ${toDisplayValue(introRequest.status)}`);
    lines.push(`Created: ${formatDateShort(introRequest.created_at)}`);
    lines.push(`Updated: ${formatDateShort(introRequest.updated_at)}`);
    lines.push(`Profile card: ${introRequest.profile_id ? 'available' : introRequest.archived_snapshot_only ? 'removed • archived snapshot preserved' : 'not available'}`);

    if (introRequest.archived_snapshot_only) {
      lines.push('History safety: live profile is gone, archived intro snapshot is preserved.');
    }

    if (canOpenReceivedSenderLinkedIn(introRequest)) {
      lines.push(`Sender LinkedIn: ${introRequest.status === 'pending' ? 'available for review' : 'available'}`);
    } else if (introRequest.role === 'received') {
      lines.push('Sender LinkedIn: not shared');
    }

    if (canOpenAcceptedTargetLinkedIn(introRequest)) {
      lines.push('Unlocked contact: LinkedIn URL available');
    } else if (introRequest.role === 'sent' && introRequest.status === 'accepted') {
      lines.push('Unlocked contact: recipient did not share a LinkedIn URL');
    } else if (introRequest.role === 'sent') {
      lines.push('Unlocked contact: not available yet');
    }

    lines.push('');
    lines.push(introStatusNote(introRequest, interfaceLanguage));
    if (introRequest.role === 'received' && introRequest.status === 'pending') {
      lines.push('Choose Accept intro only if you want to share the contact outcome described above.');
    }
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderIntroDetailKeyboard({ introRequest = null, interfaceLanguage = 'en' } = {}) {
  const rows = [];
  const transactionButtons = getTransactionButtons(interfaceLanguage);

  if (introRequest?.profile_id) {
    rows.push([{ text: '👤 Open profile', callback_data: `intro:open:${introRequest.profile_id}` }]);
  }

  if (canOpenReceivedSenderLinkedIn(introRequest)) {
    rows.push([{ text: '🔗 Sender LinkedIn', url: introRequest.linkedin_public_url.trim() }]);
  }

  if (canOpenAcceptedTargetLinkedIn(introRequest)) {
    rows.push([{ text: transactionButtons.openSharedLinkedIn, url: introRequest.linkedin_public_url.trim() }]);
  }

  if (introRequest?.role === 'received' && introRequest?.status === 'pending') {
    rows.push([
      { text: transactionButtons.acceptIntro, callback_data: `intro:acc:${introRequest.intro_request_id}` },
      { text: transactionButtons.declineIntro, callback_data: `intro:dec:${introRequest.intro_request_id}` }
    ]);
  }

  rows.push([{ text: '↩️ Back to inbox', callback_data: 'intro:inbox' }]);
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);

  return buildInlineKeyboard(rows);
}

export function renderContactUnlockDetailText({ persistenceEnabled = false, request = null, notice = null, interfaceLanguage = 'en' } = {}) {
  const lines = [
    '🔐 Telegram contact request',
    '',
    'Review whether to reveal your hidden Telegram username to this requester.'
  ];

  if (!persistenceEnabled) {
    lines.push('', 'Telegram contact details are temporarily unavailable. Try again later.');
  } else if (!request?.contact_unlock_request_id) {
    lines.push('', 'Telegram contact request not found.');
  } else {
    lines.push('');
    lines.push(`Perspective: ${request.role === 'received' ? 'Received Telegram contact request' : 'Sent Telegram contact request'}`);
    lines.push(`Member: ${toDisplayValue(request.display_name, 'Unknown member')}`);
    lines.push(`Headline: ${truncate(request.headline_user, 120)}`);
    lines.push(`Status: ${toDisplayValue(request.status)}`);
    lines.push(request.pro_covered
      ? 'Delivery coverage: Pro fair-use allowance'
      : `Payment: ${toDisplayValue(request.payment_state)}`);
    lines.push(request.pro_covered
      ? `Reference per-request price: ${Number.isFinite(Number(request.price_stars_snapshot)) ? `${request.price_stars_snapshot}⭐ • not charged` : '—'}`
      : `Request-delivery fee: ${Number.isFinite(Number(request.price_stars_snapshot)) ? `${request.price_stars_snapshot}⭐` : '—'}`);
    lines.push(getTransactionDisclosures(interfaceLanguage).requestDeliveryPayment);
    lines.push(`Requested: ${formatDateShort(request.requested_at)}`);
    if (request.role === 'sent') {
      if (request.status === 'revealed' && request.revealed_contact_value) {
        lines.push(`Unlocked Telegram username: @${String(request.revealed_contact_value).replace(/^@+/, '')}`);
      } else if (request.status === 'paid_pending_approval') {
        lines.push('Telegram contact is still waiting for recipient approval.');
      } else if (request.status === 'declined') {
        lines.push('No Telegram username was revealed.');
      }
    } else {
      lines.push(request.status === 'paid_pending_approval'
        ? getTransactionDisclosures(interfaceLanguage).telegramContactAcceptance
        : request.status === 'revealed'
          ? 'You approved this request and your hidden Telegram username was revealed to the requester.'
          : 'This Telegram contact request is no longer actionable.');
    }
  }

  if (notice) {
    lines.push('', notice);
  }

  return lines.join('\n');
}

export function renderContactUnlockDetailKeyboard({ request = null, interfaceLanguage = 'en' } = {}) {
  const rows = [];
  const transactionButtons = getTransactionButtons(interfaceLanguage);

  if (request?.profile_id) {
    rows.push([{ text: '👤 Open profile', callback_data: `intro:open:${request.profile_id}` }]);
  }

  if (request?.role === 'received' && request?.status === 'paid_pending_approval') {
    rows.push([
      { text: transactionButtons.shareTelegramContact, callback_data: `cu:acc:${request.contact_unlock_request_id}` },
      { text: transactionButtons.declineTelegramContact, callback_data: `cu:dec:${request.contact_unlock_request_id}` }
    ]);
  }

  if (request?.role === 'sent' && request?.status === 'revealed' && request?.revealed_contact_value) {
    const clean = String(request.revealed_contact_value).replace(/^@+/, '');
    rows.push([{ text: transactionButtons.openTelegramContact, url: `https://t.me/${clean}` }]);
  }

  rows.push([{ text: '↩️ Back to inbox', callback_data: 'intro:inbox' }]);
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}


export function renderDmInboxText({ persistenceEnabled = false, inboxState = null, notice = null } = {}) {
  const lines = [
    '💬 Private chats',
    '',
    'Review private-chat requests and continue approved conversations.'
  ];

  if (!persistenceEnabled) {
    lines.push('', 'Private chats are unavailable right now.');
  } else {
    const counts = inboxState?.counts || { received_pending: 0, received_total: 0, sent_pending: 0, sent_total: 0, active_total: 0 };
    const receivedItems = Array.isArray(inboxState?.received) ? inboxState.received : [];
    const sentItems = Array.isArray(inboxState?.sent) ? inboxState.sent : [];
    lines.push('');
    lines.push(`Received chat requests: ${counts.received_pending}/${counts.received_total} pending/total`);
    lines.push(`Sent chat requests: ${counts.sent_pending}/${counts.sent_total} pending/total`);
    lines.push(`Active conversations: ${counts.active_total || 0}`);

    if (receivedItems.length) {
      lines.push('', 'Incoming chat requests / threads:');
      receivedItems.forEach((item, index) => lines.push(renderDmThreadLine(item, index)));
    }

    if (sentItems.length) {
      lines.push('', 'Sent chat requests / threads:');
      sentItems.forEach((item, index) => lines.push(renderDmThreadLine(item, index)));
    }

    if (!(receivedItems.length || sentItems.length)) {
      lines.push('', 'No private-chat requests yet. Open a listed profile and use Request contact.');
    }
  }

  if (notice) {
    lines.push('', notice);
  }

  return lines.join('\n');
}

export function renderDmInboxKeyboard({ inboxState = null, interfaceLanguage = 'en' } = {}) {
  const rows = [];
  const transactionButtons = getTransactionButtons(interfaceLanguage);
  const receivedItems = Array.isArray(inboxState?.received) ? inboxState.received : [];
  const sentItems = Array.isArray(inboxState?.sent) ? inboxState.sent : [];

  for (const [index, item] of receivedItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Incoming ${index + 1}`), 20);
    rows.push([{ text: `📨 ${index + 1}. ${label}`, callback_data: `dm:view:${item?.dm_thread_id || 0}` }]);
    if (item?.status === 'pending_recipient') {
      rows.push([
        { text: transactionButtons.acceptPrivateChat, callback_data: `dm:acc:${item?.dm_thread_id || 0}` },
        { text: transactionButtons.declinePrivateChat, callback_data: `dm:dec:${item?.dm_thread_id || 0}` }
      ]);
    }
  }

  for (const [index, item] of sentItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Sent ${index + 1}`), 20);
    rows.push([{ text: `💬 ${index + 1}. ${label}`, callback_data: `dm:view:${item?.dm_thread_id || 0}` }]);
  }

    rows.push([{ text: MEMBER_BUTTONS.backToRequests, callback_data: 'contact:inbox' }]);
  rows.push([{ text: MEMBER_BUTTONS.browseDirectory, callback_data: 'dir:list:0' }]);
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderDmThreadText({ persistenceEnabled = false, thread = null, viewerTelegramUserId = null, notice = null, interfaceLanguage = 'en' } = {}) {
  const lines = [
    '🧾 Private chat',
    '',
    'Review whether to open a private conversation with this member.'
  ];

  if (!persistenceEnabled) {
    lines.push('', 'Private chat detail is unavailable right now.');
  } else if (!thread?.dm_thread_id) {
    lines.push('', 'Private chat not found.');
  } else {
    lines.push('');
    lines.push(`Perspective: ${thread.role === 'received' ? 'Received private-chat request' : 'Sent private-chat request'}`);
    lines.push(`Member: ${toDisplayValue(thread.display_name, 'Unknown member')}`);
    lines.push(`Headline: ${truncate(thread.headline_user, 120)}`);
    lines.push(`Status: ${toDisplayValue(thread.status)}`);
    lines.push(thread.pro_covered
      ? 'Delivery coverage: Pro fair-use allowance'
      : `Payment: ${toDisplayValue(thread.payment_state)}`);
    lines.push(thread.pro_covered
      ? `Reference per-request price: ${Number.isFinite(Number(thread.price_stars_snapshot)) ? `${thread.price_stars_snapshot}⭐ • not charged` : '—'}`
      : `Request-delivery fee: ${Number.isFinite(Number(thread.price_stars_snapshot)) ? `${thread.price_stars_snapshot}⭐` : '—'}`);
    if (thread.status !== 'active') {
      lines.push(getTransactionDisclosures(interfaceLanguage).requestDeliveryPayment);
    }
    lines.push(`Created: ${formatDateShort(thread.created_at)}`);
    if (thread.status === 'pending_recipient' && thread.role === 'received') {
      lines.push(getTransactionDisclosures(interfaceLanguage).privateChatAcceptance);
    }
    if (thread.first_message_text) {
      lines.push('', `First message: ${truncate(thread.first_message_text, 280)}`);
    }
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    if (messages.length) {
      lines.push('', 'Conversation:');
      messages.slice(-8).forEach((message) => lines.push(renderDmMessageLine(message, viewerTelegramUserId)));
    }
  }

  if (notice) {
    lines.push('', notice);
  }

  return lines.join('\n');
}

export function renderDmThreadKeyboard({ thread = null, interfaceLanguage = 'en' } = {}) {
  const rows = [];
  const transactionButtons = getTransactionButtons(interfaceLanguage);

  if (thread?.role === 'received' && thread?.status === 'pending_recipient') {
    rows.push([
      { text: transactionButtons.acceptPrivateChat, callback_data: `dm:acc:${thread.dm_thread_id}` },
      { text: transactionButtons.declinePrivateChat, callback_data: `dm:dec:${thread.dm_thread_id}` }
    ]);
    rows.push([
      { text: transactionButtons.blockRequester, callback_data: `dm:blk:${thread.dm_thread_id}` },
      { text: transactionButtons.reportAndBlock, callback_data: `dm:rpt:${thread.dm_thread_id}` }
    ]);
  }

  if (thread?.role === 'sent' && thread?.status === 'payment_pending') {
    rows.push([{ text: payPrivateChatDeliveryButton(thread.price_stars_snapshot, interfaceLanguage), callback_data: `dm:pay:${thread.dm_thread_id}` }]);
  }

  if (thread?.status === 'active') {
    rows.push([{ text: '✉️ Send message', callback_data: `dm:send:${thread.dm_thread_id}` }]);
  }

  rows.push([{ text: '↩️ Back to Private chats', callback_data: 'dm:inbox' }]);
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderDirectoryFiltersText({ persistenceEnabled = false, filterSummary = summarizeDirectoryFilters(), notice = null } = {}) {
  const lines = [
    '🎯 Directory filters',
    '',
    'Use text, city, one industry bucket, and any number of skills to narrow listed profiles. Skill filters match any selected skill.',
    '',
    ...renderFilterSummaryLines(filterSummary)
  ];

  if (!persistenceEnabled) {
    lines.push('');
    lines.push('Directory filters are temporarily unavailable. Try again later.');
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderDirectoryFiltersKeyboard({ filterSummary = summarizeDirectoryFilters() } = {}) {
  const rows = [];

  rows.push([
    { text: `🔎 Search: ${truncate(filterSummary.textQueryLabel, 18)}`, callback_data: 'dir:ft:q' },
    { text: `📍 City: ${truncate(filterSummary.cityQueryLabel, 18)}`, callback_data: 'dir:ft:c' }
  ]);

  if (filterSummary.textQuery || filterSummary.cityQuery) {
    const clearRow = [];
    if (filterSummary.textQuery) {
      clearRow.push({ text: '✖️ Clear search', callback_data: 'dir:fx:q' });
    }
    if (filterSummary.cityQuery) {
      clearRow.push({ text: '✖️ Clear city', callback_data: 'dir:fx:c' });
    }
    rows.push(clearRow);
  }

  for (const bucket of DIRECTORY_INDUSTRY_BUCKETS) {
    rows.push([filterIndustryButton(filterSummary, bucket)]);
  }

  for (let index = 0; index < DIRECTORY_SKILLS.length; index += 2) {
    const chunk = DIRECTORY_SKILLS.slice(index, index + 2).map((skill) => filterSkillButton(filterSummary, skill));
    rows.push(chunk);
  }

  if (!filterSummary.isDefault) {
    rows.push([{ text: '🧹 Clear filters', callback_data: 'dir:fc' }]);
  }
  rows.push([{ text: MEMBER_BUTTONS.backToDirectory, callback_data: 'dir:list:0' }]);
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);

  return buildInlineKeyboard(rows);
}



export function renderInviteText({ inviteState = null, notice = null } = {}) {
  const lines = [
    MEMBER_SURFACES.invite,
    '',
    'Share your personal Intro Deck invite. Activity and rewards are tracked automatically.'
  ];
  if (!inviteState?.persistenceEnabled) {
    lines.push('', memberUnavailable('Invite tracking'));
  } else {
    const invitedCount = Number(inviteState.invitedCount || 0) || 0;
    const activatedCount = Number(inviteState.activatedCount || 0) || 0;
    const rewardsSummary = inviteState?.rewardsSummary || null;
    lines.push('', `Invited: ${invitedCount}`, `Activated: ${activatedCount}`);
    if (rewardsSummary && String(rewardsSummary.mode || 'off') !== 'off') lines.push(`Points: ${Number(rewardsSummary.availablePoints || 0) || 0}`);
  }
  if (notice) lines.push('', escapeHtml(sanitizeMemberNotice(notice)));
  return lines.join('\n');
}

export function renderInviteKeyboard({ inviteState = null } = {}) {
  const rows = [];
  if (inviteState?.persistenceEnabled && inviteState?.inviteLink) {
    rows.push([{ text: '📨 Share to a chat', switch_inline_query: inviteState.shareInlineQuery || 'invite' }]);
    rows.push([
      { text: '🖼 Forwarding card', callback_data: 'invite:send_card' },
      { text: '🔗 Copy invite link', callback_data: 'invite:show_link' }
    ]);
    const activityRow = [{ text: '📊 Activity', callback_data: 'invite:activity' }];
    const pointsEntry = getInvitePointsEntry(inviteState?.rewardsSummary);
    if (pointsEntry) activityRow.push(pointsEntry);
    rows.push(activityRow);
  }
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderInvitePerformanceText({ inviteState = null, notice = null } = {}) {
  const invitedCount = Number(inviteState?.invitedCount || 0) || 0;
  const activatedCount = Number(inviteState?.activatedCount || 0) || 0;
  const recentInvites = Array.isArray(inviteState?.invited) ? inviteState.invited.slice(0, 3) : [];
  const lines = [
    '📊 Invite activity',
    '',
    'See invite totals, attribution sources, recent movement, and the latest joined contacts.',
    '',
    '<b>All-time</b>',
    `• Invited: ${invitedCount}`,
    `• Activated: ${activatedCount}`,
    `• Activation rate: ${getInviteActivationRate(invitedCount, activatedCount)}`,
    '',
    '<b>By source</b>',
    `• Share to a chat: ${Number(inviteState?.inlineShareCount || 0) || 0}`,
    `• Copy invite link: ${Number(inviteState?.rawLinkCount || 0) || 0}`,
    `• Forwarding card: ${Number(inviteState?.inviteCardCount || 0) || 0}`,
    '',
    '<b>Last 7 days</b>',
    `• Invited: ${Number(inviteState?.joined7d || 0) || 0}`,
    `• Activated: ${Number(inviteState?.activated7d || 0) || 0}`
  ];

  if (inviteState?.activationHint) {
    lines.push('', '<b>Activation rule</b>');
    lines.push(`• Current signal: ${escapeHtml(inviteState.activationHint)}.`);
  }

  lines.push('', '<b>Recent activity</b>');
  if (recentInvites.length > 0) {
    recentInvites.forEach((item, index) => lines.push(escapeHtml(renderInviteFriendLine(item, index))));
  } else {
    lines.push('• No invite activity yet.');
    lines.push('• Share your card or attributed link to start tracking activity.');
  }

  if (notice) {
    lines.push('', escapeHtml(notice));
  }

  return lines.join('\n');
}

export function renderInvitePerformanceKeyboard({ inviteState = null } = {}) {
  const rows = [[
    { text: '📨 Invite people', callback_data: 'invite:root' },
    { text: '📋 Full history', callback_data: 'invite:hist:1' }
  ]];
  const bottomRow = [];
  const pointsEntry = getInvitePointsEntry(inviteState?.rewardsSummary);
  if (pointsEntry) bottomRow.push(pointsEntry);
  bottomRow.push({ text: MEMBER_BUTTONS.home, callback_data: 'home:root' });
  rows.push(bottomRow);
  return buildInlineKeyboard(rows);
}

export function renderInviteHistoryText({ inviteState = null, historyState = null, notice = null } = {}) {
  const totalCount = Number(historyState?.totalCount || 0) || 0;
  const currentPage = Number(historyState?.page || 1) || 1;
  const totalPages = Number(historyState?.totalPages || 1) || 1;
  const startIndex = Number(historyState?.startIndex || 0) || 0;
  const endIndex = Number(historyState?.endIndex || 0) || 0;
  const lines = [
    '📋 Invite history',
    '',
    'Everyone who joined from your invite appears here.',
    '',
    '<b>Summary</b>',
    `• Invited: ${Number(inviteState?.invitedCount || 0) || 0}`,
    `• Activated: ${Number(inviteState?.activatedCount || 0) || 0}`,
    `• Activation rate: ${getInviteActivationRate(inviteState?.invitedCount, inviteState?.activatedCount)}`,
    '',
    '<b>History window</b>'
  ];

  if (totalCount > 0) {
    lines.push(`• Showing: ${startIndex + 1}–${endIndex} of ${totalCount}`);
    lines.push(`• Page: ${currentPage}/${totalPages}`);
    lines.push('', '<b>Contacts</b>');
    historyState.items.forEach((item, index) => lines.push(escapeHtml(renderInviteHistoryLine(item, index, startIndex))));
  } else {
    lines.push('• No invited contacts yet.');
    lines.push('• Your first joined contact will appear here automatically.');
  }

  if (notice) {
    lines.push('', escapeHtml(notice));
  }

  return lines.join('\n');
}

export function renderInviteHistoryKeyboard({ inviteState = null, historyState = null } = {}) {
  const rows = [];
  const navRow = [];
  if (historyState?.hasPrev) {
    navRow.push({ text: '⬅️ Prev', callback_data: `invite:hist:${Math.max(1, Number(historyState?.page || 1) - 1)}` });
  }
  if (historyState?.hasNext) {
    navRow.push({ text: 'Next ➡️', callback_data: `invite:hist:${Math.max(1, Number(historyState?.page || 1) + 1)}` });
  }
  if (navRow.length) rows.push(navRow);
  rows.push([
    { text: '📨 Invite people', callback_data: 'invite:root' },
    { text: '📊 Activity', callback_data: 'invite:activity' }
  ]);
  const bottomRow = [];
  const pointsEntry = getInvitePointsEntry(inviteState?.rewardsSummary);
  if (pointsEntry) bottomRow.push(pointsEntry);
  bottomRow.push({ text: MEMBER_BUTTONS.home, callback_data: 'home:root' });
  rows.push(bottomRow);
  if (!(Number(inviteState?.invitedCount || 0) > 0)) {
    rows.push([
      { text: '📨 Share to a chat', switch_inline_query: inviteState?.shareInlineQuery || 'invite' },
      { text: '🔗 Copy invite link', callback_data: 'invite:show_link' }
    ]);
  }
  return buildInlineKeyboard(rows);
}

function formatInviteRewardsModeLabel(mode = 'off') {
  switch (String(mode || 'off').trim().toLowerCase()) {
    case 'earn_only':
      return 'earn only';
    case 'live':
      return 'live';
    case 'paused':
      return 'paused';
    case 'off':
    default:
      return 'off';
  }
}

function renderInviteRewardEventLine(event = null, index = 0) {
  if (!event) {
    return `${index + 1}. —`;
  }

  const statusLabel = String(event.status || 'pending').replaceAll('_', ' ');
  const dueLabel = event.confirmAfter ? formatDateTimeShort(event.confirmAfter) : '—';
  const displayName = event.invitedDisplayName || 'Invited contact';
  return `${index + 1}. ${displayName} • ${Number(event.points || 0) || 0} pts • ${statusLabel} • due ${dueLabel}`;
}

export function renderInviteRewardsText({ rewardsState = null, notice = null } = {}) {
  const summary = rewardsState?.rewardsSummary || {};
  const recentEvents = Array.isArray(rewardsState?.recentEvents) ? rewardsState.recentEvents : [];
  const mode = String(summary.mode || rewardsState?.mode || 'off').trim().toLowerCase();
  const lines = [
    '🎯 Points',
    '',
    'This screen shows your invite rewards status. Only available points can be spent.',
    '',
    '<b>Your balance</b>',
    `• Mode: ${escapeHtml(formatInviteRewardsModeLabel(mode))}`,
    `• Pending: ${Number(summary.pendingPoints || 0) || 0}`,
    `• Available: ${Number(summary.availablePoints || 0) || 0}`,
    `• Redeemed: ${Number(summary.redeemedPoints || 0) || 0}`,
    '',
    '<b>How it works</b>',
    `• Activation signal: ${escapeHtml(rewardsState?.activationHint || 'the invited member connected LinkedIn and reached listed-ready state')}.`,
    `• Pending confirms after ${Number(summary?.config?.activationConfirmHours || 24) || 24}h if the activation still holds.`,
    '• Self-invites, existing users, and raw opens do not earn points.',
    '• What changes by mode is shown below.'
  ];

  lines.push('', '<b>Redeem status</b>');
  if (mode === 'live') {
    lines.push('• Redeem for Pro is live now. Spend from Available only.');
  } else if (mode === 'earn_only') {
    lines.push('• Earning is on and tracking is live. Redeem is not available yet.');
  } else if (mode === 'paused') {
    lines.push('• Rewards are paused right now. Existing balances stay visible, but no new actions go through.');
  } else {
    lines.push('• Rewards program is off right now. Existing balances stay visible, but no new actions go through.');
  }

  lines.push('', '<b>Recent reward events</b>');
  if (recentEvents.length > 0) {
    recentEvents.forEach((event, index) => lines.push(escapeHtml(renderInviteRewardEventLine(event, index))));
  } else {
    lines.push('• No reward events yet.');
    lines.push('• Once a qualified invite confirms, it will appear here.');
  }

  if (notice) {
    lines.push('', escapeHtml(notice));
  }

  return lines.join('\n');
}

export function renderInviteRewardsKeyboard({ rewardsState = null } = {}) {
  const mode = String(rewardsState?.rewardsSummary?.mode || rewardsState?.mode || 'off').trim().toLowerCase();
  const redeemLabel = mode === 'live'
    ? '✨ Redeem for Pro'
    : mode === 'earn_only'
      ? '🔒 Redeem for Pro'
      : mode === 'paused'
        ? '⏸️ Redeem paused'
        : '🚫 Redeem off';
  return buildInlineKeyboard([
    [{ text: redeemLabel, callback_data: 'invite:redeem' }],
    [
      { text: '📨 Invite people', callback_data: 'invite:root' },
      { text: '📋 Full history', callback_data: 'invite:hist:1' }
    ],
    [
      { text: '📊 Activity', callback_data: 'invite:activity' },
      { text: MEMBER_BUTTONS.home, callback_data: 'home:root' }
    ]
  ]);
}

export function renderInviteRedeemText({ redeemState = null, notice = null } = {}) {
  const summary = redeemState?.rewardsSummary || {};
  const catalog = Array.isArray(redeemState?.catalog) ? redeemState.catalog : [];
  const lines = [
    '✨ Redeem for Pro',
    '',
    'Exchange available invite points for Intro Deck Pro.',
    '',
    '<b>Status</b>',
    `• Mode: ${escapeHtml(formatInviteRewardsModeLabel(redeemState?.mode || summary.mode || 'off'))}`,
    `• Available: ${Number(summary.availablePoints || 0) || 0}`,
    `• Pending: ${Number(summary.pendingPoints || 0) || 0}`,
    `• Redeemed: ${Number(summary.redeemedPoints || 0) || 0}`,
    '',
    '<b>Catalog</b>'
  ];

  if (catalog.length) {
    catalog.forEach((item) => {
      lines.push(`• ${escapeHtml(item.label || item.code)} — ${Number(item.pointsCost || 0) || 0} pts`);
    });
  } else {
    lines.push('• No redeem catalog is configured right now.');
  }

  if (redeemState?.blockedReason === 'redeem_not_live_in_earn_only') {
    lines.push('', 'Redeem is not live yet. Earn-only mode keeps balances visible without spending.');
  } else if (redeemState?.blockedReason === 'rewards_paused') {
    lines.push('', 'Rewards are paused right now. No new redeem actions can be completed.');
  } else if (redeemState?.blockedReason === 'rewards_off') {
    lines.push('', 'Rewards program is off right now.');
  } else {
    lines.push('', 'Only available points can be spent. Pending stays locked until confirmation.');
  }

  if (notice) {
    lines.push('', escapeHtml(notice));
  }

  return lines.join('\n');
}

export function renderInviteRedeemKeyboard({ redeemState = null } = {}) {
  const rows = [];
  const mode = String(redeemState?.mode || redeemState?.rewardsSummary?.mode || 'off').trim().toLowerCase();
  const availablePoints = Number(redeemState?.rewardsSummary?.availablePoints || 0) || 0;
  const catalog = Array.isArray(redeemState?.catalog) ? redeemState.catalog : [];

  if (mode === 'live') {
    catalog.forEach((item) => {
      const affordable = availablePoints >= (Number(item.pointsCost || 0) || 0);
      rows.push([{ text: `${affordable ? '✅' : '🔒'} ${item.label || item.code} • ${item.pointsCost} pts`, callback_data: `invite:redeem_item:${item.code}` }]);
    });
  }

  rows.push([
    { text: '🎯 Points', callback_data: 'invite:points' },
    { text: '📨 Invite people', callback_data: 'invite:root' }
  ]);
  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderInviteRedeemConfirmText({ catalogItem = null, rewardsSummary = null, notice = null } = {}) {
  const itemLabel = catalogItem?.label || catalogItem?.code || 'selected item';
  const cost = Number(catalogItem?.pointsCost || 0) || 0;
  const proDays = Number(catalogItem?.proDays || 0) || 0;
  const available = Number(rewardsSummary?.availablePoints || 0) || 0;
  return [
    '✅ Confirm redeem',
    '',
    `Redeem <b>${escapeHtml(itemLabel)}</b>?`,
    '',
    `• Cost: ${cost} pts`,
    `• Result: ${proDays} days Pro`,
    `• Available now: ${available}`,
    '',
    'This spends available points only and applies Pro through the existing subscription rail.',
    ...(notice ? ['', escapeHtml(notice)] : [])
  ].join('\n');
}

export function renderInviteRedeemConfirmKeyboard({ redemptionId = null } = {}) {
  return buildInlineKeyboard([
    [{ text: '✅ Confirm', callback_data: `invite:redeem_confirm:${redemptionId}` }],
    [{ text: '↩️ Back to redeem', callback_data: 'invite:redeem' }],
    [{ text: '🎯 Points', callback_data: 'invite:points' }]
  ]);
}

export function renderInviteLinkText({ inviteState = null } = {}) {
  return [
    '🔗 <b>Your invite link</b>',
    '',
    'Copy this attributed link when you want to share outside the Telegram card flow.',
    '',
    `<code>${escapeHtml(inviteState?.inviteLink || '—')}</code>`
  ].join('\n');
}

export function renderInviteLinkKeyboard() {
  return buildInlineKeyboard([
    [{ text: '↩️ Invite people', callback_data: 'invite:root' }],
    [{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]
  ]);
}

export function renderInvitePublicCaption() {
  return [
    'Discover professionals and connect by permission in Telegram.',
    '',
    'Browse listed profiles, view LinkedIn-connected identity, and request private contact only after approval.'
  ].join('\n');
}

function resolveInvitePublicUrl(inviteState = null, shareMode = 'inline') {
  if (shareMode === 'forwarding') {
    return inviteState?.inviteCardLink || inviteState?.inlineInviteLink || inviteState?.inviteLink || null;
  }
  return inviteState?.inlineInviteLink || inviteState?.inviteCardLink || inviteState?.inviteLink || null;
}

export function renderInviteCardText() {
  return renderInvitePublicCaption();
}

export function renderInviteCardKeyboard({ inviteState = null, inviteUrl = null } = {}) {
  const targetUrl = inviteUrl || inviteState?.inviteCardLink || inviteState?.inlineInviteLink || inviteState?.inviteLink;
  return buildInlineKeyboard(targetUrl ? [[{ text: 'Open Intro Deck', url: targetUrl }]] : []);
}

export function renderInlineInviteShareText() {
  return renderInvitePublicCaption();
}

export function renderInlineInviteCaption() {
  return renderInvitePublicCaption();
}

export function buildInviteMediaCard({ inviteState = null, shareMode = 'inline' } = {}) {
  const inviteUrl = resolveInvitePublicUrl(inviteState, shareMode);
  return {
    inviteUrl,
    caption: renderInvitePublicCaption(),
    parseMode: 'HTML',
    replyMarkup: renderInviteCardKeyboard({ inviteUrl }),
    photoFileId: inviteState?.invitePhotoFileId || null,
    photoUrl: inviteState?.invitePhotoUrl || null
  };
}

export function buildInlineInviteResult({ inviteState = null } = {}) {
  const media = buildInviteMediaCard({ inviteState, shareMode: 'inline' });

  if (media.photoFileId) {
    return {
      type: 'photo',
      id: 'invite-photo-cached',
      photo_file_id: media.photoFileId,
      title: 'Share Intro Deck invite',
      description: 'Share a photo invite card for Intro Deck',
      caption: media.caption,
      parse_mode: media.parseMode,
      reply_markup: media.replyMarkup
    };
  }

  if (media.photoUrl) {
    return {
      type: 'photo',
      id: 'invite-photo-url',
      photo_url: media.photoUrl,
      thumbnail_url: media.photoUrl,
      photo_width: 1200,
      photo_height: 630,
      title: 'Share Intro Deck invite',
      description: 'Share a photo invite card for Intro Deck',
      caption: media.caption,
      parse_mode: media.parseMode,
      reply_markup: media.replyMarkup
    };
  }

  return {
    type: 'article',
    id: 'invite-article-fallback',
    title: 'Share Intro Deck invite',
    description: 'Share your personal Intro Deck invite into any chat',
    input_message_content: {
      message_text: media.caption,
      parse_mode: media.parseMode,
      disable_web_page_preview: true
    },
    reply_markup: media.replyMarkup
  };
}


export function renderAdminInviteSnapshotText({ state = null, notice = null } = {}) {
  const summary = state?.snapshot?.summary || {};
  const topInviters = Array.isArray(state?.snapshot?.topInviters) ? state.snapshot.topInviters : [];
  const recentInvites = Array.isArray(state?.snapshot?.recentInvites) ? state.snapshot.recentInvites : [];
  const totalInvites = Number(summary.totalInvites || 0) || 0;
  const activatedInvites = Number(summary.activatedInvites || 0) || 0;
  const lines = [
    '📨 Инвайты',
    '',
    'Сводка invite-слоя и качества активации до включения rewards и redeem.',
    '',
    '<b>Сводка</b>',
    `• Всего инвайтов: ${totalInvites}`,
    `• Активировано: ${activatedInvites}`,
    `• Конверсия: ${Number(summary.activationRate || 0) || 0}%`,
    `• За 7д: ${Number(summary.joined7d || 0) || 0} приглашено • ${Number(summary.activated7d || 0) || 0} активировано`,
    '',
    '<b>По источникам</b>',
    `• Inline share: ${Number(summary.inlineShareCount || 0) || 0}`,
    `• Link + copy: ${Number(summary.rawLinkCount || 0) || 0}`,
    `• Invite card: ${Number(summary.inviteCardCount || 0) || 0}`
  ];

  if (state?.activationHint) {
    lines.push('', '<b>Правило активации</b>');
    lines.push(`• Текущий сигнал: ${escapeHtml(state.activationHint)}.`);
  }

  lines.push('', '<b>Топ инвайтеры</b>');
  if (topInviters.length) {
    topInviters.forEach((item, index) => lines.push(escapeHtml(renderAdminInviteTopLine(item, index))));
  } else {
    lines.push('• Пока нет инвайтов для рейтинга.');
  }

  lines.push('', '<b>Последние инвайты</b>');
  if (recentInvites.length) {
    recentInvites.forEach((item, index) => lines.push(escapeHtml(renderAdminInviteRecentLine(item, index))));
  } else {
    lines.push('• Пока нет недавней invite-активности.');
  }

  if (notice) {
    lines.push('', escapeHtml(notice));
  }

  return lines.join('\n');
}

export function renderAdminInviteSnapshotKeyboard() {
  return buildInlineKeyboard([
    [{ text: '🔄 Обновить', callback_data: 'adm:invite' }],
    [{ text: '↩️ Назад в Операции', callback_data: 'adm:ops' }],
    [{ text: '🏠 Главная', callback_data: 'home:root' }]
  ]);
}

export function renderOperatorDiagnosticsText({
  persistenceEnabled = false,
  diagnostics = null,
  bucket = null,
  introRequestId = null,
  hotRetryDue = [],
  hotFailed = [],
  hotExhausted = [],
  notice = null,
  allowed = true,
  aiNewsConfig = null,
  aiNewsPresetSummary = null
} = {}) {
  const lines = [
    '🛠 Operator diagnostics',
    '',
    'Read-only notification receipt view.'
  ];

  if (!allowed) {
    lines.push('This area is only available to the operator account.');
  } else if (!persistenceEnabled) {
    lines.push('Persistence: disabled in current environment');
  } else if (introRequestId) {
    const summary = diagnostics?.introSummary;
    lines.push(`Intro scope: #${introRequestId}`);
    if (!summary) {
      lines.push('No receipt rows found for this intro request yet.');
    } else {
      lines.push(`Counts: total ${summary.totalCount || 0} • sent ${summary.sentCount || 0} • retry due ${summary.retryDueCount || 0} • failed ${summary.failedCount || 0} • exhausted ${summary.exhaustedCount || 0} • skipped ${summary.skippedCount || 0}`);
      lines.push(`Last event: ${formatDateTimeShort(summary.lastEventAt)}`);
    }

    lines.push('');
    lines.push('Recent rows:');
    const rows = diagnostics?.recent || [];
    if (!rows.length) {
      lines.push('— none');
    } else {
      lines.push(...rows.slice(0, 6).map((item, index) => renderNotificationReceiptLine(item, index)));
    }
  } else {
    const counts = diagnostics?.counts || { total: 0, sent: 0, retry_due: 0, failed: 0, exhausted: 0, skipped: 0 };
    lines.push(`View: ${notificationBucketLabel(bucket)}`);
    lines.push(`Counts: total ${counts.total || 0} • sent ${counts.sent || 0} • retry due ${counts.retry_due || 0} • failed ${counts.failed || 0} • exhausted ${counts.exhausted || 0} • skipped ${counts.skipped || 0}`);
    lines.push('');

    if (bucket) {
      lines.push('Recent rows:');
      const rows = diagnostics?.recent || [];
      if (!rows.length) {
        lines.push('— none');
      } else {
        lines.push(...rows.slice(0, 8).map((item, index) => renderNotificationReceiptLine(item, index)));
      }
    } else {
      lines.push('Retry due now:');
      lines.push(...(hotRetryDue.length ? hotRetryDue.map((item, index) => renderNotificationReceiptLine(item, index)) : ['— none']));
      lines.push('');
      lines.push('Recent failures:');
      lines.push(...(hotFailed.length ? hotFailed.map((item, index) => renderNotificationReceiptLine(item, index)) : ['— none']));
      lines.push('');
      lines.push('Recent exhausted:');
      lines.push(...(hotExhausted.length ? hotExhausted.map((item, index) => renderNotificationReceiptLine(item, index)) : ['— none']));
    }
  }

  if (allowed && aiNewsConfig) {
    lines.push('');
    lines.push('AI/news drafts:');
    lines.push(`• mode: ${aiNewsConfig.mode || 'off'}`);
    lines.push(`• rollout stage: ${aiNewsConfig.rolloutStage || 'operator_acceptance'}`);
    lines.push(`• configuration: ${aiNewsConfig.configurationValid === false ? 'invalid / fail-safe disabled' : aiNewsConfig.enabled ? 'enabled' : 'disabled'}`);
    lines.push(`• source mode: ${aiNewsConfig.source?.mode || 'newsdata_only'}`);
    lines.push(`• enabled source providers: ${(aiNewsConfig.source?.enabledProviders || ['newsdata']).join(', ') || 'none'}`);
    lines.push(`• NewsData fallback: ${aiNewsConfig.newsdata?.configured ? 'configured' : 'not configured'}`);
    lines.push(`• GitHub API: ${aiNewsConfig.source?.githubToken ? 'authenticated' : 'public / bounded'}`);
    lines.push(`• generator mode: ${aiNewsConfig.generator?.mode || 'openai'}${aiNewsConfig.generator?.browseOnly ? ' / browse only' : ''}`);
    lines.push(`• selected generator: ${aiNewsConfig.generator?.provider || 'none'}`);
    lines.push(`• OpenAI: ${aiNewsConfig.openai?.configured ? `configured / ${aiNewsConfig.openai.model}` : 'not configured'}`);
    lines.push(`• Groq: ${aiNewsConfig.groq?.configured ? `configured / ${aiNewsConfig.groq.model}` : 'not configured'}`);
    lines.push('• template generator: built-in / deterministic');
    lines.push(`• access product: ${aiNewsConfig.mode === 'pro' ? 'Pro members + operators' : aiNewsConfig.mode === 'operator' ? 'operators only' : 'off'}`);
    lines.push(`• preset limit: ${aiNewsConfig.presetLimit || 0}`);
    lines.push(`• scheduler: ${aiNewsConfig.schedule?.enabled ? `${aiNewsConfig.schedule.driver} / live` : 'off'}`);
    lines.push(`• scheduled effect: Telegram draft only`);
    lines.push('• automatic publishing: disabled');
    if (aiNewsPresetSummary) {
      lines.push(`• presets: active ${aiNewsPresetSummary.active_presets || 0} • paused ${aiNewsPresetSummary.paused_presets || 0} • due ${aiNewsPresetSummary.due_presets || 0}`);
      lines.push(`• runs/24h: ${aiNewsPresetSummary.runs_24h || 0} • delivered ${aiNewsPresetSummary.delivered_24h || 0} • failed ${aiNewsPresetSummary.failed_24h || 0} • blocked ${aiNewsPresetSummary.blocked_24h || 0}`);
      lines.push(`• delivery retry due: ${aiNewsPresetSummary.retry_due || 0}`);
      if (Object.prototype.hasOwnProperty.call(aiNewsPresetSummary, 'newsdata_calls_24h')) {
        const estimatedUsd = (Number(aiNewsPresetSummary.estimated_cost_microusd_24h || 0) / 1_000_000).toFixed(6);
        lines.push(`• discovery calls/24h: RSS ${aiNewsPresetSummary.rss_calls_24h || 0} • HN ${aiNewsPresetSummary.hacker_news_calls_24h || 0} • GitHub ${aiNewsPresetSummary.github_releases_calls_24h || 0} • NewsData ${aiNewsPresetSummary.newsdata_calls_24h || 0}`);
        lines.push(`• generator calls/24h: OpenAI ${aiNewsPresetSummary.openai_calls_24h || 0} • Groq ${aiNewsPresetSummary.groq_calls_24h || 0} • template ${aiNewsPresetSummary.template_calls_24h || 0}`);
        lines.push(`• provider failures/24h: ${aiNewsPresetSummary.provider_failures_24h || 0}`);
        lines.push(`• OpenAI tokens/24h: in ${aiNewsPresetSummary.openai_input_tokens_24h || 0} • out ${aiNewsPresetSummary.openai_output_tokens_24h || 0}`);
        lines.push(`• Groq tokens/24h: in ${aiNewsPresetSummary.groq_input_tokens_24h || 0} • out ${aiNewsPresetSummary.groq_output_tokens_24h || 0}`);
        lines.push(`• estimated provider cost/24h: $${estimatedUsd}`);
        lines.push(`• drafts/24h: attempts ${aiNewsPresetSummary.draft_attempts_24h || 0} • generated ${aiNewsPresetSummary.generated_drafts_24h || 0} • edited ${aiNewsPresetSummary.edited_drafts_24h || 0} • LinkedIn published ${aiNewsPresetSummary.linkedin_posts_24h || 0}`);
        lines.push(`• unknown LinkedIn outcomes/24h: ${aiNewsPresetSummary.unknown_share_outcomes_24h || 0}`);
      } else {
        lines.push('• provider telemetry: migration 032 required');
      }
    }
    if (aiNewsConfig.configurationError?.code) {
      lines.push(`• config error: ${aiNewsConfig.configurationError.code}`);
    }
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderOperatorDiagnosticsKeyboard({
  allowed = true,
  bucket = null,
  introRequestId = null,
  diagnostics = null,
  hotRetryDue = [],
  hotFailed = [],
  hotExhausted = []
} = {}) {
  if (!allowed) {
    return buildInlineKeyboard([[{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]]);
  }

  const rows = [];

  if (introRequestId) {
    rows.push([{ text: '🔄 Refresh intro', callback_data: `ops:i:${introRequestId}` }]);
    rows.push([{ text: '🧭 All diagnostics', callback_data: 'ops:diag' }]);
  } else {
    const refreshTarget = bucket === 'retry_due'
      ? 'ops:b:due'
      : bucket === 'failed'
        ? 'ops:b:fal'
        : bucket === 'exhausted'
          ? 'ops:b:exh'
          : 'ops:diag';
    rows.push([{ text: '🔄 Refresh', callback_data: refreshTarget }]);
    rows.push([
      { text: `${bucket === 'retry_due' ? '✅' : '⏳'} Retry due`, callback_data: 'ops:b:due' },
      { text: `${bucket === 'failed' ? '✅' : '⚠️'} Failed`, callback_data: 'ops:b:fal' }
    ]);
    rows.push([
      { text: `${bucket === 'exhausted' ? '✅' : '🧱'} Exhausted`, callback_data: 'ops:b:exh' },
      { text: `${bucket ? '🧭' : '✅'} All`, callback_data: 'ops:diag' }
    ]);
  }

  const introButtons = collectOperatorIntroButtons({ diagnostics, hotRetryDue, hotFailed, hotExhausted });
  if (introButtons.length) {
    rows.push(introButtons.map((value) => ({ text: `#${value}`, callback_data: `ops:i:${value}` })));
  }

  rows.push([{ text: MEMBER_BUTTONS.home, callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}
