const DEFAULT_LINKEDIN_OIDC_DISCOVERY_URL = 'https://www.linkedin.com/oauth/.well-known/openid-configuration';
const DEFAULT_LINKEDIN_SCOPES = 'openid profile';
const DEFAULT_LINKEDIN_VERIFIED_MODE = 'off';
const DEFAULT_LINKEDIN_VERIFIED_SCOPES = 'r_profile_basicinfo r_verify_details';
const DEFAULT_LINKEDIN_VERIFIED_IDENTITY_API_VERSION = '202510.03';
const DEFAULT_LINKEDIN_VERIFIED_REPORT_API_VERSION = '202510';
const DEFAULT_LINKEDIN_VERIFIED_API_TIMEOUT_MS = 8000;
const DEFAULT_LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED = false;
const DEFAULT_LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS = 30;
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

export function getLinkedInVerificationConfig() {
  const mode = readEnumEnv(
    'LINKEDIN_VERIFIED_MODE',
    DEFAULT_LINKEDIN_VERIFIED_MODE,
    ['off', 'development', 'lite']
  );

  const scopes = parseScopes(readEnv('LINKEDIN_VERIFIED_SCOPES', DEFAULT_LINKEDIN_VERIFIED_SCOPES));
  const requiredBasicScope = 'r_profile_basicinfo';
  const supportedVerificationScopes = ['r_verify_details', 'r_verify'];
  const verificationScope = supportedVerificationScopes.find((scope) => scopes.includes(scope)) || null;
  if (mode !== 'off' && !scopes.includes(requiredBasicScope)) {
    throw new Error(`LINKEDIN_VERIFIED_SCOPES is missing required scope: ${requiredBasicScope}`);
  }
  if (mode !== 'off' && !verificationScope) {
    throw new Error(`LINKEDIN_VERIFIED_SCOPES must include r_verify_details (current) or r_verify (legacy)`);
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

  return {
    dbConfigured: dbConfig.configured,
    linkedInConfigured,
    linkedInVerificationConfigured: linkedInConfigured && linkedInVerification.enabled,
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
