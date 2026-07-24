import { readFileSync, existsSync } from 'node:fs';
import {
  renderInviteKeyboard,
  renderInvitePerformanceKeyboard,
  renderInviteHistoryKeyboard,
  renderInviteRewardsKeyboard,
  renderInviteRewardsText,
  renderInviteText
} from '../src/lib/telegram/render.js';

const inviteComposerPath = new URL('../src/bot/composers/inviteComposer.js', import.meta.url);
const createBotPath = new URL('../src/bot/createBot.js', import.meta.url);
const appSurfacesPath = new URL('../src/bot/surfaces/appSurfaces.js', import.meta.url);
const adminSurfacesPath = new URL('../src/bot/surfaces/adminSurfaces.js', import.meta.url);
const operatorComposerPath = new URL('../src/bot/composers/operatorComposer.js', import.meta.url);
const inviteStorePath = new URL('../src/lib/storage/inviteStore.js', import.meta.url);
const inviteRepoPath = new URL('../src/db/inviteRepo.js', import.meta.url);
const currentStatePath = new URL('../doc/00_CURRENT_STATE.md', import.meta.url);
const specPath = new URL('../doc/spec/STEP052.4_INVITE_REWARDS_READ_SURFACES.md', import.meta.url);

const inviteComposer = readFileSync(inviteComposerPath, 'utf8');
for (const token of ["buildInviteRewardsSurface", "composer.callbackQuery('invite:points'"] ) {
  if (!inviteComposer.includes(token)) {
    throw new Error(`Invite composer missing token: ${token}`);
  }
}

const createBotSource = readFileSync(createBotPath, 'utf8');
if (!createBotSource.includes('buildInviteRewardsSurface')) {
  throw new Error('createBot must wire buildInviteRewardsSurface into invite composer');
}

const appSurfacesSource = readFileSync(appSurfacesPath, 'utf8');
for (const token of ['loadInviteRewardsSummaryState', 'buildInviteRewardsSurface', 'renderInviteRewardsText', 'renderInviteRewardsKeyboard']) {
  if (!appSurfacesSource.includes(token)) {
    throw new Error(`App surfaces missing rewards read token: ${token}`);
  }
}

const inviteStore = readFileSync(inviteStorePath, 'utf8');
for (const token of ['loadInviteRewardsSummaryState', 'listInviteRewardEventsByUserId', 'getAdminInviteRewardsSnapshot']) {
  if (!inviteStore.includes(token)) {
    throw new Error(`Invite store missing STEP052.4 read token: ${token}`);
  }
}

const inviteRepo = readFileSync(inviteRepoPath, 'utf8');
for (const token of ['export async function listInviteRewardEventsByUserId', 'export async function getAdminInviteRewardsSnapshot']) {
  if (!inviteRepo.includes(token)) {
    throw new Error(`Invite repo missing STEP052.4 export: ${token}`);
  }
}

const adminSurfaces = readFileSync(adminSurfacesPath, 'utf8');
for (const token of ['Главный обзор invite-потока', 'Экран режима и балансов rewards-программы', 'Экран подтверждения pending-наград']) {
  if (!adminSurfaces.includes(token)) {
    throw new Error(`Admin invite read truth missing token: ${token}`);
  }
}

const operatorComposer = readFileSync(operatorComposerPath, 'utf8');
if (!operatorComposer.includes('topRewardInviters')) {
  throw new Error('Operator composer fallback must tolerate rewards read truth');
}

const inviteKeyboard = JSON.stringify(renderInviteKeyboard({
  inviteState: {
    persistenceEnabled: true,
    inviteLink: 'https://t.me/example?start=ii_demo',
    shareInlineQuery: 'invite',
    rewardsSummary: { mode: 'earn_only', pendingPoints: 10, availablePoints: 0, redeemedPoints: 0 }
  }
}).inline_keyboard);
if (!inviteKeyboard.includes('invite:points')) {
  throw new Error('Invite root keyboard must expose Points entry');
}

const perfKeyboard = JSON.stringify(renderInvitePerformanceKeyboard({ inviteState: { rewardsSummary: { mode: 'earn_only' } } }).inline_keyboard);
if (!perfKeyboard.includes('invite:points')) {
  throw new Error('Invite performance keyboard must expose Points entry');
}

const historyKeyboard = JSON.stringify(renderInviteHistoryKeyboard({
  inviteState: { invitedCount: 0, shareInlineQuery: 'invite', rewardsSummary: { mode: 'earn_only' } },
  historyState: { page: 1, hasPrev: false, hasNext: false }
}).inline_keyboard);
if (!historyKeyboard.includes('invite:points')) {
  throw new Error('Invite history keyboard must expose Points entry');
}

const rewardsKeyboard = JSON.stringify(renderInviteRewardsKeyboard().inline_keyboard);
for (const token of ['invite:root', 'invite:activity', 'invite:hist:1']) {
  if (!rewardsKeyboard.includes(token)) {
    throw new Error(`Points keyboard missing ${token}`);
  }
}

const rewardsText = renderInviteRewardsText({
  rewardsState: {
    rewardsSummary: {
      mode: 'earn_only',
      config: { activationConfirmHours: 24 },
      pendingPoints: 10,
      availablePoints: 0,
      redeemedPoints: 0
    },
    activationHint: 'the invited member connected LinkedIn and reached listed-ready state',
    recentEvents: [{ invitedDisplayName: 'Alice', points: 10, status: 'pending', confirmAfter: '2026-04-15T10:00:00Z' }]
  }
});
for (const token of ['Only available points can be spent', 'Mode: earn only', 'Recent reward events']) {
  if (!rewardsText.includes(token)) {
    throw new Error(`Points text missing token: ${token}`);
  }
}

const inviteText = renderInviteText({
  inviteState: {
    persistenceEnabled: true,
    inviteCode: 'ABC123',
    inviteLink: 'https://t.me/example?start=ii_demo',
    invitedCount: 2,
    activatedCount: 1,
    rewardsSummary: { mode: 'earn_only', pendingPoints: 10, availablePoints: 0 }
  }
});
if (!inviteText.includes('Available points: 0') || !inviteText.includes('Invite activity and rewards are tracked automatically')) {
  throw new Error('Invite root text must show bounded rewards context without dense navigation copy');
}

const currentState = readFileSync(currentStatePath, 'utf8');
if (!currentState.includes('STEP052.4 — Invite Rewards Read Surfaces + Founder Read Truth') && !currentState.includes('STEP052.5 — Invite Rewards Redeem Foundation + Founder Mode Controls')) {
  throw new Error('Current state doc must remain on STEP052.4+ rewards corridor');
}

if (!existsSync(specPath)) {
  throw new Error('Missing STEP052.4 spec doc');
}
