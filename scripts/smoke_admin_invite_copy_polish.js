import { createAdminSurfaceBuilders } from '../src/bot/surfaces/adminSurfaces.js';

const builders = createAdminSurfaceBuilders({ currentStep: 'STEP052.8.1' });

const overview = await builders.buildAdminInviteSurface({
  state: {
    snapshot: {
      summary: {
        totalInvites: 4,
        activatedInvites: 1,
        activationRate: 25,
        inlineShareCount: 1,
        rawLinkCount: 2,
        inviteCardCount: 1,
        joined7d: 2,
        activated7d: 1
      },
      topInviters: [{ displayName: 'Alice', invitedCount: 4, activatedCount: 1, activationRate: 25 }],
      recentInvites: [{ referrerDisplayName: 'Alice', displayName: 'Bob', status: 'joined', source: 'invite_card', joinedAt: '2026-04-14T10:00:00Z' }]
    },
    activationHint: 'the invited member connected LinkedIn or started a profile',
    rewards: { mode: 'off' }
  },
  view: 'overview'
});

for (const fragment of ['Вход, активация и источники приглашений.', 'Сводка:', 'Источники:']) {
  if (!overview.text.includes(fragment)) {
    throw new Error(`Overview copy missing fragment: ${fragment}`);
  }
}
if (overview.text.includes('<b>')) {
  throw new Error('Admin invite overview should not leak raw HTML markup');
}

const rewards = await builders.buildAdminInviteSurface({
  state: {
    rewards: {
      mode: 'earn_only',
      totals: { pendingPoints: 10, pendingEntries: 1, availablePoints: 0, availableEntries: 0, redeemedPoints: 0, redeemedEntries: 0, pendingCandidates: 1, pendingDue: 0 },
      config: { activationPoints: 10, activationConfirmHours: 24 },
      topRewardInviters: [],
      recentRewardEvents: []
    },
    snapshot: { summary: {}, topInviters: [], recentInvites: [] }
  },
  view: 'rewards'
});

for (const fragment of ['Режим и балансы программы наград.', 'Режим:', 'Балансы:']) {
  if (!rewards.text.includes(fragment)) {
    throw new Error(`Rewards copy missing fragment: ${fragment}`);
  }
}
const keyboard = JSON.stringify(rewards.reply_markup.inline_keyboard);
for (const token of ['Награды', 'Подтверждение', 'История режима']) {
  if (!keyboard.includes(token)) {
    throw new Error(`Invite admin keyboard missing polished label: ${token}`);
  }
}

console.log('OK: admin invite copy polish');
