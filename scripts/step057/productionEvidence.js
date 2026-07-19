import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  STEP057_SCENARIOS,
  assertEvidenceReference,
  evaluateProductionReadiness,
  normalizeArtifactSha,
  parseCliArgs,
  sha256File
} from './productionReadinessLib.js';

function isIsoTimestamp(value) {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

export function createTemplate(filePath) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const payload = {
    schemaVersion: 1,
    step: 'STEP057',
    runId: `step057-manual-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    operator: '',
    executedAt: '',
    productionUrl: 'https://intro-deck.vercel.app',
    commitOrArtifactSha: '',
    automatedEvidence: {
      preflightPath: '',
      preflightSha256: ''
    },
    scenarios: STEP057_SCENARIOS.map((scenario) => ({
      id: scenario.id,
      required: scenario.required,
      status: 'NOT_RUN',
      evidence: [],
      notes: ''
    }))
  };
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ created: absolute, scenarios: payload.scenarios.length }, null, 2));
}

function loadPreflight(payload) {
  const absolute = path.resolve(payload.automatedEvidence?.preflightPath || '');
  if (!fs.existsSync(absolute)) throw new Error('Preflight evidence file does not exist');
  const actualSha = sha256File(absolute);
  if (actualSha !== String(payload.automatedEvidence?.preflightSha256 || '').toLowerCase()) {
    throw new Error('Preflight evidence SHA-256 mismatch');
  }
  const evidence = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (evidence.step !== 'STEP057' || evidence.phase !== 'production-preflight') {
    throw new Error('Preflight evidence has the wrong step or phase');
  }
  if (!String(evidence.runtime?.node || '').startsWith('20.')) {
    throw new Error('Release evidence requires a Node 20 production preflight');
  }
  if (evidence.safety?.mutatingQueriesExecuted !== false || evidence.safety?.transactionMode !== 'READ ONLY') {
    throw new Error('Preflight evidence does not prove read-only production execution');
  }
  return { absolute, actualSha, evidence };
}

export function verifyEvidence(filePath) {
  const absolute = path.resolve(filePath);
  const payload = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (payload.step !== 'STEP057') throw new Error('Manual evidence step must be STEP057');
  if (!String(payload.operator || '').trim()) throw new Error('operator is required');
  if (!isIsoTimestamp(payload.executedAt)) throw new Error('executedAt must be a valid timestamp');
  let productionUrl;
  try { productionUrl = new URL(payload.productionUrl); } catch { throw new Error('productionUrl must be a valid URL'); }
  if (productionUrl.protocol !== 'https:') throw new Error('productionUrl must use HTTPS');
  const artifactSha = normalizeArtifactSha(payload.commitOrArtifactSha);
  if (!artifactSha) throw new Error('commitOrArtifactSha must be a valid SHA');

  const preflight = loadPreflight(payload);
  if (preflight.evidence.artifactSha !== artifactSha || preflight.evidence.healthArtifactSha !== artifactSha) {
    throw new Error('Preflight artifact binding does not match manual evidence');
  }
  if (preflight.evidence.target?.baseUrl !== productionUrl.toString().replace(/\/$/, '')) {
    throw new Error('Preflight production URL does not match manual evidence');
  }

  const scenarioIds = new Set((payload.scenarios || []).map((scenario) => scenario.id));
  const missing = STEP057_SCENARIOS.filter((scenario) => !scenarioIds.has(scenario.id));
  if (missing.length) throw new Error(`Missing scenarios: ${missing.map((item) => item.id).join(', ')}`);
  for (const scenario of payload.scenarios) assertEvidenceReference(scenario);

  const result = evaluateProductionReadiness({
    preflightVerdict: preflight.evidence.verdict,
    scenarios: payload.scenarios
  });
  const reportPath = path.join(path.dirname(absolute), 'STEP057_PRODUCTION_READINESS_REPORT.md');
  const lines = [
    '# STEP057 — Production Readiness Report',
    '',
    `- Verdict: **${result.verdict}**`,
    `- Operator: ${payload.operator}`,
    `- Executed: ${payload.executedAt}`,
    `- Production URL: ${payload.productionUrl}`,
    `- Artifact SHA: \`${artifactSha}\``,
    `- Automated preflight: **${preflight.evidence.verdict}**`,
    `- Preflight evidence: \`${preflight.absolute}\``,
    `- Preflight SHA-256: \`${preflight.actualSha}\``,
    '',
    '## Core-loop scenarios',
    '',
    '| Scenario | Required | Status | Evidence |',
    '|---|---:|---|---|',
    ...payload.scenarios.map((scenario) => `| \`${scenario.id}\` | ${scenario.required ? 'yes' : 'no'} | **${scenario.status}** | ${(scenario.evidence || []).join('<br>') || '—'} |`),
    '',
    '## Verdict reasons',
    '',
    ...(result.reasons.length ? result.reasons.map((reason) => `- ${reason}`) : ['- All automated and manual acceptance requirements passed.']),
    '',
    '## Truth boundary',
    '',
    '- GO proves the recorded production artifact and captured scenarios only.',
    '- GO_WITH_RISKS means the required core loop passed, while optional payment/replay evidence remains incomplete or automated warnings remain.',
    '- NO_GO means at least one required core-loop or runtime invariant failed or was not tested.',
    '- This pack never creates fixtures and never mutates production data.'
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
  console.log(JSON.stringify({ verdict: result.verdict, reportPath, reasons: result.reasons }, null, 2));
  if (result.verdict === 'NO_GO') process.exitCode = 1;
  return { result, reportPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseCliArgs();
  const command = values[0];
  const filePath = values[1] || 'runtime_evidence/step057/manual-evidence.json';
  if (command === 'init') createTemplate(filePath);
  else if (command === 'verify') verifyEvidence(filePath);
  else throw new Error('Usage: node scripts/step057/productionEvidence.js <init|verify> [file]');
}
