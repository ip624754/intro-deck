-- STEP053 — Contact Contract and Payment Honesty Lock

do $$
begin
  if to_regclass('contact_unlock_requests') is null then
    raise exception 'STEP053 requires migrations/019_contact_unlock_requests.sql before migration 027';
  end if;
  if to_regclass('member_dm_threads') is null then
    raise exception 'STEP053 requires migrations/020_member_dm_relay.sql before migration 027';
  end if;
  if to_regclass('purchase_receipts') is null then
    raise exception 'STEP053 requires migrations/021_pricing_receipts_ops.sql before migration 027';
  end if;

  if exists (
    select 1 from contact_unlock_requests
    where provider_payment_charge_id is not null
    group by provider_payment_charge_id having count(*) > 1
  ) then
    raise exception 'STEP053 blocked: duplicate direct-contact provider payment charge IDs require operator review';
  end if;
  if exists (
    select 1 from member_dm_threads
    where telegram_payment_charge_id is not null
    group by telegram_payment_charge_id having count(*) > 1
  ) then
    raise exception 'STEP053 blocked: duplicate DM Telegram payment charge IDs require operator review';
  end if;
  if exists (
    select 1 from member_dm_threads
    where provider_payment_charge_id is not null
    group by provider_payment_charge_id having count(*) > 1
  ) then
    raise exception 'STEP053 blocked: duplicate DM provider payment charge IDs require operator review';
  end if;
end $$;

alter table if exists contact_unlock_requests
  add column if not exists pro_covered boolean not null default false,
  add column if not exists checkout_authorized_at timestamptz;

alter table if exists member_dm_threads
  add column if not exists contact_policy_snapshot text,
  add column if not exists pro_covered boolean not null default false,
  add column if not exists checkout_authorized_at timestamptz;

create unique index if not exists uq_contact_unlock_provider_charge
  on contact_unlock_requests(provider_payment_charge_id)
  where provider_payment_charge_id is not null;

create unique index if not exists uq_member_dm_telegram_charge
  on member_dm_threads(telegram_payment_charge_id)
  where telegram_payment_charge_id is not null;

create unique index if not exists uq_member_dm_provider_charge
  on member_dm_threads(provider_payment_charge_id)
  where provider_payment_charge_id is not null;

create index if not exists idx_contact_unlock_pro_usage
  on contact_unlock_requests(requester_user_id, requested_at desc)
  where pro_covered = true;

create index if not exists idx_member_dm_pro_usage
  on member_dm_threads(initiator_user_id, delivered_at desc)
  where pro_covered = true;

create table if not exists contact_unlock_events (
  id bigserial primary key,
  request_id bigint not null references contact_unlock_requests(id) on delete cascade,
  actor_user_id bigint references users(id) on delete set null,
  event_type text not null,
  detail_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contact_unlock_events_request_id_idx
  on contact_unlock_events(request_id, created_at desc);
