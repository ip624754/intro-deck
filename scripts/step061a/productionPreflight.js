import { Pool } from 'pg';
import {
  getAiNewsDraftConfig,
  getDbConfig,
  getTelegramConfig
} from '../../src/config/env.js';
import { sanitizeConnectionString } from '../../src/db/pool.js';
import {
  createEvidenceRecorder,
  normalizeArtifactSha,
  parseCliArgs,
  redactRuntimeError,
  requireProductionTarget
} from './liveAcceptanceLib.js';

const REQUIRED_TABLES = [
  'ai_news_preferences',
  'ai_news_sources',
  'ai_news_drafts',
  'ai_news_draft_events',
  'ai_news_presets',
  'ai_news_preset_runs',
  'ai_news_provider_usage_events',
  'linkedin_share_intents',
  'linkedin_share_events'
];

const REQUIRED_COLUMNS = [
  ['ai_news_drafts', 'preset_run_id'],
  ['ai_news_drafts', 'openai_input_tokens'],
  ['ai_news_drafts', 'openai_output_tokens'],
  ['ai_news_drafts', 'openai_total_tokens'],
  ['ai_news_drafts', 'estimated_generation_cost_microusd'],
  ['linkedin_share_intents', 'source_kind'],
  ['linkedin_share_intents', 'source_ref_id'],
  ['linkedin_share_intents', 'provider_post_id']
];

const REQUIRED_INDEXES = [
  'uq_ai_news_user_unresolved_draft',
  'uq_ai_news_drafts_user_source_active',
  'uq_ai_news_preset_scheduled_run',
  'uq_ai_news_drafts_preset_run',
  'uq_linkedin_share_ai_news_draft',
  'idx_ai_news_provider_usage_created',
  'idx_ai_news_provider_usage_user_created'
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
    application_name: 'introdeck_step061a_readonly'
  });
}

async function fetchJson(url, { label = 'remote endpoint', ...options } = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(`HTTP ${response.status} for ${label}`);
  return payload;
}

