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

function renderAdminInviteTopLine(item, index) {
  return `${index + 1}. ${toDisplayValue(item?.displayName, 'Member')} — ${Number(item?.invitedCount || 0)} invited • ${Number(item?.activatedCount || 0)} activated • ${Number(item?.activationRate || 0)}%`;
}

function renderAdminInviteRecentLine(item, index) {
  const status = item?.status === 'activated' ? 'activated' : 'joined';
  return `${index + 1}. ${toDisplayValue(item?.referrerDisplayName, 'Member')} → ${toDisplayValue(item?.displayName, 'Member')} • ${status} via ${inviteSourceLabel(item?.source)} • ${formatDateShort(item?.joinedAt)}`;
}

function buildJoinIntroDeckAnchor(inviteUrl) {
  return inviteUrl ? `<a href="${escapeHtml(inviteUrl)}">Join Intro Deck</a>` : 'Join Intro Deck';
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

function buildActivationStepLines(profileSnapshot) {
  return getProfileActivationState(profileSnapshot || {}).steps.map((step) => `${step.complete ? '✅' : '▫️'} ${step.label}`);
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
    { text: '🏠 Home', callback_data: 'home:root' }
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

export function renderIntroNotificationText({ eventType = null, introRequest = null } = {}) {
  const member = toDisplayValue(introRequest?.display_name, 'Unknown member');
  const headline = notificationHeadline(introRequest?.headline_user);

  if (eventType === 'intro_request_created') {
    return [
      '📬 New intro request',
      '',
      `${member} wants to connect.`,
      headline,
      '',
      'Open the intro inbox or review this request directly.'
    ].join('\n');
  }

  if (eventType === 'intro_request_accepted') {
    return [
      '✅ Intro accepted',
      '',
      `${member} accepted your intro request.`,
      headline,
      '',
      'Open the intro detail to review the current contact outcome.'
    ].join('\n');
  }

  if (eventType === 'intro_request_declined') {
    return [
      '❌ Intro declined',
      '',
      `${member} declined your intro request.`,
      headline,
      '',
      'Open the intro detail to review the final state.'
    ].join('\n');
  }

  return [
    '🧾 Intro receipt',
    '',
    `${member}`,
    headline
  ].join('\n');
}

export function renderIntroNotificationKeyboard({ eventType = null, introRequestId = null } = {}) {
  const rows = [];

  if (introRequestId) {
    rows.push([{ text: '🧾 View intro', callback_data: `intro:view:${introRequestId}` }]);
  }

  if (eventType === 'intro_request_created') {
    rows.push([{ text: '📥 Open inbox', callback_data: 'intro:inbox' }]);
  }

  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

function introStatusNote(item) {
  if (item?.role === 'received' && item?.status === 'pending') {
    return 'You can accept or decline this intro request.';
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
  if (purpose === 'verification_refresh') {
    url.searchParams.set('purpose', 'verification_refresh');
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

function buildLinkedInVerificationPrivateLines(profileSnapshot, access) {
  if (!access?.enabled) return [];

  const tierLabel = access.mode === 'development' ? 'Development testing' : 'Lite';
  const lines = [
    '',
    `🛡 Verified on LinkedIn • ${tierLabel}`,
    'This private status is visible only to you during STEP058A.'
  ];

  if (!profileSnapshot?.linkedin_verification_schema_ready) {
    lines.push('• Snapshot storage: migration 028 required');
    lines.push('• Public trust badges remain disabled.');
    return lines;
  }

  if (!profileSnapshot?.linkedin_verification_synced_at) {
    lines.push('• Identity: not synced');
    lines.push('• Workplace: not synced');
    lines.push('• Use Refresh LinkedIn verification below.');
    lines.push('• Public trust badges remain disabled.');
    return lines;
  }

  lines.push(`• Identity: ${profileSnapshot.linkedin_identity_verified ? 'confirmed by LinkedIn' : 'not present'}`);
  lines.push(`• Workplace: ${profileSnapshot.linkedin_workplace_verified ? 'confirmed by LinkedIn' : 'not present'}`);
  lines.push(`• Snapshot: ${formatVerificationSyncedAt(profileSnapshot.linkedin_verification_synced_at)}`);
  lines.push('• Role, company, skills, bio, and experience remain member-provided.');
  lines.push('• Public trust badges remain disabled until STEP058B and Lite approval.');
  return lines;
}

export function renderHomeText({ profileSnapshot = null, persistenceEnabled = false, directoryStats = null, introInboxStats = null, isOperator = false, notice = null } = {}) {
  const lines = [
    '💼 Intro Deck',
    '',
    'Listed professional profiles. Contact by permission.',
    ''
  ];

  if (!persistenceEnabled) {
    lines.push('Profile saving is unavailable right now.');
  } else if (!profileSnapshot?.linkedin_sub) {
    lines.push('LinkedIn: not connected yet');
    lines.push(homeNextStepLine(profileSnapshot));
  } else {
    const displayName = profileSnapshot.display_name || profileSnapshot.linkedin_name || 'Profile linked';
    lines.push(`Connected as: ${displayName}`);
    const linkedInImportLine = linkedinIdentityImportLine(profileSnapshot);
    if (linkedInImportLine) {
      lines.push(linkedInImportLine);
    }
    lines.push(`Profile status: ${profileSnapshot.profile_state || 'draft'} • ${profileSnapshot.visibility_status || 'hidden'}`);
    lines.push(activationProgressLine(profileSnapshot));
    lines.push(readinessLine(profileSnapshot));
    lines.push(`Skills: ${formatSkillSummary(profileSnapshot)}`);
    lines.push(homeNextStepLine(profileSnapshot));
  }

  if (directoryStats) {
    lines.push('');
    lines.push(`Directory: ${directoryStats.totalCount} live profile${directoryStats.totalCount === 1 ? '' : 's'}`);
  }

  if (introInboxStats) {
    lines.push('');
    lines.push(`Intros: ${introInboxStats.receivedPending || 0} pending received • ${introInboxStats.sentPending || 0} pending sent`);
  }

  if (isOperator) {
    lines.push('');
    lines.push('Admin tools are available for this account.');
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderHomeKeyboard({ appBaseUrl, telegramUserId, profileSnapshot = null, persistenceEnabled = false, isOperator = false }) {
  const rows = [];
  const isLinkedInConnected = Boolean(profileSnapshot?.linkedin_sub);

  if (!isLinkedInConnected) {
    rows.push([{ text: '🔐 Connect LinkedIn', url: buildLinkedInStartUrl({ appBaseUrl, telegramUserId }) }]);
  } else if (persistenceEnabled) {
    const activation = getProfileActivationState(profileSnapshot || {});
    const profileLabel = activation.isReady ? '🧩 Edit profile' : '➡️ Continue setup';
    const profileCallback = activation.isReady ? 'p:menu' : 'p:next';
    rows.push([
      { text: profileLabel, callback_data: profileCallback },
      { text: '🌐 Browse directory', callback_data: 'dir:list:0' }
    ]);
  }

  if (persistenceEnabled && !isLinkedInConnected) {
    rows.push([
      { text: '🌐 Browse directory', callback_data: 'dir:list:0' },
      { text: '⭐ Plans', callback_data: 'plans:root' }
    ]);
  }

  if (persistenceEnabled && isLinkedInConnected) {
    rows.push([
      { text: '📨 Contact inbox', callback_data: 'contact:inbox' },
      { text: '⭐ Plans', callback_data: 'plans:root' }
    ]);
    rows.push([{ text: '📨 Invite contacts', callback_data: 'invite:root' }]);
  }

  rows.push([{ text: '❓ Help', callback_data: 'help:root' }]);

  if (isOperator) {
    rows.push([{ text: '👑 Админка', callback_data: 'adm:home' }]);
  }

  return buildInlineKeyboard(rows);
}

export function renderHelpText() {
  return [
    '❓ Help',
    '',
    'Use Intro Deck to connect a LinkedIn account, complete a member-provided professional card, browse listed profiles, and use one Contact flow to continue privately only after approval.',
    '',
    'Start here:',
    '• connect LinkedIn',
    '• complete your profile',
    '• browse the directory',
    '• open Contact inbox for requests and private chats',
    '• use /contact to return to that hub',
    '• open plans / Pro status',
    '• invite professional contacts'
  ].join('\n');
}

export function renderHelpKeyboard() {
  return buildInlineKeyboard([
    [
      { text: '🧩 Profile', callback_data: 'p:menu' },
      { text: '🌐 Browse directory', callback_data: 'dir:list:0' }
    ],
    [{ text: '📨 Contact inbox', callback_data: 'contact:inbox' }],
    [
      { text: '⭐ Plans', callback_data: 'plans:root' },
      { text: '📨 Invite contacts', callback_data: 'invite:root' }
    ],
    [{ text: '🏠 Home', callback_data: 'home:root' }]
  ]);
}

function pricingReceiptLabel(receipt) {
  if (receipt?.receiptType === 'subscription') {
    return 'Pro';
  }
  if (receipt?.receiptType === 'contact_unlock') {
    return 'Telegram contact';
  }
  if (receipt?.receiptType === 'dm_open') {
    return 'DM open';
  }
  return toDisplayValue(receipt?.receiptType, 'Receipt');
}

export function renderPricingText({ pricingState = null } = {}) {
  const state = pricingState || {};
  const pricing = state.pricing || {};
  const subscriptionConfig = state.subscriptionConfig || {};
  const subscription = state.subscription || null;
  const recentReceipts = Array.isArray(state.recentReceipts) ? state.recentReceipts.slice(0, 5) : [];
  const allowance = state.proOutreachAllowance || null;
  const fairUseLimit = allowance?.limit || state.contactPolicy?.proOutreachDailyLimit || 0;
  const lines = [
    '⭐ Intro Deck Pro',
    '',
    'Pro includes a bounded fair-use allowance for delivering contact requests across both private-chat and Telegram-contact options.',
    ''
  ];

  if (!state.persistenceEnabled) {
    lines.push('Pricing and purchase history are unavailable right now.');
  } else if (subscription?.isActive) {
    lines.push(`Status: Pro active until ${formatDateShort(subscription.expiresAt)}`);
  } else if (subscription?.expiresAt) {
    lines.push(`Status: Pro inactive • last expired ${formatDateShort(subscription.expiresAt)}`);
  } else {
    lines.push('Status: Pro not active yet');
  }

  lines.push('');
  lines.push(`Pro monthly: ${pricing.proMonthlyPriceStars || 0}⭐ • ${subscriptionConfig.proMonthlyDurationDays || 30} days`);
  lines.push(`Telegram-contact request delivery: ${pricing.contactUnlockPriceStars || 0}⭐ each without Pro`);
  lines.push(`Private-chat request delivery: ${pricing.dmOpenPriceStars || 0}⭐ each without Pro`);
  lines.push('');
  lines.push('Pro fair use:');
  lines.push(`• ${buildProFairUseDisclosure({ dailyLimit: fairUseLimit })}`);
  if (allowance?.supported) {
    lines.push(`• Current rolling window: ${allowance.used}/${allowance.limit} used • ${allowance.remaining} remaining`);
  }
  lines.push('• Recipient approval is always required. Approval or reply is not guaranteed.');
  lines.push('• Decline or no reply alone does not trigger an automatic refund of a paid request-delivery fee.');

  if (recentReceipts.length) {
    lines.push('');
    lines.push('Recent purchases:');
    for (const receipt of recentReceipts) {
      lines.push(`• ${pricingReceiptLabel(receipt)} • ${receipt?.amountStars || 0}⭐ • ${formatDateShort(receipt?.confirmedAt || receipt?.purchasedAt)}`);
    }
  }

  if (state.reason && !state.persistenceEnabled) {
    lines.push('');
    lines.push(`Reason: ${state.reason}`);
  }

  return lines.join('\n');
}

export function renderPricingKeyboard({ pricingState = null } = {}) {
  const state = pricingState || {};
  const pricing = state.pricing || {};
  const subscription = state.subscription || null;
  const rows = [];

  if (state.persistenceEnabled) {
    if (subscription?.isActive) {
      rows.push([{ text: `✅ Pro active • until ${formatDateShort(subscription.expiresAt)}`, callback_data: 'plans:root' }]);
    } else {
      rows.push([{ text: `⭐ Buy Pro • ${pricing.proMonthlyPriceStars || 0}⭐`, callback_data: 'plans:buy:pro' }]);
    }
    rows.push([
      { text: '🔄 Refresh', callback_data: 'plans:root' },
      { text: '🏠 Home', callback_data: 'home:root' }
    ]);
    return buildInlineKeyboard(rows);
  }

  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderProfileMenuText({ profileSnapshot = null, persistenceEnabled = false, linkedinVerificationAccess = null, notice = null } = {}) {
  const lines = [
    '🧩 Profile setup',
    ''
  ];

  if (!persistenceEnabled) {
    lines.push('Profile setup is unavailable right now.');
  } else if (!profileSnapshot?.linkedin_sub) {
    lines.push('Connect LinkedIn first. Intro Deck uses the account connection for basic identity only; the professional card is completed by you.');
  } else {
    const activation = getProfileActivationState(profileSnapshot);
    lines.push(`LinkedIn connected as: ${profileSnapshot.linkedin_name || profileSnapshot.display_name || 'LinkedIn user'}`);
    lines.push('Professional card details are member-provided.');
    lines.push('LinkedIn does not verify the professional fields you enter on your card.');
    lines.push('');
    lines.push(`📊 ${activationProgressLine(profileSnapshot)}`);
    lines.push(activationNextStepLine(profileSnapshot));
    lines.push('');
    lines.push('Required for listing');
    lines.push(...buildActivationStepLines(profileSnapshot));
    lines.push('');
    lines.push('Directory status');
    lines.push(`• Visibility: ${profileSnapshot.visibility_status || 'hidden'}`);
    lines.push(`• ${readinessLine(profileSnapshot)}`);
    if (activation.isReady && !activation.isListed) {
      lines.push('• Preview the public card before publishing it.');
    }
    lines.push('');
    lines.push('Optional details and contact settings are kept on a separate screen.');
    lines.push(...buildLinkedInVerificationPrivateLines(profileSnapshot, linkedinVerificationAccess));
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderProfileMenuKeyboard({ appBaseUrl = null, telegramUserId = null, profileSnapshot = null, persistenceEnabled = false, linkedinVerificationAccess = null, linkedinVerificationLaunchTicket = null } = {}) {
  if (!persistenceEnabled) {
    return buildInlineKeyboard([
      [{ text: '🏠 Home', callback_data: 'home:root' }]
    ]);
  }

  if (!profileSnapshot?.linkedin_sub) {
    const rows = [];
    if (appBaseUrl && telegramUserId) {
      rows.push([{ text: '🔐 Connect LinkedIn', url: buildLinkedInStartUrl({ appBaseUrl, telegramUserId }) }]);
    }
    rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
    return buildInlineKeyboard(rows);
  }

  const activation = getProfileActivationState(profileSnapshot);
  const primaryButton = activation.isReady
    ? { text: activation.isListed ? '👁 Review listed profile' : '👁 Preview & publish', callback_data: 'p:prev' }
    : { text: '➡️ Continue setup', callback_data: 'p:next' };

  const rows = [
    [primaryButton],
    [
      { text: '✏️ Display name', callback_data: 'p:ed:dn' },
      { text: '✏️ Headline', callback_data: 'p:ed:hl' }
    ],
    [
      { text: '🏷 Industry', callback_data: 'p:ed:in' },
      { text: '📝 About', callback_data: 'p:ed:ab' }
    ],
    [{ text: '🧠 Skills', callback_data: 'p:sk' }],
    [{ text: '⚙️ Optional details & contact', callback_data: 'p:opt' }]
  ];

  if (linkedinVerificationAccess?.enabled && linkedinVerificationLaunchTicket && appBaseUrl && telegramUserId) {
    rows.push([{
      text: '🛡 Refresh LinkedIn verification',
      url: buildLinkedInStartUrl({
        appBaseUrl,
        telegramUserId,
        returnTo: '/profile',
        purpose: 'verification_refresh',
        launchTicket: linkedinVerificationLaunchTicket
      })
    }]);
  }

  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderProfilePreviewText({ profileSnapshot = null, persistenceEnabled = false, notice = null } = {}) {
  const lines = [
    '👁 Profile preview',
    ''
  ];

  if (!persistenceEnabled) {
    lines.push('Preview is unavailable right now.');
  } else if (!profileSnapshot?.linkedin_sub) {
    lines.push('Connect LinkedIn first before previewing your profile.');
  } else {
    const activation = getProfileActivationState(profileSnapshot);
    lines.push('🪪 Public card');
    lines.push(`${toDisplayValue(profileSnapshot.display_name, profileSnapshot.linkedin_name || 'Unnamed profile')}`);
    lines.push(toDisplayValue(profileSnapshot.headline_user));
    lines.push('');
    lines.push(`🏢 Company: ${toDisplayValue(profileSnapshot.company_user)}`);
    lines.push(`📍 City: ${toDisplayValue(profileSnapshot.city_user)}`);
    lines.push(`🏷 Industry: ${toDisplayValue(profileSnapshot.industry_user)}`);
    lines.push(`🧠 Skills: ${formatSkillSummary(profileSnapshot)}`);
    lines.push(`🔗 Public LinkedIn URL: ${toDisplayValue(profileSnapshot.linkedin_public_url)}`);
    lines.push('');
    lines.push('📝 About');
    lines.push(truncate(profileSnapshot.about_user, 320));
    lines.push('');
    lines.push('🔒 Not shown publicly');
    lines.push(`• Hidden Telegram username: ${hiddenTelegramUsernameSummary(profileSnapshot)}`);
    lines.push(`• Contact mode: ${profileContactModeSummary(profileSnapshot)}`);
    lines.push('');
    lines.push(`📊 ${activationProgressLine(profileSnapshot)}`);
    lines.push(`• ${readinessLine(profileSnapshot)}`);

    if (!activation.isReady) {
      lines.push(`• ${activationNextStepLine(profileSnapshot)}`);
      lines.push('• Publishing remains locked until every required step is complete.');
    } else if (activation.isListed) {
      lines.push('• This card is currently visible in the directory.');
    } else {
      lines.push('• Ready to publish. Publishing makes this card visible to bot users; private contact details remain hidden.');
    }
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderProfilePreviewKeyboard({ profileSnapshot = null, persistenceEnabled = true } = {}) {
  const rows = [];
  const activation = getProfileActivationState(profileSnapshot || {});

  if (persistenceEnabled && profileSnapshot?.linkedin_sub) {
    if (!activation.isReady) {
      rows.push([{ text: '➡️ Continue setup', callback_data: 'p:next' }]);
    } else if (activation.isListed) {
      rows.push([{ text: '🙈 Hide from directory', callback_data: 'p:vis' }]);
    } else {
      rows.push([{ text: '🌐 Publish in directory', callback_data: 'p:pub' }]);
    }
    rows.push([{ text: '⚙️ Optional details & contact', callback_data: 'p:opt' }]);
  }

  rows.push([
    { text: '↩️ Back to profile', callback_data: 'p:menu' },
    { text: '🏠 Home', callback_data: 'home:root' }
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
        { text: '↩️ Back to profile', callback_data: 'p:menu' },
        { text: '🏠 Home', callback_data: 'home:root' }
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
      { text: '↩️ Back to profile', callback_data: 'p:menu' },
      { text: '🏠 Home', callback_data: 'home:root' }
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
      { text: '↩️ Back to profile', callback_data: 'p:menu' },
      { text: '🏠 Home', callback_data: 'home:root' }
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
    [{ text: '🏠 Home', callback_data: 'home:root' }]
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
    lines.push('Persistence is disabled in this environment. Skill selection is unavailable.');
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
      { text: '↩️ Back to profile', callback_data: 'p:menu' },
      { text: '🏠 Home', callback_data: 'home:root' }
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
      { text: '↩️ Back to profile', callback_data: 'p:menu' },
      { text: '🏠 Home', callback_data: 'home:root' }
    ]
  ]);
}

export function renderDirectoryListText({ profiles = [], page = 0, totalCount = 0, persistenceEnabled = false, filterSummary = summarizeDirectoryFilters(), viewerProfile = null, notice = null } = {}) {
  const lines = [
    '🌐 Directory',
    '',
    'Listed profile cards are visible to bot users. Private contact details stay hidden unless the owner approves a supported contact path.',
    '',
    ...renderFilterSummaryLines(filterSummary)
  ];

  if (!persistenceEnabled) {
    lines.push('');
    lines.push('Directory browse is unavailable right now.');
  } else if (!profiles.length) {
    lines.push('');
    if (!filterSummary.isDefault) {
      lines.push('No listed profiles match the current filters.');
    } else if (viewerProfile?.linkedin_sub && !viewerProfile?.completion?.isReady) {
      lines.push('No listed profiles yet. Complete your profile to become one of the first visible members.');
    } else if (viewerProfile?.completion?.isReady && viewerProfile?.visibility_status !== 'listed') {
      lines.push('No listed profiles yet. Your profile is ready — list it to be one of the first visible members.');
    } else {
      lines.push('No listed profiles yet. Check back soon or complete your own profile to join the directory.');
    }
  } else {
    lines.push('');
    lines.push(`Page: ${page + 1}`);
    lines.push(`Listed profiles: ${totalCount}`);
    lines.push('');
    profiles.forEach((profile, index) => {
      const marker = profile.is_viewer ? '• you' : '• open';
      lines.push(`${index + 1}. ${directoryProfileLabel(profile)} ${marker}`);
    });
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderDirectoryListKeyboard({ profiles = [], page = 0, hasPrev = false, hasNext = false, viewerProfile = null, filterSummary = summarizeDirectoryFilters() } = {}) {
  const rows = profiles.map((profile, index) => [{
    text: `${index + 1}. ${truncate(toDisplayValue(profile.display_name, profile.linkedin_name || 'Unnamed'), 28)}`,
    callback_data: `dir:open:${profile.profile_id}:${page}`
  }]);

  const pagerRow = [];
  if (hasPrev) {
    pagerRow.push({ text: '⬅️ Prev', callback_data: `dir:list:${page - 1}` });
  }
  if (hasNext) {
    pagerRow.push({ text: 'Next ➡️', callback_data: `dir:list:${page + 1}` });
  }
  if (pagerRow.length) {
    rows.push(pagerRow);
  }

  rows.push([{ text: '🎯 Filters', callback_data: 'dir:flt' }]);

  if (!profiles.length && viewerProfile?.linkedin_sub) {
    if (!viewerProfile?.completion?.isReady) {
      rows.push([{ text: '➡️ Continue profile setup', callback_data: 'p:next' }]);
    } else if (viewerProfile?.visibility_status !== 'listed' && filterSummary.isDefault) {
      rows.push([{ text: '🌍 List my profile', callback_data: 'p:vis' }]);
    } else {
      rows.push([{ text: '👁 Preview my card', callback_data: 'p:prev' }]);
    }
  }

  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderDirectoryCardText({ profileSnapshot = null, persistenceEnabled = false, notice = null } = {}) {
  const lines = [
    '👤 Directory profile',
    ''
  ];

  if (!persistenceEnabled) {
    lines.push('Persistence is disabled in this environment. Directory card is unavailable.');
  } else if (!profileSnapshot?.profile_id) {
    lines.push('Listed profile not found.');
  } else {
    lines.push(`${toDisplayValue(profileSnapshot.display_name, profileSnapshot.linkedin_name || 'Unnamed profile')}${profileSnapshot.is_viewer ? ' • you' : ''}`);
    lines.push(toDisplayValue(profileSnapshot.headline_user));
    lines.push('');
    lines.push('Profile details: member-provided');
    lines.push(`Company: ${toDisplayValue(profileSnapshot.company_user)}`);
    lines.push(`City: ${toDisplayValue(profileSnapshot.city_user)}`);
    lines.push(`Industry: ${toDisplayValue(profileSnapshot.industry_user)}`);
    lines.push(`Skills: ${formatSkillSummary(profileSnapshot)}`);
    lines.push(directoryContactLabel(profileSnapshot));
    lines.push('');
    lines.push(`About: ${truncate(profileSnapshot.about_user, 320)}`);
    lines.push('');
    lines.push(`Visibility: ${toDisplayValue(profileSnapshot.visibility_status)}`);
    lines.push(`Contact mode: ${profileContactModeSummary(profileSnapshot)}`);
    lines.push(`State: ${toDisplayValue(profileSnapshot.profile_state)}`);
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderDirectoryCardKeyboard({ profileSnapshot = null, page = 0 } = {}) {
  const rows = [];

  if (canViewerOpenDirectoryLinkedIn(profileSnapshot)) {
    rows.push([{ text: profileSnapshot?.is_viewer ? '🔗 Open my LinkedIn' : '🔗 Open LinkedIn', url: profileSnapshot.linkedin_public_url.trim() }]);
  }

  if (canOpenContactRequestRail(profileSnapshot)) {
    rows.push([{ text: '🤝 Request contact', callback_data: `dir:contact:${profileSnapshot.profile_id}:${page}` }]);
  }

  rows.push([{ text: '↩️ Back to directory', callback_data: `dir:list:${page}` }]);
  rows.push([{ text: '🎯 Filters', callback_data: 'dir:flt' }]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);

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

  if (notice) lines.push('', notice);
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
      rows.push([{ text: '⭐ Plans / Pro status', callback_data: 'plans:root' }]);
    }
  }
  if (profileSnapshot?.profile_id) rows.push([{ text: '↩️ Back to profile', callback_data: `dir:open:${profileSnapshot.profile_id}:${page}` }]);
  rows.push([{ text: '🌐 Directory', callback_data: `dir:list:${page}` }]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderContactInboxText({ notice = null } = {}) {
  const lines = [
    '📨 Contact inbox',
    '',
    'One place to open contact requests and approved private conversations.',
    '',
    'Requests',
    '• Free intro requests',
    '• Telegram-contact reveal requests',
    '',
    'Private chats',
    '• New chat requests',
    '• Approved conversations'
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}

export function renderContactInboxKeyboard() {
  return buildInlineKeyboard([
    [{ text: '📥 Requests', callback_data: 'intro:inbox' }, { text: '💬 Private chats', callback_data: 'dm:inbox' }],
    [{ text: '🌐 Browse directory', callback_data: 'dir:list:0' }, { text: '⭐ Plans', callback_data: 'plans:root' }],
    [{ text: '🏠 Home', callback_data: 'home:root' }]
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

export function renderIntroInboxKeyboard({ inboxState = null, contactUnlockInbox = null } = {}) {
  const rows = [];
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
        { text: '✅ Accept', callback_data: `intro:acc:${item?.intro_request_id || 0}` },
        { text: '❌ Decline', callback_data: `intro:dec:${item?.intro_request_id || 0}` }
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
      rows.push([{ text: '🔓 Open contact', url: item.linkedin_public_url.trim() }]);
    }
  }


  for (const [index, item] of unlockReceivedItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Direct ${index + 1}`), 20);
    rows.push([{ text: `🔐 ${index + 1}. ${label}`, callback_data: `cu:view:${item?.contact_unlock_request_id || 0}` }]);
    if (item?.status === 'paid_pending_approval') {
      rows.push([
        { text: '✅ Approve', callback_data: `cu:acc:${item?.contact_unlock_request_id || 0}` },
        { text: '❌ Decline', callback_data: `cu:dec:${item?.contact_unlock_request_id || 0}` }
      ]);
    }
  }

  for (const [index, item] of unlockSentItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Direct ${index + 1}`), 20);
    rows.push([{ text: `⭐ ${index + 1}. ${label}`, callback_data: `cu:view:${item?.contact_unlock_request_id || 0}` }]);
    if (item?.status === 'revealed' && item?.revealed_contact_value) {
      const clean = String(item.revealed_contact_value).replace(/^@+/, '');
      rows.push([{ text: '🔓 Open contact', url: `https://t.me/${clean}` }]);
    }
  }

  rows.push([{ text: '🔄 Refresh', callback_data: 'intro:inbox' }]);
  rows.push([{ text: '💬 Private chats', callback_data: 'dm:inbox' }]);
  rows.push([{ text: '🌐 Browse directory', callback_data: 'dir:list:0' }]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);

  return buildInlineKeyboard(rows);
}

export function renderIntroDetailText({ persistenceEnabled = false, introRequest = null, notice = null } = {}) {
  const lines = [
    '🧾 Intro request',
    '',
    'Review the current state of this intro and any unlocked contact details.'
  ];

  if (!persistenceEnabled) {
    lines.push('');
    lines.push('Persistence is disabled in this environment. Intro detail is unavailable.');
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
    lines.push(introStatusNote(introRequest));
  }

  if (notice) {
    lines.push('');
    lines.push(notice);
  }

  return lines.join('\n');
}

export function renderIntroDetailKeyboard({ introRequest = null } = {}) {
  const rows = [];

  if (introRequest?.profile_id) {
    rows.push([{ text: '👤 Open profile', callback_data: `intro:open:${introRequest.profile_id}` }]);
  }

  if (canOpenReceivedSenderLinkedIn(introRequest)) {
    rows.push([{ text: '🔗 Sender LinkedIn', url: introRequest.linkedin_public_url.trim() }]);
  }

  if (canOpenAcceptedTargetLinkedIn(introRequest)) {
    rows.push([{ text: '🔓 Open contact', url: introRequest.linkedin_public_url.trim() }]);
  }

  if (introRequest?.role === 'received' && introRequest?.status === 'pending') {
    rows.push([
      { text: '✅ Accept', callback_data: `intro:acc:${introRequest.intro_request_id}` },
      { text: '❌ Decline', callback_data: `intro:dec:${introRequest.intro_request_id}` }
    ]);
  }

  rows.push([{ text: '↩️ Back to inbox', callback_data: 'intro:inbox' }]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);

  return buildInlineKeyboard(rows);
}

export function renderContactUnlockDetailText({ persistenceEnabled = false, request = null, notice = null } = {}) {
  const lines = [
    '🔐 Telegram contact request',
    '',
    'Review the current state of this direct Telegram contact request.'
  ];

  if (!persistenceEnabled) {
    lines.push('', 'Persistence is disabled in this environment. Telegram contact detail is unavailable.');
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
    lines.push('Contract: delivery of a permission request only • recipient approval is required • approval is not guaranteed.');
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
        ? 'You can approve or decline this Telegram contact request.'
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

export function renderContactUnlockDetailKeyboard({ request = null } = {}) {
  const rows = [];

  if (request?.profile_id) {
    rows.push([{ text: '👤 Open profile', callback_data: `intro:open:${request.profile_id}` }]);
  }

  if (request?.role === 'received' && request?.status === 'paid_pending_approval') {
    rows.push([
      { text: '✅ Approve', callback_data: `cu:acc:${request.contact_unlock_request_id}` },
      { text: '❌ Decline', callback_data: `cu:dec:${request.contact_unlock_request_id}` }
    ]);
  }

  if (request?.role === 'sent' && request?.status === 'revealed' && request?.revealed_contact_value) {
    const clean = String(request.revealed_contact_value).replace(/^@+/, '');
    rows.push([{ text: '🔓 Open contact', url: `https://t.me/${clean}` }]);
  }

  rows.push([{ text: '↩️ Back to inbox', callback_data: 'intro:inbox' }]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
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

export function renderDmInboxKeyboard({ inboxState = null } = {}) {
  const rows = [];
  const receivedItems = Array.isArray(inboxState?.received) ? inboxState.received : [];
  const sentItems = Array.isArray(inboxState?.sent) ? inboxState.sent : [];

  for (const [index, item] of receivedItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Incoming ${index + 1}`), 20);
    rows.push([{ text: `📨 ${index + 1}. ${label}`, callback_data: `dm:view:${item?.dm_thread_id || 0}` }]);
    if (item?.status === 'pending_recipient') {
      rows.push([
        { text: '✅ Accept', callback_data: `dm:acc:${item?.dm_thread_id || 0}` },
        { text: '❌ Decline', callback_data: `dm:dec:${item?.dm_thread_id || 0}` }
      ]);
    }
  }

  for (const [index, item] of sentItems.entries()) {
    const label = truncate(toDisplayValue(item?.display_name, `Sent ${index + 1}`), 20);
    rows.push([{ text: `💬 ${index + 1}. ${label}`, callback_data: `dm:view:${item?.dm_thread_id || 0}` }]);
  }

  rows.push([{ text: '🔄 Refresh', callback_data: 'dm:inbox' }]);
  rows.push([{ text: '📨 Contact inbox', callback_data: 'contact:inbox' }]);
  rows.push([{ text: '🌐 Browse directory', callback_data: 'dir:list:0' }]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderDmThreadText({ persistenceEnabled = false, thread = null, viewerTelegramUserId = null, notice = null } = {}) {
  const lines = [
    '🧾 Private chat',
    '',
    'Review the current private-chat request state and continue the conversation when active.'
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
      lines.push('Contract: delivery of a DM permission request only • recipient approval is required • approval or reply is not guaranteed.');
    }
    lines.push(`Created: ${formatDateShort(thread.created_at)}`);
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

export function renderDmThreadKeyboard({ thread = null } = {}) {
  const rows = [];

  if (thread?.role === 'received' && thread?.status === 'pending_recipient') {
    rows.push([
      { text: '✅ Accept', callback_data: `dm:acc:${thread.dm_thread_id}` },
      { text: '❌ Decline', callback_data: `dm:dec:${thread.dm_thread_id}` }
    ]);
    rows.push([
      { text: '⛔ Block', callback_data: `dm:blk:${thread.dm_thread_id}` },
      { text: '🚩 Report', callback_data: `dm:rpt:${thread.dm_thread_id}` }
    ]);
  }

  if (thread?.role === 'sent' && thread?.status === 'payment_pending') {
    rows.push([{ text: '⭐ Pay and deliver request', callback_data: `dm:pay:${thread.dm_thread_id}` }]);
  }

  if (thread?.status === 'active') {
    rows.push([{ text: '✉️ Send message', callback_data: `dm:send:${thread.dm_thread_id}` }]);
  }

  rows.push([{ text: '↩️ Back to Private chats', callback_data: 'dm:inbox' }]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
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
    lines.push('Persistence is disabled in this environment. Directory filters are unavailable.');
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
  rows.push([{ text: '↩️ Back to directory', callback_data: 'dir:list:0' }]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);

  return buildInlineKeyboard(rows);
}



export function renderInviteText({ inviteState = null, notice = null } = {}) {
  const lines = [
    '📨 Invite & rewards',
    '',
    'Use this screen to share your personal invite in the format that fits the chat best.',
    '',
    '<b>Share options</b>',
    '• Share invite — opens Telegram share with your personal invite already attached.',
    '• Invite card — sends a ready-made card you can forward as-is.',
    '• Link + copy — shows the raw invite link for manual sharing.'
  ];

  if (!inviteState?.persistenceEnabled) {
    lines.push('', 'Invite tracking is unavailable right now.');
  } else {
    const invitedCount = Number(inviteState.invitedCount || 0) || 0;
    const activatedCount = Number(inviteState.activatedCount || 0) || 0;
    lines.push('', '<b>Your snapshot</b>');
    lines.push(`• Invited: ${invitedCount}`);
    lines.push(`• Activated: ${activatedCount}`);
    lines.push(`• Activation rate: ${getInviteActivationRate(invitedCount, activatedCount)}`);
    lines.push(`• Invite code: <code>${escapeHtml(inviteState.inviteCode || '—')}</code>`);
    if (inviteState.invitedBy?.displayName) {
      lines.push(`• Joined from: ${escapeHtml(inviteState.invitedBy.displayName)}`);
    }

    const rewardsSummary = inviteState?.rewardsSummary || null;
    if (rewardsSummary) {
      lines.push('', '<b>Points preview</b>');
      lines.push(`• Mode: ${escapeHtml(formatInviteRewardsModeLabel(rewardsSummary.mode))}`);
      lines.push(`• Pending: ${Number(rewardsSummary.pendingPoints || 0) || 0}`);
      lines.push(`• Available: ${Number(rewardsSummary.availablePoints || 0) || 0}`);
    }

    lines.push('', '<b>Open next</b>');
    lines.push('• Performance — totals, sources, and the last 7 days.');
    lines.push('• Invite history — everyone who actually joined from your invite.');
    lines.push('• Points — pending, available, redeemed, and redeem status.');
  }

  if (notice) {
    lines.push('', escapeHtml(notice));
  }

  return lines.join('\n');
}

export function renderInviteKeyboard({ inviteState = null } = {}) {
  const rows = [];
  if (inviteState?.persistenceEnabled && inviteState?.inviteLink) {
    rows.push([{ text: '📨 Share invite', switch_inline_query: inviteState.shareInlineQuery || 'invite' }]);
    rows.push([
      { text: '🧾 Invite card', callback_data: 'invite:send_card' },
      { text: '🔗 Link + copy', callback_data: 'invite:show_link' }
    ]);
    rows.push([
      { text: '📊 Performance', callback_data: 'invite:perf' },
      { text: '📋 Invite history', callback_data: 'invite:hist:1' }
    ]);
    rows.push([
      { text: '🎯 Points', callback_data: 'invite:points' },
      { text: '🔄 Refresh', callback_data: 'invite:root' }
    ]);
  }
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderInvitePerformanceText({ inviteState = null, notice = null } = {}) {
  const invitedCount = Number(inviteState?.invitedCount || 0) || 0;
  const activatedCount = Number(inviteState?.activatedCount || 0) || 0;
  const lines = [
    '📊 Invite performance',
    '',
    'This screen shows how your invite is performing: totals, sources, and recent 7-day movement.',
    '',
    '<b>All-time</b>',
    `• Invited: ${invitedCount}`,
    `• Activated: ${activatedCount}`,
    `• Activation rate: ${getInviteActivationRate(invitedCount, activatedCount)}`,
    '',
    '<b>By source</b>',
    `• Inline share: ${Number(inviteState?.inlineShareCount || 0) || 0}`,
    `• Link + copy: ${Number(inviteState?.rawLinkCount || 0) || 0}`,
    `• Invite card: ${Number(inviteState?.inviteCardCount || 0) || 0}`,
    '',
    '<b>Last 7 days</b>',
    `• Invited: ${Number(inviteState?.joined7d || 0) || 0}`,
    `• Activated: ${Number(inviteState?.activated7d || 0) || 0}`
  ];

  if (inviteState?.activationHint) {
    lines.push('', '<b>Activation rule</b>');
    lines.push(`• Current signal: ${escapeHtml(inviteState.activationHint)}.`);
  }

  if (!(invitedCount > 0)) {
    lines.push('', '<b>No invite activity yet</b>');
    lines.push('• Start with Share invite, Invite card, or Link + copy. Your performance data will fill in automatically.');
  }

  if (notice) {
    lines.push('', escapeHtml(notice));
  }

  return lines.join('\n');
}

export function renderInvitePerformanceKeyboard({ inviteState = null } = {}) {
  const rows = [
    [
      { text: '📨 Invite & rewards', callback_data: 'invite:root' },
      { text: '📋 Invite history', callback_data: 'invite:hist:1' }
    ],
    [
      { text: '🎯 Points', callback_data: 'invite:points' },
      { text: '🏠 Home', callback_data: 'home:root' }
    ]
  ];
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
    'Everyone who joined from your invite appears here. Use this screen to confirm who actually came in and when.',
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
  if (navRow.length) {
    rows.push(navRow);
  }
  rows.push([
    { text: '📨 Invite & rewards', callback_data: 'invite:root' },
    { text: '📊 Performance', callback_data: 'invite:perf' }
  ]);
  rows.push([
    { text: '🎯 Points', callback_data: 'invite:points' },
    { text: '🏠 Home', callback_data: 'home:root' }
  ]);
  if (!(Number(inviteState?.invitedCount || 0) > 0)) {
    rows.push([
      { text: '📨 Share invite', switch_inline_query: inviteState?.shareInlineQuery || 'invite' },
      { text: '🔗 Link + copy', callback_data: 'invite:show_link' }
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
      { text: '📨 Invite & rewards', callback_data: 'invite:root' },
      { text: '📋 Invite history', callback_data: 'invite:hist:1' }
    ],
    [
      { text: '📊 Performance', callback_data: 'invite:perf' },
      { text: '🏠 Home', callback_data: 'home:root' }
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
    { text: '📨 Invite & rewards', callback_data: 'invite:root' }
  ]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
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
    'Copy this link into any chat when you want to share manually instead of using the Telegram share flow.',
    '',
    `<code>${escapeHtml(inviteState?.inviteLink || '—')}</code>`
  ].join('\n');
}

export function renderInviteLinkKeyboard() {
  return buildInlineKeyboard([
    [{ text: '📨 Invite & rewards', callback_data: 'invite:root' }],
    [{ text: '🏠 Home', callback_data: 'home:root' }]
  ]);
}

export function renderInviteCardText({ inviteState = null } = {}) {
  return [
    '🤝 <b>Join me on Intro Deck</b>',
    '',
    'Forward this card as-is or open Intro Deck directly from the button below.',
    '',
    buildJoinIntroDeckAnchor(inviteState?.inviteCardLink || inviteState?.inlineInviteLink || inviteState?.inviteLink)
  ].join('\n');
}

export function renderInviteCardKeyboard({ inviteState = null } = {}) {
  const inviteUrl = inviteState?.inviteCardLink || inviteState?.inlineInviteLink || inviteState?.inviteLink;
  const rows = inviteUrl ? [[{ text: 'Open Intro Deck', url: inviteUrl }]] : [];
  rows.push([
    { text: '📨 Invite & rewards', callback_data: 'invite:root' },
    { text: '🎯 Points', callback_data: 'invite:points' }
  ]);
  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}

export function renderInlineInviteShareText({ inviteState = null } = {}) {
  return [
    'I found a Telegram directory for browsing listed profiles and requesting permission to connect.',
    '',
    buildJoinIntroDeckAnchor(inviteState?.inlineInviteLink || inviteState?.inviteLink)
  ].join('\n');
}

export function renderInlineInviteCaption({ inviteState = null } = {}) {
  return [
    'Professional discovery and contact by permission in Telegram.',
    'Listed profiles. LinkedIn-connected accounts. Private contact after approval.',
    '',
    buildJoinIntroDeckAnchor(inviteState?.inlineInviteLink || inviteState?.inviteLink)
  ].join('\n');
}

export function buildInlineInviteResult({ inviteState = null } = {}) {
  const replyMarkup = renderInviteCardKeyboard({ inviteState });

  if (inviteState?.invitePhotoFileId) {
    return {
      type: 'photo',
      id: 'invite-photo-cached',
      photo_file_id: inviteState.invitePhotoFileId,
      title: 'Share Intro Deck invite',
      description: 'Share a photo invite card for Intro Deck',
      caption: renderInlineInviteCaption({ inviteState }),
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    };
  }

  if (inviteState?.invitePhotoUrl) {
    return {
      type: 'photo',
      id: 'invite-photo-url',
      photo_url: inviteState.invitePhotoUrl,
      thumbnail_url: inviteState.invitePhotoUrl,
      photo_width: 1200,
      photo_height: 630,
      title: 'Share Intro Deck invite',
      description: 'Share a photo invite card for Intro Deck',
      caption: renderInlineInviteCaption({ inviteState }),
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    };
  }

  return {
    type: 'article',
    id: 'invite-article-fallback',
    title: 'Share Intro Deck invite',
    description: 'Share your personal Intro Deck invite into any chat',
    input_message_content: {
      message_text: renderInlineInviteShareText({ inviteState }),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    },
    reply_markup: replyMarkup
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
  allowed = true
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
    return buildInlineKeyboard([[{ text: '🏠 Home', callback_data: 'home:root' }]]);
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

  rows.push([{ text: '🏠 Home', callback_data: 'home:root' }]);
  return buildInlineKeyboard(rows);
}
