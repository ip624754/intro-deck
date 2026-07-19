-- STEP059: explicit user-approved Share Profile on LinkedIn foundation.
-- This migration is additive and idempotent.

create table if not exists linkedin_share_intents (
  id bigserial primary key,
  public_token uuid not null unique,
  user_id bigint not null references users(id) on delete cascade,
  linkedin_account_id bigint not null references linkedin_accounts(id) on delete cascade,
  profile_id bigint not null references member_profiles(id) on delete cascade,
  post_text text not null,
  visibility text not null default 'PUBLIC',
  status text not null default 'draft',
  provider_post_id text,
  provider_request_id text,
  provider_http_status integer,
  provider_error_code text,
  failure_reason text,
  attempt_count integer not null default 0,
  claim_token uuid,
  claim_started_at timestamptz,
  confirmed_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(post_text) between 1 and 3000),
  check (visibility in ('PUBLIC', 'CONNECTIONS')),
  check (status in ('draft', 'authorization_started', 'publishing', 'published', 'failed', 'unknown', 'cancelled', 'expired')),
  check (attempt_count >= 0),
  check (status <> 'publishing' or (claim_token is not null and claim_started_at is not null)),
  check (status <> 'published' or (provider_post_id is not null and published_at is not null))
);

create unique index if not exists uq_linkedin_share_provider_post
  on linkedin_share_intents(provider_post_id)
  where provider_post_id is not null;

create index if not exists idx_linkedin_share_user_created
  on linkedin_share_intents(user_id, created_at desc);

create index if not exists idx_linkedin_share_active_expiry
  on linkedin_share_intents(status, expires_at)
  where status in ('draft', 'authorization_started', 'publishing');

create unique index if not exists uq_linkedin_share_user_unresolved
  on linkedin_share_intents(user_id)
  where status in ('draft', 'authorization_started', 'publishing', 'unknown');

create table if not exists linkedin_share_events (
  id bigserial primary key,
  share_intent_id bigint not null references linkedin_share_intents(id) on delete cascade,
  event_type text not null,
  detail_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_linkedin_share_events_intent
  on linkedin_share_events(share_intent_id, created_at asc);
