export async function listAiNewsPresets(client, { userId, includeDeleted = false }) {
  const result = await client.query(
    `select * from ai_news_presets
     where user_id=$1 ${includeDeleted ? '' : "and status <> 'deleted'"}
     order by created_at asc, id asc`,
    [userId]
  );
  return result.rows;
}

export async function countAiNewsPresets(client, { userId }) {
  const result = await client.query(
    `select count(*)::int as count from ai_news_presets where user_id=$1 and status <> 'deleted'`,
    [userId]
  );
  return Number(result.rows[0]?.count || 0);
}

export async function getAiNewsPresetByToken(client, { userId, publicToken, forUpdate = false }) {
  const result = await client.query(
    `select * from ai_news_presets
     where user_id=$1 and public_token=$2::uuid and status <> 'deleted'
     limit 1 ${forUpdate ? 'for update' : ''}`,
    [userId, publicToken]
  );
  return result.rows[0] || null;
}

export async function createAiNewsPreset(client, {
  publicToken,
  userId,
  name,
  presetKey,
  customQuery,
  sourceLanguage,
  sourceCountry,
  sourceCategory,
  postLanguage,
  tone,
  scheduleKind,
  deliveryHourUtc,
  nextRunAt
}) {
  const result = await client.query(
    `insert into ai_news_presets (
       public_token, user_id, name, preset_key, custom_query,
       source_language, source_country, source_category, post_language, tone,
       schedule_kind, delivery_hour_utc, status, next_run_at
     ) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',$13)
     returning *`,
    [
      publicToken, userId, name, presetKey, customQuery,
      sourceLanguage, sourceCountry, sourceCategory, postLanguage, tone,
      scheduleKind, deliveryHourUtc, nextRunAt
    ]
  );
  return result.rows[0];
}

export async function updateAiNewsPresetSchedule(client, {
  presetId,
  scheduleKind,
  deliveryHourUtc,
  nextRunAt
}) {
  const result = await client.query(
    `update ai_news_presets
     set schedule_kind=$2, delivery_hour_utc=$3, next_run_at=$4,
         status=case when status='deleted' then status else 'active' end,
         last_error_code=null, updated_at=now()
     where id=$1 and status <> 'deleted'
     returning *`,
    [presetId, scheduleKind, deliveryHourUtc, nextRunAt]
  );
  return result.rows[0] || null;
}

export async function setAiNewsPresetStatus(client, { presetId, status, nextRunAt = null, errorCode = null }) {
  const result = await client.query(
    `update ai_news_presets
     set status=$2,
         next_run_at=case when $2='active' then $3 else null end,
         last_error_code=$4,
         updated_at=now()
     where id=$1 and status <> 'deleted'
     returning *`,
    [presetId, status, nextRunAt, errorCode]
  );
  return result.rows[0] || null;
}

export async function softDeleteAiNewsPreset(client, { presetId }) {
  const result = await client.query(
    `update ai_news_presets
     set status='deleted', deleted_at=now(), next_run_at=null, updated_at=now()
     where id=$1 and status <> 'deleted'
     returning *`,
    [presetId]
  );
  return result.rows[0] || null;
}

export async function listDueAiNewsPresetsForClaim(client, { batchSize }) {
  const result = await client.query(
    `with ranked_due as (
       select p.id,
              row_number() over (partition by p.user_id order by p.next_run_at asc, p.id asc) as user_due_rank
       from ai_news_presets p
       where p.status='active'
         and p.schedule_kind in ('daily','weekdays')
         and p.next_run_at is not null
         and p.next_run_at <= now()
         and not exists (
           select 1
           from ai_news_drafts d
           where d.user_id=p.user_id
             and (
               d.status in ('share_ready','unknown')
               or (d.status in ('generating','draft','editing') and d.expires_at > now())
             )
         )
     )
     select p.*, u.telegram_user_id, u.telegram_username
     from ai_news_presets p
     join ranked_due r on r.id=p.id and r.user_due_rank=1
     join users u on u.id=p.user_id
     order by p.next_run_at asc, p.id asc
     limit $1
     for update of p skip locked`,
    [batchSize]
  );
  return result.rows;
}

export async function createScheduledAiNewsPresetRun(client, {
  preset,
  publicToken,
  claimToken,
  claimExpiresAt,
  nextRunAt
}) {
  const inserted = await client.query(
    `insert into ai_news_preset_runs (
       public_token, preset_id, user_id, trigger_kind, scheduled_for,
       status, attempt_count, claim_token, claimed_at, claim_expires_at,
       detail_json
     ) values ($1::uuid,$2,$3,'scheduled',$4,'claimed',1,$5::uuid,now(),$6,$7::jsonb)
     on conflict (preset_id, scheduled_for) where trigger_kind='scheduled' do nothing
     returning *`,
    [
      publicToken,
      preset.id,
      preset.user_id,
      preset.next_run_at,
      claimToken,
      claimExpiresAt,
      JSON.stringify({
        presetName: preset.name,
        presetKey: preset.preset_key,
        scheduleKind: preset.schedule_kind,
        deliveryHourUtc: preset.delivery_hour_utc
      })
    ]
  );
  await client.query(
    `update ai_news_presets
     set next_run_at=$2, last_run_at=now(), updated_at=now()
     where id=$1`,
    [preset.id, nextRunAt]
  );
  return inserted.rows[0] || null;
}

