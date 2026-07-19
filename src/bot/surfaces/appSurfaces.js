import * as render from '../../lib/telegram/render.js';
import { loadDirectoryCard, loadDirectoryPage } from '../../lib/storage/directoryStore.js';
import { loadDirectoryFilterState } from '../../lib/storage/directoryFilterStore.js';
import { loadIntroInboxState, loadIntroRequestDetailForTelegramUser } from '../../lib/storage/introRequestStore.js';
import { loadContactUnlockInboxState, loadContactUnlockRequestDetailForTelegramUser } from '../../lib/storage/contactUnlockStore.js';
import { loadDmInboxState, loadDmThreadDetailForTelegramUser } from '../../lib/storage/dmStore.js';
import { touchTelegramUserAndLoadProfile } from '../../lib/storage/profileStore.js';
import { loadNotificationOperatorSurface } from '../../lib/storage/notificationStore.js';
import { loadPricingSurfaceState } from '../../lib/storage/monetizationStore.js';
import { loadAiNewsPresetOperatorDiagnostics } from '../../lib/storage/aiNewsPresetStore.js';
import { loadInviteHistoryState, loadInviteRewardsSummaryState, loadInviteSurfaceState } from '../../lib/storage/inviteStore.js';
import { loadProfileEditorState } from '../../lib/storage/profileEditStore.js';
import { getAiNewsDraftConfig, getLinkedInConfig, getLinkedInShareConfig, getLinkedInVerificationConfig, getPricingConfig, isOperatorTelegramUser } from '../../config/env.js';
import { loadActiveAdminNotice } from '../../lib/storage/adminStore.js';
import { buildSignedLinkedInLaunchTicket } from '../../lib/linkedin/oidc.js';


function fallbackRenderHelpText({ aiNewsVisible = false } = {}) {
  return [
    '❓ Help',
    '',
    'Use Intro Deck to connect a LinkedIn account, complete a member-provided professional card, browse listed profiles, and use one Contact flow to continue privately only after approval.',
    '',
    'Shortcuts:',
    '• /profile — open your profile',
    '• /browse — browse the directory',
    '• /contact — open the Contact inbox hub',
    '• /inbox — open contact requests',
    '• /dm — open private chats',
    '• /plans — open pricing and Pro status',
    '• /invite — share your invite',
    '• /share — preview and explicitly publish your listed profile on LinkedIn',
    ...(aiNewsVisible ? ['• /news — create evidence-bound drafts, manage personal presets, and approve each LinkedIn post separately'] : []),
    '• /menu — return home'
  ].join('\n');
}

function fallbackRenderHelpKeyboard({ aiNewsVisible = false } = {}) {
  const rows = [
      [
        { text: '🧩 Profile', callback_data: 'p:menu' },
        { text: '🌐 Browse directory', callback_data: 'dir:list:0' }
      ],
      [{ text: '📨 Contact inbox', callback_data: 'contact:inbox' }],
      ...(aiNewsVisible ? [[{ text: '🧠 AI/news drafts', callback_data: 'news:home' }]] : []),
      [
        { text: '⭐ Plans', callback_data: 'plans:root' },
        { text: '📨 Invite contacts', callback_data: 'invite:root' }
      ],
      [{ text: '🏠 Home', callback_data: 'home:root' }]
    ];
  return { inline_keyboard: rows };
}

