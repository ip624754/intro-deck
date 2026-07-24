# STEP065A1 Operator Rollout

## Order of operations

1. Apply `migrations/038_linkedin_profile_share_attribution_foundation.sql` to production PostgreSQL.
2. Verify schema and immutable trigger.
3. Deploy exact STEP065A1 source candidate.
4. Verify `/api/health`.
5. Publish one new profile-share post. Existing posts remain legacy/unattributed.
6. Open its `ls_` link from a second Telegram account.
7. Run one request flow and approval flow.
8. Inspect bounded SQL evidence.

Do not publish a STEP065A1 `ls_` link before migration 038 is confirmed ready.

## Schema verification

```sql
select column_name, data_type
from information_schema.columns
where table_schema = current_schema()
  and table_name = 'linkedin_share_intents'
  and column_name in ('attribution_token', 'attribution_revoked_at')
order by column_name;

select table_name
from information_schema.tables
where table_schema = current_schema()
  and table_name in (
    'linkedin_share_attribution_sessions',
    'linkedin_share_attribution_events'
  )
order by table_name;

select tgname, tgenabled
from pg_trigger
where tgrelid = 'linkedin_share_attribution_events'::regclass
  and not tgisinternal;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in (
  'linkedin_share_intents'::regclass,
  'linkedin_share_attribution_events'::regclass
)
  and conname in (
    'linkedin_share_attribution_token_source_check',
    'linkedin_share_attribution_events_event_type_check',
    'linkedin_share_attribution_events_entity_type_check'
  )
order by conname;
```

Constraint names for inline checks may be PostgreSQL-generated except for `linkedin_share_attribution_token_source_check`; inspect the table definition if the generated names differ.

## Health gate

Confirm:

```text
step = STEP065A1
docsStep = STEP065A1
runtime.node = 20.x
linkedInShareAttributionPolicy.schemaRequirement = migration_038
linkedInShareAttributionPolicy.deepLinkContract = ls_128bit_base64url_exact_match
linkedInShareAttributionPolicy.eventLedger = immutable_append_only
linkedInShareAttributionPolicy.externalTracking = false
linkedInShareAttributionPolicy.dashboardIncluded = false
```

## Live core loop

1. Create a new ordinary LinkedIn profile-share draft.
2. Confirm preview URL begins with `https://t.me/introdeckbot?start=ls_`.
3. Publish once and save the LinkedIn Post ID.
4. Open the link from another Telegram user.
5. Confirm the exact public profile opens.
6. Submit one intro request, Telegram-contact request, or private-chat request.
7. Approve it from the profile owner account.
8. Confirm no duplicate product side effect on repeated callback.

## Evidence queries

```sql
select
  lsi.id,
  lsi.provider_post_id,
  lsi.attribution_token,
  lsi.status,
  lsi.published_at
from linkedin_share_intents lsi
where lsi.source_kind = 'profile_share'
order by lsi.created_at desc
limit 5;

select
  event_type,
  count(*) as event_count,
  count(distinct visitor_user_id) as unique_visitors
from linkedin_share_attribution_events
where share_intent_id = <SHARE_INTENT_ID>
group by event_type
order by event_type;

select
  event_type,
  entity_type,
  entity_id,
  telegram_update_id,
  created_at
from linkedin_share_attribution_events
where share_intent_id = <SHARE_INTENT_ID>
order by created_at asc;
```

Do not publish screenshots containing Telegram IDs or internal visitor IDs.

## Expected chain

```text
profile_opened
→ contact_request_started or private_chat_request_started
→ request_submitted
→ request_approved
```

## Rollback

- Before any STEP065A1 post is published: deploy exact STEP064B4D2A; leave migration 038 in place.
- After an `ls_` link is public: preserve `ls_` token resolution. If attribution writes misbehave, deploy a compatibility hotfix that keeps resolution and disables only evidence writes.
