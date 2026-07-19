-- STEP061A: AI/news end-to-end live acceptance and rollout telemetry.
-- Additive and idempotent. No automatic publishing or provider retry is introduced.

do $$
begin
  if to_regclass('ai_news_drafts') is null
     or to_regclass('ai_news_sources') is null
     or to_regclass('ai_news_preset_runs') is null then
    raise exception 'STEP061A migration 032 requires migrations 030 and 031';
  end if;
end $$;

alter table ai_news_drafts
  add column if not exists openai_input_tokens integer,
  add column if not exists openai_output_tokens integer,
  add column if not exists openai_total_tokens integer,
  add column if not exists estimated_generation_cost_microusd bigint;

alter table ai_news_drafts
  drop constraint if exists ai_news_drafts_openai_usage_nonnegative;

alter table ai_news_drafts
  add constraint ai_news_drafts_openai_usage_nonnegative
  check (
    (openai_input_tokens is null or openai_input_tokens >= 0)
    and (openai_output_tokens is null or openai_output_tokens >= 0)
    and (openai_total_tokens is null or openai_total_tokens >= 0)
    and (estimated_generation_cost_microusd is null or estimated_generation_cost_microusd >= 0)
  );

create table if not exists ai_news_provider_usage_events (
  id bigserial primary key,
  user_id bigint references users(id) on delete set null,
  source_id bigint references ai_news_sources(id) on delete set null,
  draft_id bigint references ai_news_drafts(id) on delete set null,
  preset_run_id bigint references ai_news_preset_runs(id) on delete set null,
  provider text not null,
  operation text not null,
  outcome text not null,
  request_id text,
  model_name text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  result_count integer,
  duration_ms integer,
  estimated_cost_microusd bigint not null default 0,
  error_code text,
  detail_json jsonb,
  created_at timestamptz not null default now(),
  check (provider in ('newsdata', 'openai')),
  check (operation in ('search_latest', 'generate_draft')),
  check (outcome in ('success', 'no_result', 'failed')),
  check (input_tokens is null or input_tokens >= 0),
  check (output_tokens is null or output_tokens >= 0),
  check (total_tokens is null or total_tokens >= 0),
  check (result_count is null or result_count >= 0),
  check (duration_ms is null or duration_ms >= 0),
  check (estimated_cost_microusd >= 0),
  check (request_id is null or char_length(request_id) <= 240),
  check (model_name is null or char_length(model_name) <= 160),
  check (error_code is null or char_length(error_code) <= 160)
);

create index if not exists idx_ai_news_provider_usage_created
  on ai_news_provider_usage_events(created_at desc);

create index if not exists idx_ai_news_provider_usage_user_created
  on ai_news_provider_usage_events(user_id, created_at desc);

create index if not exists idx_ai_news_provider_usage_provider_created
  on ai_news_provider_usage_events(provider, operation, created_at desc);

create index if not exists idx_ai_news_provider_usage_draft
  on ai_news_provider_usage_events(draft_id, created_at asc)
  where draft_id is not null;
