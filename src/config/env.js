const DEFAULT_LINKEDIN_OIDC_DISCOVERY_URL = 'https://www.linkedin.com/oauth/.well-known/openid-configuration';
const DEFAULT_LINKEDIN_SCOPES = 'openid profile';
const DEFAULT_LINKEDIN_VERIFIED_MODE = 'off';
const DEFAULT_LINKEDIN_VERIFIED_SCOPES = 'r_profile_basicinfo r_verify';
const DEFAULT_LINKEDIN_VERIFIED_IDENTITY_API_VERSION = '202510.03';
const DEFAULT_LINKEDIN_VERIFIED_REPORT_API_VERSION = '202510';
const DEFAULT_LINKEDIN_VERIFIED_API_TIMEOUT_MS = 8000;
const DEFAULT_LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED = false;
const DEFAULT_LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS = 30;
const DEFAULT_LINKEDIN_SHARE_MODE = 'off';
const DEFAULT_LINKEDIN_SHARE_SCOPES = 'w_member_social';
const DEFAULT_LINKEDIN_SHARE_POSTS_API_VERSION = '202606';
const DEFAULT_LINKEDIN_SHARE_API_TIMEOUT_MS = 8000;
const DEFAULT_LINKEDIN_SHARE_INTENT_TTL_SECONDS = 900;
const DEFAULT_LINKEDIN_SHARE_CLAIM_TIMEOUT_SECONDS = 300;
const DEFAULT_LINKEDIN_SHARE_VISIBILITY = 'PUBLIC';
const DEFAULT_AI_NEWS_DRAFT_MODE = 'off';
const DEFAULT_NEWSDATA_BASE_URL = 'https://newsdata.io/api/1/';
const DEFAULT_NEWSDATA_API_TIMEOUT_MS = 8000;
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const DEFAULT_OPENAI_DRAFT_MODEL = 'gpt-5.2';
const DEFAULT_OPENAI_API_TIMEOUT_MS = 30000;
const DEFAULT_AI_NEWS_GENERATOR_MODE = 'openai';
const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_DRAFT_MODEL = 'openai/gpt-oss-20b';
const DEFAULT_GROQ_API_TIMEOUT_MS = 30000;
const DEFAULT_GROQ_INPUT_COST_USD_PER_1M = 0;
const DEFAULT_GROQ_OUTPUT_COST_USD_PER_1M = 0;
const DEFAULT_AI_NEWS_DAILY_LIMIT = 3;
const DEFAULT_AI_NEWS_SEARCH_DAILY_LIMIT = 10;
const DEFAULT_AI_NEWS_SEARCH_COOLDOWN_SECONDS = 60;
const DEFAULT_AI_NEWS_MAX_SOURCE_AGE_HOURS = 48;
const DEFAULT_AI_NEWS_MAX_ARTICLES = 5;
const DEFAULT_AI_NEWS_SOURCE_SELECTION_TTL_SECONDS = 1800;
const DEFAULT_AI_NEWS_DRAFT_TTL_SECONDS = 3600;
const DEFAULT_AI_NEWS_PRESET_LIMIT = 3;
const DEFAULT_AI_NEWS_SCHEDULE_MODE = 'off';
const DEFAULT_AI_NEWS_SCHEDULE_DRIVER = 'vercel_daily';
const DEFAULT_AI_NEWS_SCHEDULE_DAILY_HOUR_UTC = 8;
const DEFAULT_AI_NEWS_SCHEDULE_BATCH_SIZE = 5;
const DEFAULT_AI_NEWS_SCHEDULE_CLAIM_TIMEOUT_SECONDS = 900;
const DEFAULT_AI_NEWS_SCHEDULE_RETRY_DELAY_SECONDS = 900;
const DEFAULT_AI_NEWS_SCHEDULE_MAX_ATTEMPTS = 3;
const DEFAULT_AI_NEWS_ROLLOUT_STAGE = 'operator_acceptance';
const DEFAULT_NEWSDATA_REQUEST_COST_USD = 0;
const DEFAULT_AI_NEWS_SOURCE_MODE = 'newsdata_only';
const DEFAULT_AI_NEWS_ENABLED_PROVIDERS = 'rss,hacker_news,github_releases,newsdata';
const DEFAULT_AI_NEWS_PROVIDER_MAX_ARTICLES = 4;
const DEFAULT_AI_NEWS_RSS_TIMEOUT_MS = 7000;
const DEFAULT_AI_NEWS_RSS_MAX_FEEDS_PER_SEARCH = 2;
const DEFAULT_AI_NEWS_HN_TIMEOUT_MS = 7000;
const DEFAULT_AI_NEWS_HN_SCAN_LIMIT = 12;
const DEFAULT_AI_NEWS_HN_MIN_SCORE = 10;
const DEFAULT_AI_NEWS_GITHUB_TIMEOUT_MS = 8000;
const DEFAULT_AI_NEWS_GITHUB_MAX_REPOS_PER_SEARCH = 2;
const DEFAULT_OPENAI_INPUT_COST_USD_PER_1M = 0;
const DEFAULT_OPENAI_OUTPUT_COST_USD_PER_1M = 0;
const DEFAULT_STATE_TTL_SECONDS = 600;
const DEFAULT_JWKS_CACHE_TTL_SECONDS = 3600;
const DEFAULT_DATABASE_SSLMODE = 'require';
const DEFAULT_TELEGRAM_UPDATE_DEDUPE_TTL_SECONDS = 86400;
const DEFAULT_TELEGRAM_ACTION_THROTTLE_SECONDS = 3;
const DEFAULT_NOTIFICATION_RETRY_DELAY_SECONDS = 300;
const DEFAULT_NOTIFICATION_RETRY_BATCH_SIZE = 10;
const DEFAULT_NOTIFICATION_RETRY_CLAIM_TIMEOUT_SECONDS = 60;
const DEFAULT_NOTIFICATION_MAX_ATTEMPTS = 3;
const DEFAULT_NOTIFICATION_RECEIPT_DIAGNOSTICS_LIMIT = 20;
const DEFAULT_CONTACT_UNLOCK_PRICE_STARS = 75;
const DEFAULT_DM_OPEN_PRICE_STARS = 100;
const DEFAULT_PRO_MONTHLY_PRICE_STARS = 149;
const DEFAULT_PRO_MONTHLY_DURATION_DAYS = 30;
const DEFAULT_PRO_OUTREACH_DAILY_LIMIT = 10;
const DEFAULT_CONTACT_REQUEST_RETRY_COOLDOWN_DAYS = 30;
const DEFAULT_PAYMENT_CHECKOUT_AUTH_TTL_MINUTES = 30;
const DEFAULT_PAYMENT_CHECKOUT_RETRY_LOCK_SECONDS = 1800;

