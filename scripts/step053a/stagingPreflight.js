import { getAppConfig, getContactPolicyConfig, getPricingConfig, getTelegramConfig } from '../../src/config/env.js';
import { CURRENT_SOURCE_STEP } from '../../src/config/release.js';
import {
  assertStagingTarget,
  createAcceptancePool,
  createEvidenceRecorder,
  getNodeRuntimeState,
  normalizeError,
  parseCliArgs,
  requireAcceptanceArtifactSha
} from './runtimeAcceptanceLib.js';

const REQUIRED_TABLES = [
  'users',
  'linkedin_accounts',
  'member_profiles',
  'contact_unlock_requests',
  'contact_unlock_events',
  'member_dm_threads',
  'member_dm_messages',
  'member_dm_events',
  'member_subscriptions',
  'purchase_receipts'
];

const REQUIRED_COLUMNS = {
  contact_unlock_requests: ['policy_snapshot', 'pro_covered', 'checkout_authorized_at', 'provider_payment_charge_id', 'telegram_payment_charge_id'],
  contact_unlock_events: ['request_id', 'actor_user_id', 'event_type', 'detail_json', 'created_at'],
  member_dm_threads: ['contact_policy_snapshot', 'pro_covered', 'checkout_authorized_at', 'provider_payment_charge_id', 'telegram_payment_charge_id'],
  purchase_receipts: ['related_entity_type', 'related_entity_id', 'raw_payload_snapshot', 'provider_payment_charge_id', 'telegram_payment_charge_id'],
  member_profiles: ['telegram_username_hidden', 'contact_mode']
};

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

async function fetchTelegram(method, token) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { signal: AbortSignal.timeout(10000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(`Telegram ${method} failed: HTTP ${response.status} ${payload?.description || 'unknown_error'}`);
  }
  return payload.result;
}

