export async function acquireAiNewsUserLock(client, userId) {
  await client.query(
    `select pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [`introdeck:ai_news:${userId}`]
  );
}

export async function getAiNewsPreferences(client, userId) {
  const result = await client.query(
    `select * from ai_news_preferences where user_id = $1 limit 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function upsertAiNewsPreferences(client, {
  userId,
  presetKey = 'ai_technology',
  customQuery = null,
  sourceLanguage = 'en',
  sourceCountry = null,
  sourceCategory = null,
  postLanguage = 'en',
  tone = 'professional'
}) {
  const result = await client.query(
    `insert into ai_news_preferences (
       user_id, preset_key, custom_query, source_language, source_country,
       source_category, post_language, tone
     ) values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (user_id) do update set
       preset_key = excluded.preset_key,
       custom_query = excluded.custom_query,
       source_language = excluded.source_language,
       source_country = excluded.source_country,
       source_category = excluded.source_category,
       post_language = excluded.post_language,
       tone = excluded.tone,
       updated_at = now()
     returning *`,
    [userId, presetKey, customQuery, sourceLanguage, sourceCountry, sourceCategory, postLanguage, tone]
  );
  return result.rows[0];
}

export async function patchAiNewsPreferences(client, { userId, patch }) {
  const current = await getAiNewsPreferences(client, userId);
  const next = {
    presetKey: patch.presetKey ?? current?.preset_key ?? 'ai_technology',
    customQuery: patch.customQuery !== undefined ? patch.customQuery : (current?.custom_query ?? null),
    sourceLanguage: patch.sourceLanguage ?? current?.source_language ?? 'en',
    sourceCountry: patch.sourceCountry !== undefined ? patch.sourceCountry : (current?.source_country ?? null),
    sourceCategory: patch.sourceCategory !== undefined ? patch.sourceCategory : (current?.source_category ?? null),
    postLanguage: patch.postLanguage ?? current?.post_language ?? 'en',
    tone: patch.tone ?? current?.tone ?? 'professional'
  };
  return upsertAiNewsPreferences(client, { userId, ...next });
}


export async function claimAiNewsSourceSearch(client, { userId, cooldownSeconds, dailyLimit, ignoreCooldown = false }) {
  await client.query(
    `insert into ai_news_preferences (user_id) values ($1)
     on conflict (user_id) do nothing`,
    [userId]
  );
  const result = await client.query(
    `select * from ai_news_preferences where user_id=$1 limit 1 for update`,
    [userId]
  );
  const row = result.rows[0];
  const now = Date.now();
  const lastSearchAt = row?.last_search_started_at ? new Date(row.last_search_started_at).getTime() : 0;
  if (!ignoreCooldown && lastSearchAt && lastSearchAt > now - (cooldownSeconds * 1000)) {
    return { claimed: false, reason: 'ai_news_search_cooldown', retryAfterSeconds: Math.max(1, Math.ceil((lastSearchAt + cooldownSeconds * 1000 - now) / 1000)) };
  }
  const windowStartedAt = row?.search_window_started_at ? new Date(row.search_window_started_at).getTime() : 0;
  const windowActive = windowStartedAt && windowStartedAt > now - (24 * 60 * 60 * 1000);
  const count = windowActive ? Number(row.search_count_in_window || 0) : 0;
  if (count >= dailyLimit) return { claimed: false, reason: 'ai_news_search_daily_limit_reached', used: count, limit: dailyLimit };
  const updated = await client.query(
    `update ai_news_preferences
     set last_search_started_at=now(),
         search_window_started_at=case when search_window_started_at is null or search_window_started_at <= now() - interval '24 hours' then now() else search_window_started_at end,
         search_count_in_window=case when search_window_started_at is null or search_window_started_at <= now() - interval '24 hours' then 1 else search_count_in_window + 1 end,
         updated_at=now()
     where user_id=$1
     returning *`,
    [userId]
  );
  return { claimed: true, preferences: updated.rows[0], used: Number(updated.rows[0]?.search_count_in_window || 0), limit: dailyLimit };
}

export async function getAiNewsDraftByUserAndSource(client, { userId, sourceId }) {
  const result = await client.query(
    `select * from ai_news_drafts
     where user_id=$1 and source_id=$2 and status not in ('failed','cancelled','expired')
     order by created_at desc limit 1`,
    [userId, sourceId]
  );
  return result.rows[0] || null;
}

export async function countAiNewsDraftsSince(client, { userId, since }) {
  const result = await client.query(
    `select count(*)::int as count
     from ai_news_drafts
     where user_id = $1
       and created_at >= $2`,
    [userId, since]
  );
  return result.rows[0]?.count || 0;
}

export async function getBlockingAiNewsDraft(client, userId, { forUpdate = false } = {}) {
  await client.query(
    `update ai_news_drafts set status='expired', updated_at=now()
     where user_id=$1 and status in ('generating','draft','editing') and expires_at <= now()`,
    [userId]
  );
  const result = await client.query(
    `select * from ai_news_drafts
     where user_id = $1
       and status in ('generating', 'draft', 'editing', 'share_ready', 'unknown')
     order by created_at desc
     limit 1
     ${forUpdate ? 'for update' : ''}`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function upsertAiNewsSource(client, {
  publicToken,
  userId,
  providerArticleId,
  sourceUrl,
  sourceUrlHash,
  sourceTitle,
  sourceName,
  sourceDomain,
  sourceDescription,
  sourceContentExcerpt,
  sourceLanguage,
  sourceCountry,
  sourceCategories,
  publishedAt,
  querySnapshot,
  evidenceHash,
  expiresAt
}) {
  const result = await client.query(
    `insert into ai_news_sources (
       public_token, user_id, provider, provider_article_id, source_url, source_url_hash,
       source_title, source_name, source_domain, source_description, source_content_excerpt,
       source_language, source_country, source_categories_json, published_at,
       query_snapshot, evidence_hash, expires_at
     ) values (
       $1::uuid, $2, 'newsdata', $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13::jsonb, $14,
       $15, $16, $17
     )
     on conflict (user_id, source_url_hash) do update set
       provider_article_id = excluded.provider_article_id,
       source_title = excluded.source_title,
       source_name = excluded.source_name,
       source_domain = excluded.source_domain,
       source_description = excluded.source_description,
       source_content_excerpt = excluded.source_content_excerpt,
       source_language = excluded.source_language,
       source_country = excluded.source_country,
       source_categories_json = excluded.source_categories_json,
       published_at = excluded.published_at,
       query_snapshot = excluded.query_snapshot,
       evidence_hash = excluded.evidence_hash,
       fetched_at = now(),
       expires_at = excluded.expires_at,
       updated_at = now()
     returning *`,
    [
      publicToken, userId, providerArticleId, sourceUrl, sourceUrlHash,
      sourceTitle, sourceName, sourceDomain, sourceDescription, sourceContentExcerpt,
      sourceLanguage, sourceCountry, JSON.stringify(sourceCategories || []), publishedAt,
      querySnapshot, evidenceHash, expiresAt
    ]
  );
  return result.rows[0];
}

export async function listRecentAiNewsSources(client, { userId, limit = 5 }) {
  const result = await client.query(
    `select * from ai_news_sources
     where user_id = $1 and expires_at > now()
     order by published_at desc, fetched_at desc
     limit $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function getAiNewsSourceByToken(client, { publicToken, userId, forUpdate = false }) {
  const result = await client.query(
    `select * from ai_news_sources
     where public_token = $1::uuid and user_id = $2
     limit 1
     ${forUpdate ? 'for update' : ''}`,
    [publicToken, userId]
  );
  return result.rows[0] || null;
}

export async function insertAiNewsDraftEvent(client, { draftId, eventType, detail = null }) {
  await client.query(
    `insert into ai_news_draft_events (draft_id, event_type, detail_json)
     values ($1, $2, $3::jsonb)`,
    [draftId, eventType, detail ? JSON.stringify(detail) : null]
  );
}

export async function createGeneratingAiNewsDraft(client, {
  publicToken,
  userId,
  profileId,
  sourceId,
  postLanguage,
  tone,
  generationInputHash,
  sourceEvidenceHash,
  expiresAt,
  presetId = null,
  presetRunId = null,
  deliveryKind = 'manual'
}) {
  const result = await client.query(
    `insert into ai_news_drafts (
       public_token, user_id, profile_id, source_id, status,
       post_language, tone, generation_input_hash, source_evidence_hash, expires_at,
       preset_id, preset_run_id, delivery_kind
     ) values ($1::uuid, $2, $3, $4, 'generating', $5, $6, $7, $8, $9, $10, $11, $12)
     returning *`,
    [publicToken, userId, profileId, sourceId, postLanguage, tone, generationInputHash, sourceEvidenceHash, expiresAt, presetId, presetRunId, deliveryKind]
  );
  await insertAiNewsDraftEvent(client, {
    draftId: result.rows[0].id,
    eventType: 'generation_started',
    detail: { sourceId, postLanguage, tone, allowanceConsumed: true, presetId, presetRunId, deliveryKind }
  });
  return result.rows[0];
}

export async function finalizeAiNewsDraftGenerated(client, {
  draftId,
  postText,
  evidenceClaims,
  modelProvider,
  modelName,
  providerResponseId,
  providerRequestId = null
}) {
  const result = await client.query(
    `update ai_news_drafts
     set status='draft', post_text=$2, ai_generated_text=$2,
         evidence_claims_json=$3::jsonb, model_provider=$4, model_name=$5,
         provider_response_id=$6, provider_request_id=$7, generation_error_code=null, updated_at=now()
     where id=$1 and status='generating'
     returning *`,
    [draftId, postText, JSON.stringify(evidenceClaims || []), modelProvider, modelName, providerResponseId, providerRequestId]
  );
  if (result.rows[0]) {
    await insertAiNewsDraftEvent(client, {
      draftId,
      eventType: 'generation_completed',
      detail: { modelProvider, modelName, providerRequestId, evidenceClaimCount: (evidenceClaims || []).length }
    });
  }
  return result.rows[0] || null;
}

export async function finalizeAiNewsDraftFailed(client, { draftId, errorCode }) {
  const result = await client.query(
    `update ai_news_drafts
     set status='failed', generation_error_code=$2, updated_at=now()
     where id=$1 and status='generating'
     returning *`,
    [draftId, String(errorCode || 'ai_news_generation_failed').slice(0, 200)]
  );
  if (result.rows[0]) {
    await insertAiNewsDraftEvent(client, { draftId, eventType: 'generation_failed', detail: { errorCode } });
  }
  return result.rows[0] || null;
}

export async function getAiNewsDraftByToken(client, { publicToken, userId, forUpdate = false }) {
  const result = await client.query(
    `select
       d.*,
       s.public_token as source_public_token,
       s.source_url, s.source_title, s.source_name, s.source_domain,
       s.source_description, s.source_content_excerpt, s.published_at,
       s.query_snapshot, s.evidence_hash,
       lsi.public_token as share_public_token,
       lsi.visibility as share_visibility,
       lsi.status as share_status
     from ai_news_drafts d
     join ai_news_sources s on s.id = d.source_id
     left join linkedin_share_intents lsi on lsi.id = d.share_intent_id
     where d.public_token = $1::uuid and d.user_id = $2
     limit 1
     ${forUpdate ? 'for update of d' : ''}`,
    [publicToken, userId]
  );
  return result.rows[0] || null;
}

export async function getLatestAiNewsDraftForUser(client, userId) {
  const result = await client.query(
    `select
       d.*,
       s.public_token as source_public_token,
       s.source_url, s.source_title, s.source_name, s.source_domain,
       s.source_description, s.source_content_excerpt, s.published_at,
       s.query_snapshot, s.evidence_hash,
       lsi.public_token as share_public_token,
       lsi.visibility as share_visibility,
       lsi.status as share_status
     from ai_news_drafts d
     join ai_news_sources s on s.id = d.source_id
     left join linkedin_share_intents lsi on lsi.id = d.share_intent_id
     where d.user_id = $1
     order by d.created_at desc
     limit 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function updateAiNewsDraftText(client, { draftId, postText }) {
  const result = await client.query(
    `update ai_news_drafts
     set status='draft', post_text=$2, edited_by_user=true, evidence_claims_json='[]'::jsonb, updated_at=now()
     where id=$1 and status in ('draft', 'editing')
     returning *`,
    [draftId, postText]
  );
  if (result.rows[0]) {
    await insertAiNewsDraftEvent(client, { draftId, eventType: 'draft_edited' });
  }
  return result.rows[0] || null;
}

export async function cancelAiNewsDraft(client, { draftId }) {
  const result = await client.query(
    `update ai_news_drafts
     set status='cancelled', updated_at=now()
     where id=$1 and status in ('draft', 'editing', 'failed')
     returning *`,
    [draftId]
  );
  if (result.rows[0]) await insertAiNewsDraftEvent(client, { draftId, eventType: 'cancelled' });
  return result.rows[0] || null;
}

export async function attachAiNewsDraftShareIntent(client, { draftId, shareIntentId }) {
  const result = await client.query(
    `update ai_news_drafts
     set status='share_ready', share_intent_id=$2, confirmed_at=now(), updated_at=now()
     where id=$1 and status='draft' and share_intent_id is null
     returning *`,
    [draftId, shareIntentId]
  );
  if (result.rows[0]) {
    await insertAiNewsDraftEvent(client, { draftId, eventType: 'share_authorized', detail: { shareIntentId } });
  }
  return result.rows[0] || null;
}

export async function markAiNewsDraftPublishedByShareIntent(client, { shareIntentId }) {
  const result = await client.query(
    `update ai_news_drafts
     set status='published', published_at=now(), updated_at=now()
     where share_intent_id=$1 and status in ('share_ready', 'unknown')
     returning *`,
    [shareIntentId]
  );
  if (result.rows[0]) await insertAiNewsDraftEvent(client, { draftId: result.rows[0].id, eventType: 'published', detail: { shareIntentId } });
  return result.rows[0] || null;
}

export async function markAiNewsDraftShareFailed(client, { shareIntentId, outcomeUnknown = false }) {
  const status = outcomeUnknown ? 'unknown' : 'failed';
  const result = await client.query(
    `update ai_news_drafts
     set status=$2, updated_at=now()
     where share_intent_id=$1 and status='share_ready'
     returning *`,
    [shareIntentId, status]
  );
  if (result.rows[0]) await insertAiNewsDraftEvent(client, { draftId: result.rows[0].id, eventType: outcomeUnknown ? 'share_outcome_unknown' : 'share_failed', detail: { shareIntentId } });
  return result.rows[0] || null;
}

export async function reopenAiNewsDraftAfterShareCancel(client, { shareIntentId, reason = 'cancelled' }) {
  const result = await client.query(
    `update ai_news_drafts
     set status='draft', share_intent_id=null, confirmed_at=null, updated_at=now()
     where share_intent_id=$1 and status='share_ready'
     returning *`,
    [shareIntentId]
  );
  if (result.rows[0]) await insertAiNewsDraftEvent(client, { draftId: result.rows[0].id, eventType: `share_${reason}`, detail: { shareIntentId, reason } });
  return result.rows[0] || null;
}

export async function beginAiNewsInputSession(client, { userId, inputKind, draftId = null, expiresAt }) {
  const result = await client.query(
    `insert into ai_news_input_sessions (user_id, input_kind, draft_id, expires_at)
     values ($1, $2, $3, $4)
     on conflict (user_id) do update set
       input_kind=excluded.input_kind, draft_id=excluded.draft_id,
       expires_at=excluded.expires_at, updated_at=now()
     returning *`,
    [userId, inputKind, draftId, expiresAt]
  );
  return result.rows[0];
}

export async function getAiNewsInputSession(client, { userId, forUpdate = false }) {
  const result = await client.query(
    `select * from ai_news_input_sessions
     where user_id=$1
     limit 1
     ${forUpdate ? 'for update' : ''}`,
    [userId]
  );
  const session = result.rows[0] || null;
  if (session && new Date(session.expires_at).getTime() <= Date.now()) {
    await client.query(`delete from ai_news_input_sessions where user_id=$1`, [userId]);
    return null;
  }
  return session;
}

export async function clearAiNewsInputSession(client, { userId }) {
  await client.query(`delete from ai_news_input_sessions where user_id=$1`, [userId]);
}
