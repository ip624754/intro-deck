import { normalizeInterfaceLanguage } from '../i18n/language.js';

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
  help: '❓ Help',
  language: '🌐 Language settings'
});

export const MEMBER_BUTTONS = Object.freeze({
  home: '🏠 Home',
  editProfile: '👤 Profile',
  continueSetup: '➡️ Continue setup',
  browseDirectory: '🌐 Browse',
  requests: '📥 Requests',
  storyFinder: '🗞 Story finder',
  invitePeople: '✉️ Invite people',
  pro: '⭐ Pro',
  help: '❓ Help',
  language: '🌐 Language',
  filters: '🎯 Filters',
  backToDirectory: '← Back to directory',
  backToRequests: '← Back to requests',
  previous: '‹ Previous',
  next: 'Next ›'
});

const MEMBER_SURFACES_RU = Object.freeze({
  home: '💼 Intro Deck',
  profile: '🧩 Профиль',
  profilePreview: '👁 Предпросмотр профиля',
  directory: '🌐 Каталог',
  directoryProfile: '👤 Профессиональный профиль',
  requests: '📥 Запросы и чаты',
  storyFinder: '🗞 Поиск инфоповодов',
  invite: '✉️ Пригласить людей',
  pro: '⭐ Intro Deck Pro',
  help: '❓ Помощь',
  language: '🌐 Настройки языка'
});

const MEMBER_BUTTONS_RU = Object.freeze({
  home: '🏠 Главная',
  editProfile: '👤 Профиль',
  continueSetup: '➡️ Продолжить настройку',
  browseDirectory: '🌐 Открыть каталог',
  requests: '📥 Запросы',
  storyFinder: '🗞 Поиск инфоповодов',
  invitePeople: '✉️ Пригласить людей',
  pro: '⭐ Pro',
  help: '❓ Помощь',
  language: '🌐 Язык',
  filters: '🎯 Фильтры',
  backToDirectory: '← Назад в каталог',
  backToRequests: '← Назад к запросам',
  previous: '‹ Назад',
  next: 'Далее ›'
});

const REASON_MAP_EN = Object.freeze({
  migration_028_required: 'LinkedIn trust details are temporarily unavailable.',
  migration_029_required: 'LinkedIn sharing is temporarily unavailable.',
  migration_030_required: 'Story finder is temporarily unavailable.',
  migration_031_required: 'Saved searches are temporarily unavailable.',
  migration_032_required: 'Story finder is temporarily unavailable.',
  migration_033_required: 'Story finder is temporarily unavailable.',
  migration_034_required: 'Draft creation is temporarily unavailable.',
  migration_035_required: 'Personalized discovery is temporarily unavailable.',
  migration_036_required: 'Personalized discovery is temporarily unavailable.',
  migration_037_required: 'Language settings are temporarily unavailable.',
  contact_contract_requires_migration: 'Contact requests are temporarily unavailable.',
  ai_news_draft_config_invalid: 'Story finder is temporarily unavailable.',
  ai_news_disabled: 'Story finder is temporarily unavailable.',
  linkedin_share_unavailable: 'LinkedIn sharing is temporarily unavailable.',
  DATABASE_URL_NOT_CONFIGURED: 'This feature is temporarily unavailable.'
});

const REASON_MAP_RU = Object.freeze({
  migration_028_required: 'Данные доверия LinkedIn временно недоступны.',
  migration_029_required: 'Публикация в LinkedIn временно недоступна.',
  migration_030_required: 'Поиск инфоповодов временно недоступен.',
  migration_031_required: 'Сохранённые поиски временно недоступны.',
  migration_032_required: 'Поиск инфоповодов временно недоступен.',
  migration_033_required: 'Поиск инфоповодов временно недоступен.',
  migration_034_required: 'Создание черновика временно недоступно.',
  migration_035_required: 'Персонализированный поиск временно недоступен.',
  migration_036_required: 'Персонализированный поиск временно недоступен.',
  migration_037_required: 'Настройки языка временно недоступны.',
  contact_contract_requires_migration: 'Контактные запросы временно недоступны.',
  ai_news_draft_config_invalid: 'Поиск инфоповодов временно недоступен.',
  ai_news_disabled: 'Поиск инфоповодов временно недоступен.',
  linkedin_share_unavailable: 'Публикация в LinkedIn временно недоступна.',
  DATABASE_URL_NOT_CONFIGURED: 'Эта функция временно недоступна.'
});

export function getMemberSurfaces(interfaceLanguage = 'en') {
  return normalizeInterfaceLanguage(interfaceLanguage) === 'ru' ? MEMBER_SURFACES_RU : MEMBER_SURFACES;
}

export function getMemberButtons(interfaceLanguage = 'en') {
  return normalizeInterfaceLanguage(interfaceLanguage) === 'ru' ? MEMBER_BUTTONS_RU : MEMBER_BUTTONS;
}

export function memberReasonText(reason, fallback = 'This action is temporarily unavailable. Try again later.', interfaceLanguage = 'en') {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const reasonMap = language === 'ru' ? REASON_MAP_RU : REASON_MAP_EN;
  if (reasonMap[normalized]) return reasonMap[normalized];
  if (/^migration_\d+_required$/i.test(normalized)) {
    return language === 'ru' ? 'Эта функция временно недоступна.' : 'This feature is temporarily unavailable.';
  }
  if (/DATABASE_URL|persistence|constraint|SQLSTATE|relation\s+"|duplicate key|syntax error/i.test(normalized)) return fallback;
  if (/^[a-z0-9_]+$/i.test(normalized) && normalized.includes('_')) return fallback;
  return normalized;
}

export function memberUnavailable(subject = 'This feature', interfaceLanguage = 'en') {
  return normalizeInterfaceLanguage(interfaceLanguage) === 'ru'
    ? `${subject} временно недоступны. Попробуйте позже.`
    : `${subject} is temporarily unavailable. Try again later.`;
}

export function sanitizeMemberNotice(notice, fallback = 'This action could not be completed. Try again later.', interfaceLanguage = 'en') {
  const text = String(notice || '').trim();
  if (!text) return '';
  const icon = /^[✅⚠️❌ℹ️⏳]/u.test(text) ? `${text[0]} ` : '';
  const body = text.replace(/^[✅⚠️❌ℹ️⏳]\s*/u, '').trim();
  const safe = memberReasonText(body, fallback, interfaceLanguage);
  return `${icon}${safe}`.trim();
}

export function profileVisibilityLabel(value, interfaceLanguage = 'en') {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const normalized = String(value || '').trim().toLowerCase();
  if (language === 'ru') {
    if (normalized === 'listed') return 'Опубликован';
    if (normalized === 'hidden') return 'Скрыт';
    return 'Черновик';
  }
  if (normalized === 'listed') return 'Live';
  if (normalized === 'hidden') return 'Hidden';
  return 'Draft';
}

export function profileStateLabel(value, interfaceLanguage = 'en') {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const normalized = String(value || '').trim().toLowerCase();
  if (language === 'ru') {
    if (normalized === 'active') return 'Активен';
    if (normalized === 'draft') return 'Черновик';
    if (normalized === 'archived') return 'Архив';
    return normalized ? normalized.replaceAll('_', ' ') : 'Черновик';
  }
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