async function queryReadOnlySnapshot(pool, telegramUserId = null) {
  const client = await pool.connect();
  try {
    await client.query('begin read only');
    await client.query("set local statement_timeout = '15000ms'");

    const server = await client.query(`
      select current_setting('server_version') as version,
             current_database() as database_name,
             current_user as database_user,
             pg_is_in_recovery() as in_recovery
    `);

    const tables = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema=current_schema() and table_name = any($1::text[])
    `, [REQUIRED_TABLES]);

    const columns = await client.query(`
      select table_name, column_name
      from information_schema.columns
      where table_schema=current_schema()
        and (table_name, column_name) in (
          ('ai_news_drafts','preset_run_id'),
          ('ai_news_drafts','openai_input_tokens'),
          ('ai_news_drafts','openai_output_tokens'),
          ('ai_news_drafts','openai_total_tokens'),
          ('ai_news_drafts','estimated_generation_cost_microusd'),
          ('linkedin_share_intents','source_kind'),
          ('linkedin_share_intents','source_ref_id'),
          ('linkedin_share_intents','provider_post_id')
        )
    `);

    const indexes = await client.query(`
      select indexname
      from pg_indexes
      where schemaname=current_schema() and indexname = any($1::text[])
    `, [REQUIRED_INDEXES]);

    const impossible = await client.query(`
      select
        (select count(*)::int from ai_news_drafts d
          where d.status='published' and (d.share_intent_id is null or d.published_at is null)) as published_draft_without_receipt,
        (select count(*)::int from linkedin_share_intents s
          where s.source_kind='ai_news_draft' and s.status='published'
            and (s.provider_post_id is null or s.published_at is null)) as published_share_without_provider_receipt,
        (select count(*)::int from (
          select source_ref_id from linkedin_share_intents
          where source_kind='ai_news_draft' and status='published' and source_ref_id is not null
          group by source_ref_id having count(*) > 1
        ) q) as duplicate_published_share_per_draft,
        (select count(*)::int from ai_news_preset_runs
          where status='delivered' and (telegram_message_id is null or delivered_at is null)) as delivered_run_without_telegram_receipt,
        (select count(*)::int from ai_news_drafts d
          join linkedin_share_intents s on s.id=d.share_intent_id
          where d.status='published' and s.status <> 'published') as published_draft_share_state_mismatch,
        (select count(*)::int from ai_news_provider_usage_events
          where estimated_cost_microusd < 0 or coalesce(input_tokens,0) < 0 or coalesce(output_tokens,0) < 0) as invalid_provider_usage
    `);

    const metrics = await client.query(`
      select
        (select count(*)::int from ai_news_sources where fetched_at >= now()-interval '24 hours') as sources_24h,
        (select count(*)::int from ai_news_drafts where created_at >= now()-interval '24 hours') as draft_attempts_24h,
        (select count(*)::int from ai_news_drafts where status in ('draft','editing','share_ready','published') and created_at >= now()-interval '24 hours') as generated_drafts_24h,
        (select count(*)::int from ai_news_drafts where edited_by_user=true and created_at >= now()-interval '24 hours') as edited_drafts_24h,
        (select count(*)::int from linkedin_share_intents where source_kind='ai_news_draft' and status='published' and published_at >= now()-interval '24 hours') as linkedin_posts_24h,
        (select count(*)::int from linkedin_share_intents where source_kind='ai_news_draft' and status='unknown' and created_at >= now()-interval '24 hours') as unknown_share_outcomes_24h,
        (select count(*)::int from ai_news_preset_runs where trigger_kind='run_now' and created_at >= now()-interval '24 hours') as run_now_24h,
        (select count(*)::int from ai_news_preset_runs where trigger_kind='scheduled' and created_at >= now()-interval '24 hours') as scheduled_runs_24h,
        (select count(*)::int from ai_news_preset_runs where status='delivered' and created_at >= now()-interval '24 hours') as scheduled_delivered_24h,
        (select count(*)::int from ai_news_provider_usage_events where provider='newsdata' and created_at >= now()-interval '24 hours') as newsdata_calls_24h,
        (select count(*)::int from ai_news_provider_usage_events where provider='openai' and created_at >= now()-interval '24 hours') as openai_calls_24h,
        (select count(*)::int from ai_news_provider_usage_events where outcome='failed' and created_at >= now()-interval '24 hours') as provider_failures_24h,
        (select coalesce(sum(input_tokens),0)::bigint from ai_news_provider_usage_events where provider='openai' and created_at >= now()-interval '24 hours') as input_tokens_24h,
        (select coalesce(sum(output_tokens),0)::bigint from ai_news_provider_usage_events where provider='openai' and created_at >= now()-interval '24 hours') as output_tokens_24h,
        (select coalesce(sum(estimated_cost_microusd),0)::bigint from ai_news_provider_usage_events where created_at >= now()-interval '24 hours') as estimated_cost_microusd_24h
    `);

    let userSnapshot = null;
    if (telegramUserId) {
      const user = await client.query(`select id, telegram_user_id from users where telegram_user_id=$1 limit 1`, [telegramUserId]);
      const userId = user.rows[0]?.id || null;
      if (userId) {
        const result = await client.query(`
          select
            u.id as user_id,
            p.profile_state, p.visibility_status,
            (select count(*)::int from ai_news_sources s where s.user_id=u.id and s.fetched_at >= now()-interval '24 hours') as sources_24h,
            (select count(*)::int from ai_news_drafts d where d.user_id=u.id and d.created_at >= now()-interval '24 hours') as drafts_24h,
            (select count(*)::int from ai_news_drafts d where d.user_id=u.id and d.edited_by_user=true and d.created_at >= now()-interval '24 hours') as edited_24h,
            (select count(*)::int from linkedin_share_intents s where s.user_id=u.id and s.source_kind='ai_news_draft' and s.status='published' and s.published_at >= now()-interval '24 hours') as published_24h,
            (select count(*)::int from ai_news_presets ap where ap.user_id=u.id and ap.status <> 'deleted') as presets,
            (select count(*)::int from ai_news_preset_runs r where r.user_id=u.id and r.trigger_kind='run_now' and r.created_at >= now()-interval '24 hours') as run_now_24h,
            (select count(*)::int from ai_news_preset_runs r where r.user_id=u.id and r.trigger_kind='scheduled' and r.status='delivered' and r.created_at >= now()-interval '24 hours') as scheduled_delivered_24h
          from users u
          left join member_profiles p on p.user_id=u.id
          where u.id=$1
          group by u.id,p.profile_state,p.visibility_status
        `, [userId]);
        userSnapshot = result.rows[0] || null;
      }
    }

    await client.query('commit');
    return {
      server: server.rows[0],
      tables: tables.rows.map((row) => row.table_name),
      columns: columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
      indexes: indexes.rows.map((row) => row.indexname),
      impossible: impossible.rows[0],
      metrics: metrics.rows[0],
      userSnapshot
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const { flags } = parseCliArgs();
  const allowNodeMismatch = flags.has('--allow-node-mismatch');
  const recorder = createEvidenceRecorder({ phase: 'production-preflight' });
  let target = null;
  let health = null;
  let telegramIdentity = null;
  let webhook = null;
  let dbSnapshot = null;
  let pool = null;
  const secrets = [process.env.TELEGRAM_BOT_TOKEN, process.env.DATABASE_URL, process.env.OPENAI_API_KEY, process.env.NEWSDATA_API_KEY];

  try {
    const node20 = process.versions.node.startsWith('20.');
    recorder.record('node20', node20 ? 'PASS' : allowNodeMismatch ? 'WARN' : 'FAIL', {
      summary: node20 ? `Node ${process.versions.node}` : `Node ${process.versions.node}; canonical runtime is Node 20.x`
    });

    target = requireProductionTarget();
    recorder.record('production_target_guard', 'PASS', { summary: `Production target ${target.baseUrl}` });
    recorder.record('artifact_anchor', 'PASS', { summary: `Expected artifact ${target.artifactSha}` });

    health = await fetchJson(`${target.baseUrl}/api/health?full=1`, { label: 'production health' });
    const healthSha = normalizeArtifactSha(health.artifactSha);
    const bindingPass = health.ok === true && health.step === 'STEP061A' && health.docsStep === 'STEP061A' && healthSha === target.artifactSha;
    recorder.record('deployed_health_artifact_binding', bindingPass ? 'PASS' : 'FAIL', {
      summary: bindingPass
        ? `STEP061A health is bound to ${healthSha}`
        : `Expected STEP061A/${target.artifactSha}; received ${health.step}/${healthSha || 'missing'}`
    });

    const ai = health.aiNewsDraft || {};
    const configPass = health.flags?.aiNewsDraftConfigured === true && health.flags?.aiNewsScheduleConfigured === true && ai.configurationValid === true;
    recorder.record('ai_news_runtime_config', configPass ? 'PASS' : 'FAIL', {
      summary: configPass
        ? `${ai.mode}/${ai.rolloutStage}; NewsData ${ai.newsProviderConfigured ? 'on' : 'off'}; OpenAI ${ai.aiProviderConfigured ? 'on' : 'off'}`
        : 'AI/news or scheduler runtime configuration is incomplete'
    });
    recorder.record('rollout_stage_guard', ai.rolloutStage === 'operator_acceptance' ? 'PASS' : ai.rolloutStage === 'limited_pro' ? 'WARN' : 'WARN', {
      summary: `Rollout stage ${ai.rolloutStage || 'missing'}; operator_acceptance is the safe initial gate`
    });
    recorder.record('automatic_publishing_disabled', ai.automaticPublishing === false && ai.schedule?.scheduledEffect === 'telegram_draft_only' ? 'PASS' : 'FAIL', {
      summary: `automaticPublishing=${ai.automaticPublishing}; scheduledEffect=${ai.schedule?.scheduledEffect || 'missing'}`
    });
    recorder.record('provider_telemetry_contract', ai.providerTelemetryRequired === true ? 'PASS' : 'FAIL', {
      summary: `providerTelemetryRequired=${ai.providerTelemetryRequired}; costEstimationConfigured=${ai.costEstimationConfigured}`
    });

    const telegram = getTelegramConfig();
    const apiBase = `https://api.telegram.org/bot${telegram.botToken}`;
    const me = await fetchJson(`${apiBase}/getMe`, { label: 'Telegram getMe' });
    telegramIdentity = me.result || null;
    const username = String(telegramIdentity?.username || '').toLowerCase();
    recorder.record('telegram_getme', me.ok && (!target.expectedBotUsername || username === target.expectedBotUsername) ? 'PASS' : 'FAIL', {
      summary: `Telegram bot @${username || 'unknown'}${target.expectedBotUsername ? `; expected @${target.expectedBotUsername}` : ''}`
    });

    const webhookPayload = await fetchJson(`${apiBase}/getWebhookInfo`, { label: 'Telegram getWebhookInfo' });
    webhook = webhookPayload.result || {};
    const expectedWebhook = `${target.baseUrl}/api/webhook`;
    recorder.record('telegram_webhook_url', webhook.url === expectedWebhook ? 'PASS' : 'FAIL', {
      summary: `Webhook ${webhook.url || 'missing'}; expected ${expectedWebhook}`
    });
    const pending = Number(webhook.pending_update_count || 0);
    recorder.record('telegram_pending_updates', pending >= 25 ? 'WARN' : 'PASS', { summary: `${pending} pending Telegram updates` });
    recorder.record('telegram_webhook_recent_error', webhook.last_error_message ? 'WARN' : 'PASS', {
      summary: webhook.last_error_message ? redactRuntimeError(webhook.last_error_message, secrets) : 'No webhook error reported'
    });

    pool = createReadOnlyPool();
    dbSnapshot = await queryReadOnlySnapshot(pool, target.telegramUserId);
    recorder.record('postgres_read_only_connection', 'PASS', {
      summary: `PostgreSQL ${dbSnapshot.server.version}; database ${dbSnapshot.server.database_name}`
    });

    const missingTables = REQUIRED_TABLES.filter((name) => !dbSnapshot.tables.includes(name));
    const missingColumns = REQUIRED_COLUMNS.map(([table, column]) => `${table}.${column}`).filter((name) => !dbSnapshot.columns.includes(name));
    const missingIndexes = REQUIRED_INDEXES.filter((name) => !dbSnapshot.indexes.includes(name));
    recorder.record('migration_030_031_032_runtime_schema', missingTables.length || missingColumns.length || missingIndexes.length ? 'FAIL' : 'PASS', {
      summary: missingTables.length || missingColumns.length || missingIndexes.length
        ? `Missing tables [${missingTables.join(', ')}], columns [${missingColumns.join(', ')}], indexes [${missingIndexes.join(', ')}]`
        : 'AI/news migrations 030, 031, and 032 runtime schema is present'
    });

    const impossibleTotal = Object.values(dbSnapshot.impossible || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    recorder.record('ai_news_impossible_states', impossibleTotal ? 'FAIL' : 'PASS', {
      summary: impossibleTotal ? `${impossibleTotal} impossible AI/news or LinkedIn receipt states detected` : 'No checked impossible AI/news or LinkedIn receipt states detected',
      counts: dbSnapshot.impossible
    });

    const metrics = Object.fromEntries(Object.entries(dbSnapshot.metrics || {}).map(([key, value]) => [key, Number(value || 0)]));
    recorder.record('provider_runtime_health', metrics.provider_failures_24h >= 5 ? 'FAIL' : metrics.provider_failures_24h > 0 ? 'WARN' : 'PASS', {
      summary: `NewsData ${metrics.newsdata_calls_24h}/24h; OpenAI ${metrics.openai_calls_24h}/24h; failures ${metrics.provider_failures_24h}; unknown LinkedIn outcomes ${metrics.unknown_share_outcomes_24h}`,
      metrics
    });
    recorder.record('cost_and_conversion_counters', 'PASS', {
      summary: `draft attempts ${metrics.draft_attempts_24h}; generated ${metrics.generated_drafts_24h}; edited ${metrics.edited_drafts_24h}; LinkedIn posts ${metrics.linkedin_posts_24h}; estimated cost $${(metrics.estimated_cost_microusd_24h / 1_000_000).toFixed(6)}`
    });

    if (target.telegramUserId) {
      const user = dbSnapshot.userSnapshot;
      recorder.record('acceptance_operator_profile', user?.profile_state === 'active' && user?.visibility_status === 'listed' ? 'PASS' : 'WARN', {
        summary: user ? `profile=${user.profile_state}/${user.visibility_status}; sources ${user.sources_24h}; drafts ${user.drafts_24h}; edited ${user.edited_24h}; published ${user.published_24h}; run-now ${user.run_now_24h}; scheduled delivered ${user.scheduled_delivered_24h}` : 'Telegram acceptance user was not found',
        userSnapshot: user
      });
    } else {
      recorder.record('acceptance_operator_profile', 'INFO', { summary: 'STEP061A_TELEGRAM_USER_ID not supplied; user-specific read-only evidence skipped' });
    }
  } catch (error) {
    recorder.record('preflight_execution', 'FAIL', { summary: redactRuntimeError(error?.message || error, secrets) });
  } finally {
    if (pool) await pool.end().catch(() => {});
    const result = recorder.write({
      target: target ? { baseUrl: target.baseUrl, artifactSha: target.artifactSha, telegramUserId: target.telegramUserId } : null,
      artifactSha: target?.artifactSha || null,
      healthArtifactSha: normalizeArtifactSha(health?.artifactSha),
      deployedRuntime: health?.runtime ? { node: health.runtime.node || null } : null,
      telegram: telegramIdentity ? { id: telegramIdentity.id, username: telegramIdentity.username } : null,
      webhook: webhook ? {
        url: webhook.url,
        pendingUpdateCount: webhook.pending_update_count,
        lastErrorDate: webhook.last_error_date || null,
        lastErrorMessage: webhook.last_error_message ? redactRuntimeError(webhook.last_error_message, secrets) : null
      } : null,
      database: dbSnapshot ? { server: dbSnapshot.server, metrics: dbSnapshot.metrics, userSnapshot: dbSnapshot.userSnapshot } : null,
      safety: { mutatingQueriesExecuted: false, transactionMode: 'READ ONLY', providerCallsExecuted: false }
    });
    console.log(JSON.stringify({ verdict: result.payload.verdict, jsonPath: result.jsonPath, mdPath: result.mdPath }, null, 2));
    if (['FAIL', 'BLOCKED'].includes(result.payload.verdict)) process.exitCode = 1;
  }
}

await main();
