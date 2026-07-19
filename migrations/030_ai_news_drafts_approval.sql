-- STEP060: AI/news draft approval foundation.
-- Additive and idempotent. No automatic publishing is introduced.

create table if not exists ai_news_preferences (
  user_id bigint primary key references users(id) on delete cascade,
  preset_key text not null default 'ai_technology',
  custom_query text,
  source_language text not null default 'en',
  source_country text,
  source_category text,
  post_language text not null default 'en',
  tone text not null default 'professional',
  last_search_started_at timestamptz,
  search_window_started_at timestamptz,
  search_count_in_window integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preset_key in ('ai_technology', 'business_growth', 'crypto_web3', 'custom')),
  check (custom_query is null or char_length(custom_query) between 2 and 120),
  check (source_language in ('en', 'ru')),
  check (source_country is null or source_country ~ '^[a-z]{2}$'),
  check (source_category is null or char_length(source_category) between 2 and 40),
  check (post_language in ('en', 'ru')),
  check (tone in ('professional', 'analytical', 'concise')),
  check (search_count_in_window >= 0)
);

create table if not exists ai_news_sources (
  id bigserial primary key,
  public_token uuid not null unique,
  user_id bigint not null references users(id) on delete cascade,
  provider text not null,
  provider_article_id text,
  source_url text not null,
  source_url_hash text not null,
  source_title text not null,
  source_name text,
  source_domain text,
  source_description text,
  source_content_excerpt text,
  source_language text,
  source_country text,
  source_categories_json jsonb,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  query_snapshot text not null,
  evidence_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider in ('newsdata')),
  check (char_length(source_url) between 8 and 2048),
  check (char_length(source_title) between 3 and 600),
  check (source_description is null or char_length(source_description) <= 1600),
  check (source_content_excerpt is null or char_length(source_content_excerpt) <= 2400),
  check (char_length(query_snapshot) between 2 and 240),
  check (char_length(evidence_hash) between 40 and 128),
  unique (user_id, source_url_hash)
);

create index if not exists idx_ai_news_sources_user_fetched
  on ai_news_sources(user_id, fetched_at desc);

create index if not exists idx_ai_news_sources_expiry
  on ai_news_sources(expires_at);

create table if not exists ai_news_drafts (
  id bigserial primary key,
  public_token uuid not null unique,
  user_id bigint not null references users(id) on delete cascade,
  profile_id bigint not null references member_profiles(id) on delete cascade,
  source_id bigint not null references ai_news_sources(id) on delete restrict,
  status text not null default 'generating',
  post_text text,
  ai_generated_text text,
  edited_by_user boolean not null default false,
  post_language text not null,
  tone text not null,
  evidence_claims_json jsonb not null default '[]'::jsonb,
  model_provider text,
  model_name text,
  provider_response_id text,
  provider_request_id text,
  generation_input_hash text not null,
  source_evidence_hash text not null,
  generation_error_code text,
  share_intent_id bigint references linkedin_share_intents(id) on delete set null,
  confirmed_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('generating', 'draft', 'editing', 'share_ready', 'published', 'failed', 'unknown', 'cancelled', 'expired')),
  check (post_text is null or char_length(post_text) between 80 and 3000),
  check (ai_generated_text is null or char_length(ai_generated_text) between 80 and 3000),
  check (post_language in ('en', 'ru')),
  check (tone in ('professional', 'analytical', 'concise')),
  check (model_provider is null or model_provider in ('openai')),
  check (char_length(generation_input_hash) between 40 and 128),
  check (char_length(source_evidence_hash) between 40 and 128),
  check (status <> 'published' or (share_intent_id is not null and published_at is not null))
);

create unique index if not exists uq_ai_news_user_unresolved_draft
  on ai_news_drafts(user_id)
  where status in ('generating', 'draft', 'editing', 'share_ready', 'unknown');

create index if not exists idx_ai_news_drafts_user_created
  on ai_news_drafts(user_id, created_at desc);

create index if not exists idx_ai_news_drafts_source
  on ai_news_drafts(source_id, created_at desc);

create unique index if not exists uq_ai_news_drafts_user_source_active
  on ai_news_drafts(user_id, source_id)
  where status not in ('failed', 'cancelled', 'expired');

create table if not exists ai_news_draft_events (
  id bigserial primary key,
  draft_id bigint not null references ai_news_drafts(id) on delete cascade,
  event_type text not null,
  detail_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_news_draft_events_draft
  on ai_news_draft_events(draft_id, created_at asc);

create table if not exists ai_news_input_sessions (
  user_id bigint primary key references users(id) on delete cascade,
  input_kind text not null,
  draft_id bigint references ai_news_drafts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (input_kind in ('topic_query', 'edit_draft')),
  check ((input_kind = 'topic_query' and draft_id is null) or (input_kind = 'edit_draft' and draft_id is not null))
);

alter table linkedin_share_intents
  add column if not exists source_kind text not null default 'profile_share',
  add column if not exists source_ref_id bigint,
  add column if not exists source_snapshot_hash text;

alter table linkedin_share_intents
  drop constraint if exists linkedin_share_intents_source_kind_check;

alter table linkedin_share_intents
  add constraint linkedin_share_intents_source_kind_check
  check (source_kind in ('profile_share', 'ai_news_draft'));

create unique index if not exists uq_linkedin_share_ai_news_draft
  on linkedin_share_intents(source_ref_id)
  where source_kind = 'ai_news_draft' and source_ref_id is not null and status in ('draft', 'authorization_started', 'publishing', 'published', 'unknown');
