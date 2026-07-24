const OWNER_SUMMARY_SELECT = `
  count(distinct s.id)::int as published_posts,
  count(e.id) filter (where e.event_type='profile_opened')::int as total_opens,
  count(distinct e.visitor_user_id) filter (where e.event_type='profile_opened')::int as unique_opens,
  count(distinct e.visitor_user_id) filter (where e.event_type in ('contact_request_started','private_chat_request_started'))::int as unique_started,
  count(e.id) filter (where e.event_type='request_submitted')::int as submitted_requests,
  count(distinct e.visitor_user_id) filter (where e.event_type='request_submitted')::int as unique_submitted,
  count(e.id) filter (where e.event_type='request_approved')::int as approved_requests,
  count(distinct e.visitor_user_id) filter (where e.event_type='request_approved')::int as unique_approved,
  count(distinct s.id) filter (where s.published_at >= now()-interval '7 days')::int as published_posts_7d,
  count(distinct e.visitor_user_id) filter (where e.event_type='profile_opened' and e.created_at >= now()-interval '7 days')::int as unique_opens_7d,
  count(distinct e.visitor_user_id) filter (where e.event_type='request_submitted' and e.created_at >= now()-interval '7 days')::int as unique_submitted_7d,
  count(distinct e.visitor_user_id) filter (where e.event_type='request_approved' and e.created_at >= now()-interval '7 days')::int as unique_approved_7d,
  max(s.published_at) as last_published_at,
  max(e.created_at) as last_event_at`;

export async function loadOwnerLinkedInShareConversionSummary(client, telegramUserId) {
  const result = await client.query(
    `with owner as (
       select id from users where telegram_user_id=$1 limit 1
     ), shares as (
       select lsi.* from linkedin_share_intents lsi
       join owner o on o.id=lsi.user_id
       where lsi.source_kind='profile_share' and lsi.status='published'
     )
     select ${OWNER_SUMMARY_SELECT}
     from shares s
     left join linkedin_share_attribution_events e on e.share_intent_id=s.id`,
    [telegramUserId]
  );
  return result.rows[0] || null;
}

export async function listOwnerLinkedInShareConversionPosts(client, { telegramUserId, limit = 5 }) {
  const result = await client.query(
    `select
       s.public_token, s.provider_post_id, s.published_at,
       count(e.id) filter (where e.event_type='profile_opened')::int as total_opens,
       count(distinct e.visitor_user_id) filter (where e.event_type='profile_opened')::int as unique_opens,
       count(distinct e.visitor_user_id) filter (where e.event_type in ('contact_request_started','private_chat_request_started'))::int as unique_started,
       count(e.id) filter (where e.event_type='request_submitted')::int as submitted_requests,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_submitted')::int as unique_submitted,
       count(e.id) filter (where e.event_type='request_approved')::int as approved_requests,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_approved')::int as unique_approved,
       max(e.created_at) as last_event_at
     from linkedin_share_intents s
     join users u on u.id=s.user_id
     left join linkedin_share_attribution_events e on e.share_intent_id=s.id
     where u.telegram_user_id=$1 and s.source_kind='profile_share' and s.status='published'
     group by s.id
     order by s.published_at desc nulls last, s.id desc
     limit $2`,
    [telegramUserId, limit]
  );
  return result.rows;
}

export async function loadOwnerLinkedInShareConversionPost(client, { telegramUserId, publicToken }) {
  const metrics = await client.query(
    `select
       s.public_token, s.provider_post_id, s.published_at,
       count(e.id) filter (where e.event_type='profile_opened')::int as total_opens,
       count(distinct e.visitor_user_id) filter (where e.event_type='profile_opened')::int as unique_opens,
       count(distinct e.visitor_user_id) filter (where e.event_type in ('contact_request_started','private_chat_request_started'))::int as unique_started,
       count(e.id) filter (where e.event_type='request_submitted')::int as submitted_requests,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_submitted')::int as unique_submitted,
       count(e.id) filter (where e.event_type='request_approved')::int as approved_requests,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_approved')::int as unique_approved
     from linkedin_share_intents s
     join users u on u.id=s.user_id
     left join linkedin_share_attribution_events e on e.share_intent_id=s.id
     where u.telegram_user_id=$1 and s.public_token=$2::uuid
       and s.source_kind='profile_share' and s.status='published'
     group by s.id
     limit 1`,
    [telegramUserId, publicToken]
  );
  const post = metrics.rows[0] || null;
  if (!post) return null;
  const recent = await client.query(
    `select event_type, created_at
     from linkedin_share_attribution_events e
     join linkedin_share_intents s on s.id=e.share_intent_id
     join users u on u.id=s.user_id
     where u.telegram_user_id=$1 and s.public_token=$2::uuid
     order by e.created_at desc
     limit 8`,
    [telegramUserId, publicToken]
  );
  return { ...post, recent_events: recent.rows };
}

export async function loadAdminLinkedInShareConversionSummary(client, { limit = 5 } = {}) {
  const summaryResult = await client.query(
    `with shares as (
       select * from linkedin_share_intents
       where source_kind='profile_share' and status='published'
     )
     select
       count(distinct s.id)::int as published_posts,
       count(distinct s.user_id)::int as publishing_owners,
       count(e.id) filter (where e.event_type='profile_opened')::int as total_opens,
       count(distinct e.visitor_user_id) filter (where e.event_type='profile_opened')::int as unique_opens,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_submitted')::int as unique_submitted,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_approved')::int as unique_approved,
       count(distinct s.id) filter (where s.published_at >= now()-interval '7 days')::int as published_posts_7d,
       count(distinct e.visitor_user_id) filter (where e.event_type='profile_opened' and e.created_at >= now()-interval '7 days')::int as unique_opens_7d,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_submitted' and e.created_at >= now()-interval '7 days')::int as unique_submitted_7d,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_approved' and e.created_at >= now()-interval '7 days')::int as unique_approved_7d
     from shares s left join linkedin_share_attribution_events e on e.share_intent_id=s.id`
  );
  const postsResult = await client.query(
    `select
       s.provider_post_id, s.published_at,
       coalesce(nullif(mp.display_name,''), nullif(la.full_name,''), 'Участник') as owner_name,
       count(distinct e.visitor_user_id) filter (where e.event_type='profile_opened')::int as unique_opens,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_submitted')::int as unique_submitted,
       count(distinct e.visitor_user_id) filter (where e.event_type='request_approved')::int as unique_approved
     from linkedin_share_intents s
     join member_profiles mp on mp.id=s.profile_id
     join linkedin_accounts la on la.id=s.linkedin_account_id
     left join linkedin_share_attribution_events e on e.share_intent_id=s.id
     where s.source_kind='profile_share' and s.status='published'
     group by s.id, mp.display_name, la.full_name
     order by s.published_at desc nulls last, s.id desc
     limit $1`,
    [limit]
  );
  return { summary: summaryResult.rows[0] || null, recent_posts: postsResult.rows };
}
