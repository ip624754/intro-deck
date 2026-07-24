import { localizeMemberSurface } from '../../lib/telegram/memberLocalization.js';

const MEMBER_SURFACE_BUILDERS = Object.freeze([
  'buildHomeSurface',
  'buildHelpSurface',
  'buildLanguageSettingsSurface',
  'buildPricingSurface',
  'buildProfileMenuSurface',
  'buildProfilePreviewSurface',
  'buildLinkedInSharePerformanceSurface',
  'buildLinkedInSharePerformancePostSurface',
  'buildProfileSkillsSurface',
  'buildProfileOptionalSurface',
  'buildDirectoryListSurface',
  'buildDirectoryCardSurface',
  'buildContactRequestSurface',
  'buildContactInboxSurface',
  'buildDirectoryFiltersSurface',
  'buildIntroDetailSurface',
  'buildContactUnlockDetailSurface',
  'buildIntroInboxSurface',
  'buildDmInboxSurface',
  'buildDmThreadSurface',
  'buildInviteSurface',
  'buildInviteLinkSurface',
  'buildInvitePerformanceSurface',
  'buildInviteHistorySurface',
  'buildInviteRewardsSurface',
  'buildInviteCardMessage'
]);

export function createLocalizedSurfaceBuilders(builders) {
  const localized = { ...builders };
  for (const key of MEMBER_SURFACE_BUILDERS) {
    const builder = builders?.[key];
    if (typeof builder !== 'function') continue;
    localized[key] = async (ctx, ...args) => localizeMemberSurface(
      await builder(ctx, ...args),
      ctx?.interfaceLanguage || 'en'
    );
  }
  return localized;
}
