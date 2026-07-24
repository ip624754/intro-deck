import { createAdminSurfaceBuilders } from '../src/bot/surfaces/adminSurfaces.js';
import {
  renderInviteCardKeyboard,
  renderInviteKeyboard,
  renderInviteLinkKeyboard,
  renderInviteRewardsKeyboard,
  renderInviteText
} from '../src/lib/telegram/render.js';

const builders = createAdminSurfaceBuilders({ currentStep: 'STEP052.8' });
const state = {
  snapshot: {
    summary: {
      totalInvites: 9,
      activatedInvites: 4,
      activationRate: 44.4,
      inlineShareCount: 5,
      rawLinkCount: 3,
      inviteCardCount: 1,
      joined7d: 3,
      activated7d: 2
    },
    topInviters: [{ displayName: 'Alice', invitedCount: 3, activatedCount: 2, activationRate: 66.7 }],
    recentInvites: [{ referrerDisplayName: 'Alice', displayName: 'Bob', status: 'activated', source: 'invite_card', joinedAt: '2026-04-14T12:00:00Z' }]
  },
  rewards: {
    mode: 'live',
    config: { activationPoints: 10, activationConfirmHours: 24 },
    totals: {
      pendingPoints: 10,
      pendingEntries: 1,
      availablePoints: 20,
      availableEntries: 2,
      redeemedPoints: 30,
      redeemedEntries: 3,
      pendingCandidates: 1,
      pendingDue: 0,
      confirmedToday: 1,
      rejectedToday: 0
    },
    topRewardInviters: [{ displayName: 'Alice', totalPoints: 40, pendingPoints: 10, availablePoints: 20 }],
    recentRewardEvents: [{ referrerDisplayName: 'Alice', invitedDisplayName: 'Bob', status: 'pending', points: 10, confirmAfter: '2026-04-15T12:00:00Z' }],
    lastSettlementRun: { settlementRunId: 'run_123', status: 'completed', modeSnapshot: 'live', processedCount: 1, confirmedCount: 1, rejectedCount: 0, skippedCount: 0, startedAt: '2026-04-15T12:00:00Z', finishedAt: '2026-04-15T12:01:00Z' },
    reconciliation: { warningCount: 0, completedRedemptions: 1, sampleWarnings: [] },
    modeAudit: [{ changedByDisplayName: 'Founder', fromMode: 'earn_only', toMode: 'live', createdAt: '2026-04-15T11:00:00Z' }]
  },
  activationHint: 'connected LinkedIn or started a profile'
};

for (const view of ['overview', 'rewards', 'settlement', 'audit']) {
  const surface = await builders.buildAdminInviteSurface({ state, view });
  if (!surface.reply_markup?.inline_keyboard?.length) {
    throw new Error(`Admin invite ${view} view must have keyboard navigation`);
  }
}

const rewardsKeyboard = JSON.stringify((await builders.buildAdminInviteSurface({ state, view: 'rewards' })).reply_markup.inline_keyboard);
for (const token of ['adm:invite:overview', 'adm:invite:settlement', 'adm:invite:mode:off', 'adm:invite:mode:live']) {
  if (!rewardsKeyboard.includes(token)) {
    throw new Error(`Rewards admin view missing ${token}`);
  }
}

const settlementKeyboard = JSON.stringify((await builders.buildAdminInviteSurface({ state, view: 'settlement' })).reply_markup.inline_keyboard);
for (const token of ['adm:invite:settlement:run', 'adm:invite:settlement:reconcile', 'adm:invite:rewards']) {
  if (!settlementKeyboard.includes(token)) {
    throw new Error(`Settlement admin view missing ${token}`);
  }
}

const inviteText = renderInviteText({
  inviteState: {
    persistenceEnabled: true,
    inviteLink: 'https://t.me/example?start=ii_demo',
    inviteCode: 'ABC123',
    invitedCount: 2,
    activatedCount: 1,
    rewardsSummary: { mode: 'live', pendingPoints: 10, availablePoints: 20 }
  }
});
if (!inviteText.includes('Share your personal Intro Deck invite') || !inviteText.includes('Points: 20')) {
  throw new Error('Invite root must explain simplified share actions and bounded points state');
}

const inviteKeyboard = JSON.stringify(renderInviteKeyboard({ inviteState: { persistenceEnabled: true, inviteLink: 'https://t.me/example?start=ii_demo', shareInlineQuery: 'invite', rewardsSummary: { mode: 'live' } } }).inline_keyboard);
for (const token of ['invite:send_card', 'invite:show_link', 'invite:activity', 'invite:points']) {
  if (!inviteKeyboard.includes(token)) {
    throw new Error(`Invite root keyboard missing ${token}`);
  }
}

const linkKeyboard = JSON.stringify(renderInviteLinkKeyboard().inline_keyboard);
if (!linkKeyboard.includes('invite:root') || !linkKeyboard.includes('home:root')) {
  throw new Error('Invite link screen must allow returning to invite root and home');
}

const cardKeyboard = JSON.stringify(renderInviteCardKeyboard({ inviteState: { inviteCardLink: 'https://t.me/example?start=ic_demo' } }).inline_keyboard);
if (!cardKeyboard.includes('Open Intro Deck') || cardKeyboard.includes('callback_data')) {
  throw new Error('Public invite card must expose one URL CTA and no owner navigation callbacks');
}

const pointsKeyboard = JSON.stringify(renderInviteRewardsKeyboard({ rewardsState: { rewardsSummary: { mode: 'live' } } }).inline_keyboard);
for (const token of ['invite:redeem', 'invite:root', 'invite:hist:1', 'invite:activity']) {
  if (!pointsKeyboard.includes(token)) {
    throw new Error(`Points screen missing ${token}`);
  }
}

console.log('OK: admin/invite navigation polish');