function readEnv(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  return typeof value === 'string' ? value.trim() : value;
}

function readRequiredEnv(name) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}


function readBooleanEnv(name, fallback = false) {
  const raw = String(readEnv(name, fallback ? '1' : '0') || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off', ''].includes(raw)) return false;
  throw new Error(`${name} must be a boolean value (1/0, true/false, yes/no, on/off)`);
}

function readNonNegativeNumberEnv(name, fallback = 0) {
  const raw = readEnv(name, String(fallback));
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number: ${raw}`);
  }
  return parsed;
}

function readIntegerEnv(name, fallback) {
  const raw = readEnv(name, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer for ${name}: ${raw}`);
  }
  return parsed;
}

function readEnumEnv(name, fallback, allowedValues) {
  const value = String(readEnv(name, fallback) || '').trim().toLowerCase();
  if (!allowedValues.includes(value)) {
    throw new Error(`${name} must be one of: ${allowedValues.join(', ')}`);
  }
  return value;
}

function parseScopes(value) {
  return [...new Set(String(value || '')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean))];
}

function readCsvEnumListEnv(name, fallback, allowedValues) {
  const values = [...new Set(String(readEnv(name, fallback) || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean))];
  const invalid = values.filter((value) => !allowedValues.includes(value));
  if (invalid.length) {
    throw new Error(`${name} contains unsupported values: ${invalid.join(', ')}`);
  }
  return values;
}


