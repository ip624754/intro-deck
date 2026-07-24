export async function getPublishedLinkedInShareByAttributionToken(client, attributionToken) {
  const result = await client.query(
    `select
       lsi.id as share_intent_id,
       lsi.profile_id,
       lsi.user_id as owner_user_id,
       lsi.provider_post_id,
       lsi.attribution_token,
       mp.profile_state,
       mp.visibility_status
     from linkedin_share_intents lsi
     join member_profiles mp on mp.id = lsi.profile_id
     where lsi.attribution_token = $1
       and lsi.source_kind = 'profile_share'
       and lsi.status = 'published'
       and lsi.attribution_revoked_at is null
     limit 1`,
    [attributionToken]
  );
  return result.rows[0] || null;
}

export async function upsertLinkedInShareAttributionSession(client, {
  visitorUserId,
  shareIntentId,
  profileId,
  expiresAt
}) {
  const result = await client.query(
    `insert into linkedin_share_attribution_sessions (
       visitor_user_id, share_intent_id, profile_id, expires_at
     ) values ($1, $2, $3, $4)
     on conflict (visitor_user_id)
     do update set
       share_intent_id = excluded.share_intent_id,
       profile_id = excluded.profile_id,
       expires_at = excluded.expires_at,
       first_opened_at = case
         when linkedin_share_attribution_sessions.share_intent_id = excluded.share_intent_id
           then linkedin_share_attribution_sessions.first_opened_at
         else now()
       end,
       last_opened_at = now(),
       updated_at = now()
     returning *`,
    [visitorUserId, shareIntentId, profileId, expiresAt]
  );
  return result.rows[0] || null;
}

export async function getActiveLinkedInShareAttributionSession(client, {
  visitorUserId,
  targetProfileId
}) {
  const result = await client.query(
    `select
       s.*,
       lsi.user_id as owner_user_id,
       lsi.provider_post_id,
       lsi.attribution_revoked_at,
       mp.profile_state,
       mp.visibility_status
     from linkedin_share_attribution_sessions s
     join linkedin_share_intents lsi on lsi.id = s.share_intent_id
     join member_profiles mp on mp.id = s.profile_id
     where s.visitor_user_id = $1
       and s.profile_id = $2
       and s.expires_at > now()
       and lsi.source_kind = 'profile_share'
       and lsi.status = 'published'
       and lsi.attribution_revoked_at is null
       and mp.profile_state = 'active'
       and mp.visibility_status = 'listed'
     limit 1`,
    [visitorUserId, targetProfileId]
  );
  return result.rows[0] || null;
}

export async function insertLinkedInShareAttributionEvent(client, {
  eventKey,
  shareIntentId,
  profileId,
  ownerUserId,
  visitorUserId,
  eventType,
  entityType = null,
  entityId = null,
  telegramUpdateId = null,
  detail = null
}) {
  const result = await client.query(
    `insert into linkedin_share_attribution_events (
       event_key,
       share_intent_id,
       profile_id,
       owner_user_id,
       visitor_user_id,
       event_type,
       entity_type,
       entity_id,
       telegram_update_id,
       detail_json
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     on conflict (event_key) do nothing
     returning *`,
    [
      eventKey,
      shareIntentId,
      profileId,
      ownerUserId,
      visitorUserId,
      eventType,
      entityType,
      entityId,
      telegramUpdateId,
      detail ? JSON.stringify(detail) : null
    ]
  );
  return result.rows[0] || null;
}

export async function getLinkedInShareSubmittedAttributionByEntity(client, {
  entityType,
  entityId,
  ownerTelegramUserId
}) {
  const result = await client.query(
    `select
       e.share_intent_id,
       e.profile_id,
       e.owner_user_id,
       e.visitor_user_id,
       u.telegram_user_id as owner_telegram_user_id
     from linkedin_share_attribution_events e
     join users u on u.id = e.owner_user_id
     join linkedin_share_intents lsi on lsi.id = e.share_intent_id
     where e.event_type = 'request_submitted'
       and e.entity_type = $1
       and e.entity_id = $2
       and u.telegram_user_id = $3
       and lsi.status = 'published'
       and lsi.attribution_revoked_at is null
     order by e.created_at asc
     limit 1`,
    [entityType, entityId, ownerTelegramUserId]
  );
  return result.rows[0] || null;
}
