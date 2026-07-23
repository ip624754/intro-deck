import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STEP057_SCENARIOS,
  evaluateProductionReadiness,
  normalizeArtifactSha
} from './step057/productionReadinessLib.js';
import {
  renderContactInboxKeyboard,
  renderContactRequestKeyboard,
  renderDirectoryCardKeyboard,
  renderHomeKeyboard
} from '../src/lib/telegram/render.js';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const env = read('.env.example');
const release = read('src/config/release.js');
const health = read('api/health.js');
const preflight = read('scripts/step057/productionPreflight.js');
const evidence = read('scripts/step057/productionEvidence.js');
const runbook = read('doc/79_STEP057_PRODUCTION_READINESS_RUNBOOK.md');
const spec = read('doc/spec/STEP057_PRODUCTION_READINESS_AND_CORE_LOOP_ACCEPTANCE.md');

for (const script of ['step057:preflight', 'step057:evidence:init', 'step057:evidence:verify', 'smoke:step057-readiness']) {
  assert.ok(packageJson.scripts[script], `Missing package script ${script}`);
}
for (const key of ['STEP057_TARGET', 'STEP057_BASE_URL', 'STEP057_ARTIFACT_SHA', 'STEP057_TELEGRAM_BOT_USERNAME', 'STEP057_EVIDENCE_DIR']) {
  assert.match(env, new RegExp(`^${key}=`, 'm'), `.env.example missing ${key}`);
}
const sourceStep = release.match(/CURRENT_SOURCE_STEP = 'STEP(\d+)([A-Z]?\d*)(?:-([A-Z]\d+[A-Z]?))?'/);
assert.ok(sourceStep, 'Missing current STEP marker');
assert.ok(Number(sourceStep[1]) >= 57, `STEP057 readiness pack must remain forward-compatible, got STEP${sourceStep[1]}${sourceStep[2] || ''}${sourceStep[3] ? `-${sourceStep[3]}` : ''}`);
assert.match(health, /step: CURRENT_SOURCE_STEP/);
assert.match(preflight, /begin read only/i);
assert.match(preflight, /mutatingQueriesExecuted: false/);
assert.match(preflight, /bot<redacted>/);
assert.doesNotMatch(preflight, /for \${url}/);
assert.doesNotMatch(preflight, /\b(insert|update|delete|truncate|alter|drop)\s+(into|table|from)?/i);
for (const token of [
  'deployed_health_artifact_binding',
  'runtime_config_surface',
  'telegram_getme',
  'telegram_webhook_url',
  'telegram_pending_updates',
  'migration_027_runtime_schema',
  'impossible_database_states',
  'directory_supply',
  'notification_delivery_health',
  'contact_policy_runtime'
]) assert.match(preflight, new RegExp(token));
assert.match(evidence, /GO_WITH_RISKS/);
assert.match(evidence, /Node 20 production preflight/);
assert.match(evidence, /read-only production execution/);
assert.match(evidence, /never creates fixtures/i);
assert.match(runbook, /read-only/i);
assert.match(runbook, /GO_WITH_RISKS/);
assert.match(spec, /production-safe/i);
assert.equal(STEP057_SCENARIOS.length, 11);
assert.equal(STEP057_SCENARIOS.filter((item) => item.required).length, 8);
assert.equal(normalizeArtifactSha('a'.repeat(40)), 'a'.repeat(40));
assert.equal(normalizeArtifactSha('nope'), null);

const passScenarios = STEP057_SCENARIOS.map((item) => ({ id: item.id, status: 'PASS' }));
assert.equal(evaluateProductionReadiness({ preflightVerdict: 'PASS', scenarios: passScenarios }).verdict, 'GO');
const optionalNotRun = passScenarios.map((item) => STEP057_SCENARIOS.find((def) => def.id === item.id)?.required ? item : { ...item, status: 'NOT_RUN' });
assert.equal(evaluateProductionReadiness({ preflightVerdict: 'PASS', scenarios: optionalNotRun }).verdict, 'GO_WITH_RISKS');
const requiredNotRun = passScenarios.map((item) => item.id === 'bot_start_home' ? { ...item, status: 'NOT_RUN' } : item);
assert.equal(evaluateProductionReadiness({ preflightVerdict: 'PASS', scenarios: requiredNotRun }).verdict, 'NO_GO');

const profile = { profile_id: 42, display_name: 'Member', headline_user: 'Founder', contact_mode: 'paid_unlock_requires_approval', is_viewer: false };
assert.match(JSON.stringify(renderDirectoryCardKeyboard({ profileSnapshot: profile, page: 0 })), /dir:contact:42:0/);
assert.match(JSON.stringify(renderContactRequestKeyboard({ profileSnapshot: profile, pricingState: { persistenceEnabled: true, profile: { linkedin_sub: 'x' }, pricing: { contactUnlockPriceStars: 75, dmOpenPriceStars: 100 }, subscription: { isActive: false }, proOutreachAllowance: { supported: true, allowed: false, remaining: 0 } }, page: 0 })), /dir:dm:42:0/);
assert.match(JSON.stringify(renderContactInboxKeyboard()), /intro:inbox/);
assert.match(JSON.stringify(renderHomeKeyboard({ persistenceEnabled: true, profileSnapshot: { linkedin_sub: 'x', completion: { isReady: false }, visibility_status: 'hidden' } })), /p:next/);

console.log('OK: STEP057 production readiness and core-loop acceptance pack');
