# STEP063A — Operator rollout

## 1. Artifact boundary

Apply the STEP063A PATCH only over the exact STEP061A baseline:

```text
IntroDeck_STEP061A_FULL_2026-07-20.zip
SHA-256 658d8fa38fd4340d4fd0bc82c3b7fca796a5a929b80930ffb1c0d9a07250c04e
```

Do not apply the PATCH to an unknown or modified tree.

## 2. Pre-deploy safe state

Deploy first with:

```env
AI_NEWS_SOURCE_MODE=newsdata_only
AI_NEWS_ENABLED_PROVIDERS=newsdata
AI_NEWS_ROLLOUT_STAGE=operator_acceptance
```

This preserves the existing provider path while the source overlay is built and migration readiness is checked.

## 3. Apply migration

Run the complete file:

```text
migrations/033_ai_news_multi_source_quality_foundation.sql
```

Prerequisites:

```text
migration 030: ai_news_sources / ai_news_drafts
migration 032: ai_news_provider_usage_events / provider usage fields
```

Required database evidence:

```sql
select column_name
from information_schema.columns
where table_schema=current_schema()
  and table_name='ai_news_sources'
  and column_name in (
    'source_kind',
    'source_authority_score',
    'source_is_primary',
    'trend_score',
    'source_metadata_json'
  )
order by column_name;
```

Expected: five rows.

## 4. Enable bounded operator acceptance

Use `doc/env/STEP063A_MULTI_SOURCE_OPERATOR_ACCEPTANCE.env` as the non-secret profile and retain existing provider secrets separately.

Minimum:

```env
AI_NEWS_SOURCE_MODE=multi_source
AI_NEWS_ENABLED_PROVIDERS=rss,hacker_news,github_releases,newsdata
AI_NEWS_ROLLOUT_STAGE=operator_acceptance
```

`GITHUB_API_TOKEN` is optional. Do not store it in artifacts.

## 5. Health acceptance

Expected minimum:

```json
{
  "ok": true,
  "step": "STEP063A",
  "docsStep": "STEP063A",
  "aiNewsDraft": {
    "sourceMode": "multi_source",
    "enabledSourceProviders": ["rss", "hacker_news", "github_releases", "newsdata"],
    "newsdataFallbackPolicy": "only_when_primary_pool_is_below_limit",
    "explicitApprovalRequired": true,
    "automaticPublishing": false
  }
}
```

## 6. Manual operator acceptance

Run one bounded loop per preset:

```text
/news
→ AI & Technology
→ Find fresh news
→ inspect provider diversity and duplicate removal
→ Open source
→ Draft one source
→ edit text
→ explicit LinkedIn approval
→ exactly one LinkedIn receipt
```

Then repeat with Business and Crypto only if the first loop passes.

Capture:

- source mode and enabled providers from health;
- candidate provider mix;
- source URLs and duplicate count;
- any isolated provider failure message;
- one stored provider-usage row per attempted provider;
- exactly one LinkedIn post/receipt for the approved draft;
- duplicate callback result.

## 7. Rollback

Runtime rollback without schema rollback:

```env
AI_NEWS_SOURCE_MODE=newsdata_only
AI_NEWS_ENABLED_PROVIDERS=newsdata
```

Redeploy and verify health reports `sourceMode=newsdata_only`.

Migration 033 is additive. Do not drop its columns or constraints during an incident rollback; leave the schema in place and disable multi-source through ENV.
