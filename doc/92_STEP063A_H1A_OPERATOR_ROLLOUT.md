# STEP063A-H1A — Operator Rollout

## Safe configuration

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

No migration is required.

## Health acceptance

Open `/api/health` and verify:

```text
step = STEP063A-H1A
sourceMode = multi_source
generatorMode = off
browseOnly = true
schedule.mode = off
sourceQualityPolicy.presetQueryMapping = true
sourceQualityPolicy.providerMinimumScores.newsdata = 35
sourceQualityPolicy.promotionalContentPolicy = reject_high_confidence_non_primary
automaticPublishing = false
```

## Telegram acceptance

1. Open `/news`.
2. Verify search allowance and, when exhausted, reset time.
3. Select `Crypto` and run one search.
4. Confirm no `Draft` buttons exist in browse-only mode.
5. Confirm promotional price-prediction entries and unrelated business/AI entries do not fill the Crypto list.
6. Open one original source.
7. Confirm the last available search removes `Search again`.

## Database evidence

```sql
select provider, operation, outcome, result_count, error_code, detail_json, created_at
from ai_news_provider_usage_events
where created_at >= now() - interval '30 minutes'
order by created_at desc;
```

Expected:

- RSS full failure has a non-null sanitized `error_code`.
- HN/GitHub `no_result` rows contain bounded diagnostic counters/reasons in `detail_json`.
- NewsData `detail_json` contains relevance accepted/rejected counts.

```sql
select count(*) as new_drafts
from ai_news_drafts
where created_at >= now() - interval '30 minutes';
```

Browse-only acceptance requires `new_drafts = 0` for the test window.

## Rollback

Return to the exact STEP063A-H1 artifact or keep H1A code and disable the source surface:

```env
AI_NEWS_DRAFT_MODE=off
AI_NEWS_SCHEDULE_MODE=off
```

The preferred rollback is the prior H1 FULL artifact because H1A does not add a migration.
