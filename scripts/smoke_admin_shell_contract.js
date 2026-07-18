import { readFileSync } from 'node:fs';
import { renderHomeKeyboard } from '../src/lib/telegram/render.js';
import { createAdminSurfaceBuilders } from '../src/bot/surfaces/adminSurfaces.js';

const operatorHomeKeyboard = JSON.stringify(renderHomeKeyboard({
  appBaseUrl: 'https://example.com',
  telegramUserId: 42,
  profileSnapshot: { linkedin_sub: 'abc' },
  persistenceEnabled: true,
  isOperator: true
}).inline_keyboard);
if (!operatorHomeKeyboard.includes('adm:home')) {
  throw new Error('Operator home keyboard must expose the admin shell entrypoint');
}
if (operatorHomeKeyboard.includes('ops:diag')) {
  throw new Error('Operator home keyboard must not expose the legacy diagnostics callback directly');
}

const surfaces = createAdminSurfaceBuilders({ currentStep: 'STEP043' });
const adminHome = await surfaces.buildAdminHomeSurface();
if (!adminHome.text.includes('👑 Админка')) {
  throw new Error('Admin home surface must expose the Russian admin title');
}
for (const callback of ['adm:ops', 'adm:comms', 'adm:sys', 'adm:ops:funnel:conn_noprofile', 'adm:ops:funnel:ready_not_listed', 'home:root']) {
  if (!JSON.stringify(adminHome.reply_markup.inline_keyboard).includes(callback)) {
    throw new Error(`Admin home keyboard missing ${callback}`);
  }
}

const operatorComposerSource = readFileSync(new URL('../src/bot/composers/operatorComposer.js', import.meta.url), 'utf8');
for (const fragment of ['adm:home:funnel:', 'adm:ops:funnel:', 'adm:comms:funnel:', 'adm:sys:funnel:']) {
  if (!operatorComposerSource.includes(fragment)) {
    throw new Error(`Operator composer missing funnel routing fragment: ${fragment}`);
  }
}

const createBotSource = readFileSync(new URL('../src/bot/createBot.js', import.meta.url), 'utf8');
if (!createBotSource.includes("import { CURRENT_SOURCE_STEP } from '../config/release.js'") || !createBotSource.includes('currentStep: CURRENT_SOURCE_STEP')) {
  throw new Error('Bot factory must wire admin surfaces to the canonical release step marker');
}

console.log('OK: admin shell contract');
