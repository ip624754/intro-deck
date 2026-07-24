import { CURRENT_SOURCE_STEP, getRuntimeArtifactSha } from '../src/config/release.js';
import { publicSourceRegistrySummary } from '../src/lib/news/sourceRegistry.js';
import { publicSourceRelevanceSummary } from '../src/lib/news/sourceRelevance.js';
import { publicAudienceDiscoverySummary } from '../src/lib/ai/newsDiscoveryContract.js';
import {
  getAiNewsDraftConfig,
  getLinkedInShareConfig,
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
  const linkedInShare = getLinkedInShareConfig();
  const aiNewsDraft = getAiNewsDraftConfig();
  const generatorMode = aiNewsDraft.generator?.mode || 'openai';
  const generatorConfigured = generatorMode === 'off' || generatorMode === 'template'
    ? true
    : generatorMode === 'groq'
      ? aiNewsDraft.groq.configured
      : aiNewsDraft.openai.configured;
  const generatorModel = generatorMode === 'groq'
    ? aiNewsDraft.groq.model
    : generatorMode === 'template'
      ? 'introdeck-template-v1'
      : generatorMode === 'openai'
        ? aiNewsDraft.openai.model
        : null;
  res.status(200).json({
    ok: true,
    step: CURRENT_SOURCE_STEP,
    docsStep: CURRENT_SOURCE_STEP,
    artifactSha: getRuntimeArtifactSha(),
    service: 'linkedin-telegram-directory-bot',
    runtime: {
      node: process.versions.node
    },
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
    memberCopyPolicy: {
      canonicalSurfaces: ['home', 'profile', 'directory', 'requests', 'story_finder', 'invite', 'pro', 'help'],
      memberDiagnostics: 'user_safe_copy_only',
      buttonContract: 'sentence_case_verb_object_contextual_back',
      rawRuntimeStatesVisible: false,
      callbackIdsChanged: false,
      businessLogicChanged: false
    },
    inviteSharePolicy: {
      publicCardCta: 'single_open_intro_deck',
      publicCardOwnerNavigation: false,
      publicCaptionLinkDuplication: false,
      attribution: 'source_specific_telegram_deep_links',
      forwardingCard: 'canonical_photo_card_with_text_fallback',
      inviteMenu: 'share_card_link_activity_points_by_mode',
      activitySurface: 'performance_plus_recent_joined_contacts',
      rewardAccountingChanged: false,
      activationRulesChanged: false
    },
    aiNewsDraft: {
      enabled: aiNewsDraft.enabled,
      mode: aiNewsDraft.mode,
      rolloutStage: aiNewsDraft.rolloutStage,
      configurationValid: aiNewsDraft.configurationValid !== false,
      configurationError: aiNewsDraft.configurationError || null,
      newsProvider: aiNewsDraft.source?.mode === 'multi_source' ? 'multi_source' : 'newsdata',
      newsProviderConfigured: aiNewsDraft.source?.mode === 'multi_source'
        ? Boolean(aiNewsDraft.source?.enabledProviders?.length)
        : aiNewsDraft.newsdata.configured,
      sourceMode: aiNewsDraft.source?.mode || 'newsdata_only',
      enabledSourceProviders: aiNewsDraft.source?.enabledProviders || ['newsdata'],
      sourceProviderStatus: {
        rss: aiNewsDraft.source?.enabledProviders?.includes('rss') || false,
        hackerNews: aiNewsDraft.source?.enabledProviders?.includes('hacker_news') || false,
        githubReleases: aiNewsDraft.source?.enabledProviders?.includes('github_releases') || false,
        githubAuthenticated: Boolean(aiNewsDraft.source?.githubToken),
        newsdata: aiNewsDraft.newsdata.configured && (aiNewsDraft.source?.enabledProviders?.includes('newsdata') ?? true)
      },
      sourceRegistry: {
        rssCount: publicSourceRegistrySummary().rss.length,
        githubRepositoryCount: publicSourceRegistrySummary().githubReleases.length
      },
      sourceQualityPolicy: publicSourceRelevanceSummary(),
      audienceDiscoveryPolicy: publicAudienceDiscoverySummary(),
      searchUxPolicy: {
        persistentProgressMessage: true,
        terminalStates: ['results', 'failed'],
        duplicateCallbackGuard: true,
        providerFailureAllowanceRelease: true,
        progressClaim: 'configured_source_providers_only'
      },
      newsdataFallbackPolicy: aiNewsDraft.source?.mode === 'multi_source' ? 'only_when_primary_pool_is_below_limit' : 'primary_provider',
      generatorMode,
      generatorEnabled: Boolean(aiNewsDraft.generator?.enabled),
      browseOnly: Boolean(aiNewsDraft.generator?.browseOnly),
      generatorProvider: aiNewsDraft.generator?.provider || null,
      generatorProviderConfigured: generatorConfigured,
      aiProvider: aiNewsDraft.generator?.provider || 'none',
      aiProviderConfigured: generatorConfigured,
      model: generatorModel,
      generatorProviderStatus: {
        template: true,
        groq: aiNewsDraft.groq.configured,
        openai: aiNewsDraft.openai.configured
      },
      providerTelemetryRequired: true,
      costEstimationConfigured: Boolean(
        Number(aiNewsDraft.newsdata.estimatedRequestCostUsd || 0) > 0 ||
        Number(aiNewsDraft.openai.inputCostUsdPerMillion || 0) > 0 ||
        Number(aiNewsDraft.openai.outputCostUsdPerMillion || 0) > 0 ||
        Number(aiNewsDraft.groq.inputCostUsdPerMillion || 0) > 0 ||
        Number(aiNewsDraft.groq.outputCostUsdPerMillion || 0) > 0
      ),
      dailyLimit: aiNewsDraft.dailyLimit,
      searchDailyLimit: aiNewsDraft.searchDailyLimit,
      searchCooldownSeconds: aiNewsDraft.searchCooldownSeconds,
      maxSourceAgeHours: aiNewsDraft.maxSourceAgeHours,
      presetLimit: aiNewsDraft.presetLimit,
      schedule: {
        enabled: aiNewsDraft.schedule.enabled,
        mode: aiNewsDraft.schedule.mode,
        requestedMode: aiNewsDraft.schedule.requestedMode || aiNewsDraft.schedule.mode,
        disabledReason: aiNewsDraft.schedule.disabledReason || null,
        driver: aiNewsDraft.schedule.driver,
        configurationValid: aiNewsDraft.schedule.configurationValid !== false,
        configurationError: aiNewsDraft.schedule.configurationError || null,
        cronAuthConfigured: Boolean(aiNewsDraft.schedule.cronSecret),
        cronAuthSource: aiNewsDraft.schedule.cronAuthSource || null,
        batchSize: aiNewsDraft.schedule.batchSize,
        dailyHourUtc: aiNewsDraft.schedule.dailyHourUtc,
        scheduledEffect: 'telegram_draft_only'
      },
      explicitApprovalRequired: true,
      automaticPublishing: false,
      subscriptionControlsAccessNotPublishing: true,
      sourceEvidenceRequired: true,
      tokenPersistence: 'none',
      liveAcceptancePolicy: 'artifact_bound_preflight_plus_manual_core_loop_evidence',
      migrationSafetyPolicy: {
        migration035Ordering: 'drop_legacy_constraints_before_value_rewrite',
        partialSchemaRepairMigration: '036',
        audienceContractReadiness: 'columns_plus_constraints_fail_closed'
      },
      searchRecoveryPolicy: {
        exactClaimMatchRequired: true,
        unexpectedPostClaimFailureReleasesAllowance: true,
        diagnosticCodesArePhaseTagged: true
      }
    },
    linkedInShare: {
      enabled: linkedInShare.enabled,
      mode: linkedInShare.mode,
      configurationValid: linkedInShare.configurationValid !== false,
      configurationError: linkedInShare.configurationError || null,
      scope: linkedInShare.scopes.includes('w_member_social') ? 'w_member_social' : null,
      postsApiVersion: linkedInShare.postsApiVersion,
      visibility: linkedInShare.visibility,
      explicitApprovalRequired: true,
      tokenPersistence: 'none',
      liveAcceptancePolicy: 'artifact_bound_preflight_plus_manual_core_loop_evidence',
      automaticPublishing: false
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
