import { CURRENT_SOURCE_STEP, getRuntimeArtifactSha } from '../src/config/release.js';
import {
  getLinkedInVerificationConfig,
  getNotificationOpsConfig,
  getNotificationRetryConfig,
  getOperatorConfig,
  getPublicFlags,
  getRuntimeGuardConfig
} from '../src/config/env.js';

export default async function handler(req, res) {
  const flags = getPublicFlags();
  const runtimeGuards = getRuntimeGuardConfig();
  const notificationRetry = getNotificationRetryConfig();
  const notificationOps = getNotificationOpsConfig();
  const operatorConfig = getOperatorConfig();
  const linkedInVerification = getLinkedInVerificationConfig();
  res.status(200).json({
    ok: true,
    step: CURRENT_SOURCE_STEP,
    docsStep: CURRENT_SOURCE_STEP,
    artifactSha: getRuntimeArtifactSha(),
    service: 'linkedin-telegram-directory-bot',
    flags,
    persistence: {
      enabled: flags.dbConfigured
    },
    webhook: {
      secretConfigured: flags.telegramWebhookSecretConfigured
    },
    runtimeGuards: {
      dbBacked: flags.runtimeGuardsConfigured,
      updateDedupeTtlSeconds: runtimeGuards.updateDedupeTtlSeconds,
      actionThrottleSeconds: runtimeGuards.actionThrottleSeconds
    },
    notificationReceipts: {
      enabled: flags.notificationReceiptsConfigured
    },
    notificationRetry: {
      enabled: flags.notificationRetryConfigured,
      cronAuthConfigured: flags.notificationRetryCronConfigured,
      manualAuthConfigured: flags.notificationRetryManualConfigured,
      batchSize: notificationRetry.batchSize,
      retryDelaySeconds: notificationRetry.retryDelaySeconds,
      claimTimeoutSeconds: notificationRetry.claimTimeoutSeconds,
      maxAttempts: notificationRetry.maxAttempts
    },
    notificationOps: {
      enabled: flags.notificationOpsConfigured,
      defaultDiagnosticsLimit: notificationOps.defaultDiagnosticsLimit
    },
    operatorDiagnosticsSurface: {
      enabled: flags.operatorDiagnosticsSurfaceConfigured,
      operatorCount: operatorConfig.operatorTelegramUserIds.length
    },
    linkedInVerification: {
      enabled: linkedInVerification.enabled,
      mode: linkedInVerification.mode,
      configurationValid: linkedInVerification.configurationValid !== false,
      configurationError: linkedInVerification.configurationError || null,
      categoryOnly: linkedInVerification.mode === 'development' || linkedInVerification.mode === 'lite',
      identityApiVersion: linkedInVerification.identityApiVersion,
      reportApiVersion: linkedInVerification.reportApiVersion,
      verificationScope: linkedInVerification.verificationScope,
      publicBadgeRequested: linkedInVerification.publicBadgeRequested,
      publicBadgesEnabled: linkedInVerification.publicBadgesEnabled,
      publicBadgeMaxAgeDays: linkedInVerification.publicBadgeMaxAgeDays,
      publicBadgePolicy: 'lite_plus_explicit_flag_plus_fresh_lite_snapshot'
    }
  });
}