const renderHelpText = typeof render.renderHelpText === 'function' ? render.renderHelpText : fallbackRenderHelpText;
const renderHelpKeyboard = typeof render.renderHelpKeyboard === 'function' ? render.renderHelpKeyboard : fallbackRenderHelpKeyboard;
const renderDirectoryCardKeyboard = render.renderDirectoryCardKeyboard;
const renderDirectoryCardText = render.renderDirectoryCardText;
const renderContactRequestText = render.renderContactRequestText;
const renderContactRequestKeyboard = render.renderContactRequestKeyboard;
const renderContactInboxText = render.renderContactInboxText;
const renderContactInboxKeyboard = render.renderContactInboxKeyboard;
const renderDirectoryFiltersKeyboard = render.renderDirectoryFiltersKeyboard;
const renderDirectoryFiltersText = render.renderDirectoryFiltersText;
const renderContactUnlockDetailKeyboard = render.renderContactUnlockDetailKeyboard;
const renderContactUnlockDetailText = render.renderContactUnlockDetailText;
const renderIntroDetailKeyboard = render.renderIntroDetailKeyboard;
const renderIntroDetailText = render.renderIntroDetailText;
const renderIntroInboxKeyboard = render.renderIntroInboxKeyboard;
const renderIntroInboxText = render.renderIntroInboxText;
const renderDirectoryListKeyboard = render.renderDirectoryListKeyboard;
const renderDmInboxKeyboard = render.renderDmInboxKeyboard;
const renderDmInboxText = render.renderDmInboxText;
const renderDmThreadKeyboard = render.renderDmThreadKeyboard;
const renderDmThreadText = render.renderDmThreadText;
const renderDirectoryListText = render.renderDirectoryListText;
const renderHomeKeyboard = render.renderHomeKeyboard;
const renderHomeText = render.renderHomeText;
const renderOperatorDiagnosticsKeyboard = render.renderOperatorDiagnosticsKeyboard;
const renderOperatorDiagnosticsText = render.renderOperatorDiagnosticsText;
const renderProfileMenuKeyboard = render.renderProfileMenuKeyboard;
const renderProfileMenuText = render.renderProfileMenuText;
const renderProfileOptionalKeyboard = render.renderProfileOptionalKeyboard;
const renderProfileOptionalText = render.renderProfileOptionalText;
const renderProfilePreviewKeyboard = render.renderProfilePreviewKeyboard;
const renderProfilePreviewText = render.renderProfilePreviewText;
const renderProfileSkillsKeyboard = render.renderProfileSkillsKeyboard;
const renderProfileSkillsText = render.renderProfileSkillsText;
const renderPricingText = render.renderPricingText;
const renderPricingKeyboard = render.renderPricingKeyboard;
const renderInviteText = render.renderInviteText;
const renderInviteKeyboard = render.renderInviteKeyboard;
const renderInviteLinkText = render.renderInviteLinkText;
const renderInviteLinkKeyboard = render.renderInviteLinkKeyboard;
const renderInviteCardText = render.renderInviteCardText;
const renderInviteCardKeyboard = render.renderInviteCardKeyboard;
const renderInvitePerformanceText = render.renderInvitePerformanceText;
const renderInvitePerformanceKeyboard = render.renderInvitePerformanceKeyboard;
const renderInviteHistoryText = render.renderInviteHistoryText;
const renderInviteHistoryKeyboard = render.renderInviteHistoryKeyboard;
const renderInviteRewardsText = render.renderInviteRewardsText;
const renderInviteRewardsKeyboard = render.renderInviteRewardsKeyboard;
const renderInlineInviteCaption = render.renderInlineInviteCaption;
const renderInlineInviteShareText = render.renderInlineInviteShareText;


