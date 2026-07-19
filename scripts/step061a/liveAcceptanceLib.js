import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const STEP061A_SCENARIOS = Object.freeze([
  { id: 'profile_active_listed', required: true, title: 'Operator profile is active and listed' },
  { id: 'newsdata_source_list', required: true, title: 'NewsData returns fresh source candidates' },
  { id: 'openai_draft_generated', required: true, title: 'OpenAI creates a valid evidence-bound draft' },
  { id: 'draft_edit_validated', required: true, title: 'Full-text edit is revalidated and saved' },
  { id: 'explicit_approval_share_intent', required: true, title: 'Explicit approval creates one STEP059 share intent' },
  { id: 'linkedin_exactly_one_published_receipt', required: true, title: 'Exactly one LinkedIn post and durable receipt' },
  { id: 'duplicate_callback_idempotent', required: true, title: 'Duplicate callback does not create a second post' },
  { id: 'preset_run_now_draft', required: true, title: 'Saved preset Run now creates one reviewable draft' },
  { id: 'scheduler_telegram_draft_only', required: true, title: 'Authenticated scheduler delivers one Telegram draft only' },
  { id: 'no_automatic_publishing', required: true, title: 'Search, generation, and scheduler never auto-publish' },
  { id: 'provider_cost_estimate', required: false, title: 'Provider token/request cost estimate is configured and observed' },
  { id: 'limited_pro_member_flow', required: false, title: 'One limited Pro member completes the draft flow without auto-publish' }
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
  const target = String(process.env.STEP061A_TARGET || '').trim().toLowerCase();
  if (target !== 'production') throw new Error('STEP061A_TARGET must be exactly "production"');

  const rawBaseUrl = String(process.env.STEP061A_BASE_URL || process.env.APP_BASE_URL || '').trim();
  let baseUrl;
  try { baseUrl = new URL(rawBaseUrl); } catch { throw new Error('STEP061A_BASE_URL or APP_BASE_URL must be a valid URL'); }
  if (baseUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
    throw new Error('STEP061A production URL must use HTTPS and cannot point to localhost');
  }

  const artifactSha = normalizeArtifactSha(process.env.STEP061A_ARTIFACT_SHA);
  if (!artifactSha) throw new Error('STEP061A_ARTIFACT_SHA must be a 40- or 64-character hexadecimal SHA');

  const telegramUserIdRaw = String(process.env.STEP061A_TELEGRAM_USER_ID || '').trim();
  const telegramUserId = telegramUserIdRaw ? Number.parseInt(telegramUserIdRaw, 10) : null;
  if (telegramUserIdRaw && (!Number.isFinite(telegramUserId) || telegramUserId <= 0)) {
    throw new Error('STEP061A_TELEGRAM_USER_ID must be a positive Telegram user ID');
  }

  return {
    target,
    baseUrl: baseUrl.toString().replace(/\/$/, ''),
    artifactSha,
    telegramUserId,
    expectedBotUsername: String(process.env.STEP061A_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '').toLowerCase() || null
  };
}

export function makeRunId(prefix = 'step061a') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${prefix}-${stamp}-${crypto.randomBytes(4).toString('hex')}`;
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function redactRuntimeError(message, secrets = []) {
  let text = String(message || 'unknown_error')
    .replace(/https?:\/\/[^\s@/]+:[^\s@/]+@/gi, 'https://<redacted>@')
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<redacted>')
    .replace(/(?:sk|sess|key)-[A-Za-z0-9_-]{12,}/g, '[REDACTED_API_KEY]');
  for (const secret of secrets) {
    const value = String(secret || '').trim();
    if (value) text = text.split(value).join('[REDACTED_SECRET]');
  }
  return text.slice(0, 600);
}

export function createEvidenceRecorder({
  phase,
  runId = makeRunId(),
  evidenceRoot = process.env.STEP061A_EVIDENCE_DIR || 'runtime_evidence/step061a'
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
      step: 'STEP061A',
      phase,
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      verdict: verdict(),
      runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
      checks,
      ...extra
    };
    const jsonPath = path.join(outputDir, `${phase}.json`);
    const mdPath = path.join(outputDir, `${phase}.md`);
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    const lines = [
      `# STEP061A ${phase} evidence`, '',
      `- Run ID: \`${runId}\``,
      `- Verdict: **${payload.verdict}**`,
      `- Node: \`${payload.runtime.node}\``,
      `- Completed: ${payload.completedAt}`, '',
      '| Check | Status | Evidence |', '|---|---|---|',
      ...checks.map((check) => `| \`${check.id}\` | **${check.status}** | ${String(check.summary || check.reason || '').replace(/\|/g, '\\|')} |`)
    ];
    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`);
    return { payload, jsonPath, mdPath, outputDir };
  }

  return { runId, checks, record, verdict, write };
}

export function assertEvidenceReference(scenario) {
  if (scenario.status === 'NOT_RUN') return;
  if (!Array.isArray(scenario.evidence) || !scenario.evidence.some((item) => String(item || '').trim())) {
    throw new Error(`Scenario ${scenario.id} requires at least one evidence reference`);
  }
}

export function evaluateLiveAcceptance({ preflightVerdict, scenarios }) {
  const scenarioMap = new Map((scenarios || []).map((scenario) => [scenario.id, scenario]));
  const missing = STEP061A_SCENARIOS.filter((definition) => !scenarioMap.has(definition.id));
  if (missing.length) return { verdict: 'NO_GO', reasons: [`Missing scenarios: ${missing.map((item) => item.id).join(', ')}`] };
  const invalid = (scenarios || []).filter((scenario) => !MANUAL_STATUSES.has(scenario.status));
  if (invalid.length) return { verdict: 'NO_GO', reasons: [`Invalid scenario statuses: ${invalid.map((item) => item.id).join(', ')}`] };

  const reasons = [];
  if (['FAIL', 'BLOCKED'].includes(preflightVerdict)) reasons.push(`Automated preflight verdict is ${preflightVerdict}`);
  const failed = (scenarios || []).filter((scenario) => ['FAIL', 'BLOCKED'].includes(scenario.status));
  if (failed.length) reasons.push(`Failed scenarios: ${failed.map((item) => item.id).join(', ')}`);
  const requiredNotPassed = STEP061A_SCENARIOS.filter((definition) => definition.required && scenarioMap.get(definition.id)?.status !== 'PASS');
  if (requiredNotPassed.length) reasons.push(`Required scenarios not passed: ${requiredNotPassed.map((item) => item.id).join(', ')}`);
  if (reasons.length) return { verdict: 'NO_GO', reasons };

  const optionalNotPassed = STEP061A_SCENARIOS.filter((definition) => !definition.required && scenarioMap.get(definition.id)?.status !== 'PASS');
  if (preflightVerdict === 'WARN' || optionalNotPassed.length) {
    return {
      verdict: 'GO_WITH_RISKS',
      reasons: [
        ...(preflightVerdict === 'WARN' ? ['Automated preflight contains warnings'] : []),
        ...(optionalNotPassed.length ? [`Optional rollout evidence not passed: ${optionalNotPassed.map((item) => item.id).join(', ')}`] : [])
      ]
    };
  }
  return { verdict: 'GO', reasons: [] };
}
