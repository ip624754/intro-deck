import { readFileSync } from 'node:fs';
import { createAdminSurfaceBuilders } from '../src/bot/surfaces/adminSurfaces.js';

const createBotSource = readFileSync(new URL('../src/bot/createBot.js', import.meta.url), 'utf8');
const operatorComposerSource = readFileSync(new URL('../src/bot/composers/operatorComposer.js', import.meta.url), 'utf8');
const adminSurfacesSource = readFileSync(new URL('../src/bot/surfaces/adminSurfaces.js', import.meta.url), 'utf8');

if (!createBotSource.includes('buildAdminInviteSurface')) {
  throw new Error('Admin invite surface is not wired into createBot');
}

if (!operatorComposerSource.includes("composer.callbackQuery('adm:invite'")) {
  throw new Error('Admin invite callback is missing');
}

if (!adminSurfacesSource.includes('📨 Инвайты')) {
  throw new Error('Admin operations hub must expose invite entrypoint');
}

const builders = createAdminSurfaceBuilders({ currentStep: 'STEP052' });
const surface = await builders.buildAdminInviteSurface({
  state: {
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
      recentInvites: [{ referrerDisplayName: 'Alice', displayName: 'Bob', status: 'activated', source: 'inline_share', joinedAt: '2026-04-14T12:00:00Z' }]
    },
    activationHint: 'connected LinkedIn or started a profile'
  }
});

if (!surface.text.includes('Сводка:') || !surface.text.includes('Топ приглашающих:') || !surface.text.includes('Последние приглашения:')) {
  throw new Error('Admin invite surface text must expose summary, top inviters, and recent invites');
}

const rewardsSurface = await builders.buildAdminInviteSurface({
  state: {
    snapshot: { summary: { totalInvites: 9, activatedInvites: 4, activationRate: 44.4, inlineShareCount: 5, rawLinkCount: 3, inviteCardCount: 1, joined7d: 3, activated7d: 2 }, topInviters: [], recentInvites: [] },
    rewards: { mode: 'live', totals: { pendingPoints: 10, pendingEntries: 1, availablePoints: 20, availableEntries: 2, redeemedPoints: 30, redeemedEntries: 3, pendingCandidates: 1, pendingDue: 0 }, topRewardInviters: [], recentRewardEvents: [] }
  },
  view: 'rewards'
});
if (!rewardsSurface.text.includes('Режим и балансы программы наград.') || !JSON.stringify(rewardsSurface.reply_markup.inline_keyboard).includes('adm:invite:mode:live')) {
  throw new Error('Admin invite rewards view must expose focused rewards text and mode controls');
}

const keyboard = JSON.stringify(surface.reply_markup.inline_keyboard);
for (const token of ['adm:invite:overview', 'adm:ops', 'home:root']) {
  if (!keyboard.includes(token)) {
    throw new Error(`Admin invite keyboard missing ${token}`);
  }
}

console.log('OK: invite admin contract');
