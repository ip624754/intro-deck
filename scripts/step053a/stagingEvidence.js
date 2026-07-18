import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeRunId, parseCliArgs, sha256File } from './runtimeAcceptanceLib.js';

export const MANUAL_SCENARIOS = [
  ['telegram_intro_only_buttons', 'Intro-only card shows no paid contact or DM buttons'],
  ['telegram_mode_switch_precheckout', 'Both pre-checkout paths reject after target switches to intro-only'],
  ['telegram_paid_contact_once', 'Paid direct-contact request reaches paid_pending_approval once'],
  ['telegram_paid_dm_once', 'Paid DM request reaches pending_recipient once'],
  ['telegram_wrong_currency_amount', 'Wrong currency or amount is rejected before authorization'],
  ['telegram_duplicate_successful_payment', 'Duplicate successful-payment update does not create a second receipt or request notification'],
  ['telegram_cross_entity_charge_replay', 'A charge cannot be reused for another entity'],
  ['telegram_concurrent_precheckout', 'Two near-simultaneous pre-checkout callbacks yield one authorization'],
  ['telegram_pro_allowance', 'Pro deliveries share one rolling allowance and increment once'],
  ['telegram_pro_paid_fallback', 'The first request after the configured Pro limit offers paid fallback (11th at the default limit)'],
  ['telegram_stale_draft_after_decline', 'Stale Pro DM draft is blocked after cross-rail decline'],
  ['telegram_block_closes_rails', 'Recipient block prevents a new direct-contact request'],
  ['telegram_copy_terms_parity', 'Bot pricing, invoice disclosure, receipt, and Terms state the same fee/fair-use contract']
];

function template(outputPath) {
  const payload = {
    schemaVersion: 1,
    step: 'STEP053A',
    runId: makeRunId('step053a-manual'),
    target: 'staging',
    operator: '',
    commitOrArtifactSha: '',
    stagingUrl: '',
    executedAt: '',
    runtime: { nodeVersion: '', postgresVersion: '', telegramBotUsername: '' },
    automatedEvidence: {
      preflightPath: '',
      preflightSha256: '',
      databaseRuntimePath: '',
      databaseRuntimeSha256: ''
    },
    scenarios: MANUAL_SCENARIOS.map(([id, description]) => ({ id, description, status: 'BLOCKED', observedAt: '', evidence: [], notes: '' })),
    operatorVerdict: 'BLOCKED'
  };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(outputPath);
}

function loadEvidence(filePath) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (payload.step !== 'STEP053A') throw new Error('Evidence step must be STEP053A');
  if (payload.target !== 'staging') throw new Error('Evidence target must be staging');
  return payload;
}

