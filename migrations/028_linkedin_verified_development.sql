-- STEP058A — Verified on LinkedIn Development Integration
-- Stores category-only trust signals. No access token, refresh token, ID token,
-- government ID data, verified legal name, or single-use verification URL is stored.

begin;

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

-- Historical STEP045/048 payloads could include raw OAuth token values inside
-- raw_oidc_claims_json.token. Remove those secrets in place. This operation is
-- idempotent and keeps non-secret token metadata intact.
update linkedin_accounts
set raw_oidc_claims_json = jsonb_set(
  coalesce(raw_oidc_claims_json, '{}'::jsonb),
  '{token}',
  coalesce(raw_oidc_claims_json->'token', '{}'::jsonb)
    - 'access_token'
    - 'refresh_token'
    - 'id_token',
  true
)
where raw_oidc_claims_json ? 'token'
  and jsonb_typeof(raw_oidc_claims_json->'token') = 'object'
  and (
    (raw_oidc_claims_json->'token') ? 'access_token'
    or (raw_oidc_claims_json->'token') ? 'refresh_token'
    or (raw_oidc_claims_json->'token') ? 'id_token'
  );

commit;