function noticeMatchesProfile(notice, profileSnapshot) {
  if (!notice?.isActive || !notice?.body) {
    return null;
  }

  const hasLinkedIn = Boolean(profileSnapshot?.linkedin_sub);
  const profileId = profileSnapshot?.profile_id || null;
  const profileState = profileSnapshot?.profile_state || null;
  const visibilityStatus = profileSnapshot?.visibility_status || 'hidden';
  const skillsReady = Boolean(profileSnapshot?.completion?.hasRequiredSkills);
  const lastSeenAt = profileSnapshot?.last_seen_at ? new Date(profileSnapshot.last_seen_at) : null;
  const isListedActive = visibilityStatus === 'listed' && lastSeenAt && !Number.isNaN(lastSeenAt.getTime())
    ? lastSeenAt.getTime() >= Date.now() - (14 * 24 * 60 * 60 * 1000)
    : false;
  const isListedInactive = visibilityStatus === 'listed' && !isListedActive;

  switch (notice.audienceKey) {
    case 'CONNECTED':
      return hasLinkedIn ? notice.body : null;
    case 'NOT_CONNECTED':
      return hasLinkedIn ? null : notice.body;
    case 'CONNECTED_NO_PROFILE':
      return hasLinkedIn && !profileId ? notice.body : null;
    case 'PROFILE_INCOMPLETE':
      return hasLinkedIn && profileState !== 'active' ? notice.body : null;
    case 'COMPLETE_NO_SKILLS':
      return profileState === 'active' && !skillsReady ? notice.body : null;
    case 'READY_NOT_LISTED':
      return profileState === 'active' && visibilityStatus !== 'listed' ? notice.body : null;
    case 'LISTED_ACTIVE':
      return profileState === 'active' && isListedActive ? notice.body : null;
    case 'LISTED_INACTIVE':
      return profileState === 'active' && isListedInactive ? notice.body : null;
    case 'LISTED':
      return profileState === 'active' && visibilityStatus === 'listed' ? notice.body : null;
    case 'ALL':
    default:
      return notice.body;
  }
}

function buildInvitePhotoUrl(appBaseUrl) {
  if (!appBaseUrl) {
    return null;
  }

  return new URL('/assets/social/intro-deck-og-1200x630.jpg', appBaseUrl).toString();
}

