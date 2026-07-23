# STEP063B-H1 — Operator Rollout

## Preconditions

- Deploy over exact STEP063B FULL baseline.
- Migration 035 must already be applied.
- Keep browse-only acceptance settings unless generator testing is explicitly intended.

## Recommended production ENV

```env
AI_NEWS_DRAFT_MODE=operator
AI_NEWS_ROLLOUT_STAGE=operator_acceptance
AI_NEWS_SOURCE_MODE=multi_source
AI_NEWS_ENABLED_PROVIDERS=rss,hacker_news,github_releases,newsdata
AI_NEWS_GENERATOR_MODE=off
AI_NEWS_SCHEDULE_MODE=off
AI_NEWS_DAILY_LIMIT=3
AI_NEWS_SEARCH_DAILY_LIMIT=10
```

No new ENV variable is introduced.

## Health acceptance

Expected:

```text
step = STEP063B-H1
docsStep = STEP063B-H1
searchUxPolicy.persistentProgressMessage = true
searchUxPolicy.duplicateCallbackGuard = true
searchUxPolicy.providerFailureAllowanceRelease = true
automaticPublishing = false
```

## Telegram acceptance

1. Open `/news`.
2. Press `Find relevant stories` once.
3. Confirm the existing card becomes a visible `Finding relevant stories…` state or a fallback reply appears.
4. Confirm that exact visible message becomes either results or a persistent failure card.
5. Press the progress button repeatedly and confirm no second search starts.
6. On provider-total failure, confirm retry is offered only after allowance restoration.
7. Confirm browse-only creates zero draft rows.

## SQL checks

```sql
select search_count_in_window, last_search_started_at, updated_at
from ai_news_preferences
order by updated_at desc
limit 5;
```

```sql
select count(*) as new_drafts
from ai_news_drafts
where created_at >= now() - interval '15 minutes';
```

Expected in browse-only: `new_drafts = 0`.

## Rollback

Redeploy exact STEP063B FULL artifact. No database rollback is required.
