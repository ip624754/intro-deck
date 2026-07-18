import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { computeDatabaseFingerprint, getNodeRuntimeState, parseDatabaseIdentity } from './step053a/runtimeAcceptanceLib.js';
import { MANUAL_SCENARIOS } from './step053a/stagingEvidence.js';

const root = new URL('../', import.meta.url);
const read = (relative) => fs.readFileSync(new URL(relative, root), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const env = read('.env.example');
const gitignore = read('.gitignore');
const release = read('src/config/release.js');
const health = read('api/health.js');
const createBot = read('src/bot/createBot.js');
const runtimeLib = read('scripts/step053a/runtimeAcceptanceLib.js');
const preflight = read('scripts/step053a/stagingPreflight.js');
const dbAcceptance = read('scripts/step053a/stagingDbAcceptance.js');
const evidence = read('scripts/step053a/stagingEvidence.js');
const runbook = read('doc/77_STEP053A_STAGING_RUNTIME_ACCEPTANCE_RUNBOOK.md');
const spec = read('doc/spec/STEP053A_STAGING_RUNTIME_ACCEPTANCE_PACK.md');

for (const script of ['step053a:preflight', 'step053a:database', 'step053a:evidence:init', 'step053a:evidence:verify', 'smoke:step053a-pack']) {
  assert.ok(packageJson.scripts[script], `Missing package script ${script}`);
}
for (const key of ['STEP053A_TARGET', 'STEP053A_MUTATION_ACK', 'STEP053A_DATABASE_ACK', 'STEP053A_EVIDENCE_DIR', 'STEP053A_ARTIFACT_SHA']) {
  assert.match(env, new RegExp(`^${key}=`, 'm'), `.env.example missing ${key}`);
}
assert.match(gitignore, /runtime_evidence\//);
assert.match(release, /CURRENT_SOURCE_STEP = 'STEP053A'/);
assert.match(health, /step: CURRENT_SOURCE_STEP/);
assert.match(health, /docsStep: CURRENT_SOURCE_STEP/);
assert.match(health, /artifactSha: getRuntimeArtifactSha\(\)/);
assert.match(createBot, /currentStep: CURRENT_SOURCE_STEP/);
for (const token of ['migration_027_required_tables', 'telegram_webhook_secret_configured', 'telegram_webhook_recent_error', 'payment_charge_ambiguity_preflight', 'impossible_financial_states', 'postgres_advisory_lock_support', 'telegram_getme', 'deployed_health']) {
  assert.match(preflight, new RegExp(token));
}
for (const token of ['intro_only_authoritative', 'concurrent_precheckout_serialization', 'payment_charge_replay_guards', 'pro_combined_allowance_concurrency', 'fixture_cleanup']) {
  assert.match(dbAcceptance, new RegExp(token));
}
assert.match(runtimeLib, /ALLOW_STEP053A_STAGING_FIXTURES/);
assert.match(runtimeLib, /STEP053A_DATABASE_ACK/);
assert.match(runtimeLib, /STEP053A_ARTIFACT_SHA/);
assert.match(dbAcceptance, /createOrGetContactUnlockRequest/);
assert.match(dbAcceptance, /createOrGetDmThreadDraft/);
assert.match(dbAcceptance, /getProOutreachAllowance/);
assert.match(dbAcceptance, /left\(telegram_username, length\(\$1\)\) = \$1/);
assert.doesNotMatch(dbAcceptance, /telegram_username like/);
assert.match(evidence, /operatorVerdict must be GO/);
assert.match(evidence, /database fingerprints do not match/);
assert.match(evidence, /artifact SHA does not match manual evidence/);
assert.equal(MANUAL_SCENARIOS.length, 13);
assert.match(runbook, /NOT live-confirmed/i);
assert.match(runbook, /Node 20/i);
assert.match(runbook, /DATABASE_ACK/);
assert.match(spec, /fails closed/i);

const sample = 'postgresql://alice:secret@staging-db.example.com:5432/introdeck_staging?sslmode=require';
assert.deepEqual(parseDatabaseIdentity(sample), {
  protocol: 'postgresql',
  host: 'staging-db.example.com',
  port: '5432',
  database: 'introdeck_staging',
  user: 'alice',
  sslmode: 'require'
});
assert.equal(computeDatabaseFingerprint(sample), computeDatabaseFingerprint(sample));
assert.equal(computeDatabaseFingerprint(sample).length, 16);
assert.equal(typeof getNodeRuntimeState({ allowMismatch: true }).version, 'string');

console.log('OK: STEP053A staging runtime acceptance pack contract');
