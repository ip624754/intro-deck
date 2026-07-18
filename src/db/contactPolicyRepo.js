export async function acquireContactPairLock(client, { userAId, userBId }) {
  const left = String(userAId) < String(userBId) ? userAId : userBId;
  const right = String(userAId) < String(userBId) ? userBId : userAId;
  await client.query(
    `select pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [`introdeck:contact_pair:${left}:${right}`]
  );
}

export async function getContactPairRestriction(client, {
  requesterUserId,
  targetUserId,
  retryCooldownDays
}) {
  const result = await client.query(
    `
      select
        exists (
          select 1
          from member_dm_threads
          where least(initiator_user_id, recipient_user_id) = least($1, $2)
            and greatest(initiator_user_id, recipient_user_id) = greatest($1, $2)
            and status = 'blocked'
        ) as pair_blocked,
        (
          select max(declined_at) + make_interval(days => $3)
          from (
            select declined_at
            from contact_unlock_requests
            where requester_user_id = $1
              and target_user_id = $2
              and status = 'declined'
              and declined_at is not null
            union all
            select declined_at
            from member_dm_threads
            where initiator_user_id = $1
              and recipient_user_id = $2
              and status = 'declined'
              and declined_at is not null
          ) declined_requests
          where declined_at > now() - make_interval(days => $3)
        ) as retry_available_at
    `,
    [requesterUserId, targetUserId, retryCooldownDays]
  );

  return {
    blocked: Boolean(result.rows[0]?.pair_blocked),
    retryAvailableAt: result.rows[0]?.retry_available_at || null
  };
}
