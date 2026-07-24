export async function acquireLinkedInShareUserLock(client, userId) {
  await client.query(
    `select pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [`linkedin-share-user:${userId}`]
  );
}

export async function getBlockingLinkedInShareIntentForUser(client, userId) {
  const result = await client.query(
    `select *
     from linkedin_share_intents
     where user_id = $1
       and status in ('publishing', 'unknown')
     order by created_at desc
     limit 1
     for update`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function insertLinkedInShareEvent(client, { shareIntentId, eventType, detail = null }) {
  await client.query(
    `insert into linkedin_share_events (share_intent_id, event_type, detail_json)
     values ($1, $2, $3::jsonb)`,
    [shareIntentId, eventType, detail ? JSON.stringify(detail) : null]
  );
}

export async function createLinkedInShareIntent(client, {
  publicToken,
  userId,
  linkedinAccountId,
  profileId,
  postText,
  visibility,
  expiresAt,
  sourceKind = 'profile_share',
  sourceRefId = null,
  sourceSnapshotHash = null,
  attributionToken = null,
  attributionReady = false
}) {
  await client.query(
    `update linkedin_share_intents
     set status = 'cancelled', updated_at = now(), failure_reason = 'superseded_by_new_draft'
     where user_id = $1
       and status in ('draft', 'authorization_started')`,
    [userId]
  );

  const result = attributionReady
    ? await client.query(
        `insert into linkedin_share_intents (
           public_token, user_id, linkedin_account_id, profile_id,
           post_text, visibility, status, expires_at,
           source_kind, source_ref_id, source_snapshot_hash, attribution_token
         ) values ($1::uuid, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11)
         returning *`,
        [publicToken, userId, linkedinAccountId, profileId, postText, visibility, expiresAt, sourceKind, sourceRefId, sourceSnapshotHash, attributionToken]
      )
    : await client.query(
        `insert into linkedin_share_intents (
           public_token, user_id, linkedin_account_id, profile_id,
           post_text, visibility, status, expires_at,
           source_kind, source_ref_id, source_snapshot_hash
         ) values ($1::uuid, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10)
         returning *`,
        [publicToken, userId, linkedinAccountId, profileId, postText, visibility, expiresAt, sourceKind, sourceRefId, sourceSnapshotHash]
      );

  const row = result.rows[0];
  await insertLinkedInShareEvent(client, {
    shareIntentId: row.id,
    eventType: 'draft_created',
    detail: { visibility, expiresAt, sourceKind, sourceRefId }
  });
  return row;
}

export async function getLinkedInShareIntentByToken(client, publicToken, { forUpdate = false } = {}) {
  const result = await client.query(
    `select
       lsi.*,
       u.telegram_user_id,
       u.telegram_username,
       la.linkedin_sub,
       mp.visibility_status as current_visibility_status,
       mp.profile_state as current_profile_state
     from linkedin_share_intents lsi
     join users u on u.id = lsi.user_id
     join linkedin_accounts la on la.id = lsi.linkedin_account_id
     join member_profiles mp on mp.id = lsi.profile_id
     where lsi.public_token = $1::uuid
     limit 1
     ${forUpdate ? 'for update of lsi' : ''}`,
    [publicToken]
  );
  return result.rows[0] || null;
}

export async function markLinkedInShareAuthorizationStarted(client, { publicToken, telegramUserId }) {
  const intent = await getLinkedInShareIntentByToken(client, publicToken, { forUpdate: true });
  if (!intent) return { ok: false, reason: 'share_intent_not_found' };
  if (String(intent.telegram_user_id) !== String(telegramUserId)) return { ok: false, reason: 'share_intent_owner_mismatch' };
  if (new Date(intent.expires_at).getTime() <= Date.now()) {
    await client.query(`update linkedin_share_intents set status='expired', updated_at=now() where id=$1`, [intent.id]);
    await insertLinkedInShareEvent(client, { shareIntentId: intent.id, eventType: 'expired' });
    return { ok: false, reason: 'share_intent_expired', intent: { ...intent, status: 'expired' } };
  }
  if (intent.status === 'published') return { ok: true, alreadyPublished: true, intent };
  if (!['draft', 'authorization_started', 'failed'].includes(intent.status)) {
    return { ok: false, reason: `share_intent_${intent.status}` };
  }

  const result = await client.query(
    `update linkedin_share_intents
     set status='authorization_started', confirmed_at=coalesce(confirmed_at, now()), updated_at=now()
     where id=$1
     returning *`,
    [intent.id]
  );
  await insertLinkedInShareEvent(client, { shareIntentId: intent.id, eventType: 'authorization_started' });
  return { ok: true, intent: { ...intent, ...result.rows[0] } };
}

export async function cancelLinkedInShareIntent(client, { publicToken, telegramUserId }) {
  const intent = await getLinkedInShareIntentByToken(client, publicToken, { forUpdate: true });
  if (!intent) return { changed: false, reason: 'share_intent_not_found' };
  if (String(intent.telegram_user_id) !== String(telegramUserId)) return { changed: false, reason: 'share_intent_owner_mismatch' };
  if (!['draft', 'authorization_started', 'failed'].includes(intent.status)) {
    return { changed: false, reason: `share_intent_${intent.status}` };
  }
  await client.query(`update linkedin_share_intents set status='cancelled', updated_at=now() where id=$1`, [intent.id]);
  await insertLinkedInShareEvent(client, { shareIntentId: intent.id, eventType: 'cancelled' });
  return { changed: true, intent: { ...intent, status: 'cancelled' } };
}

export async function claimLinkedInShareIntent(client, {
  publicToken,
  telegramUserId,
  linkedinSub,
  claimToken,
  staleAfterSeconds
}) {
  const intent = await getLinkedInShareIntentByToken(client, publicToken, { forUpdate: true });
  if (!intent) return { claimed: false, reason: 'share_intent_not_found' };
  if (String(intent.telegram_user_id) !== String(telegramUserId)) return { claimed: false, reason: 'share_intent_owner_mismatch' };
  if (String(intent.linkedin_sub) !== String(linkedinSub)) return { claimed: false, reason: 'share_intent_linkedin_identity_mismatch' };
  if (intent.current_profile_state !== 'active' || intent.current_visibility_status !== 'listed') {
    return { claimed: false, reason: 'share_profile_not_listed' };
  }
  if (new Date(intent.expires_at).getTime() <= Date.now()) {
    await client.query(`update linkedin_share_intents set status='expired', updated_at=now() where id=$1`, [intent.id]);
    await insertLinkedInShareEvent(client, { shareIntentId: intent.id, eventType: 'expired' });
    return { claimed: false, reason: 'share_intent_expired', intent: { ...intent, status: 'expired' } };
  }
  if (intent.status === 'published') return { claimed: false, alreadyPublished: true, intent };
  if (intent.status === 'unknown') return { claimed: false, reason: 'share_outcome_unknown', intent };
  if (intent.status === 'cancelled' || intent.status === 'expired') return { claimed: false, reason: `share_intent_${intent.status}` };

  if (intent.status === 'publishing') {
    const startedAt = intent.claim_started_at ? new Date(intent.claim_started_at).getTime() : 0;
    if (startedAt > Date.now() - (staleAfterSeconds * 1000)) {
      return { claimed: false, inProgress: true, reason: 'share_publish_in_progress', intent };
    }
    // A stale external publish attempt is indeterminate. Never retry automatically.
    await client.query(
      `update linkedin_share_intents
       set status='unknown', failure_reason='stale_publish_claim_outcome_unknown', updated_at=now()
       where id=$1`,
      [intent.id]
    );
    await insertLinkedInShareEvent(client, {
      shareIntentId: intent.id,
      eventType: 'outcome_unknown',
      detail: { reason: 'stale_publish_claim' }
    });
    return { claimed: false, reason: 'share_outcome_unknown', intent: { ...intent, status: 'unknown' } };
  }

  if (!['draft', 'authorization_started', 'failed'].includes(intent.status)) {
    return { claimed: false, reason: `share_intent_${intent.status}` };
  }

  const result = await client.query(
    `update linkedin_share_intents
     set status='publishing', claim_token=$2::uuid, claim_started_at=now(),
         attempt_count=attempt_count+1, updated_at=now(), failure_reason=null,
         provider_request_id=null, provider_http_status=null, provider_error_code=null
     where id=$1
     returning *`,
    [intent.id, claimToken]
  );
  await insertLinkedInShareEvent(client, {
    shareIntentId: intent.id,
    eventType: 'publish_claimed',
    detail: { attemptCount: result.rows[0].attempt_count }
  });
  return { claimed: true, intent: { ...intent, ...result.rows[0] } };
}

export async function finalizeLinkedInSharePublished(client, {
  shareIntentId,
  claimToken,
  providerPostId,
  providerRequestId,
  providerHttpStatus
}) {
  const result = await client.query(
    `update linkedin_share_intents
     set status='published', provider_post_id=$3, provider_request_id=$4,
         provider_http_status=$5, provider_error_code=null,
         published_at=now(), updated_at=now(),
         claim_token=null, claim_started_at=null, failure_reason=null
     where id=$1 and claim_token=$2::uuid and status='publishing'
     returning *`,
    [shareIntentId, claimToken, providerPostId, providerRequestId, providerHttpStatus]
  );
  if (!result.rows[0]) return null;
  await insertLinkedInShareEvent(client, {
    shareIntentId,
    eventType: 'published',
    detail: { providerPostId, providerRequestId, providerHttpStatus }
  });
  return result.rows[0];
}

export async function finalizeLinkedInShareFailed(client, {
  shareIntentId,
  claimToken,
  status,
  providerRequestId = null,
  providerHttpStatus = null,
  providerErrorCode = null,
  failureReason = null
}) {
  const result = await client.query(
    `update linkedin_share_intents
     set status=$3, provider_request_id=$4, provider_http_status=$5,
         provider_error_code=$6, failure_reason=$7, updated_at=now(),
         claim_token=null, claim_started_at=null
     where id=$1 and claim_token=$2::uuid and status='publishing'
     returning *`,
    [shareIntentId, claimToken, status, providerRequestId, providerHttpStatus, providerErrorCode, failureReason]
  );
  if (!result.rows[0]) return null;
  await insertLinkedInShareEvent(client, {
    shareIntentId,
    eventType: status === 'unknown' ? 'outcome_unknown' : 'publish_failed',
    detail: { providerRequestId, providerHttpStatus, providerErrorCode, failureReason }
  });
  return result.rows[0];
}


export async function markLinkedInShareOutcomeUnknownAfterProviderSuccess(client, {
  shareIntentId,
  claimToken,
  providerPostId,
  providerRequestId,
  providerHttpStatus,
  failureReason
}) {
  const result = await client.query(
    `update linkedin_share_intents
     set status='unknown', provider_post_id=$3, provider_request_id=$4,
         provider_http_status=$5, failure_reason=$6, updated_at=now(),
         claim_token=null, claim_started_at=null
     where id=$1 and claim_token=$2::uuid and status='publishing'
     returning *`,
    [shareIntentId, claimToken, providerPostId, providerRequestId, providerHttpStatus, failureReason]
  );
  if (!result.rows[0]) return null;
  await insertLinkedInShareEvent(client, {
    shareIntentId,
    eventType: 'outcome_unknown',
    detail: {
      reason: failureReason,
      providerPostId,
      providerRequestId,
      providerHttpStatus
    }
  });
  return result.rows[0];
}
