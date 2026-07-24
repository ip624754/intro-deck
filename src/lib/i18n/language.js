export const SUPPORTED_INTERFACE_LANGUAGES = Object.freeze(['en', 'ru']);
export const SUPPORTED_POST_LANGUAGES = Object.freeze(['en', 'ru']);
export const DEFAULT_INTERFACE_LANGUAGE = 'en';
export const DEFAULT_POST_LANGUAGE = 'en';

function normalizeStoredLanguage(value, supported, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return supported.includes(normalized) ? normalized : fallback;
}

export function normalizeInterfaceLanguage(value, fallback = DEFAULT_INTERFACE_LANGUAGE) {
  return normalizeStoredLanguage(value, SUPPORTED_INTERFACE_LANGUAGES, fallback);
}

export function normalizeDefaultPostLanguage(value, fallback = DEFAULT_POST_LANGUAGE) {
  return normalizeStoredLanguage(value, SUPPORTED_POST_LANGUAGES, fallback);
}

export function inferInterfaceLanguageFromTelegramLocale(value) {
  const normalized = String(value || '').trim().toLowerCase().replaceAll('_', '-');
  return normalized === 'ru' || normalized.startsWith('ru-') ? 'ru' : DEFAULT_INTERFACE_LANGUAGE;
}

export function resolveLanguagePreferences(source = null) {
  const input = source || {};
  return {
    interfaceLanguage: normalizeInterfaceLanguage(input.interfaceLanguage ?? input.interface_language),
    defaultPostLanguage: normalizeDefaultPostLanguage(input.defaultPostLanguage ?? input.default_post_language),
    schemaReady: Boolean(input.schemaReady ?? input.language_schema_ready)
  };
}

export function languageDisplayName(value, displayLanguage = DEFAULT_INTERFACE_LANGUAGE) {
  const normalizedValue = normalizeInterfaceLanguage(value);
  const normalizedDisplayLanguage = normalizeInterfaceLanguage(displayLanguage);
  if (normalizedDisplayLanguage === 'ru') {
    return normalizedValue === 'ru' ? 'Русский' : 'English';
  }
  return normalizedValue === 'ru' ? 'Russian' : 'English';
}