export function createSurfaceBuilders({ appBaseUrl, invitePhotoFileId = null }) {
  function getLinkedInVerificationSurfaceAccess(telegramUserId) {
    const verificationConfig = getLinkedInVerificationConfig();
    const ownerEligible = verificationConfig.mode === 'lite'
      || (verificationConfig.mode === 'development' && isOperatorTelegramUser(telegramUserId));
    return {
      ...verificationConfig,
      enabled: verificationConfig.enabled && ownerEligible
    };
  }

  async function buildHomeSurface(ctx, homeExtraNotice = null) {
    const storeResult = await touchTelegramUserAndLoadProfile({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => {
      console.warn('[home surface] profile load skipped', error?.message || error);
      return {
        persistenceEnabled: false,
        profile: null,
        reason: 'profile_load_failed'
      };
    });

    const directoryResult = storeResult.persistenceEnabled
      ? await loadDirectoryPage({ page: 0, viewerTelegramUserId: ctx.from.id }).catch((error) => ({
        persistenceEnabled: true,
        profiles: [],
        totalCount: 0,
        hasPrev: false,
        hasNext: false,
        reason: String(error?.message || error)
      }))
      : null;

    const introInboxResult = storeResult.persistenceEnabled
      ? await loadIntroInboxState({
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username || null
      }).catch((error) => ({
        persistenceEnabled: true,
        inbox: null,
        reason: String(error?.message || error)
      }))
      : null;

    const adminNoticeResult = storeResult.persistenceEnabled
      ? await loadActiveAdminNotice().catch(() => ({ persistenceEnabled: true, notice: null }))
      : { persistenceEnabled: false, notice: null };
    const activeNotice = noticeMatchesProfile(adminNoticeResult.notice, storeResult.profile);
    const combinedNotice = [activeNotice, homeExtraNotice].filter(Boolean).join('\n\n') || null;

    return {
      text: renderHomeText({
        profileSnapshot: storeResult.profile,
        persistenceEnabled: storeResult.persistenceEnabled,
        directoryStats: directoryResult ? { totalCount: directoryResult.totalCount || 0 } : null,
        introInboxStats: introInboxResult?.inbox?.counts || null,
        isOperator: isOperatorTelegramUser(ctx.from.id),
        notice: combinedNotice
      }),
      reply_markup: renderHomeKeyboard({
        appBaseUrl,
        telegramUserId: ctx.from.id,
        profileSnapshot: storeResult.profile,
        persistenceEnabled: storeResult.persistenceEnabled,
        isOperator: isOperatorTelegramUser(ctx.from.id),
        aiNewsVisible: (() => {
          const config = getAiNewsDraftConfig();
          return config.enabled && (config.mode === 'pro' || isOperatorTelegramUser(ctx.from.id));
        })()
      })
    };
  }

  async function buildHelpSurface(ctx) {
    const config = getAiNewsDraftConfig();
    const aiNewsVisible = config.enabled && (config.mode === 'pro' || isOperatorTelegramUser(ctx?.from?.id));
    return {
      text: renderHelpText({ aiNewsVisible }),
      reply_markup: renderHelpKeyboard({ aiNewsVisible })
    };
  }

  async function buildPricingSurface(ctx) {
    const state = await loadPricingSurfaceState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      recentLimit: 3
    }).catch((error) => ({
      persistenceEnabled: false,
      profile: null,
      subscription: null,
      recentReceipts: [],
      pricing: null,
      reason: String(error?.message || error)
    }));

    return {
      text: renderPricingText({ pricingState: state }),
      reply_markup: renderPricingKeyboard({ pricingState: state })
    };
  }

  async function buildProfileMenuSurface(ctx, notice = null) {
    const state = await loadProfileEditorState({
      telegramUserId: ctx.from.id
    }).catch((error) => {
      console.warn('[profile menu] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        profile: null,
        reason: 'profile_menu_load_failed'
      };
    });

    const adminNoticeResult = state.persistenceEnabled
      ? await loadActiveAdminNotice().catch(() => ({ persistenceEnabled: true, notice: null }))
      : { persistenceEnabled: false, notice: null };
    const activeNotice = noticeMatchesProfile(adminNoticeResult.notice, state.profile);
    const combinedNotice = [activeNotice, notice].filter(Boolean).join('\n\n') || null;
    const linkedinVerificationAccess = getLinkedInVerificationSurfaceAccess(ctx.from.id);
    const linkedinVerificationLaunchTicket = linkedinVerificationAccess.enabled
      ? buildSignedLinkedInLaunchTicket({
          telegramUserId: ctx.from.id,
          purpose: 'verification_refresh',
          secret: getLinkedInConfig().stateSecret
        })
      : null;

    return {
      text: renderProfileMenuText({
        profileSnapshot: state.profile,
        persistenceEnabled: state.persistenceEnabled,
        linkedinVerificationAccess,
        notice: combinedNotice
      }),
      reply_markup: renderProfileMenuKeyboard({
        appBaseUrl,
        telegramUserId: ctx.from.id,
        profileSnapshot: state.profile,
        persistenceEnabled: state.persistenceEnabled,
        linkedinVerificationAccess,
        linkedinVerificationLaunchTicket
      })
    };
  }

  async function buildProfilePreviewSurface(ctx, notice = null) {
    const state = await loadProfileEditorState({
      telegramUserId: ctx.from.id
    }).catch((error) => {
      console.warn('[profile preview] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        profile: null,
        reason: 'profile_preview_load_failed'
      };
    });

    const linkedinVerificationAccess = getLinkedInVerificationSurfaceAccess(ctx.from.id);
    return {
      text: renderProfilePreviewText({
        profileSnapshot: state.profile,
        persistenceEnabled: state.persistenceEnabled,
        linkedinVerificationConfig: linkedinVerificationAccess,
        notice,
        aiNewsConfig: getAiNewsDraftConfig(),
        aiNewsPresetSummary: aiNewsPresetDiagnostics.summary || null
      }),
      reply_markup: renderProfilePreviewKeyboard({
        profileSnapshot: state.profile,
        persistenceEnabled: state.persistenceEnabled,
        linkedinShareConfig: getLinkedInShareConfig()
      })
    };
  }

  async function buildProfileSkillsSurface(ctx, notice = null) {
    const state = await loadProfileEditorState({
      telegramUserId: ctx.from.id
    }).catch((error) => {
      console.warn('[profile skills] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        profile: null,
        reason: 'profile_skills_load_failed'
      };
    });

    return {
      text: renderProfileSkillsText({
        profileSnapshot: state.profile,
        persistenceEnabled: state.persistenceEnabled,
        notice
      }),
      reply_markup: renderProfileSkillsKeyboard({
        profileSnapshot: state.profile
      })
    };
  }


  async function buildProfileOptionalSurface(ctx, notice = null) {
    const state = await loadProfileEditorState({
      telegramUserId: ctx.from.id
    }).catch((error) => {
      console.warn('[profile optional] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        profile: null,
        reason: 'profile_optional_load_failed'
      };
    });

    return {
      text: renderProfileOptionalText({
        profileSnapshot: state.profile,
        persistenceEnabled: state.persistenceEnabled,
        notice
      }),
      reply_markup: renderProfileOptionalKeyboard({
        profileSnapshot: state.profile,
        persistenceEnabled: state.persistenceEnabled
      })
    };
  }

