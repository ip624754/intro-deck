import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { getDbConfig } from '../../src/config/env.js';
import { sanitizeConnectionString } from '../../src/db/pool.js';

const ALLOWED_STATUSES = new Set(['PASS', 'FAIL', 'WARN', 'BLOCKED', 'INFO']);

function buildSslOption(sslMode) {
  if (!sslMode || sslMode === 'disable') {
    return false;
  }
  return { rejectUnauthorized: sslMode === 'verify-full' };
}

export function parseCliArgs(argv = process.argv.slice(2)) {
  const flags = new Set(argv.filter((value) => value.startsWith('--')));
  const values = argv.filter((value) => !value.startsWith('--'));
  return { flags, values };
}

export function makeRunId(prefix = 'step053a') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const entropy = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${stamp}-${entropy}`;
}

export function getNodeRuntimeState({ allowMismatch = false } = {}) {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  const canonical = major === 20;
  return {
    version: process.versions.node,
    major,
    canonical,
    allowed: canonical || allowMismatch
  };
}

export function parseDatabaseIdentity(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return {
    protocol: parsed.protocol.replace(':', ''),
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, '') || 'postgres',
    user: decodeURIComponent(parsed.username || ''),
    sslmode: parsed.searchParams.get('sslmode') || null
  };
}

export function computeDatabaseFingerprint(databaseUrl) {
  const identity = parseDatabaseIdentity(databaseUrl);
  const canonical = `${identity.protocol}|${identity.host}|${identity.port}|${identity.database}|${identity.user}`;
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export function assertStagingTarget({ mutating = false } = {}) {
  const target = String(process.env.STEP053A_TARGET || '').trim().toLowerCase();
  if (target !== 'staging') {
    throw new Error('STEP053A_TARGET must be exactly "staging"');
  }
  const dbConfig = getDbConfig();
  if (!dbConfig.configured) {
    throw new Error('DATABASE_URL is required');
  }

  const fingerprint = computeDatabaseFingerprint(dbConfig.databaseUrl);
  if (mutating) {
    const mutationAck = String(process.env.STEP053A_MUTATION_ACK || '').trim();
    if (mutationAck !== 'ALLOW_STEP053A_STAGING_FIXTURES') {
      throw new Error('STEP053A_MUTATION_ACK must equal ALLOW_STEP053A_STAGING_FIXTURES');
    }
    const databaseAck = String(process.env.STEP053A_DATABASE_ACK || '').trim();
    if (databaseAck !== fingerprint) {
      throw new Error(`STEP053A_DATABASE_ACK must equal the preflight fingerprint ${fingerprint}`);
    }
  }

  return { dbConfig, fingerprint, identity: parseDatabaseIdentity(dbConfig.databaseUrl) };
}

export function createAcceptancePool({ max = 6 } = {}) {
  const dbConfig = getDbConfig();
  if (!dbConfig.configured) {
    throw new Error('DATABASE_URL is not configured');
  }
  return new Pool({
    connectionString: sanitizeConnectionString(dbConfig.databaseUrl),
    ssl: buildSslOption(dbConfig.sslMode),
    max,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 7000,
    application_name: 'introdeck_step053a_acceptance'
  });
}


export function requireAcceptanceArtifactSha() {
  const normalized = String(process.env.STEP053A_ARTIFACT_SHA || '').trim().toLowerCase();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(normalized)) {
    throw new Error('STEP053A_ARTIFACT_SHA must be a 40- or 64-character hexadecimal SHA');
  }
  return normalized;
}

export function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

export function createEvidenceRecorder({ phase, runId = makeRunId(), evidenceRoot = process.env.STEP053A_EVIDENCE_DIR || 'runtime_evidence/step053a' }) {
  const startedAt = new Date().toISOString();
  const checks = [];
  const outputDir = path.resolve(evidenceRoot, runId);

  function record(id, status, detail = {}) {
    if (!ALLOWED_STATUSES.has(status)) {
      throw new Error(`Unsupported evidence status: ${status}`);
    }
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
      step: 'STEP053A',
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
      `# STEP053A ${phase} evidence`,
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

  return { runId, outputDir, checks, record, verdict, write };
}

export async function withTransaction(pool, fn, { lockTimeoutMs = 10000, statementTimeoutMs = 30000 } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`set local lock_timeout = '${Math.max(1, lockTimeoutMs)}ms'`);
    await client.query(`set local statement_timeout = '${Math.max(1, statementTimeoutMs)}ms'`);
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function normalizeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code || null,
    constraint: error?.constraint || null
  };
}
