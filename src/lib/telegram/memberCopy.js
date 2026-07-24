export const MEMBER_SURFACES = Object.freeze({
  home: '💼 Intro Deck',
  profile: '🧩 Profile',
  profilePreview: '👁 Profile preview',
  directory: '🌐 Directory',
  directoryProfile: '👤 Professional profile',
  requests: '📥 Requests & chats',
  storyFinder: '🗞 Story finder',
  invite: '✉️ Invite people',
  pro: '⭐ Intro Deck Pro',
  help: '❓ Help'
});

export const MEMBER_BUTTONS = Object.freeze({
  home: '🏠 Home',
  editProfile: '🧩 Edit profile',
  continueSetup: '➡️ Continue setup',
  browseDirectory: '🌐 Browse',
  requests: '📥 Requests',
  storyFinder: '🗞 Story finder',
  invitePeople: '✉️ Invite people',
  pro: '⭐ Pro',
  help: '❓ Help',
  filters: '🎯 Filters',
  backToDirectory: '← Back to directory',
  backToRequests: '← Back to requests',
  previous: '‹ Previous',
  next: 'Next ›'
});

const REASON_MAP = Object.freeze({
  migration_028_required: 'LinkedIn trust details are temporarily unavailable.',
  migration_029_required: 'LinkedIn sharing is temporarily unavailable.',
  migration_030_required: 'Story finder is temporarily unavailable.',
  migration_031_required: 'Saved searches are temporarily unavailable.',
  migration_032_required: 'Story finder is temporarily unavailable.',
  migration_033_required: 'Story finder is temporarily unavailable.',
  migration_034_required: 'Draft creation is temporarily unavailable.',
  migration_035_required: 'Personalized discovery is temporarily unavailable.',
  migration_036_required: 'Personalized discovery is temporarily unavailable.',
  contact_contract_requires_migration: 'Contact requests are temporarily unavailable.',
  ai_news_draft_config_invalid: 'Story finder is temporarily unavailable.',
  ai_news_disabled: 'Story finder is temporarily unavailable.',
  linkedin_share_unavailable: 'LinkedIn sharing is temporarily unavailable.',
  DATABASE_URL_NOT_CONFIGURED: 'This feature is temporarily unavailable.'
});

export function memberReasonText(reason, fallback = 'This action is temporarily unavailable. Try again later.') {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  if (REASON_MAP[normalized]) return REASON_MAP[normalized];
  if (/^migration_\d+_required$/i.test(normalized)) return 'This feature is temporarily unavailable.';
  if (/DATABASE_URL|persistence|constraint|SQLSTATE|relation\s+"|duplicate key|syntax error/i.test(normalized)) return fallback;
  if (/^[a-z0-9_]+$/i.test(normalized) && normalized.includes('_')) return fallback;
  return normalized;
}

export function memberUnavailable(subject = 'This feature') {
  return `${subject} is temporarily unavailable. Try again later.`;
}

export function sanitizeMemberNotice(notice, fallback = 'This action could not be completed. Try again later.') {
  const text = String(notice || '').trim();
  if (!text) return '';
  const icon = /^[✅⚠️❌ℹ️⏳]/u.test(text) ? `${text[0]} ` : '';
  const body = text.replace(/^[✅⚠️❌ℹ️⏳]\s*/u, '').trim();
  const safe = memberReasonText(body, fallback);
  return `${icon}${safe}`.trim();
}

export function profileVisibilityLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'listed') return 'Live';
  if (normalized === 'hidden') return 'Hidden';
  return 'Draft';
}

export function profileStateLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'active') return 'Active';
  if (normalized === 'draft') return 'Draft';
  if (normalized === 'archived') return 'Archived';
  return normalized ? normalized.replaceAll('_', ' ') : 'Draft';
}

export function sourceMatchLabel(metadata = {}) {
  const finalFit = Number(metadata.finalFitScore);
  const relevance = Number(metadata.relevanceScore);
  const score = Number.isFinite(finalFit) ? finalFit : Number.isFinite(relevance) ? relevance : null;
  if (score === null) return 'Relevant story';
  if (score >= 80) return 'Strong match';
  if (score >= 60) return 'Good match';
  return 'Related story';
}

export function sourceQualityLabel({ isPrimary = false, qualityTier = null } = {}) {
  if (isPrimary) return 'Official source';
  if (qualityTier === 'high') return 'Established source';
  return 'Editorial source';
}
