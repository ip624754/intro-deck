-- STEP004 baseline schema. Wired into runtime storage paths when DATABASE_URL is configured.

create table if not exists users (
  id bigserial primary key,
  telegram_user_id bigint not null unique,
  telegram_username text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists linkedin_accounts (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  linkedin_sub text not null unique,
  full_name text,
  given_name text,
  family_name text,
  picture_url text,
  email text,
  email_verified boolean not null default false,
  locale text,
  raw_oidc_claims_json jsonb,
  linked_at timestamptz not null default now(),
  last_refresh_at timestamptz,
  unique(user_id)
);

create table if not exists linkedin_verification_snapshots (
  linkedin_account_id bigint primary key references linkedin_accounts(id) on delete cascade,
  api_member_id text not null,
  verification_categories text[] not null default '{}',
  identity_verified boolean not null default false,
  workplace_verified boolean not null default false,
  verification_state text not null,
  verification_url_offered boolean not null default false,
  source_tier text not null,
  identity_api_version text not null,
  report_api_version text not null,
  profile_last_refreshed_at timestamptz,
  synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_state in ('identity_and_workplace_verified', 'category_verified', 'verification_available', 'no_category_or_url')),
  check (source_tier in ('development', 'lite', 'plus')),
  check (verification_categories <@ array['IDENTITY', 'WORKPLACE']::text[]),
  check (identity_verified = ('IDENTITY' = any(verification_categories))),
  check (workplace_verified = ('WORKPLACE' = any(verification_categories)))
);

create unique index if not exists idx_linkedin_verification_api_member
  on linkedin_verification_snapshots(api_member_id);

create index if not exists idx_linkedin_verification_identity
  on linkedin_verification_snapshots(identity_verified, synced_at desc);
create index if not exists idx_linkedin_verification_workplace
  on linkedin_verification_snapshots(workplace_verified, synced_at desc);

create table if not exists member_profiles (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  display_name text,
  headline_user text,
  company_user text,
  city_user text,
  industry_user text,
  about_user text,
  linkedin_public_url text,
  telegram_username_hidden text,
  visibility_status text not null default 'hidden',
  contact_mode text not null default 'intro_request',
  profile_state text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility_status in ('hidden', 'listed')),
  check (contact_mode in ('intro_request', 'paid_unlock_requires_approval', 'telegram_only', 'external_link')),
  check (profile_state in ('draft', 'active', 'paused')),
  unique(user_id)
);

create table if not exists member_profile_skills (
  profile_id bigint not null references member_profiles(id) on delete cascade,
  skill_slug text not null,
  skill_label text not null,
  primary key (profile_id, skill_slug)
);

create index if not exists idx_linkedin_accounts_user_id on linkedin_accounts(user_id);
create index if not exists idx_member_profiles_visibility_state on member_profiles(visibility_status, profile_state);


create table if not exists contact_unlock_requests (
  id bigserial primary key,
  requester_user_id bigint not null references users(id) on delete cascade,
  target_user_id bigint not null references users(id) on delete cascade,
  target_profile_id bigint not null references member_profiles(id) on delete cascade,
  contact_type text not null default 'telegram_username',
  status text not null default 'payment_pending',
  payment_state text not null default 'pending',
  price_stars_snapshot integer not null,
  policy_snapshot text not null,
  requester_display_name text,
  requester_headline_user text,
  target_display_name text,
  target_headline_user text,
  telegram_payment_charge_id text,
  provider_payment_charge_id text,
  pro_covered boolean not null default false,
  checkout_authorized_at timestamptz,
  revealed_contact_value text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  declined_at timestamptz,
  revealed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (contact_type in ('telegram_username')),
  check (status in ('payment_pending', 'paid_pending_approval', 'revealed', 'declined', 'cancelled')),
  check (payment_state in ('pending', 'paid', 'failed', 'refunded')),
  check (price_stars_snapshot > 0),
  unique (telegram_payment_charge_id)
);