async function main() {
  const { flags } = parseCliArgs();
  const allowNodeMismatch = flags.has('--allow-node-mismatch');
  const skipTelegram = flags.has('--skip-telegram');
  const skipHealth = flags.has('--skip-health');
  const recorder = createEvidenceRecorder({ phase: 'preflight' });
  let pool = null;
  let databaseFingerprint = null;
  let appBaseUrl = null;
  let artifactSha = null;

  try {
    const runtime = getNodeRuntimeState({ allowMismatch: allowNodeMismatch });
    recorder.record('node20', runtime.canonical ? 'PASS' : runtime.allowed ? 'WARN' : 'FAIL', {
      summary: runtime.canonical ? `Canonical Node ${runtime.version}` : `Node ${runtime.version}; repository requires Node 20.x`
    });
    if (!runtime.allowed) {
      throw new Error(`Node 20.x required; current runtime is ${runtime.version}`);
    }

    const target = assertStagingTarget({ mutating: false });
    databaseFingerprint = target.fingerprint;
    artifactSha = requireAcceptanceArtifactSha();
    recorder.record('artifact_anchor', 'PASS', { summary: `Acceptance artifact ${artifactSha}`, artifactSha });
    recorder.record('staging_target_guard', 'PASS', {
      summary: `Database fingerprint ${target.fingerprint}`,
      database: target.identity
    });

    appBaseUrl = getAppConfig().appBaseUrl;
    const policy = getContactPolicyConfig();
    const pricing = getPricingConfig();
    recorder.record('runtime_contract_config', 'PASS', {
      summary: `Pro ${policy.proOutreachDailyLimit}/24h; cooldown ${policy.retryCooldownDays}d; checkout TTL ${policy.checkoutAuthorizationTtlMinutes}m`,
      policy,
      pricing
    });

    pool = createAcceptancePool({ max: 4 });
    const client = await pool.connect();
    try {
      await client.query(`set statement_timeout = '30000ms'`);
      await client.query(`set lock_timeout = '10000ms'`);
      const identity = await client.query(`
        select
          current_database() as database_name,
          current_user as database_user,
          current_schema() as schema_name,
          current_setting('server_version') as server_version,
          current_setting('transaction_read_only') as transaction_read_only,
          inet_server_addr()::text as server_address,
          inet_server_port() as server_port
      `);
      const row = identity.rows[0] || {};
      recorder.record('postgres_connectivity', row.transaction_read_only === 'off' ? 'PASS' : 'FAIL', {
        summary: `PostgreSQL ${row.server_version}; database ${row.database_name}; read_only=${row.transaction_read_only}`,
        database: row
      });

      const tables = await client.query(
        `select table_name from information_schema.tables where table_schema = current_schema() and table_name = any($1::text[])`,
        [REQUIRED_TABLES]
      );
      const foundTables = new Set(tables.rows.map((item) => item.table_name));
      const missingTables = REQUIRED_TABLES.filter((name) => !foundTables.has(name));
      recorder.record('migration_027_required_tables', missingTables.length ? 'FAIL' : 'PASS', {
        summary: missingTables.length ? `Missing tables: ${missingTables.join(', ')}` : 'All required tables exist',
        missingTables
      });

      const missingColumns = [];
      for (const [tableName, columns] of Object.entries(REQUIRED_COLUMNS)) {
        const result = await client.query(
          `select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1 and column_name = any($2::text[])`,
          [tableName, columns]
        );
        const found = new Set(result.rows.map((item) => item.column_name));
        for (const column of columns) {
          if (!found.has(column)) missingColumns.push(`${tableName}.${column}`);
        }
      }
      recorder.record('migration_027_required_columns', missingColumns.length ? 'FAIL' : 'PASS', {
        summary: missingColumns.length ? `Missing columns: ${missingColumns.join(', ')}` : 'All STEP053 columns exist',
        missingColumns
      });

      const indexes = await client.query(
        `select indexname from pg_indexes where schemaname = current_schema() and indexname = any($1::text[])`,
        [REQUIRED_INDEXES]
      );
      const foundIndexes = new Set(indexes.rows.map((item) => item.indexname));
      const missingIndexes = REQUIRED_INDEXES.filter((name) => !foundIndexes.has(name));
      recorder.record('migration_027_required_indexes', missingIndexes.length ? 'FAIL' : 'PASS', {
        summary: missingIndexes.length ? `Missing indexes: ${missingIndexes.join(', ')}` : 'All STEP053 indexes exist',
        missingIndexes
      });

      const duplicates = await client.query(`
        with charge_owners as (
          select 'telegram'::text as charge_kind, telegram_payment_charge_id as charge, concat('contact_unlock_request:', id::text) as owner
          from contact_unlock_requests where telegram_payment_charge_id is not null
          union all
          select 'provider', provider_payment_charge_id, concat('contact_unlock_request:', id::text)
          from contact_unlock_requests where provider_payment_charge_id is not null
          union all
          select 'telegram', telegram_payment_charge_id, concat('dm_thread:', id::text)
          from member_dm_threads where telegram_payment_charge_id is not null
          union all
          select 'provider', provider_payment_charge_id, concat('dm_thread:', id::text)
          from member_dm_threads where provider_payment_charge_id is not null
          union all
          select 'telegram', telegram_payment_charge_id, concat(coalesce(related_entity_type, 'receipt'), ':', coalesce(related_entity_id::text, id::text))
          from purchase_receipts where telegram_payment_charge_id is not null
          union all
          select 'provider', provider_payment_charge_id, concat(coalesce(related_entity_type, 'receipt'), ':', coalesce(related_entity_id::text, id::text))
          from purchase_receipts where provider_payment_charge_id is not null
        )
        select charge_kind, charge, array_agg(distinct owner order by owner) as owners, count(distinct owner)::int as owner_count
        from charge_owners
        group by charge_kind, charge
        having count(distinct owner) > 1
        order by owner_count desc, charge_kind, charge
        limit 25
      `);
      recorder.record('payment_charge_ambiguity_preflight', duplicates.rowCount ? 'FAIL' : 'PASS', {
        summary: duplicates.rowCount ? `${duplicates.rowCount} charge values map to multiple entities` : 'Every Telegram/provider charge maps to one canonical entity',
        duplicates: duplicates.rows
      });

      const impossible = await client.query(`
        select
          (select count(*)::int from contact_unlock_requests
            where payment_state = 'paid' and pro_covered = false and telegram_payment_charge_id is null) as contact_paid_without_charge,
          (select count(*)::int from contact_unlock_requests
            where pro_covered = true and payment_state <> 'paid') as contact_invalid_pro_state,
          (select count(*)::int from member_dm_threads
            where payment_state = 'confirmed' and pro_covered = false and telegram_payment_charge_id is null) as dm_paid_without_charge,
          (select count(*)::int from member_dm_threads
            where pro_covered = true and payment_state <> 'confirmed') as dm_invalid_pro_state,
          (select count(*)::int from contact_unlock_requests
            where status = 'paid_pending_approval' and payment_state <> 'paid') as contact_status_payment_mismatch,
          (select count(*)::int from member_dm_threads
            where status in ('pending_recipient', 'active') and payment_state not in ('confirmed', 'not_required')) as dm_status_payment_mismatch
      `);
      const impossibleRow = impossible.rows[0] || {};
      const impossibleTotal = Object.values(impossibleRow).reduce((sum, value) => sum + Number(value || 0), 0);
      recorder.record('impossible_financial_states', impossibleTotal ? 'FAIL' : 'PASS', {
        summary: impossibleTotal ? `${impossibleTotal} impossible or ambiguous rows detected` : 'No impossible STEP053 payment states detected',
        counts: impossibleRow
      });

      await client.query('begin');
      await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`step053a:preflight:${recorder.runId}`]);
      await client.query('rollback');
      recorder.record('postgres_advisory_lock_support', 'PASS', { summary: 'Transaction advisory lock acquired and released' });
    } finally {
      client.release();
    }

    if (skipTelegram) {
      recorder.record('telegram_getme', 'BLOCKED', { summary: 'Skipped by --skip-telegram' });
      recorder.record('telegram_webhook_info', 'BLOCKED', { summary: 'Skipped by --skip-telegram' });
    } else {
      const telegram = getTelegramConfig();
      recorder.record('telegram_webhook_secret_configured', telegram.webhookSecret ? 'PASS' : 'FAIL', {
        summary: telegram.webhookSecret ? 'TELEGRAM_WEBHOOK_SECRET is configured' : 'TELEGRAM_WEBHOOK_SECRET is missing'
      });
      const me = await fetchTelegram('getMe', telegram.botToken);
      recorder.record('telegram_getme', 'PASS', { summary: `Bot @${me.username || me.id}`, bot: { id: me.id, username: me.username || null } });
      const webhook = await fetchTelegram('getWebhookInfo', telegram.botToken);
      const expectedWebhookUrl = new URL('/api/webhook', appBaseUrl).toString();
      const webhookMatches = webhook.url === expectedWebhookUrl;
      recorder.record('telegram_webhook_info', webhook.url && webhookMatches ? 'PASS' : 'FAIL', {
        summary: !webhook.url ? 'Webhook URL is empty' : webhookMatches ? `Webhook matches staging URL; pending=${webhook.pending_update_count || 0}` : `Webhook mismatch: expected ${expectedWebhookUrl}`,
        webhook: {
          url: webhook.url || null,
          expectedUrl: expectedWebhookUrl,
          pendingUpdateCount: webhook.pending_update_count || 0,
          lastErrorDate: webhook.last_error_date || null,
          lastErrorMessage: webhook.last_error_message || null,
          maxConnections: webhook.max_connections || null,
          ipAddress: webhook.ip_address || null
        }
      });
      const lastErrorAgeSeconds = webhook.last_error_date ? Math.max(0, Math.floor(Date.now() / 1000) - Number(webhook.last_error_date)) : null;
      recorder.record('telegram_webhook_recent_error', lastErrorAgeSeconds !== null && lastErrorAgeSeconds < 900 ? 'WARN' : 'PASS', {
        summary: lastErrorAgeSeconds === null ? 'No Telegram webhook error recorded' : lastErrorAgeSeconds < 900 ? `Recent webhook error ${lastErrorAgeSeconds}s ago: ${webhook.last_error_message || 'unknown'}` : `Last webhook error is ${lastErrorAgeSeconds}s old`
      });
    }

    if (skipHealth) {
      recorder.record('deployed_health', 'BLOCKED', { summary: 'Skipped by --skip-health' });
    } else {
      const healthUrl = new URL('/api/health?full=1', appBaseUrl).toString();
      const response = await fetch(healthUrl, {
        headers: { 'user-agent': 'IntroDeck-STEP053A-Acceptance/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      const payload = await response.json().catch(() => null);
      const healthPass = Boolean(
        response.ok &&
        payload?.ok === true &&
        payload?.service === 'linkedin-telegram-directory-bot' &&
        payload?.step === CURRENT_SOURCE_STEP &&
        payload?.docsStep === CURRENT_SOURCE_STEP &&
        payload?.artifactSha === artifactSha &&
        payload?.persistence?.enabled === true &&
        payload?.webhook?.secretConfigured === true &&
        payload?.flags?.contactUnlockConfigured === true &&
        payload?.flags?.dmRelayConfigured === true &&
        payload?.flags?.pricingConfigured === true
      );
      recorder.record('deployed_health', healthPass ? 'PASS' : 'FAIL', {
        summary: healthPass ? `HTTP ${response.status}; deployed step ${payload.step}` : `Health contract mismatch at ${healthUrl} (HTTP ${response.status})`,
        expectedStep: CURRENT_SOURCE_STEP,
        expectedArtifactSha: artifactSha,
        health: payload
      });
    }
  } catch (error) {
    recorder.record('preflight_exception', 'FAIL', { summary: error?.message || String(error), error: normalizeError(error) });
  } finally {
    if (pool) await pool.end().catch(() => {});
    const output = recorder.write({ target: 'staging', databaseFingerprint, artifactSha, appBaseUrl });
    console.log(JSON.stringify({ verdict: output.payload.verdict, databaseFingerprint, evidence: output.jsonPath }, null, 2));
    if (output.payload.verdict !== 'PASS') process.exitCode = 1;
  }
}

await main();
