import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  STEP061A_SCENARIOS,
  assertEvidenceReference,
  evaluateLiveAcceptance,
  normalizeArtifactSha,
  parseCliArgs,
  sha256File
} from './liveAcceptanceLib.js';

function isIsoTimestamp(value) {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

export function createTemplate(filePath) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const payload = {
    schemaVersion: 1,
    step: 'STEP061A',
    runId: `step061a-manual-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    operator: '',
    executedAt: '',
    productionUrl: 'https://intro-deck.vercel.app',
    commitOrArtifactSha: '',
    rolloutStageObserved: 'operator_acceptance',
    automatedEvidence: {
      preflightPath: '',
      preflightSha256: ''
    },
    scenarios: STEP061A_SCENARIOS.map((scenario) => ({
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
  if (evidence.step !== 'STEP061A' || evidence.phase !== 'production-preflight') {
    throw new Error('Preflight evidence has the wrong step or phase');
  }
  const localNode20 = String(evidence.runtime?.node || '').startsWith('20.');
  const deployedNode20 = String(evidence.deployedRuntime?.node || '').startsWith('20.');
  if (!localNode20 && !deployedNode20) {
    throw new Error('Release evidence requires Node 20 in the local preflight or the bound deployed runtime');
  }
  if (evidence.safety?.mutatingQueriesExecuted !== false || evidence.safety?.transactionMode !== 'READ ONLY' || evidence.safety?.providerCallsExecuted !== false) {
    throw new Error('Preflight evidence does not prove read-only, no-provider-call execution');
  }
  return { absolute, actualSha, evidence };
}

export function verifyEvidence(filePath) {
  const absolute = path.resolve(filePath);
  const payload = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (payload.step !== 'STEP061A') throw new Error('Manual evidence step must be STEP061A');
  if (!String(payload.operator || '').trim()) throw new Error('operator is required');
  if (!isIsoTimestamp(payload.executedAt)) throw new Error('executedAt must be a valid timestamp');
  let productionUrl;
  try { productionUrl = new URL(payload.productionUrl); } catch { throw new Error('productionUrl must be a valid URL'); }
  if (productionUrl.protocol !== 'https:') throw new Error('productionUrl must use HTTPS');
  const artifactSha = normalizeArtifactSha(payload.commitOrArtifactSha);
  if (!artifactSha) throw new Error('commitOrArtifactSha must be a valid SHA');
  if (!['operator_acceptance', 'limited_pro', 'live'].includes(payload.rolloutStageObserved)) {
    throw new Error('rolloutStageObserved must be operator_acceptance, limited_pro, or live');
  }

  const preflight = loadPreflight(payload);
  if (preflight.evidence.artifactSha !== artifactSha || preflight.evidence.healthArtifactSha !== artifactSha) {
    throw new Error('Preflight artifact binding does not match manual evidence');
  }
  if (preflight.evidence.target?.baseUrl !== productionUrl.toString().replace(/\/$/, '')) {
    throw new Error('Preflight production URL does not match manual evidence');
  }

  const scenarioIds = new Set((payload.scenarios || []).map((scenario) => scenario.id));
  const missing = STEP061A_SCENARIOS.filter((scenario) => !scenarioIds.has(scenario.id));
  if (missing.length) throw new Error(`Missing scenarios: ${missing.map((item) => item.id).join(', ')}`);
  for (const scenario of payload.scenarios) assertEvidenceReference(scenario);

  const result = evaluateLiveAcceptance({
    preflightVerdict: preflight.evidence.verdict,
    scenarios: payload.scenarios
  });

  const reportPath = path.join(path.dirname(absolute), 'STEP061A_LIVE_ACCEPTANCE_REPORT.md');
  const lines = [
    '# STEP061A — AI/News End-to-End Live Acceptance Report', '',
    `- Verdict: **${result.verdict}**`,
    `- Operator: ${payload.operator}`,
    `- Executed: ${payload.executedAt}`,
    `- Production URL: ${payload.productionUrl}`,
    `- Artifact SHA: \`${artifactSha}\``,
    `- Rollout stage observed: \`${payload.rolloutStageObserved}\``,
    `- Automated preflight: **${preflight.evidence.verdict}**`,
    `- Local preflight Node: \`${preflight.evidence.runtime?.node || 'unknown'}\``,
    `- Deployed runtime Node: \`${preflight.evidence.deployedRuntime?.node || 'unknown'}\``,
    `- Preflight evidence: \`${preflight.absolute}\``,
    `- Preflight SHA-256: \`${preflight.actualSha}\``, '',
    '## End-to-end scenarios', '',
    '| Scenario | Required | Status | Evidence |', '|---|---:|---|---|',
    ...payload.scenarios.map((scenario) => `| \`${scenario.id}\` | ${scenario.required ? 'yes' : 'no'} | **${scenario.status}** | ${(scenario.evidence || []).join('<br>') || '—'} |`), '',
    '## Verdict reasons', '',
    ...(result.reasons.length ? result.reasons.map((reason) => `- ${reason}`) : ['- All automated and manual acceptance requirements passed.']), '',
    '## Rollout decision', '',
    result.verdict === 'GO'
      ? '- The tested artifact may move from `operator_acceptance` to `limited_pro` through an explicit ENV change and redeploy.'
      : result.verdict === 'GO_WITH_RISKS'
        ? '- Keep `operator_acceptance` unless the listed optional risks are explicitly accepted. Do not move directly to broad live rollout.'
        : '- Keep `operator_acceptance`; fix the failed or untested required scenarios before Pro rollout.',
    '- `live` rollout remains a separate operator decision after limited-Pro evidence and unit-economics review.', '',
    '## Truth boundary', '',
    '- This report proves only the exact production artifact and evidence references recorded above.',
    '- It does not prove future provider availability, content quality, or cost stability.',
    '- Subscription controls access and allowance only. Every LinkedIn post still requires explicit one-post approval.',
    '- Automated preflight is read-only and makes no NewsData, OpenAI, Telegram-send, or LinkedIn-publish calls.'
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
  console.log(JSON.stringify({ verdict: result.verdict, reportPath, reasons: result.reasons }, null, 2));
  if (result.verdict === 'NO_GO') process.exitCode = 1;
  return { result, reportPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseCliArgs();
  const command = values[0];
  const filePath = values[1] || 'runtime_evidence/step061a/manual-evidence.json';
  if (command === 'init') createTemplate(filePath);
  else if (command === 'verify') verifyEvidence(filePath);
  else throw new Error('Usage: node scripts/step061a/productionEvidence.js <init|verify> [file]');
}