function readBoundedIntegerEnv(name, fallback, { min = 1, max }) {
  const value = readIntegerEnv(name, fallback);
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}: ${value}`);
  }
  return value;
}

function readTelegramUserIdEnv(name) {
  const raw = readEnv(name, '');
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readTelegramUserIdListEnv(name) {
  const raw = readEnv(name, '');
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function readSecretEnv(name) {
  const secret = readEnv(name);
  if (!secret) {
    return null;
  }

  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error(`${name} must be 1-256 chars and contain only A-Z, a-z, 0-9, _ and -`);
  }

  return secret;
}

export function getAppConfig() {
  return {
    appBaseUrl: readRequiredEnv('APP_BASE_URL'),
    invitePhotoFileId: readEnv('INVITE_PHOTO_FILE_ID') || null,
    nodeEnv: readEnv('NODE_ENV', 'development')
  };
}

export function getTelegramConfig() {
  const botUsername = readEnv('TELEGRAM_BOT_USERNAME') || readEnv('BOT_USERNAME') || 'introdeckbot';
  return {
    botToken: readRequiredEnv('TELEGRAM_BOT_TOKEN'),
    webhookSecret: readSecretEnv('TELEGRAM_WEBHOOK_SECRET'),
    botUsername
  };
}

function parseLinkedInVerificationConfigStrict() {
  const mode = readEnumEnv(
    'LINKEDIN_VERIFIED_MODE',
    DEFAULT_LINKEDIN_VERIFIED_MODE,
    ['off', 'development', 'lite']
  );

  const scopes = parseScopes(readEnv('LINKEDIN_VERIFIED_SCOPES', DEFAULT_LINKEDIN_VERIFIED_SCOPES));
  const requiredBasicScope = 'r_profile_basicinfo';
  const verificationScope = scopes.includes('r_verify') ? 'r_verify' : null;
  if (mode !== 'off' && !scopes.includes(requiredBasicScope)) {
    throw new Error(`LINKEDIN_VERIFIED_SCOPES is missing required scope: ${requiredBasicScope}`);
  }
  if (mode !== 'off' && !verificationScope) {
    throw new Error('LINKEDIN_VERIFIED_SCOPES must include r_verify for Development/Lite');
  }

  const identityApiVersion = String(readEnv(
    'LINKEDIN_VERIFIED_IDENTITY_API_VERSION',
    DEFAULT_LINKEDIN_VERIFIED_IDENTITY_API_VERSION
  ));
  const reportApiVersion = String(readEnv(
    'LINKEDIN_VERIFIED_REPORT_API_VERSION',
    DEFAULT_LINKEDIN_VERIFIED_REPORT_API_VERSION
  ));
  if (!/^\d{6}(?:\.\d{2})?$/.test(identityApiVersion)) {
    throw new Error('LINKEDIN_VERIFIED_IDENTITY_API_VERSION must use LinkedIn YYYYMM or YYYYMM.NN format');
  }
  if (!/^\d{6}$/.test(reportApiVersion)) {
    throw new Error('LINKEDIN_VERIFIED_REPORT_API_VERSION must use LinkedIn YYYYMM format');
  }

  const publicBadgeRequested = readBooleanEnv(
    'LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED',
    DEFAULT_LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED
  );

  return {
    mode,
    enabled: mode !== 'off',
    configurationValid: true,
    configurationError: null,
    scopes,
    requiredScopes: [requiredBasicScope, verificationScope].filter(Boolean),
    verificationScope,
    identityApiVersion,
    reportApiVersion,
    timeoutMs: readBoundedIntegerEnv(
      'LINKEDIN_VERIFIED_API_TIMEOUT_MS',
      DEFAULT_LINKEDIN_VERIFIED_API_TIMEOUT_MS,
      { min: 1000, max: 30000 }
    ),
    publicBadgeRequested,
    publicBadgesEnabled: mode === 'lite' && publicBadgeRequested,
    publicBadgeMaxAgeDays: readBoundedIntegerEnv(
      'LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS',
      DEFAULT_LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS,
      { min: 1, max: 365 }
    )
  };
}

function buildLinkedInVerificationFailSafeConfig(error) {
  const rawMode = String(readEnv('LINKEDIN_VERIFIED_MODE', DEFAULT_LINKEDIN_VERIFIED_MODE) || '').trim().toLowerCase();
  const mode = ['off', 'development', 'lite'].includes(rawMode) ? rawMode : 'off';
  const scopes = parseScopes(readEnv('LINKEDIN_VERIFIED_SCOPES', DEFAULT_LINKEDIN_VERIFIED_SCOPES));
  const verificationScope = scopes.includes('r_verify') ? 'r_verify' : null;

  return {
    mode,
    enabled: false,
    configurationValid: false,
    configurationError: {
      code: 'linkedin_verified_config_invalid',
      message: error?.message || String(error)
    },
    scopes,
    requiredScopes: [],
    verificationScope,
    identityApiVersion: String(readEnv(
      'LINKEDIN_VERIFIED_IDENTITY_API_VERSION',
      DEFAULT_LINKEDIN_VERIFIED_IDENTITY_API_VERSION
    )),
    reportApiVersion: String(readEnv(
      'LINKEDIN_VERIFIED_REPORT_API_VERSION',
      DEFAULT_LINKEDIN_VERIFIED_REPORT_API_VERSION
    )),
    timeoutMs: DEFAULT_LINKEDIN_VERIFIED_API_TIMEOUT_MS,
    publicBadgeRequested: false,
    publicBadgesEnabled: false,
    publicBadgeMaxAgeDays: DEFAULT_LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS
  };
}

export function getLinkedInVerificationConfig({ strict = false } = {}) {
  try {
    return parseLinkedInVerificationConfigStrict();
  } catch (error) {
    if (strict) throw error;
    return buildLinkedInVerificationFailSafeConfig(error);
  }
}

function parseLinkedInShareConfigStrict() {
  const mode = readEnumEnv('LINKEDIN_SHARE_MODE', DEFAULT_LINKEDIN_SHARE_MODE, ['off', 'live']);
  const scopes = parseScopes(readEnv('LINKEDIN_SHARE_SCOPES', DEFAULT_LINKEDIN_SHARE_SCOPES));
  if (mode !== 'off' && !scopes.includes('w_member_social')) {
    throw new Error('LINKEDIN_SHARE_SCOPES must include w_member_social');
  }

  const postsApiVersion = String(readEnv(
    'LINKEDIN_SHARE_POSTS_API_VERSION',
    DEFAULT_LINKEDIN_SHARE_POSTS_API_VERSION
  ));
  if (!/^\d{6}$/.test(postsApiVersion)) {
    throw new Error('LINKEDIN_SHARE_POSTS_API_VERSION must use LinkedIn YYYYMM format');
  }

  const visibility = String(readEnv('LINKEDIN_SHARE_VISIBILITY', DEFAULT_LINKEDIN_SHARE_VISIBILITY) || '')
    .trim()
    .toUpperCase();
  if (!['PUBLIC', 'CONNECTIONS'].includes(visibility)) {
    throw new Error('LINKEDIN_SHARE_VISIBILITY must be PUBLIC or CONNECTIONS');
  }

  return {
    mode,
    enabled: mode === 'live',
    configurationValid: true,
    configurationError: null,
    scopes,
    postsApiVersion,
    visibility,
    timeoutMs: readBoundedIntegerEnv(
      'LINKEDIN_SHARE_API_TIMEOUT_MS',
      DEFAULT_LINKEDIN_SHARE_API_TIMEOUT_MS,
      { min: 1000, max: 30000 }
    ),
    intentTtlSeconds: readBoundedIntegerEnv(
      'LINKEDIN_SHARE_INTENT_TTL_SECONDS',
      DEFAULT_LINKEDIN_SHARE_INTENT_TTL_SECONDS,
      { min: 300, max: 3600 }
    ),
    claimTimeoutSeconds: readBoundedIntegerEnv(
      'LINKEDIN_SHARE_CLAIM_TIMEOUT_SECONDS',
      DEFAULT_LINKEDIN_SHARE_CLAIM_TIMEOUT_SECONDS,
      { min: 60, max: 1800 }
    ),
    explicitApprovalRequired: true,
    tokenPersistence: 'none'
  };
}

function buildLinkedInShareFailSafeConfig(error) {
  const rawMode = String(readEnv('LINKEDIN_SHARE_MODE', DEFAULT_LINKEDIN_SHARE_MODE) || '').trim().toLowerCase();
  return {
    mode: rawMode === 'live' ? 'live' : 'off',
    enabled: false,
    configurationValid: false,
    configurationError: {
      code: 'linkedin_share_config_invalid',
      message: error?.message || String(error)
    },
    scopes: parseScopes(readEnv('LINKEDIN_SHARE_SCOPES', DEFAULT_LINKEDIN_SHARE_SCOPES)),
    postsApiVersion: String(readEnv('LINKEDIN_SHARE_POSTS_API_VERSION', DEFAULT_LINKEDIN_SHARE_POSTS_API_VERSION)),
    visibility: DEFAULT_LINKEDIN_SHARE_VISIBILITY,
    timeoutMs: DEFAULT_LINKEDIN_SHARE_API_TIMEOUT_MS,
    intentTtlSeconds: DEFAULT_LINKEDIN_SHARE_INTENT_TTL_SECONDS,
    claimTimeoutSeconds: DEFAULT_LINKEDIN_SHARE_CLAIM_TIMEOUT_SECONDS,
    explicitApprovalRequired: true,
    tokenPersistence: 'none'
  };
}

export function getLinkedInShareConfig({ strict = false } = {}) {
  try {
    return parseLinkedInShareConfigStrict();
  } catch (error) {
    if (strict) throw error;
    return buildLinkedInShareFailSafeConfig(error);
  }
}


function readHttpsUrlEnv(name, fallback, { allowedHostnames = null } = {}) {
  const raw = String(readEnv(name, fallback) || '').trim();
  const url = new URL(raw);
  const localhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localhost && url.protocol === 'http:')) {
    throw new Error(`${name} must use HTTPS (HTTP is allowed only for localhost)`);
  }
  if (Array.isArray(allowedHostnames) && !allowedHostnames.map((item) => String(item).toLowerCase()).includes(url.hostname.toLowerCase())) {
    throw new Error(`${name} hostname is not allowlisted`);
  }
  return url.toString();
}

function parseAiNewsScheduleConfig({ generatorMode = DEFAULT_AI_NEWS_GENERATOR_MODE } = {}) {
  const requestedMode = readEnumEnv('AI_NEWS_SCHEDULE_MODE', DEFAULT_AI_NEWS_SCHEDULE_MODE, ['off', 'live']);
  const mode = generatorMode === 'off' ? 'off' : requestedMode;
  const driver = readEnumEnv('AI_NEWS_SCHEDULE_DRIVER', DEFAULT_AI_NEWS_SCHEDULE_DRIVER, ['vercel_daily', 'external_hourly']);
  const vercelCronSecret = readSecretEnv('CRON_SECRET');
  const dedicatedCronSecret = readSecretEnv('AI_NEWS_CRON_SECRET');
  const cronSecret = driver === 'vercel_daily' ? vercelCronSecret : (dedicatedCronSecret || vercelCronSecret);
  if (mode === 'live' && !cronSecret) {
    throw new Error(driver === 'vercel_daily'
      ? 'CRON_SECRET is required for the Vercel daily AI/news scheduler'
      : 'AI_NEWS_CRON_SECRET or CRON_SECRET is required for the external hourly AI/news scheduler');
  }
  const dailyHourUtc = readBoundedIntegerEnv('AI_NEWS_SCHEDULE_DAILY_HOUR_UTC', DEFAULT_AI_NEWS_SCHEDULE_DAILY_HOUR_UTC, { min: 1, max: 23 });
  if (driver === 'vercel_daily' && dailyHourUtc !== DEFAULT_AI_NEWS_SCHEDULE_DAILY_HOUR_UTC) {
    throw new Error(`AI_NEWS_SCHEDULE_DAILY_HOUR_UTC must be ${DEFAULT_AI_NEWS_SCHEDULE_DAILY_HOUR_UTC} when AI_NEWS_SCHEDULE_DRIVER=vercel_daily`);
  }
  return {
    mode,
    requestedMode,
    enabled: mode === 'live',
    disabledReason: generatorMode === 'off' && requestedMode === 'live' ? 'ai_news_generator_disabled' : null,
    configurationValid: true,
    configurationError: null,
    cronSecret,
    cronAuthSource: driver === 'vercel_daily' ? 'CRON_SECRET' : dedicatedCronSecret ? 'AI_NEWS_CRON_SECRET' : 'CRON_SECRET',
    driver,
    dailyHourUtc,
    batchSize: readBoundedIntegerEnv('AI_NEWS_SCHEDULE_BATCH_SIZE', DEFAULT_AI_NEWS_SCHEDULE_BATCH_SIZE, { min: 1, max: 20 }),
    claimTimeoutSeconds: readBoundedIntegerEnv('AI_NEWS_SCHEDULE_CLAIM_TIMEOUT_SECONDS', DEFAULT_AI_NEWS_SCHEDULE_CLAIM_TIMEOUT_SECONDS, { min: 60, max: 3600 }),
    retryDelaySeconds: readBoundedIntegerEnv('AI_NEWS_SCHEDULE_RETRY_DELAY_SECONDS', DEFAULT_AI_NEWS_SCHEDULE_RETRY_DELAY_SECONDS, { min: 60, max: 86400 }),
    maxAttempts: readBoundedIntegerEnv('AI_NEWS_SCHEDULE_MAX_ATTEMPTS', DEFAULT_AI_NEWS_SCHEDULE_MAX_ATTEMPTS, { min: 1, max: 10 })
  };
}

function buildAiNewsScheduleFailSafeConfig(error) {
  const rawMode = String(readEnv('AI_NEWS_SCHEDULE_MODE', DEFAULT_AI_NEWS_SCHEDULE_MODE) || '').trim().toLowerCase();
  return {
    mode: 'off',
    requestedMode: rawMode === 'live' ? 'live' : 'off',
    enabled: false,
    disabledReason: null,
    configurationValid: false,
    configurationError: { code: 'ai_news_schedule_config_invalid', message: error?.message || String(error) },
    cronSecret: null,
    cronAuthSource: null,
    driver: DEFAULT_AI_NEWS_SCHEDULE_DRIVER,
    dailyHourUtc: DEFAULT_AI_NEWS_SCHEDULE_DAILY_HOUR_UTC,
    batchSize: DEFAULT_AI_NEWS_SCHEDULE_BATCH_SIZE,
    claimTimeoutSeconds: DEFAULT_AI_NEWS_SCHEDULE_CLAIM_TIMEOUT_SECONDS,
    retryDelaySeconds: DEFAULT_AI_NEWS_SCHEDULE_RETRY_DELAY_SECONDS,
    maxAttempts: DEFAULT_AI_NEWS_SCHEDULE_MAX_ATTEMPTS
  };
}

function parseAiNewsDraftConfigStrict() {
  const mode = readEnumEnv('AI_NEWS_DRAFT_MODE', DEFAULT_AI_NEWS_DRAFT_MODE, ['off', 'operator', 'pro']);
  const enabled = mode !== 'off';
  const sourceMode = readEnumEnv('AI_NEWS_SOURCE_MODE', DEFAULT_AI_NEWS_SOURCE_MODE, ['newsdata_only', 'multi_source']);
  const enabledProviders = sourceMode === 'newsdata_only'
    ? ['newsdata']
    : readCsvEnumListEnv('AI_NEWS_ENABLED_PROVIDERS', DEFAULT_AI_NEWS_ENABLED_PROVIDERS, ['rss', 'hacker_news', 'github_releases', 'newsdata']);
  const newsdataApiKey = readEnv('NEWSDATA_API_KEY') || null;
  const generatorMode = readEnumEnv('AI_NEWS_GENERATOR_MODE', DEFAULT_AI_NEWS_GENERATOR_MODE, ['off', 'template', 'groq', 'openai']);
  const openaiApiKey = readEnv('OPENAI_API_KEY') || null;
  const groqApiKey = readEnv('GROQ_API_KEY') || null;
  if (enabled && !enabledProviders.length) throw new Error('AI_NEWS_ENABLED_PROVIDERS must contain at least one provider');
  if (enabled && enabledProviders.includes('newsdata') && !newsdataApiKey) throw new Error('NEWSDATA_API_KEY is required when the newsdata provider is enabled');
  if (enabled && generatorMode === 'openai' && !openaiApiKey) throw new Error('OPENAI_API_KEY is required when AI_NEWS_GENERATOR_MODE=openai');
  if (enabled && generatorMode === 'groq' && !groqApiKey) throw new Error('GROQ_API_KEY is required when AI_NEWS_GENERATOR_MODE=groq');
  let schedule;
  try {
    schedule = parseAiNewsScheduleConfig({ generatorMode });
  } catch (error) {
    schedule = buildAiNewsScheduleFailSafeConfig(error);
  }

  const rolloutStage = readEnumEnv(
    'AI_NEWS_ROLLOUT_STAGE',
    DEFAULT_AI_NEWS_ROLLOUT_STAGE,
    ['operator_acceptance', 'limited_pro', 'live']
  );

  return {
    mode,
    enabled,
    rolloutStage,
    configurationValid: true,
    configurationError: null,
    dailyLimit: readBoundedIntegerEnv('AI_NEWS_DAILY_LIMIT', DEFAULT_AI_NEWS_DAILY_LIMIT, { min: 1, max: 25 }),
    searchDailyLimit: readBoundedIntegerEnv('AI_NEWS_SEARCH_DAILY_LIMIT', DEFAULT_AI_NEWS_SEARCH_DAILY_LIMIT, { min: 1, max: 100 }),
    searchCooldownSeconds: readBoundedIntegerEnv('AI_NEWS_SEARCH_COOLDOWN_SECONDS', DEFAULT_AI_NEWS_SEARCH_COOLDOWN_SECONDS, { min: 10, max: 3600 }),
    maxSourceAgeHours: readBoundedIntegerEnv('AI_NEWS_MAX_SOURCE_AGE_HOURS', DEFAULT_AI_NEWS_MAX_SOURCE_AGE_HOURS, { min: 1, max: 168 }),
    maxArticles: readBoundedIntegerEnv('AI_NEWS_MAX_ARTICLES', DEFAULT_AI_NEWS_MAX_ARTICLES, { min: 1, max: 10 }),
    sourceSelectionTtlSeconds: readBoundedIntegerEnv('AI_NEWS_SOURCE_SELECTION_TTL_SECONDS', DEFAULT_AI_NEWS_SOURCE_SELECTION_TTL_SECONDS, { min: 300, max: 7200 }),
    draftTtlSeconds: readBoundedIntegerEnv('AI_NEWS_DRAFT_TTL_SECONDS', DEFAULT_AI_NEWS_DRAFT_TTL_SECONDS, { min: 900, max: 86400 }),
    presetLimit: readBoundedIntegerEnv('AI_NEWS_PRESET_LIMIT', DEFAULT_AI_NEWS_PRESET_LIMIT, { min: 1, max: 10 }),
    schedule,
    generator: {
      mode: generatorMode,
      enabled: generatorMode !== 'off',
      provider: generatorMode === 'off' ? null : generatorMode,
      browseOnly: generatorMode === 'off'
    },
    source: {
      mode: sourceMode,
      enabledProviders,
      providerMaxArticles: readBoundedIntegerEnv('AI_NEWS_PROVIDER_MAX_ARTICLES', DEFAULT_AI_NEWS_PROVIDER_MAX_ARTICLES, { min: 1, max: 10 }),
      rssTimeoutMs: readBoundedIntegerEnv('AI_NEWS_RSS_TIMEOUT_MS', DEFAULT_AI_NEWS_RSS_TIMEOUT_MS, { min: 1000, max: 30000 }),
      rssMaxFeedsPerSearch: readBoundedIntegerEnv('AI_NEWS_RSS_MAX_FEEDS_PER_SEARCH', DEFAULT_AI_NEWS_RSS_MAX_FEEDS_PER_SEARCH, { min: 1, max: 5 }),
      hackerNewsTimeoutMs: readBoundedIntegerEnv('AI_NEWS_HN_TIMEOUT_MS', DEFAULT_AI_NEWS_HN_TIMEOUT_MS, { min: 1000, max: 30000 }),
      hackerNewsScanLimit: readBoundedIntegerEnv('AI_NEWS_HN_SCAN_LIMIT', DEFAULT_AI_NEWS_HN_SCAN_LIMIT, { min: 4, max: 40 }),
      hackerNewsMinScore: readBoundedIntegerEnv('AI_NEWS_HN_MIN_SCORE', DEFAULT_AI_NEWS_HN_MIN_SCORE, { min: 1, max: 10000 }),
      githubTimeoutMs: readBoundedIntegerEnv('AI_NEWS_GITHUB_TIMEOUT_MS', DEFAULT_AI_NEWS_GITHUB_TIMEOUT_MS, { min: 1000, max: 30000 }),
      githubMaxReposPerSearch: readBoundedIntegerEnv('AI_NEWS_GITHUB_MAX_REPOS_PER_SEARCH', DEFAULT_AI_NEWS_GITHUB_MAX_REPOS_PER_SEARCH, { min: 1, max: 5 }),
      githubToken: readSecretEnv('GITHUB_API_TOKEN')
    },
    newsdata: {
      configured: Boolean(newsdataApiKey),
      apiKey: newsdataApiKey,
      baseUrl: readHttpsUrlEnv('NEWSDATA_BASE_URL', DEFAULT_NEWSDATA_BASE_URL, { allowedHostnames: ['newsdata.io', 'www.newsdata.io'] }),
      timeoutMs: readBoundedIntegerEnv('NEWSDATA_API_TIMEOUT_MS', DEFAULT_NEWSDATA_API_TIMEOUT_MS, { min: 1000, max: 30000 }),
      estimatedRequestCostUsd: readNonNegativeNumberEnv('NEWSDATA_REQUEST_COST_USD', DEFAULT_NEWSDATA_REQUEST_COST_USD)
    },
    openai: {
      configured: Boolean(openaiApiKey),
      apiKey: openaiApiKey,
      baseUrl: readHttpsUrlEnv('OPENAI_BASE_URL', DEFAULT_OPENAI_BASE_URL),
      model: String(readEnv('OPENAI_DRAFT_MODEL', DEFAULT_OPENAI_DRAFT_MODEL) || '').trim(),
      timeoutMs: readBoundedIntegerEnv('OPENAI_API_TIMEOUT_MS', DEFAULT_OPENAI_API_TIMEOUT_MS, { min: 3000, max: 120000 }),
      inputCostUsdPerMillion: readNonNegativeNumberEnv('OPENAI_INPUT_COST_USD_PER_1M', DEFAULT_OPENAI_INPUT_COST_USD_PER_1M),
      outputCostUsdPerMillion: readNonNegativeNumberEnv('OPENAI_OUTPUT_COST_USD_PER_1M', DEFAULT_OPENAI_OUTPUT_COST_USD_PER_1M),
      store: false
    },
    groq: {
      configured: Boolean(groqApiKey),
      apiKey: groqApiKey,
      baseUrl: readHttpsUrlEnv('GROQ_BASE_URL', DEFAULT_GROQ_BASE_URL, { allowedHostnames: ['api.groq.com'] }),
      model: String(readEnv('GROQ_DRAFT_MODEL', DEFAULT_GROQ_DRAFT_MODEL) || '').trim(),
      timeoutMs: readBoundedIntegerEnv('GROQ_API_TIMEOUT_MS', DEFAULT_GROQ_API_TIMEOUT_MS, { min: 3000, max: 120000 }),
      inputCostUsdPerMillion: readNonNegativeNumberEnv('GROQ_INPUT_COST_USD_PER_1M', DEFAULT_GROQ_INPUT_COST_USD_PER_1M),
      outputCostUsdPerMillion: readNonNegativeNumberEnv('GROQ_OUTPUT_COST_USD_PER_1M', DEFAULT_GROQ_OUTPUT_COST_USD_PER_1M),
      store: false
    },
    explicitApprovalRequired: true,
    automaticPublishing: false,
    scheduledDeliveryCreatesDraftOnly: true,
    sourceEvidenceRequired: true
  };
}

function buildAiNewsDraftFailSafeConfig(error) {
  const rawMode = String(readEnv('AI_NEWS_DRAFT_MODE', DEFAULT_AI_NEWS_DRAFT_MODE) || '').trim().toLowerCase();
  const rawRolloutStage = String(readEnv('AI_NEWS_ROLLOUT_STAGE', DEFAULT_AI_NEWS_ROLLOUT_STAGE) || '').trim().toLowerCase();
  return {
    mode: ['operator', 'pro'].includes(rawMode) ? rawMode : 'off',
    rolloutStage: ['operator_acceptance', 'limited_pro', 'live'].includes(rawRolloutStage) ? rawRolloutStage : DEFAULT_AI_NEWS_ROLLOUT_STAGE,
    enabled: false,
    configurationValid: false,
    configurationError: { code: 'ai_news_draft_config_invalid', message: error?.message || String(error) },
    dailyLimit: DEFAULT_AI_NEWS_DAILY_LIMIT,
    searchDailyLimit: DEFAULT_AI_NEWS_SEARCH_DAILY_LIMIT,
    searchCooldownSeconds: DEFAULT_AI_NEWS_SEARCH_COOLDOWN_SECONDS,
    maxSourceAgeHours: DEFAULT_AI_NEWS_MAX_SOURCE_AGE_HOURS,
    maxArticles: DEFAULT_AI_NEWS_MAX_ARTICLES,
    sourceSelectionTtlSeconds: DEFAULT_AI_NEWS_SOURCE_SELECTION_TTL_SECONDS,
    draftTtlSeconds: DEFAULT_AI_NEWS_DRAFT_TTL_SECONDS,
    presetLimit: DEFAULT_AI_NEWS_PRESET_LIMIT,
    schedule: buildAiNewsScheduleFailSafeConfig(error),
    generator: {
      mode: ['off', 'template', 'groq', 'openai'].includes(String(readEnv('AI_NEWS_GENERATOR_MODE', DEFAULT_AI_NEWS_GENERATOR_MODE)).toLowerCase())
        ? String(readEnv('AI_NEWS_GENERATOR_MODE', DEFAULT_AI_NEWS_GENERATOR_MODE)).toLowerCase()
        : DEFAULT_AI_NEWS_GENERATOR_MODE,
      enabled: false,
      provider: null,
      browseOnly: false
    },
    source: {
      mode: String(readEnv('AI_NEWS_SOURCE_MODE', DEFAULT_AI_NEWS_SOURCE_MODE) || '').trim().toLowerCase() === 'multi_source' ? 'multi_source' : 'newsdata_only',
      enabledProviders: [],
      providerMaxArticles: DEFAULT_AI_NEWS_PROVIDER_MAX_ARTICLES,
      rssTimeoutMs: DEFAULT_AI_NEWS_RSS_TIMEOUT_MS,
      rssMaxFeedsPerSearch: DEFAULT_AI_NEWS_RSS_MAX_FEEDS_PER_SEARCH,
      hackerNewsTimeoutMs: DEFAULT_AI_NEWS_HN_TIMEOUT_MS,
      hackerNewsScanLimit: DEFAULT_AI_NEWS_HN_SCAN_LIMIT,
      hackerNewsMinScore: DEFAULT_AI_NEWS_HN_MIN_SCORE,
      githubTimeoutMs: DEFAULT_AI_NEWS_GITHUB_TIMEOUT_MS,
      githubMaxReposPerSearch: DEFAULT_AI_NEWS_GITHUB_MAX_REPOS_PER_SEARCH,
      githubToken: null
    },
    newsdata: { configured: Boolean(readEnv('NEWSDATA_API_KEY')), apiKey: null, baseUrl: DEFAULT_NEWSDATA_BASE_URL, timeoutMs: DEFAULT_NEWSDATA_API_TIMEOUT_MS, estimatedRequestCostUsd: DEFAULT_NEWSDATA_REQUEST_COST_USD },
    openai: { configured: Boolean(readEnv('OPENAI_API_KEY')), apiKey: null, baseUrl: DEFAULT_OPENAI_BASE_URL, model: String(readEnv('OPENAI_DRAFT_MODEL', DEFAULT_OPENAI_DRAFT_MODEL)), timeoutMs: DEFAULT_OPENAI_API_TIMEOUT_MS, inputCostUsdPerMillion: DEFAULT_OPENAI_INPUT_COST_USD_PER_1M, outputCostUsdPerMillion: DEFAULT_OPENAI_OUTPUT_COST_USD_PER_1M, store: false },
    groq: { configured: Boolean(readEnv('GROQ_API_KEY')), apiKey: null, baseUrl: DEFAULT_GROQ_BASE_URL, model: String(readEnv('GROQ_DRAFT_MODEL', DEFAULT_GROQ_DRAFT_MODEL)), timeoutMs: DEFAULT_GROQ_API_TIMEOUT_MS, inputCostUsdPerMillion: DEFAULT_GROQ_INPUT_COST_USD_PER_1M, outputCostUsdPerMillion: DEFAULT_GROQ_OUTPUT_COST_USD_PER_1M, store: false },
    explicitApprovalRequired: true,
    automaticPublishing: false,
    scheduledDeliveryCreatesDraftOnly: true,
    sourceEvidenceRequired: true
  };
}

export function getAiNewsDraftConfig({ strict = false } = {}) {
  try {
    return parseAiNewsDraftConfigStrict();
  } catch (error) {
    if (strict) throw error;
    return buildAiNewsDraftFailSafeConfig(error);
  }
}

export function getLinkedInConfig() {
  const scopes = parseScopes(readEnv('LINKEDIN_SCOPES', DEFAULT_LINKEDIN_SCOPES));
  const stateSecret = readRequiredEnv('LINKEDIN_STATE_SECRET');

  if (stateSecret.length < 32) {
    throw new Error('LINKEDIN_STATE_SECRET must be at least 32 characters long');
  }

  return {
    clientId: readRequiredEnv('LINKEDIN_CLIENT_ID'),
    clientSecret: readRequiredEnv('LINKEDIN_CLIENT_SECRET'),
    redirectUri: readRequiredEnv('LINKEDIN_REDIRECT_URI'),
    stateSecret,
    stateTtlSeconds: readIntegerEnv('LINKEDIN_STATE_TTL_SECONDS', DEFAULT_STATE_TTL_SECONDS),
    oidcDiscoveryUrl: readEnv('LINKEDIN_OIDC_DISCOVERY_URL', DEFAULT_LINKEDIN_OIDC_DISCOVERY_URL),
    jwksCacheTtlSeconds: readIntegerEnv('LINKEDIN_JWKS_CACHE_TTL_SECONDS', DEFAULT_JWKS_CACHE_TTL_SECONDS),
    scopes
  };
}

export function getRuntimeGuardConfig() {
  return {
    updateDedupeTtlSeconds: readIntegerEnv('TELEGRAM_UPDATE_DEDUPE_TTL_SECONDS', DEFAULT_TELEGRAM_UPDATE_DEDUPE_TTL_SECONDS),
    actionThrottleSeconds: readIntegerEnv('TELEGRAM_ACTION_THROTTLE_SECONDS', DEFAULT_TELEGRAM_ACTION_THROTTLE_SECONDS)
  };
}

export function getNotificationRetryConfig() {
  return {
    retrySecret: readSecretEnv('NOTIFICATION_RETRY_SECRET'),
    cronSecret: readSecretEnv('CRON_SECRET'),
    retryDelaySeconds: readIntegerEnv('NOTIFICATION_RETRY_DELAY_SECONDS', DEFAULT_NOTIFICATION_RETRY_DELAY_SECONDS),
    batchSize: readIntegerEnv('NOTIFICATION_RETRY_BATCH_SIZE', DEFAULT_NOTIFICATION_RETRY_BATCH_SIZE),
    claimTimeoutSeconds: readIntegerEnv('NOTIFICATION_RETRY_CLAIM_TIMEOUT_SECONDS', DEFAULT_NOTIFICATION_RETRY_CLAIM_TIMEOUT_SECONDS),
    maxAttempts: readIntegerEnv('NOTIFICATION_MAX_ATTEMPTS', DEFAULT_NOTIFICATION_MAX_ATTEMPTS)
  };
}

export function getNotificationOpsConfig() {
  return {
    opsSecret: readSecretEnv('NOTIFICATION_OPS_SECRET'),
    defaultDiagnosticsLimit: readIntegerEnv('NOTIFICATION_RECEIPT_DIAGNOSTICS_LIMIT', DEFAULT_NOTIFICATION_RECEIPT_DIAGNOSTICS_LIMIT)
  };
}


export function getPricingConfig() {
  return {
    contactUnlockPriceStars: readIntegerEnv('CONTACT_UNLOCK_PRICE_STARS', DEFAULT_CONTACT_UNLOCK_PRICE_STARS),
    dmOpenPriceStars: readIntegerEnv('DM_OPEN_PRICE_STARS', DEFAULT_DM_OPEN_PRICE_STARS),
    proMonthlyPriceStars: readIntegerEnv('PRO_MONTHLY_PRICE_STARS', DEFAULT_PRO_MONTHLY_PRICE_STARS)
  };
}

export function getSubscriptionConfig() {
  return {
    proMonthlyDurationDays: readIntegerEnv('PRO_MONTHLY_DURATION_DAYS', DEFAULT_PRO_MONTHLY_DURATION_DAYS)
  };
}

export function getContactPolicyConfig() {
  const checkoutAuthorizationTtlMinutes = readBoundedIntegerEnv(
    'PAYMENT_CHECKOUT_AUTH_TTL_MINUTES',
    DEFAULT_PAYMENT_CHECKOUT_AUTH_TTL_MINUTES,
    { min: 5, max: 1440 }
  );
  const configuredCheckoutRetryLockSeconds = readBoundedIntegerEnv(
    'PAYMENT_CHECKOUT_RETRY_LOCK_SECONDS',
    DEFAULT_PAYMENT_CHECKOUT_RETRY_LOCK_SECONDS,
    { min: 300, max: 86400 }
  );
  return {
    proOutreachDailyLimit: readBoundedIntegerEnv('PRO_OUTREACH_DAILY_LIMIT', DEFAULT_PRO_OUTREACH_DAILY_LIMIT, { min: 1, max: 100 }),
    retryCooldownDays: readBoundedIntegerEnv('CONTACT_REQUEST_RETRY_COOLDOWN_DAYS', DEFAULT_CONTACT_REQUEST_RETRY_COOLDOWN_DAYS, { min: 1, max: 365 }),
    checkoutAuthorizationTtlMinutes,
    checkoutRetryLockSeconds: Math.max(configuredCheckoutRetryLockSeconds, checkoutAuthorizationTtlMinutes * 60)
  };
}

export function getOperatorConfig() {
  const adminChatId = readTelegramUserIdEnv('ADMIN_CHAT_ID');
  const founderOperatorIds = readTelegramUserIdListEnv('TG_OPERATOR_IDS');
  const legacyOperatorIds = readTelegramUserIdListEnv('OPERATOR_TELEGRAM_USER_IDS');
  const operatorTelegramUserIds = [...new Set([
    ...(adminChatId ? [adminChatId] : []),
    ...founderOperatorIds,
    ...legacyOperatorIds
  ])];

  return {
    adminChatId,
    founderOperatorIds,
    legacyOperatorIds,
    operatorTelegramUserIds
  };
}

export function isOperatorTelegramUser(telegramUserId) {
  if (!Number.isFinite(Number(telegramUserId))) {
    return false;
  }

  return getOperatorConfig().operatorTelegramUserIds.includes(Number(telegramUserId));
}

export function getDbConfig() {
  const databaseUrl = readEnv('DATABASE_URL');
  if (!databaseUrl) {
    return {
      configured: false,
      databaseUrl: null,
      sslMode: null
    };
  }

  return {
    configured: true,
    databaseUrl,
    sslMode: readEnv('DATABASE_SSLMODE', DEFAULT_DATABASE_SSLMODE)
  };
}

export function getPublicFlags() {
  const dbConfig = getDbConfig();
  const retryConfig = getNotificationRetryConfig();

  const linkedInConfigured = Boolean(
    readEnv('LINKEDIN_CLIENT_ID') &&
      readEnv('LINKEDIN_CLIENT_SECRET') &&
      readEnv('LINKEDIN_REDIRECT_URI') &&
      readEnv('LINKEDIN_STATE_SECRET')
  );

  const linkedInVerification = getLinkedInVerificationConfig();
  const linkedInShare = getLinkedInShareConfig();
  const aiNewsDraft = getAiNewsDraftConfig();

  return {
    dbConfigured: dbConfig.configured,
    linkedInConfigured,
    linkedInVerificationConfigured: linkedInConfigured && linkedInVerification.enabled,
    linkedInShareConfigured: linkedInConfigured && linkedInShare.enabled,
    aiNewsDraftConfigured: dbConfig.configured && linkedInShare.enabled && aiNewsDraft.enabled,
    aiNewsScheduleConfigured: dbConfig.configured && aiNewsDraft.enabled && aiNewsDraft.schedule.enabled && aiNewsDraft.schedule.configurationValid !== false && Boolean(aiNewsDraft.schedule.cronSecret),
    telegramConfigured: Boolean(readEnv('TELEGRAM_BOT_TOKEN')),
    telegramWebhookSecretConfigured: Boolean(readEnv('TELEGRAM_WEBHOOK_SECRET')),
    runtimeGuardsConfigured: dbConfig.configured,
    notificationReceiptsConfigured: dbConfig.configured && Boolean(readEnv('TELEGRAM_BOT_TOKEN')),
    notificationRetryConfigured: dbConfig.configured && Boolean(readEnv('TELEGRAM_BOT_TOKEN')) && Boolean(retryConfig.retrySecret || retryConfig.cronSecret),
    notificationRetryCronConfigured: Boolean(retryConfig.cronSecret),
    notificationRetryManualConfigured: Boolean(retryConfig.retrySecret),
    notificationOpsConfigured: dbConfig.configured && Boolean(readEnv('NOTIFICATION_OPS_SECRET')),
    operatorDiagnosticsSurfaceConfigured: dbConfig.configured && Boolean(readEnv('NOTIFICATION_OPS_SECRET')) && getOperatorConfig().operatorTelegramUserIds.length > 0
,
    contactUnlockConfigured: dbConfig.configured && Boolean(readEnv('TELEGRAM_BOT_TOKEN')),
    dmRelayConfigured: dbConfig.configured && Boolean(readEnv('TELEGRAM_BOT_TOKEN')),
    pricingConfigured: dbConfig.configured && Boolean(readEnv('TELEGRAM_BOT_TOKEN'))
  };
}
