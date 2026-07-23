# STEP063B — Operator Rollout

## Preconditions

- Exact baseline overlay target: STEP063A-H1A FULL SHA-256 `b7f20e26d94872097ad8165a7d2f4f43aa7a9c3a446766b1d5260573f6baff39`.
- Migrations 030–034 are already applied.
- Keep the existing source-provider secrets server-side.
- Do not enable a generator during the initial acceptance.

## 1. Apply migration 035

Run:

```text
migrations/035_ai_news_audience_aware_discovery.sql
```

Verify columns:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = current_schema()
  and table_name in ('ai_news_preferences', 'ai_news_presets')
  and column_name in (
    'audience_key',
    'custom_audience',
    'angle_key',
    'profile_affinity_enabled'
  )
order by table_name, column_name;
```

Expected: eight rows.

Verify constraints:

```sql
select conrelid::regclass::text as table_name,
       conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in (
  'ai_news_preferences_preset_key_check',
  'ai_news_preferences_audience_key_check',
  'ai_news_preferences_custom_audience_check',
  'ai_news_preferences_angle_key_check',
  'ai_news_presets_preset_key_check',
  'ai_news_presets_audience_key_check',
  'ai_news_presets_custom_audience_check',
  'ai_news_presets_angle_key_check',
  'ai_news_input_sessions_input_kind_check',
  'ai_news_input_sessions_input_kind_draft_id_check'
)
order by conname;
```

## 2. Deploy browse-only configuration

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

No new ENV variable is introduced by STEP063B.

## 3. Health acceptance

Open `/api/health` and verify:

```text
step = STEP063B
docsStep = STEP063B
sourceMode = multi_source
generatorMode = off
browseOnly = true
automaticPublishing = false
sourceQualityPolicy.audienceAwareScoring = true
sourceQualityPolicy.profileAffinityScoring = true
audienceDiscoveryPolicy.personalizedTopic = for_you
audienceDiscoveryPolicy.externalQueryPolicy = bounded_public_profile_terms_only
audienceDiscoveryPolicy.presetContract = topic_audience_angle_language_tone
```

## 4. Telegram acceptance

1. Open `/news`.
2. Confirm the main taxonomy contains `For you`, AI & Tech, Startups, Business, Career, Crypto, and Custom topic.
3. Open Audience and select `Product & engineering`.
4. Open Angle and select `Practical lessons`.
5. Select `For you` and run one search.
6. Confirm source cards show profile, audience, and angle fit scores where available.
7. Confirm only `Open N` buttons exist in browse-only mode.
8. Save the current selection as a preset.
9. Re-open the preset and confirm topic, audience, angle, language, tone, and profile-match state are preserved.

## 5. Database evidence

Preferences:

```sql
select preset_key, custom_query, audience_key, custom_audience,
       angle_key, profile_affinity_enabled, post_language, tone, updated_at
from ai_news_preferences
order by updated_at desc
limit 10;
```

Presets:

```sql
select name, preset_key, custom_query, audience_key, custom_audience,
       angle_key, profile_affinity_enabled, post_language, tone,
       schedule_mode, status, created_at
from ai_news_presets
order by created_at desc
limit 10;
```

Sources:

```sql
select provider, source_title, source_authority_score,
       source_metadata_json ->> 'relevanceScore' as relevance_score,
       source_metadata_json ->> 'profileAffinityScore' as profile_affinity_score,
       source_metadata_json ->> 'audienceFitScore' as audience_fit_score,
       source_metadata_json ->> 'angleFitScore' as angle_fit_score,
       source_metadata_json ->> 'audienceKey' as audience_key,
       source_metadata_json ->> 'angleKey' as angle_key,
       created_at
from ai_news_sources
where created_at >= now() - interval '30 minutes'
order by created_at desc
limit 20;
```

Browse-only invariant:

```sql
select count(*) as new_drafts
from ai_news_drafts
where created_at >= now() - interval '30 minutes';
```

Expected for a source-only test window: `new_drafts = 0`.

## 6. Rollback

Preferred code rollback: redeploy the exact STEP063A-H1A FULL artifact.

Migration 035 is additive and may remain in place during rollback. Older H1A code ignores the new columns. Do not drop the migration during an incident.

Emergency surface disable:

```env
AI_NEWS_DRAFT_MODE=off
AI_NEWS_SCHEDULE_MODE=off
```
