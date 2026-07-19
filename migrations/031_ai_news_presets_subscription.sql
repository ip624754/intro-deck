-- STEP061: Personalized news presets and subscription productization.
-- Additive and idempotent. Scheduled delivery creates Telegram drafts only; it never publishes to LinkedIn.

create table if not exists ai_news_presets (
  id bigserial primary key,
  public_token uuid not null unique,
  user_id bigint not null references users(id) on delete cascade,
  name text not null,
  preset_key text not null default 'ai_technology',
  custom_query text,
  source_language text not null default 'en',
  source_country text,
  source_category text,
  post_language text not null default 'en',
  tone text not null default 'professional',
  schedule_kind text not null default 'manual',
  delivery_hour_utc integer not null default 9,
  status text not null default 'active',
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(name) between 2 and 80),
  check (preset_key in ('ai_technology', 'business_growth', 'crypto_web3', 'custom')),
  check (custom_query is null or char_length(custom_query) between 2 and 120),
  check (source_language in ('en', 'ru')),
  check (source_country is null or source_country ~ '^[a-z]{2}$'),
  check (source_category is null or char_length(source_category) between 2 and 40),
  check (post_language in ('en', 'ru')),
  check (tone in ('professional', 'analytical', 'concise')),
  check (schedule_kind in ('manual', 'daily', 'weekdays')),
  check (delivery_hour_utc between 0 and 23),
  check (status in ('active', 'paused', 'deleted')),
  check ((status = 'deleted' and deleted_at is not null) or status <> 'deleted')
);

create unique index if not exists uq_ai_news_presets_user_name_active
  on ai_news_presets(user_id, lower(name))
  where status <> 'deleted';

create index if not exists idx_ai_news_presets_user_status
  on ai_news_presets(user_id, status, created_at desc);

create index if not exists idx_ai_news_presets_due
  on ai_news_presets(next_run_at, id)
  where status = 'active' and schedule_kind in ('daily', 'weekdays') and next_run_at is not null;

create table if not exists ai_news_preset_runs (
  id bigserial primary key,
  public_token uuid not null unique,
  preset_id bigint not null references ai_news_presets(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  trigger_kind text not null,
  scheduled_for timestamptz not null,
  status text not null default 'claimed',
  attempt_count integer not null default 0,
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  next_attempt_at timestamptz,
  source_id bigint references ai_news_sources(id) on delete set null,
  telegram_message_id bigint,
  error_code text,
  detail_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  check (trigger_kind in ('scheduled', 'run_now')),
  check (status in ('claimed', 'searching', 'generating', 'draft_ready', 'delivered', 'retry_due', 'blocked', 'no_source', 'failed', 'cancelled')),
  check (attempt_count >= 0),
  check (status <> 'delivered' or (telegram_message_id is not null and delivered_at is not null))
);

create unique index if not exists uq_ai_news_preset_scheduled_run
  on ai_news_preset_runs(preset_id, scheduled_for)
  where trigger_kind = 'scheduled';

create index if not exists idx_ai_news_preset_runs_retry
  on ai_news_preset_runs(next_attempt_at, id)
  where status = 'retry_due' and next_attempt_at is not null;

create index if not exists idx_ai_news_preset_runs_user_created
  on ai_news_preset_runs(user_id, created_at desc);

alter table ai_news_drafts
  add column if not exists preset_id bigint references ai_news_presets(id) on delete set null,
  add column if not exists preset_run_id bigint references ai_news_preset_runs(id) on delete set null,
  add column if not exists delivery_kind text not null default 'manual';

alter table ai_news_drafts
  drop constraint if exists ai_news_drafts_delivery_kind_check;

alter table ai_news_drafts
  add constraint ai_news_drafts_delivery_kind_check
  check (delivery_kind in ('manual', 'scheduled', 'run_now'));

create unique index if not exists uq_ai_news_drafts_preset_run
  on ai_news_drafts(preset_run_id)
  where preset_run_id is not null;

create index if not exists idx_ai_news_drafts_preset_created
  on ai_news_drafts(preset_id, created_at desc)
  where preset_id is not null;
