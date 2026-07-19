import { Pool } from 'pg';
import { getContactPolicyConfig, getDbConfig, getPricingConfig, getTelegramConfig } from '../../src/config/env.js';
import { sanitizeConnectionString } from '../../src/db/pool.js';
import {
  createEvidenceRecorder,
  normalizeArtifactSha,
  parseCliArgs,
  requireProductionTarget
} from './productionReadinessLib.js';

const REQUIRED_TABLES = [
  'users',
  'linkedin_accounts',
  'member_profiles',
  'intro_requests',
  'contact_unlock_requests',
  'contact_unlock_events',
  'member_dm_threads',
  'member_dm_messages',
  'purchase_receipts',
  'notification_receipts'
];
const REQUIRED_INDEXES = [
  'uq_contact_unlock_provider_charge',
  'uq_member_dm_telegram_charge',
  'uq_member_dm_provider_charge',
  'uq_purchase_receipts_telegram_charge',
  'uq_purchase_receipts_provider_charge',
  'idx_contact_unlock_pro_usage',
  'idx_member_dm_pro_usage',
  'contact_unlock_events_request_id_idx'
];

function buildSslOption(sslMode) {
  if (!sslMode || sslMode === 'disable') return false;
  return { rejectUnauthorized: sslMode === 'verify-full' };
}

function createReadOnlyPool() {
  const db = getDbConfig();
  if (!db.configured) throw new Error('DATABASE_URL is required');
  return new Pool({
    connectionString: sanitizeConnectionString(db.databaseUrl),
    ssl: buildSslOption(db.sslMode),
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 7000,
    application_name: 'introdeck_step057_readonly'
  });
}

function redactRuntimeError(message) {
  return String(message || 'unknown_error')
    .replace(/https?:\/\/[^\s@/]+:[^\s@/]+@/gi, 'https://<redacted>@')
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<redacted>');
}

async function fetchJson(url, { label = 'remote endpoint', ...options } = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(`HTTP ${response.status} for ${label}`);
  return payload;
}

