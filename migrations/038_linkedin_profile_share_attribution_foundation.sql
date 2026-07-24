-- STEP065A1: LinkedIn profile-share attribution foundation.
-- Additive, idempotent and privacy-bounded. No external pixels or browser fingerprinting.

alter table linkedin_share_intents
  add column if not exists attribution_token text,
  add column if not exists attribution_revoked_at timestamptz;

create unique index if not exists uq_linkedin_share_attribution_token
  on linkedin_share_intents(attribution_token)
  where attribution_token is not null;

alter table linkedin_share_intents
  drop constraint if exists linkedin_share_attribution_token_source_check;

alter table linkedin_share_intents
  add constraint linkedin_share_attribution_token_source_check
  check (
    attribution_token is null
    or (source_kind = 'profile_share' and attribution_token ~ '^[A-Za-z0-9_-]{22}$')
  );

create table if not exists linkedin_share_attribution_sessions (
  visitor_user_id bigint primary key references users(id) on delete cascade,
  share_intent_id bigint not null references linkedin_share_intents(id) on delete cascade,
  profile_id bigint not null references member_profiles(id) on delete cascade,
  expires_at timestamptz not null,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > first_opened_at)
);

create index if not exists idx_linkedin_share_attribution_sessions_intent
  on linkedin_share_attribution_sessions(share_intent_id, expires_at);

create index if not exists idx_linkedin_share_attribution_sessions_profile
  on linkedin_share_attribution_sessions(profile_id, expires_at);

create table if not exists linkedin_share_attribution_events (
  id bigserial primary key,
  event_key text not null unique,
  share_intent_id bigint not null references linkedin_share_intents(id) on delete cascade,
  profile_id bigint not null references member_profiles(id) on delete cascade,
  owner_user_id bigint not null references users(id) on delete cascade,
  visitor_user_id bigint not null references users(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id bigint,
  telegram_update_id bigint,
  source_code text not null default 'linkedin_profile_share',
  detail_json jsonb,
  created_at timestamptz not null default now(),
  check (char_length(event_key) between 8 and 220),
  check (event_type in (
    'profile_opened',
    'contact_request_started',
    'private_chat_request_started',
    'request_submitted',
    'request_approved'
  )),
  check (entity_type is null or entity_type in ('intro_request', 'contact_unlock_request', 'dm_thread')),
  check ((entity_type is null and entity_id is null) or (entity_type is not null and entity_id is not null)),
  check (entity_id is null or entity_id > 0),
  check (telegram_update_id is null or telegram_update_id > 0),
  check (source_code = 'linkedin_profile_share')
);

create index if not exists idx_linkedin_share_attribution_events_intent
  on linkedin_share_attribution_events(share_intent_id, created_at asc);

create index if not exists idx_linkedin_share_attribution_events_profile
  on linkedin_share_attribution_events(profile_id, created_at desc);

create index if not exists idx_linkedin_share_attribution_events_visitor
  on linkedin_share_attribution_events(visitor_user_id, created_at desc);

create index if not exists idx_linkedin_share_attribution_events_entity
  on linkedin_share_attribution_events(entity_type, entity_id)
  where entity_type is not null;

create or replace function block_linkedin_share_attribution_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'linkedin_share_attribution_events are immutable';
end;
$$;

drop trigger if exists trg_linkedin_share_attribution_events_immutable
  on linkedin_share_attribution_events;

create trigger trg_linkedin_share_attribution_events_immutable
before update or delete on linkedin_share_attribution_events
for each row execute function block_linkedin_share_attribution_event_mutation();
