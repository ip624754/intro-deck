import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const STEP057_SCENARIOS = Object.freeze([
  { id: 'bot_start_home', required: true, title: 'Bot opens and Home renders' },
  { id: 'guided_activation_next_step', required: true, title: 'Guided activation resolves one next step' },
  { id: 'profile_preview_publish_hide', required: true, title: 'Preview, publish, and hide flow' },
  { id: 'directory_profile_open', required: true, title: 'Directory profile opens' },
  { id: 'intro_only_contact_request', required: true, title: 'Intro-only profile shows free intro request' },
  { id: 'paid_contact_options', required: true, title: 'Paid profile shows private chat and Telegram contact choices' },
  { id: 'contact_inbox_navigation', required: true, title: 'Contact inbox opens Requests and Private chats' },
  { id: 'operator_diagnostics', required: true, title: 'Operator diagnostics opens without critical runtime errors' },
  { id: 'stars_invoice_precheckout', required: false, title: 'Stars invoice and pre-checkout path' },
  { id: 'stars_successful_payment', required: false, title: 'Successful Stars payment completes one request' },
  { id: 'duplicate_callback_replay', required: false, title: 'Duplicate callback or payment replay stays idempotent' }
]);

const EVIDENCE_STATUSES = new Set(['PASS', 'WARN', 'FAIL', 'BLOCKED', 'INFO']);
const MANUAL_STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']);
const ARTIFACT_SHA_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;

export function parseCliArgs(argv = process.argv.slice(2)) {
  const flags = new Set(argv.filter((value) => value.startsWith('--')));
  const values = argv.filter((value) => !value.startsWith('--'));
  return { flags, values };
}

export function normalizeArtifactSha(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ARTIFACT_SHA_PATTERN.test(normalized) ? normalized : null;
}

export function requireProductionTarget() {
  const target = String(process.env.STEP057_TARGET || '').trim().toLowerCase();
  if (target !== 'production') {
    throw new Error('STEP057_TARGET must be exactly "production"');
  }

  const rawBaseUrl = String(process.env.STEP057_BASE_URL || process.env.APP_BASE_URL || '').trim();
  let baseUrl;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error('STEP057_BASE_URL or APP_BASE_URL must be a valid URL');
  }
  if (baseUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
    throw new Error('STEP057 production URL must use HTTPS and cannot point to localhost');
  }

  const artifactSha = normalizeArtifactSha(process.env.STEP057_ARTIFACT_SHA);
  if (!artifactSha) {
    throw new Error('STEP057_ARTIFACT_SHA must be a 40- or 64-character hexadecimal SHA');
  }

  return {
    target,
    baseUrl: baseUrl.toString().replace(/\/$/, ''),
    artifactSha,
    expectedBotUsername: String(process.env.STEP057_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '').toLowerCase() || null
  };
}

export function makeRunId(prefix = 'step057') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${prefix}-${stamp}-${crypto.randomBytes(4).toString('hex')}`;
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function createEvidenceRecorder({
  phase,
  runId = makeRunId(),
  evidenceRoot = process.env.STEP057_EVIDENCE_DIR || 'runtime_evidence/step057'
}) {
  const startedAt = new Date().toISOString();
  const checks = [];
  const outputDir = path.resolve(evidenceRoot, runId);

  function record(id, status, detail = {}) {
    if (!EVIDENCE_STATUSES.has(status)) throw new Error(`Unsupported evidence status: ${status}`);
    checks.push({ id, status, observedAt: new Date().toISOString(), ...detail });
  }

  function verdict() {
    if (checks.some((check) => check.status === 'FAIL')) return 'FAIL';
    if (checks.some((check) => check.status === 'BLOCKED')) return 'BLOCKED';
    if (checks.some((check) => check.status === 'WARN')) return 'WARN';
    return 'PASS';
  }

  function write(extra = {}) {
    fs.mkdirSync(outputDir, { recursive: true });
    const payload = {
      schemaVersion: 1,
      step: 'STEP057',
      phase,
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      verdict: verdict(),
      runtime: {
        node: process.versions.node,
        platform: process.platform,
        arch: process.arch
      },
      checks,
      ...extra
    };
    const jsonPath = path.join(outputDir, `${phase}.json`);
    const mdPath = path.join(outputDir, `${phase}.md`);
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    const lines = [
      `# STEP057 ${phase} evidence`,
      '',
      `- Run ID: \`${runId}\``,
      `- Verdict: **${payload.verdict}**`,
      `- Node: \`${payload.runtime.node}\``,
      `- Completed: ${payload.completedAt}`,
      '',
      '| Check | Status | Evidence |',
      '|---|---|---|',
      ...checks.map((check) => `| \`${check.id}\` | **${check.status}** | ${String(check.summary || check.reason || '').replace(/\|/g, '\\|')} |`)
    ];
    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`);
    return { payload, jsonPath, mdPath, outputDir };
  }

  return { runId, checks, record, verdict, write };
}

export function evaluateProductionReadiness({ preflightVerdict, scenarios }) {
  const scenarioMap = new Map((scenarios || []).map((scenario) => [scenario.id, scenario]));
  const missing = STEP057_SCENARIOS.filter((definition) => !scenarioMap.has(definition.id));
  if (missing.length) {
    return { verdict: 'NO_GO', reasons: [`Missing scenarios: ${missing.map((item) => item.id).join(', ')}`] };
  }

  const invalid = (scenarios || []).filter((scenario) => !MANUAL_STATUSES.has(scenario.status));
  if (invalid.length) {
    return { verdict: 'NO_GO', reasons: [`Invalid scenario statuses: ${invalid.map((item) => item.id).join(', ')}`] };
  }

  const reasons = [];
  if (['FAIL', 'BLOCKED'].includes(preflightVerdict)) reasons.push(`Automated preflight verdict is ${preflightVerdict}`);
  const failed = (scenarios || []).filter((scenario) => ['FAIL', 'BLOCKED'].includes(scenario.status));
  if (failed.length) reasons.push(`Failed scenarios: ${failed.map((item) => item.id).join(', ')}`);
  const requiredNotRun = STEP057_SCENARIOS.filter((definition) => definition.required && scenarioMap.get(definition.id)?.status !== 'PASS');
  if (requiredNotRun.length) reasons.push(`Required scenarios not passed: ${requiredNotRun.map((item) => item.id).join(', ')}`);

  if (reasons.length) return { verdict: 'NO_GO', reasons };

  const optionalNotRun = STEP057_SCENARIOS.filter((definition) => !definition.required && scenarioMap.get(definition.id)?.status !== 'PASS');
  if (preflightVerdict === 'WARN' || optionalNotRun.length) {
    return {
      verdict: 'GO_WITH_RISKS',
      reasons: [
        ...(preflightVerdict === 'WARN' ? ['Automated preflight contains warnings'] : []),
        ...(optionalNotRun.length ? [`Optional live payment/replay scenarios not passed: ${optionalNotRun.map((item) => item.id).join(', ')}`] : [])
      ]
    };
  }

  return { verdict: 'GO', reasons: [] };
}

export function assertEvidenceReference(scenario) {
  if (scenario.status === 'NOT_RUN') return;
  if (!Array.isArray(scenario.evidence) || !scenario.evidence.some((item) => String(item || '').trim())) {
    throw new Error(`Scenario ${scenario.id} requires at least one evidence reference`);
  }
}