export async function createRunNowAiNewsPresetRun(client, {
  publicToken,
  presetId,
  userId,
  claimToken,
  claimExpiresAt
}) {
  const result = await client.query(
    `insert into ai_news_preset_runs (
       public_token, preset_id, user_id, trigger_kind, scheduled_for,
       status, attempt_count, claim_token, claimed_at, claim_expires_at
     ) values ($1::uuid,$2,$3,'run_now',now(),'claimed',1,$4::uuid,now(),$5)
     returning *`,
    [publicToken, presetId, userId, claimToken, claimExpiresAt]
  );
  await client.query(`update ai_news_presets set last_run_at=now(), updated_at=now() where id=$1`, [presetId]);
  return result.rows[0];
}

export async function getAiNewsPresetRunEnvelope(client, { runId, forUpdate = false }) {
  const result = await client.query(
    `select
       r.*,
       p.public_token as preset_public_token,
       p.name as preset_name,
       p.preset_key, p.custom_query, p.source_language, p.source_country, p.source_category,
       p.post_language, p.tone, p.schedule_kind, p.delivery_hour_utc, p.status as preset_status,
       u.telegram_user_id, u.telegram_username,
       d.id as draft_id, d.public_token as draft_public_token, d.status as draft_status,
       d.post_text, d.source_id as draft_source_id,
       s.source_title, s.source_name, s.source_domain, s.source_url, s.published_at
     from ai_news_preset_runs r
     join ai_news_presets p on p.id=r.preset_id
     join users u on u.id=r.user_id
     left join ai_news_drafts d on d.preset_run_id=r.id
     left join ai_news_sources s on s.id=d.source_id
     where r.id=$1
     limit 1 ${forUpdate ? 'for update of r' : ''}`,
    [runId]
  );
  return result.rows[0] || null;
}

export async function attachAiNewsPresetRunSource(client, { runId, sourceId }) {
  const result = await client.query(
    `update ai_news_preset_runs
     set source_id=$2, status='generating', updated_at=now()
     where id=$1 and status in ('claimed','searching')
     returning *`,
    [runId, sourceId]
  );
  return result.rows[0] || null;
}

export async function markAiNewsPresetRunStatus(client, {
  runId,
  status,
  errorCode = null,
  nextAttemptAt = null,
  telegramMessageId = null,
  detail = null,
  clearClaim = true
}) {
  const result = await client.query(
    `update ai_news_preset_runs
     set status=$2,
         error_code=$3,
         next_attempt_at=$4,
         telegram_message_id=coalesce($5, telegram_message_id),
         detail_json=coalesce($6::jsonb, detail_json),
         delivered_at=case when $2='delivered' then now() else delivered_at end,
         claim_token=case when $7 then null else claim_token end,
         claimed_at=case when $7 then null else claimed_at end,
         claim_expires_at=case when $7 then null else claim_expires_at end,
         updated_at=now()
     where id=$1
     returning *`,
    [runId, status, errorCode, nextAttemptAt, telegramMessageId, detail ? JSON.stringify(detail) : null, clearClaim]
  );
  return result.rows[0] || null;
}

export async function markAiNewsPresetSuccess(client, { presetId }) {
  await client.query(
    `update ai_news_presets
     set last_success_at=now(), last_error_code=null, updated_at=now()
     where id=$1`,
    [presetId]
  );
}

export async function markAiNewsPresetError(client, { presetId, errorCode }) {
  await client.query(
    `update ai_news_presets
     set last_error_code=$2, updated_at=now()
     where id=$1`,
    [presetId, String(errorCode || 'ai_news_preset_failed').slice(0, 160)]
  );
}

export async function listRetryableAiNewsPresetRunsForClaim(client, {
  batchSize,
  claimToken,
  claimExpiresAt,
  maxAttempts
}) {
  const result = await client.query(
    `with candidates as (
       select id
       from ai_news_preset_runs
       where status='retry_due'
         and next_attempt_at is not null
         and next_attempt_at <= now()
         and attempt_count < $2
       order by next_attempt_at asc, id asc
       limit $1
       for update skip locked
     )
     update ai_news_preset_runs r
     set status='claimed',
         attempt_count=r.attempt_count+1,
         claim_token=$3::uuid,
         claimed_at=now(),
         claim_expires_at=$4,
         next_attempt_at=null,
         updated_at=now()
     from candidates c
     where r.id=c.id
     returning r.*`,
    [batchSize, maxAttempts, claimToken, claimExpiresAt]
  );
  return result.rows;
}

export async function getAiNewsPresetOperatorSummary(client) {
  const result = await client.query(
    `select
       (select count(*)::int from ai_news_presets where status='active') as active_presets,
       (select count(*)::int from ai_news_presets where status='paused') as paused_presets,
       (select count(*)::int from ai_news_presets where status='active' and next_run_at <= now()) as due_presets,
       (select count(*)::int from ai_news_preset_runs where created_at >= now()-interval '24 hours') as runs_24h,
       (select count(*)::int from ai_news_preset_runs where status='delivered' and created_at >= now()-interval '24 hours') as delivered_24h,
       (select count(*)::int from ai_news_preset_runs where status='failed' and created_at >= now()-interval '24 hours') as failed_24h,
       (select count(*)::int from ai_news_preset_runs where status='blocked' and created_at >= now()-interval '24 hours') as blocked_24h,
       (select count(*)::int from ai_news_preset_runs where status='retry_due') as retry_due`);
  const row = result.rows[0] || {};
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value || 0)]));
}

export async function markAiNewsPresetRunDraftReady(client, { runId, sourceId }) {
  const result = await client.query(
    `update ai_news_preset_runs
     set source_id=$2, status='draft_ready', error_code=null,
         claim_token=null, claimed_at=null, claim_expires_at=null,
         updated_at=now()
     where id=$1 and status in ('claimed','searching','generating')
     returning *`,
    [runId, sourceId]
  );
  return result.rows[0] || null;
}