async function buildDirectoryListSurface(ctx, page = 0, notice = null) {
  const state = await loadDirectoryPage({
    page,
    viewerTelegramUserId: ctx.from.id
  }).catch((error) => {
    console.warn('[directory list] load failed', error?.message || error);
    return {
      persistenceEnabled: false,
      page: 0,
      profiles: [],
      totalCount: 0,
      hasPrev: false,
      hasNext: false,
      filterSummary: null,
      reason: 'directory_list_load_failed'
    };
  });

  const viewerState = state.persistenceEnabled
    ? await touchTelegramUserAndLoadProfile({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch(() => ({
      persistenceEnabled: true,
      profile: null,
      reason: 'viewer_profile_load_failed'
    }))
    : { persistenceEnabled: false, profile: null };

  return {
    text: renderDirectoryListText({
      profiles: state.profiles,
      page: state.page,
      totalCount: state.totalCount,
      persistenceEnabled: state.persistenceEnabled,
      filterSummary: state.filterSummary,
      viewerProfile: viewerState.profile,
      notice
    }),
    reply_markup: renderDirectoryListKeyboard({
      profiles: state.profiles,
      page: state.page,
      hasPrev: state.hasPrev,
      hasNext: state.hasNext,
      viewerProfile: viewerState.profile,
      filterSummary: state.filterSummary
    })
  };
}

async function buildDirectoryCardSurface(ctx, profileId, page = 0, notice = null) {
    const state = await loadDirectoryCard({
      profileId,
      viewerTelegramUserId: ctx.from.id
    }).catch((error) => {
      console.warn('[directory card] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        profile: null,
        reason: 'directory_card_load_failed'
      };
    });

    const linkedinVerificationConfig = getLinkedInVerificationConfig();
    return {
      text: renderDirectoryCardText({
        profileSnapshot: state.profile,
        persistenceEnabled: state.persistenceEnabled,
        linkedinVerificationConfig,
        notice
      }),
      reply_markup: renderDirectoryCardKeyboard({ profileSnapshot: state.profile, page })
    };
  }

  async function buildContactRequestSurface(ctx, profileId, page = 0, notice = null) {
    const [directoryState, pricingState] = await Promise.all([
      loadDirectoryCard({ profileId, viewerTelegramUserId: ctx.from.id }).catch((error) => {
        console.warn('[contact request] directory load failed', error?.message || error);
        return { persistenceEnabled: false, profile: null, reason: 'contact_request_profile_load_failed' };
      }),
      loadPricingSurfaceState({ telegramUserId: ctx.from.id, telegramUsername: ctx.from.username || null }).catch((error) => {
        console.warn('[contact request] pricing load failed', error?.message || error);
        return { persistenceEnabled: false, profile: null, pricing: getPricingConfig(), subscription: null, proOutreachAllowance: null, reason: 'contact_request_pricing_load_failed' };
      })
    ]);
    const persistenceEnabled = Boolean(directoryState.persistenceEnabled);
    return {
      text: renderContactRequestText({ profileSnapshot: directoryState.profile, pricingState, persistenceEnabled, notice }),
      reply_markup: renderContactRequestKeyboard({ profileSnapshot: directoryState.profile, pricingState, page })
    };
  }

  async function buildContactInboxSurface(ctx, notice = null) {
    return {
      text: renderContactInboxText({ notice }),
      reply_markup: renderContactInboxKeyboard()
    };
  }

  async function buildDirectoryFiltersSurface(ctx, notice = null) {
    const state = await loadDirectoryFilterState({
      telegramUserId: ctx.from.id
    }).catch((error) => {
      console.warn('[directory filters] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        filterSummary: null,
        reason: 'directory_filters_load_failed'
      };
    });

    return {
      text: renderDirectoryFiltersText({
        persistenceEnabled: state.persistenceEnabled,
        filterSummary: state.filterSummary,
        notice
      }),
      reply_markup: renderDirectoryFiltersKeyboard({
        filterSummary: state.filterSummary
      })
    };
  }

  async function buildIntroDetailSurface(ctx, introRequestId, notice = null) {
    const state = await loadIntroRequestDetailForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      introRequestId
    }).catch((error) => {
      console.warn('[intro detail] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        introRequest: null,
        reason: 'intro_detail_load_failed'
      };
    });

    return {
      text: renderIntroDetailText({
        persistenceEnabled: state.persistenceEnabled,
        introRequest: state.introRequest,
        notice
      }),
      reply_markup: renderIntroDetailKeyboard({
        introRequest: state.introRequest
      })
    };
  }



  async function buildContactUnlockDetailSurface(ctx, requestId, notice = null) {
    const state = await loadContactUnlockRequestDetailForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      requestId
    }).catch((error) => {
      console.warn('[contact unlock detail] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        request: null,
        reason: 'contact_unlock_detail_load_failed'
      };
    });

    return {
      text: renderContactUnlockDetailText({
        persistenceEnabled: state.persistenceEnabled,
        request: state.request,
        notice
      }),
      reply_markup: renderContactUnlockDetailKeyboard({
        request: state.request
      })
    };
  }


  async function buildInviteSurface(ctx, notice = null) {
    const state = await loadInviteSurfaceState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => ({
      persistenceEnabled: false,
      inviteCode: null,
      inviteLink: null,
      inlineInviteLink: null,
      inviteCardLink: null,
      shareInlineQuery: 'invite',
      invitePhotoUrl: buildInvitePhotoUrl(appBaseUrl),
      invitePhotoFileId,
      invitedCount: 0,
      activatedCount: 0,
      rewardsSummary: {
        mode: 'off',
        pendingPoints: 0,
        availablePoints: 0,
        redeemedPoints: 0
      },
      invitedBy: null,
      invited: [],
      reason: String(error?.message || error)
    }));

    return {
      text: renderInviteText({ inviteState: state, notice }),
      reply_markup: renderInviteKeyboard({ inviteState: state }),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
  }

  async function buildInviteLinkSurface(ctx) {
    const state = await loadInviteSurfaceState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => ({
      persistenceEnabled: false,
      inviteCode: null,
      inviteLink: null,
      reason: String(error?.message || error)
    }));

    return {
      text: renderInviteLinkText({ inviteState: state }),
      reply_markup: renderInviteLinkKeyboard(),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
  }

  async function buildInvitePerformanceSurface(ctx, notice = null) {
    const state = await loadInviteSurfaceState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      recentLimit: 3
    }).catch((error) => ({
      persistenceEnabled: false,
      inviteCode: null,
      inviteLink: null,
      inlineInviteLink: null,
      inviteCardLink: null,
      shareInlineQuery: 'invite',
      invitedCount: 0,
      activatedCount: 0,
      rewardsSummary: {
        mode: 'off',
        pendingPoints: 0,
        availablePoints: 0,
        redeemedPoints: 0
      },
      invitedBy: null,
      invited: [],
      hasMoreInvites: false,
      activationHint: 'connected LinkedIn or started a profile',
      reason: String(error?.message || error)
    }));

    return {
      text: renderInvitePerformanceText({ inviteState: state, notice }),
      reply_markup: renderInvitePerformanceKeyboard({ inviteState: state }),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
  }

  async function buildInviteHistorySurface(ctx, page = 1, notice = null) {
    const state = await loadInviteHistoryState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      page
    }).catch((error) => ({
      persistenceEnabled: false,
      snapshot: {
        inviteCode: null,
        inviteLink: null,
        inlineInviteLink: null,
        inviteCardLink: null,
        shareInlineQuery: 'invite',
        invitedCount: 0,
        activatedCount: 0,
        rewardsSummary: {
          mode: 'off',
          pendingPoints: 0,
          availablePoints: 0,
          redeemedPoints: 0
        },
        invitedBy: null,
        invited: [],
        hasMoreInvites: false,
        activationHint: 'connected LinkedIn or started a profile'
      },
      history: {
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
        startIndex: 0,
        endIndex: 0,
        items: []
      },
      reason: String(error?.message || error)
    }));

    return {
      text: renderInviteHistoryText({ inviteState: state.snapshot, historyState: state.history, notice }),
      reply_markup: renderInviteHistoryKeyboard({ inviteState: state.snapshot, historyState: state.history }),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
  }

  async function buildInviteRewardsSurface(ctx, notice = null) {
    const state = await loadInviteRewardsSummaryState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => ({
      persistenceEnabled: false,
      rewardsSummary: {
        mode: 'off',
        config: {
          activationPoints: 10,
          activationConfirmHours: 24,
          activationRuleVersion: 'introdeck_listed_ready_v1',
          catalogVersion: 'v1'
        },
        availablePoints: 0,
        pendingPoints: 0,
        redeemedPoints: 0,
        availableEntries: 0,
        pendingEntries: 0,
        redeemedEntries: 0
      },
      recentEvents: [],
      activationHint: 'the invited member connected LinkedIn and reached listed-ready state',
      reason: String(error?.message || error)
    }));

    return {
      text: renderInviteRewardsText({ rewardsState: state, notice }),
      reply_markup: renderInviteRewardsKeyboard({ rewardsState: state }),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
  }

  async function buildInviteCardMessage(ctx) {
    const state = await loadInviteSurfaceState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => ({
      persistenceEnabled: false,
      inviteCode: null,
      inviteLink: null,
      inlineInviteLink: null,
      inviteCardLink: null,
      invitePhotoUrl: buildInvitePhotoUrl(appBaseUrl),
      invitePhotoFileId,
      invitedCount: 0,
      activatedCount: 0,
      invited: [],
      reason: String(error?.message || error)
    }));

    return {
      text: renderInviteCardText({ inviteState: state }),
      reply_markup: renderInviteCardKeyboard({ inviteState: state }),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      snapshot: {
        ...state,
        invitePhotoUrl: buildInvitePhotoUrl(appBaseUrl),
        invitePhotoFileId,
        inlineInviteCaption: renderInlineInviteCaption({ inviteState: state }),
        inlineShareText: renderInlineInviteShareText({ inviteState: state })
      }
    };
  }


  async function buildDmInboxSurface(ctx, notice = null) {
    const state = await loadDmInboxState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => {
      console.warn('[dm inbox] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        inbox: null,
        reason: 'dm_inbox_load_failed'
      };
    });

    return {
      text: renderDmInboxText({
        persistenceEnabled: state.persistenceEnabled,
        inboxState: state.inbox,
        notice
      }),
      reply_markup: renderDmInboxKeyboard({
        inboxState: state.inbox
      })
    };
  }

  async function buildDmThreadSurface(ctx, threadId, notice = null) {
    const state = await loadDmThreadDetailForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      threadId
    }).catch((error) => {
      console.warn('[dm thread] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        thread: null,
        reason: 'dm_thread_load_failed'
      };
    });

    return {
      text: renderDmThreadText({
        persistenceEnabled: state.persistenceEnabled,
        thread: state.thread,
        viewerTelegramUserId: ctx.from.id,
        notice
      }),
      reply_markup: renderDmThreadKeyboard({
        thread: state.thread
      })
    };
  }

  async function buildOperatorDiagnosticsSurface(ctx, { bucket = null, introRequestId = null, notice = null } = {}) {
    const allowed = isOperatorTelegramUser(ctx.from.id);
    if (!allowed) {
      return {
        text: renderOperatorDiagnosticsText({ allowed: false, notice }),
        reply_markup: renderOperatorDiagnosticsKeyboard({ allowed: false })
      };
    }

    const state = await loadNotificationOperatorSurface({ bucket, introRequestId }).catch((error) => ({
      persistenceEnabled: false,
      reason: String(error?.message || error),
      bucket,
      introRequestId,
      diagnostics: null,
      hotRetryDue: [],
      hotFailed: [],
      hotExhausted: []
    }));
    const aiNewsPresetDiagnostics = await loadAiNewsPresetOperatorDiagnostics().catch(() => ({ persistenceEnabled: false, summary: null }));

    return {
      text: renderOperatorDiagnosticsText({
        allowed: true,
        persistenceEnabled: state.persistenceEnabled,
        diagnostics: state.diagnostics,
        bucket: state.bucket,
        introRequestId: state.introRequestId,
        hotRetryDue: state.hotRetryDue,
        hotFailed: state.hotFailed,
        hotExhausted: state.hotExhausted,
        notice,
        aiNewsConfig: getAiNewsDraftConfig()
      }),
      reply_markup: renderOperatorDiagnosticsKeyboard({
        allowed: true,
        bucket: state.bucket,
        introRequestId: state.introRequestId,
        diagnostics: state.diagnostics,
        hotRetryDue: state.hotRetryDue,
        hotFailed: state.hotFailed,
        hotExhausted: state.hotExhausted
      })
    };
  }


  async function buildIntroInboxSurface(ctx, notice = null) {
    const state = await loadIntroInboxState({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null
    }).catch((error) => {
      console.warn('[intro inbox] load failed', error?.message || error);
      return {
        persistenceEnabled: false,
        inbox: null,
        reason: 'intro_inbox_load_failed'
      };
    });

    const contactState = state.persistenceEnabled
      ? await loadContactUnlockInboxState({
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username || null
      }).catch((error) => {
        console.warn('[contact unlock inbox] load failed', error?.message || error);
        return { persistenceEnabled: true, inbox: null, reason: 'contact_unlock_inbox_load_failed' };
      })
      : { persistenceEnabled: false, inbox: null };

    return {
      text: renderIntroInboxText({
        persistenceEnabled: state.persistenceEnabled,
        inboxState: state.inbox,
        contactUnlockInbox: contactState.inbox,
        notice
      }),
      reply_markup: renderIntroInboxKeyboard({
        inboxState: state.inbox,
        contactUnlockInbox: contactState.inbox
      })
    };
  }

  return {
    buildHomeSurface,
    buildHelpSurface,
    buildInviteSurface,
    buildInviteLinkSurface,
    buildInvitePerformanceSurface,
    buildInviteHistorySurface,
    buildInviteRewardsSurface,
    buildInviteCardMessage,
    buildPricingSurface,
    buildProfileMenuSurface,
    buildProfilePreviewSurface,
    buildProfileSkillsSurface,
    buildProfileOptionalSurface,
    buildDirectoryListSurface,
    buildDirectoryCardSurface,
    buildContactRequestSurface,
    buildContactInboxSurface,
    buildDirectoryFiltersSurface,
    buildIntroDetailSurface,
    buildContactUnlockDetailSurface,
    buildIntroInboxSurface,
    buildDmInboxSurface,
    buildDmThreadSurface,
    buildOperatorDiagnosticsSurface
  };
}