function isIsoTimestamp(value) {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

function isArtifactSha(value) {
  return /^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(String(value || '').trim());
}

function verifyHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function verifyFile(pathValue, expectedSha, label, expectedPhase) {
  if (!pathValue) throw new Error(`${label} path is required`);
  const absolute = path.resolve(pathValue);
  if (!fs.existsSync(absolute)) throw new Error(`${label} file does not exist: ${absolute}`);
  const actual = sha256File(absolute);
  if (!/^[a-f0-9]{64}$/i.test(String(expectedSha || ''))) throw new Error(`${label} expected SHA-256 is required`);
  if (actual !== String(expectedSha).toLowerCase()) throw new Error(`${label} SHA mismatch: expected ${expectedSha}, got ${actual}`);
  const payload = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (payload.step !== 'STEP053A') throw new Error(`${label} step must be STEP053A`);
  if (payload.target !== 'staging') throw new Error(`${label} target must be staging`);
  if (payload.phase !== expectedPhase) throw new Error(`${label} phase must be ${expectedPhase}, got ${payload.phase}`);
  if (payload.verdict !== 'PASS') throw new Error(`${label} verdict must be PASS, got ${payload.verdict}`);
  if (!String(payload.runtime?.node || '').startsWith('20.')) throw new Error(`${label} must be captured on Node 20.x`);
  if (!/^[a-f0-9]{16}$/i.test(String(payload.databaseFingerprint || ''))) throw new Error(`${label} requires a database fingerprint`);
  if (!isArtifactSha(payload.artifactSha)) throw new Error(`${label} requires an artifact SHA`);
  return { absolute, sha256: actual, payload };
}

function verify(filePath) {
  const payload = loadEvidence(filePath);
  if (!String(payload.runId || '').trim()) throw new Error('runId is required');
  const requiredIds = new Set(MANUAL_SCENARIOS.map(([id]) => id));
  const seen = new Set();
  for (const scenario of payload.scenarios || []) {
    if (!requiredIds.has(scenario.id)) continue;
    if (seen.has(scenario.id)) throw new Error(`Duplicate scenario: ${scenario.id}`);
    seen.add(scenario.id);
    if (scenario.status !== 'PASS') throw new Error(`Scenario ${scenario.id} must be PASS, got ${scenario.status}`);
    if (!isIsoTimestamp(scenario.observedAt)) throw new Error(`Scenario ${scenario.id} requires a valid observedAt timestamp`);
    if (!Array.isArray(scenario.evidence) || scenario.evidence.length === 0 || scenario.evidence.some((item) => !String(item || '').trim())) {
      throw new Error(`Scenario ${scenario.id} requires non-empty evidence references`);
    }
  }
  if ((payload.scenarios || []).length !== requiredIds.size) throw new Error(`Expected exactly ${requiredIds.size} scenarios`);
  const missing = [...requiredIds].filter((id) => !seen.has(id));
  if (missing.length) throw new Error(`Missing scenarios: ${missing.join(', ')}`);
  if (!String(payload.runtime?.nodeVersion || '').startsWith('20.')) throw new Error('Manual evidence must be captured on Node 20.x');
  if (!String(payload.runtime?.postgresVersion || '').trim()) throw new Error('Manual evidence requires postgresVersion');
  if (!String(payload.runtime?.telegramBotUsername || '').trim()) throw new Error('Manual evidence requires telegramBotUsername');
  if (payload.operatorVerdict !== 'GO') throw new Error('operatorVerdict must be GO');
  if (!String(payload.operator || '').trim()) throw new Error('operator is required');
  if (!isIsoTimestamp(payload.executedAt)) throw new Error('executedAt must be a valid timestamp');
  if (!verifyHttpsUrl(payload.stagingUrl)) throw new Error('stagingUrl must be a valid HTTPS URL');
  if (!isArtifactSha(payload.commitOrArtifactSha)) throw new Error('commitOrArtifactSha must be a 40- or 64-character hexadecimal SHA');

  const preflight = verifyFile(payload.automatedEvidence?.preflightPath, payload.automatedEvidence?.preflightSha256, 'Preflight evidence', 'preflight');
  const database = verifyFile(payload.automatedEvidence?.databaseRuntimePath, payload.automatedEvidence?.databaseRuntimeSha256, 'Database runtime evidence', 'database-runtime');
  if (preflight.payload.databaseFingerprint !== database.payload.databaseFingerprint) throw new Error('Automated evidence database fingerprints do not match');
  const manualArtifactSha = String(payload.commitOrArtifactSha).toLowerCase();
  if (preflight.payload.artifactSha !== manualArtifactSha || database.payload.artifactSha !== manualArtifactSha) {
    throw new Error('Automated evidence artifact SHA does not match manual evidence');
  }

  const reportPath = path.join(path.dirname(path.resolve(filePath)), 'STEP053A_STAGING_ACCEPTANCE_REPORT.md');
  const lines = [
    '# STEP053A — Staging Runtime Acceptance Report',
    '',
    `- Verdict: **GO**`,
    `- Run ID: \`${payload.runId}\``,
    `- Operator: ${payload.operator}`,
    `- Executed: ${payload.executedAt}`,
    `- Staging URL: ${payload.stagingUrl}`,
    `- Commit / artifact SHA: \`${payload.commitOrArtifactSha}\``,
    `- Node: \`${payload.runtime.nodeVersion}\``,
    `- PostgreSQL: \`${payload.runtime.postgresVersion}\``,
    `- Telegram bot: \`${payload.runtime.telegramBotUsername}\``,
    '',
    '## Automated evidence',
    '',
    `- Preflight: \`${preflight.absolute}\` — SHA-256 \`${preflight.sha256}\``,
    `- Database runtime: \`${database.absolute}\` — SHA-256 \`${database.sha256}\``,
    '',
    '## Telegram / operator-assisted scenarios',
    '',
    '| Scenario | Result | Evidence |',
    '|---|---|---|',
    ...payload.scenarios.map((scenario) => `| \`${scenario.id}\` | **${scenario.status}** | ${(scenario.evidence || []).join('<br>')} |`),
    '',
    '## Truth boundary',
    '',
    '- This report is valid only for the recorded staging target and artifact SHA.',
    '- It does not prove production deployment or production data safety.',
    '- Refund/dispute execution remains outside STEP053A unless separately evidenced.'
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
  console.log(JSON.stringify({ verdict: 'GO', reportPath }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseCliArgs();
  const command = values[0];
  const filePath = values[1] || 'runtime_evidence/step053a/manual-evidence.json';
  if (command === 'init') {
    template(filePath);
  } else if (command === 'verify') {
    verify(filePath);
  } else {
    throw new Error('Usage: node scripts/step053a/stagingEvidence.js <init|verify> [file]');
  }
}
