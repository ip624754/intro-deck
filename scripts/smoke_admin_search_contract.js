import { readFileSync } from 'node:fs';
import { createAdminSurfaceBuilders } from '../src/bot/surfaces/adminSurfaces.js';

const repoSource = readFileSync(new URL('../src/db/adminRepo.js', import.meta.url), 'utf8');
for (const needle of ['ADMIN_SEARCH_SCOPES', 'searchAdminUsersPage', 'searchAdminIntrosPage', 'searchAdminDeliveryPage', 'searchAdminOutboxPage', 'searchAdminAuditPage']) {
  if (!repoSource.includes(needle)) {
    throw new Error(`Admin repo missing search contract: ${needle}`);
  }
}

const composerSource = readFileSync(new URL('../src/bot/composers/operatorComposer.js', import.meta.url), 'utf8');
for (const needle of ['adm:search:(users|intros|delivery|outbox|audit)', 'beginAdminScopedSearchPrompt', 'loadAdminSearchResults']) {
  if (!composerSource.includes(needle)) {
    throw new Error(`Operator composer missing search route: ${needle}`);
  }
}

const surfaces = createAdminSurfaceBuilders({ currentStep: 'STEP039' });
const users = await surfaces.buildAdminUsersSurface({ state: { persistenceEnabled: true, segmentKey: 'all', page: 0, pageSize: 8, totalCount: 0, counts: {}, users: [] } });
const usersKeyboard = JSON.stringify(users.reply_markup.inline_keyboard);
if (!usersKeyboard.includes('adm:search:users')) throw new Error('Users surface missing search shortcut');
const intros = await surfaces.buildAdminIntrosSurface({ state: { persistenceEnabled: true, segmentKey: 'all', page: 0, pageSize: 8, totalCount: 0, counts: {}, intros: [] } });
if (!JSON.stringify(intros.reply_markup.inline_keyboard).includes('adm:search:intros')) throw new Error('Intros surface missing search shortcut');
const delivery = await surfaces.buildAdminDeliverySurface({ state: { persistenceEnabled: true, segmentKey: 'all', page: 0, pageSize: 8, totalCount: 0, counts: {}, records: [] } });
if (!JSON.stringify(delivery.reply_markup.inline_keyboard).includes('adm:search:delivery')) throw new Error('Delivery surface missing search shortcut');
const audit = await surfaces.buildAdminAuditSurface({ state: { persistenceEnabled: true, segmentKey: 'all', page: 0, pageSize: 8, totalCount: 0, records: [] } });
if (!JSON.stringify(audit.reply_markup.inline_keyboard).includes('adm:search:audit')) throw new Error('Audit surface missing search shortcut');

console.log('OK: admin search contract');