create index if not exists idx_contact_unlock_requests_target_status on contact_unlock_requests(target_user_id, status, updated_at desc);
create index if not exists idx_contact_unlock_requests_requester_status on contact_unlock_requests(requester_user_id, status, updated_at desc);
create unique index if not exists uniq_contact_unlock_requests_active_pair on contact_unlock_requests(requester_user_id, target_profile_id, contact_type) where status in ('payment_pending', 'paid_pending_approval');
create unique index if not exists uq_contact_unlock_provider_charge on contact_unlock_requests(provider_payment_charge_id) where provider_payment_charge_id is not null;
create index if not exists idx_contact_unlock_pro_usage on contact_unlock_requests(requester_user_id, requested_at desc) where pro_covered = true;

create table if not exists contact_unlock_events (
  id bigserial primary key,
  request_id bigint not null references contact_unlock_requests(id) on delete cascade,
  actor_user_id bigint references users(id) on delete set null,
  event_type text not null,
  detail_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contact_unlock_events_request_id_idx on contact_unlock_events(request_id, created_at desc);


create table if not exists member_dm_threads (
  id bigserial primary key,
  initiator_user_id bigint not null references users(id) on delete cascade,
  recipient_user_id bigint not null references users(id) on delete cascade,
  target_profile_id bigint references member_profiles(id) on delete set null,
  opened_via text not null default 'profile_card' check (opened_via in ('profile_card', 'contact_unlock', 'intro_followup', 'other')),
  status text not null default 'draft' check (status in ('draft', 'payment_pending', 'pending_recipient', 'active', 'declined', 'blocked', 'closed')),
  payment_state text not null default 'draft' check (payment_state in ('draft', 'pending', 'confirmed', 'not_required')),
  price_stars_snapshot integer not null default 0,
  contact_policy_snapshot text,
  pro_covered boolean not null default false,
  checkout_authorized_at timestamptz,
  first_message_text text,
  blocked_by_user_id bigint references users(id) on delete set null,
  reported_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  blocked_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz,
  last_sender_user_id bigint references users(id) on delete set null,
  telegram_payment_charge_id text,
  provider_payment_charge_id text,
  check (initiator_user_id <> recipient_user_id)
);

create index if not exists member_dm_threads_initiator_status_idx on member_dm_threads (initiator_user_id, status, updated_at desc);
create index if not exists member_dm_threads_recipient_status_idx on member_dm_threads (recipient_user_id, status, updated_at desc);
create index if not exists member_dm_threads_pair_idx on member_dm_threads (least(initiator_user_id, recipient_user_id), greatest(initiator_user_id, recipient_user_id), updated_at desc);
create unique index if not exists uq_member_dm_telegram_charge on member_dm_threads(telegram_payment_charge_id) where telegram_payment_charge_id is not null;
create unique index if not exists uq_member_dm_provider_charge on member_dm_threads(provider_payment_charge_id) where provider_payment_charge_id is not null;
create index if not exists idx_member_dm_pro_usage on member_dm_threads(initiator_user_id, delivered_at desc) where pro_covered = true;

create table if not exists member_dm_messages (
  id bigserial primary key,
  thread_id bigint not null references member_dm_threads(id) on delete cascade,
  sender_user_id bigint not null references users(id) on delete cascade,
  recipient_user_id bigint not null references users(id) on delete cascade,
  message_kind text not null default 'message' check (message_kind in ('request', 'message')),
  message_text text not null,
  delivery_state text not null default 'delivered' check (delivery_state in ('created', 'delivered', 'failed')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  failed_at timestamptz
);

create index if not exists member_dm_messages_thread_id_idx on member_dm_messages (thread_id, id desc);

create table if not exists member_dm_compose_sessions (
  user_id bigint primary key references users(id) on delete cascade,
  thread_id bigint not null references member_dm_threads(id) on delete cascade,
  compose_mode text not null check (compose_mode in ('request', 'reply')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_dm_compose_sessions_expires_at_idx on member_dm_compose_sessions (expires_at);

create table if not exists member_dm_events (
  id bigserial primary key,
  thread_id bigint not null references member_dm_threads(id) on delete cascade,
  actor_user_id bigint references users(id) on delete set null,
  event_type text not null,
  detail_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists member_dm_events_thread_id_idx on member_dm_events (thread_id, created_at desc);

-- STEP059 Share Profile on LinkedIn foundation.
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
