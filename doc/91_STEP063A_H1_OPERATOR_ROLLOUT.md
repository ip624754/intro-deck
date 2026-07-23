# STEP063A-H1 — Operator Rollout

## 1. Artifact boundary

Apply the H1 PATCH only over:

```text
IntroDeck_STEP063A_FULL_2026-07-23.zip
SHA-256 70cc1e0b6c572f1acdf0274d71b85915dfabceadf85e067a935e0778ba77adc7
```

## 2. Deploy browse-only first

Use `doc/env/STEP063A_H1_BROWSE_ONLY_PRODUCTION.env` and redeploy.

Expected health minimum:

```json
{
  "step": "STEP063A-H1",
  "aiNewsDraft": {
    "sourceMode": "multi_source",
    "generatorMode": "off",
    "generatorEnabled": false,
    "browseOnly": true,
    "generatorProvider": null,
    "schedule": {
      "enabled": false,
      "mode": "off"
    },
    "automaticPublishing": false
  }
}
```

Manual browse acceptance:

```text
/news → Find fresh news → Open source
```

Required evidence:

- source candidates are returned;
- no `Draft` buttons are rendered;
- original URLs open;
- no new `ai_news_drafts` row is created;
- source-provider telemetry is still recorded.

## 3. Apply migration 034

Run:

```text
migrations/034_ai_news_generator_provider_neutrality.sql
```

Verify:

```sql
select
  conrelid::regclass::text as table_name,
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in (
  'ai_news_drafts_model_provider_check',
  'ai_news_provider_usage_events_provider_check'
)
order by conname;
```

Expected definitions include `groq` and `template`.

## 4A. Zero-provider template acceptance

Apply `doc/env/STEP063A_H1_TEMPLATE_OPERATOR_ACCEPTANCE.env`, redeploy, and verify:

```text
generatorMode=template
model=introdeck-template-v1
```

Run exactly one draft. Expected database evidence:

```text
ai_news_drafts.model_provider = template
ai_news_drafts.model_name = introdeck-template-v1
generation_error_code = null
provider usage provider = template / outcome = success
input_tokens = 0 / output_tokens = 0
```

## 4B. Bounded Groq acceptance

Create a Groq key and store it only in Vercel Production as `GROQ_API_KEY`. Apply the Groq ENV profile and redeploy.

Expected health:

```text
generatorMode=groq
generatorProviderConfigured=true
model=openai/gpt-oss-20b
```

Run one draft only. Verify the last telemetry row:

```sql
select provider, operation, outcome, model_name, input_tokens,
       output_tokens, duration_ms, error_code, request_id, created_at
from ai_news_provider_usage_events
where operation='generate_draft'
order by created_at desc
limit 5;
```

## 5. Explicit publication acceptance

Only after one valid draft:

```text
Edit → review exact text/source → Approve → one LinkedIn OAuth authorization
```

Required result: exactly one provider post ID and one durable receipt. Duplicate callback must not create a second post.

## 6. Rollback

Return to browse-only ENV and redeploy. Migration 034 remains installed.