async function queryReadOnlySnapshot(pool) {
  const client = await pool.connect();
  try {
    await client.query('begin read only');
    await client.query("set local statement_timeout = '12000ms'");
    const server = await client.query(`select current_setting('server_version') as version, current_database() as database_name, current_user as database_user, pg_is_in_recovery() as in_recovery`);
    const tables = await client.query(`select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])`, [REQUIRED_TABLES]);
    const indexes = await client.query(`select indexname from pg_indexes where schemaname = 'public' and indexname = any($1::text[])`, [REQUIRED_INDEXES]);
    const metrics = await client.query(`
      select
        (select count(*)::int from member_profiles where profile_state = 'active' and visibility_status = 'listed') as listed_profiles,
        (select count(*)::int from member_profiles where profile_state = 'active' and visibility_status = 'listed' and contact_mode = 'intro_request') as intro_only_profiles,
        (select count(*)::int from member_profiles where profile_state = 'active' and visibility_status = 'listed' and contact_mode = 'paid_unlock_requires_approval') as paid_contact_profiles,
        (select count(*)::int from intro_requests where status = 'pending') as pending_intro_requests,
        (select count(*)::int from contact_unlock_requests where status = 'paid_pending_approval') as pending_contact_requests,
        (select count(*)::int from member_dm_threads where status = 'pending_recipient') as pending_private_chats,
        (select count(*)::int from notification_receipts where delivery_status = 'failed' and created_at >= now() - interval '24 hours') as failed_notifications_24h,
        (select count(*)::int from notification_receipts where delivery_status in ('pending','failed') and sent_message_id is null and attempt_count < max_attempts and next_attempt_at is not null and next_attempt_at <= now()) as retry_due_notifications,
        (select count(*)::int from notification_receipts where delivery_status = 'failed' and (attempt_count >= max_attempts or next_attempt_at is null) and created_at >= now() - interval '24 hours') as exhausted_notifications_24h
    `);
    const impossible = await client.query(`
      select
        (select count(*)::int from contact_unlock_requests where requester_user_id = target_user_id) as self_contact_requests,
        (select count(*)::int from member_dm_threads where initiator_user_id = recipient_user_id) as self_dm_threads,
        (select count(*)::int from contact_unlock_requests where status = 'revealed' and (approved_at is null or revealed_contact_value is null)) as invalid_revealed_contacts,
        (select count(*)::int from contact_unlock_requests where status = 'paid_pending_approval' and payment_state <> 'paid') as unpaid_pending_contacts,
        (select count(*)::int from member_dm_threads where status = 'active' and accepted_at is null) as active_dm_without_acceptance,
        (select count(*)::int from member_dm_threads where status = 'pending_recipient' and payment_state not in ('confirmed','not_required')) as unpaid_pending_dm,
        (select count(*)::int from (select provider_payment_charge_id from contact_unlock_requests where provider_payment_charge_id is not null group by provider_payment_charge_id having count(*) > 1) q) as duplicate_contact_provider_charges,
        (select count(*)::int from (select telegram_payment_charge_id from member_dm_threads where telegram_payment_charge_id is not null group by telegram_payment_charge_id having count(*) > 1) q) as duplicate_dm_telegram_charges,
        (select count(*)::int from (select provider_payment_charge_id from member_dm_threads where provider_payment_charge_id is not null group by provider_payment_charge_id having count(*) > 1) q) as duplicate_dm_provider_charges
    `);
    await client.query('commit');
    return {
      server: server.rows[0],
      tables: tables.rows.map((row) => row.table_name),
      indexes: indexes.rows.map((row) => row.indexname),
      metrics: metrics.rows[0],
      impossible: impossible.rows[0]
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function recentTelegramError(webhook) {
  if (!webhook?.last_error_date) return null;
  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(webhook.last_error_date));
  return { ageSeconds, message: webhook.last_error_message || 'unknown_error' };
}

async function main() {
  const { flags } = parseCliArgs();
  const allowNodeMismatch = flags.has('--allow-node-mismatch');
  const recorder = createEvidenceRecorder({ phase: 'production-preflight' });
  let pool;
  let target = null;
  let health = null;
  let telegramIdentity = null;
  let webhook = null;
  let dbSnapshot = null;

  try {
    const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
    const nodeStatus = nodeMajor === 20 ? 'PASS' : allowNodeMismatch ? 'WARN' : 'FAIL';
    recorder.record('node20', nodeStatus, { summary: `Node ${process.versions.node}; canonical runtime is Node 20.x` });
    if (nodeStatus === 'FAIL') throw new Error('Node 20.x is required');

    target = requireProductionTarget();
    recorder.record('production_target_guard', 'PASS', { summary: `Production target ${target.baseUrl}` });
    recorder.record('artifact_anchor', 'PASS', { summary: `Expected artifact ${target.artifactSha}`, artifactSha: target.artifactSha });

    health = await fetchJson(`${target.baseUrl}/api/health?full=1`, { label: 'production health endpoint' });
    const healthSha = normalizeArtifactSha(health.artifactSha);
    const healthOk = health.ok === true && health.step === 'STEP057' && health.docsStep === 'STEP057' && healthSha === target.artifactSha;
    recorder.record('deployed_health_artifact_binding', healthOk ? 'PASS' : 'FAIL', {
      summary: healthOk
        ? `STEP057 health is bound to ${healthSha}`
        : `Expected STEP057/${target.artifactSha}; received ${health.step}/${health.docsStep}/${health.artifactSha || 'no_sha'}`,
      health
    });

    const requiredFlags = ['dbConfigured', 'linkedInConfigured', 'telegramConfigured', 'telegramWebhookSecretConfigured', 'runtimeGuardsConfigured', 'notificationReceiptsConfigured', 'notificationRetryConfigured', 'notificationOpsConfigured', 'operatorDiagnosticsSurfaceConfigured', 'contactUnlockConfigured', 'dmRelayConfigured', 'pricingConfigured'];
    const missingFlags = requiredFlags.filter((key) => health.flags?.[key] !== true);
    recorder.record('runtime_config_surface', missingFlags.length ? 'FAIL' : 'PASS', {
      summary: missingFlags.length ? `Missing runtime flags: ${missingFlags.join(', ')}` : 'All core runtime flags are enabled'
    });

    const telegram = getTelegramConfig();
    telegramIdentity = (await fetchJson(`https://api.telegram.org/bot${telegram.botToken}/getMe`, { label: 'Telegram getMe' })).result;
    webhook = (await fetchJson(`https://api.telegram.org/bot${telegram.botToken}/getWebhookInfo`, { label: 'Telegram getWebhookInfo' })).result;
    const actualUsername = String(telegramIdentity?.username || '').toLowerCase();
    const expectedUsername = target.expectedBotUsername || String(telegram.botUsername || '').toLowerCase();
    recorder.record('telegram_getme', actualUsername && (!expectedUsername || actualUsername === expectedUsername) ? 'PASS' : 'FAIL', {
      summary: `Telegram bot @${actualUsername || 'unknown'}${expectedUsername ? `; expected @${expectedUsername}` : ''}`
    });

    const expectedWebhookUrl = `${target.baseUrl}/api/webhook`;
    recorder.record('telegram_webhook_url', webhook?.url === expectedWebhookUrl ? 'PASS' : 'FAIL', {
      summary: `Webhook ${webhook?.url || 'not_set'}; expected ${expectedWebhookUrl}`
    });
    const pendingCount = Number(webhook?.pending_update_count || 0);
    recorder.record('telegram_pending_updates', pendingCount > 100 ? 'FAIL' : pendingCount > 20 ? 'WARN' : 'PASS', {
      summary: `${pendingCount} pending Telegram updates`
    });
    const lastError = recentTelegramError(webhook);
    recorder.record('telegram_webhook_recent_error', !lastError ? 'PASS' : lastError.ageSeconds <= 3600 ? 'FAIL' : lastError.ageSeconds <= 86400 ? 'WARN' : 'INFO', {
      summary: lastError ? `${lastError.message}; ${lastError.ageSeconds}s ago` : 'No webhook error reported'
    });

    pool = createReadOnlyPool();
    dbSnapshot = await queryReadOnlySnapshot(pool);
    recorder.record('postgres_read_only_connection', 'PASS', {
      summary: `PostgreSQL ${dbSnapshot.server.version}; database ${dbSnapshot.server.database_name}`
    });
    const missingTables = REQUIRED_TABLES.filter((name) => !dbSnapshot.tables.includes(name));
    const missingIndexes = REQUIRED_INDEXES.filter((name) => !dbSnapshot.indexes.includes(name));
    recorder.record('migration_027_runtime_schema', missingTables.length || missingIndexes.length ? 'FAIL' : 'PASS', {
      summary: missingTables.length || missingIndexes.length
        ? `Missing tables [${missingTables.join(', ')}] or indexes [${missingIndexes.join(', ')}]`
        : 'STEP053/027 runtime schema is present'
    });

    const impossibleTotal = Object.values(dbSnapshot.impossible).reduce((sum, value) => sum + Number(value || 0), 0);
    recorder.record('impossible_database_states', impossibleTotal ? 'FAIL' : 'PASS', {
      summary: impossibleTotal ? `${impossibleTotal} impossible or duplicate financial states detected` : 'No checked impossible financial states detected',
      counts: dbSnapshot.impossible
    });

    const listedCount = Number(dbSnapshot.metrics.listed_profiles || 0);
    recorder.record('directory_supply', listedCount === 0 ? 'WARN' : listedCount < 3 ? 'WARN' : 'PASS', {
      summary: `${listedCount} listed profiles; ${dbSnapshot.metrics.intro_only_profiles} intro-only; ${dbSnapshot.metrics.paid_contact_profiles} paid-contact`
    });

    const exhausted = Number(dbSnapshot.metrics.exhausted_notifications_24h || 0);
    const retryDue = Number(dbSnapshot.metrics.retry_due_notifications || 0);
    recorder.record('notification_delivery_health', exhausted >= 10 ? 'FAIL' : exhausted > 0 || retryDue >= 10 ? 'WARN' : 'PASS', {
      summary: `${dbSnapshot.metrics.failed_notifications_24h} failed/24h, ${retryDue} retry due, ${exhausted} exhausted/24h`,
      metrics: dbSnapshot.metrics
    });

    const pricing = getPricingConfig();
    const policy = getContactPolicyConfig();
    recorder.record('contact_policy_runtime', 'PASS', {
      summary: `Private chat ${pricing.dmOpenPriceStars}⭐, Telegram contact ${pricing.contactUnlockPriceStars}⭐, Pro allowance ${policy.proOutreachDailyLimit}/24h, cooldown ${policy.retryCooldownDays}d`
    });
  } catch (error) {
    recorder.record('preflight_execution', 'FAIL', { summary: redactRuntimeError(error?.message || error) });
  } finally {
    if (pool) await pool.end().catch(() => {});
    const result = recorder.write({
      target: target ? { baseUrl: target.baseUrl, artifactSha: target.artifactSha } : null,
      artifactSha: target?.artifactSha || null,
      healthArtifactSha: normalizeArtifactSha(health?.artifactSha),
      telegram: telegramIdentity ? { id: telegramIdentity.id, username: telegramIdentity.username } : null,
      webhook: webhook ? {
        url: webhook.url,
        pendingUpdateCount: webhook.pending_update_count,
        lastErrorDate: webhook.last_error_date || null,
        lastErrorMessage: webhook.last_error_message || null
      } : null,
      database: dbSnapshot ? { server: dbSnapshot.server, metrics: dbSnapshot.metrics } : null,
      safety: { mutatingQueriesExecuted: false, transactionMode: 'READ ONLY' }
    });
    console.log(JSON.stringify({ verdict: result.payload.verdict, jsonPath: result.jsonPath, mdPath: result.mdPath }, null, 2));
    if (['FAIL', 'BLOCKED'].includes(result.payload.verdict)) process.exitCode = 1;
  }
}

await main();
