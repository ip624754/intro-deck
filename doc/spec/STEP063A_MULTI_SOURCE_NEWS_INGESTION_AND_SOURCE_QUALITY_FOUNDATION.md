# STEP063A — Multi-Source News Ingestion & Source Quality Foundation

## Goal

Extend the existing NewsData-only discovery path into one bounded, fail-isolated source pool without creating a second evidence, draft, subscription, scheduler, or LinkedIn publishing core.

## Mode and risk

- CogniForge mode: HEAVY
- Risk score: 12/12
- Critical zones: external provider egress, URL safety, provider budgets, schema migration, source evidence, Telegram delivery, production rollout
- Canonical input artifact: `IntroDeck_STEP061A_FULL_2026-07-20.zip`
- Canonical input SHA-256: `658d8fa38fd4340d4fd0bc82c3b7fca796a5a929b80930ffb1c0d9a07250c04e`

## Product and mechanism invariants

1. STEP059 remains the only LinkedIn publishing core.
2. Source discovery, ranking, subscription access, and scheduling never authorize publication.
3. Every draft remains bound to one minimized source evidence snapshot and exact source URL.
4. Provider egress is HTTPS-only and hostname-allowlisted; redirects are rejected. Header fetch plus body read share one total provider deadline.
5. Arbitrary RSS URLs are not accepted. RSS/Atom feeds come only from the source registry in code.
6. Provider response bodies are bounded before parsing; malformed JSON/XML fails closed for that provider.
7. One provider failure does not fail the entire discovery request when another provider returns valid candidates.
8. NewsData is a broad fallback in `multi_source`; it remains the only provider in the default `newsdata_only` mode.
9. Full copyrighted article bodies are not persisted. Existing excerpt limits remain authoritative.
10. Provider keys, GitHub tokens, raw provider payloads, prompts, OAuth tokens, and LinkedIn access tokens are not exposed in Telegram or health surfaces.

## Source providers

### RSS/Atom

- Fixed allowlisted registry only.
- Current registry covers Google Blog, GitHub Blog, and Ethereum Foundation Blog.
- Bounded parser supports RSS item and Atom entry contracts used by trusted feeds.
- Per-feed failures are isolated and recorded in provider detail telemetry.

### Hacker News

- Uses the official Firebase API host only.
- Scans a bounded number of top-story IDs in bounded batches under one overall provider deadline.
- Hacker News is a discovery/trend signal; the evidence URL is the original linked source, not the HN discussion URL.
- HN score/comments are metadata and ranking input, not factual evidence about the linked article. Query matching is token-based so short terms such as `AI` do not match unrelated substrings.

### GitHub Releases

- Uses the official GitHub REST API host only.
- Reads a fixed registry of public repositories by preset.
- Optional `GITHUB_API_TOKEN` increases provider allowance but is never required for public repositories.
- Draft and stale releases are filtered before candidate storage.

### NewsData

- Preserves the existing provider contract in `newsdata_only`.
- In `multi_source`, NewsData runs only when RSS/HN/GitHub do not fill the bounded candidate pool.
- Invalid or oversized JSON is a provider failure, never an empty-success result.

## Normalized source contract

Each provider produces a bounded normalized record:

```json
{
  "provider": "rss",
  "providerArticleId": "optional-provider-id",
  "url": "https://original-source.example/article",
  "dedupeKey": "https://original-source.example/article",
  "title": "Article title",
  "description": "Bounded excerpt",
  "contentExcerpt": "Bounded excerpt",
  "sourceName": "Source name",
  "sourceDomain": "original-source.example",
  "language": "en",
  "country": null,
  "categories": ["registry_key"],
  "publishedAt": "2026-07-23T00:00:00.000Z",
  "sourceKind": "official_blog",
  "authorityScore": 96,
  "isPrimary": true,
  "trendScore": 0,
  "metadata": {}
}
```

## Deduplication and ranking

1. Canonicalize URL, strip known tracking parameters, sort remaining query parameters, and remove fragments/trailing slashes.
2. Deduplicate exact canonical URLs across providers.
3. Apply conservative title-similarity deduplication to near-identical titles only.
4. Prefer higher authority, primary sources, direct RSS/GitHub discovery, freshness, and bounded trend score.
5. Preserve provider diversity with a soft per-provider cap; deferred valid candidates may fill remaining slots.

## Schema

Migration `033_ai_news_multi_source_quality_foundation.sql`:

- expands source providers to `newsdata`, `rss`, `hacker_news`, and `github_releases`;
- adds `source_kind`, `source_authority_score`, `source_is_primary`, `trend_score`, and `source_metadata_json`;
- expands provider telemetry and adds `discover_sources`;
- adds provider/quality indexes;
- requires migrations 030 and 032.

## Rollout contract

Default and rollback-safe state:

```env
AI_NEWS_SOURCE_MODE=newsdata_only
```

Operator acceptance after migration 033:

```env
AI_NEWS_SOURCE_MODE=multi_source
AI_NEWS_ENABLED_PROVIDERS=rss,hacker_news,github_releases,newsdata
AI_NEWS_ROLLOUT_STAGE=operator_acceptance
```

If `multi_source` is enabled before migration 033, the UI fails closed with `migration_033_required`. The deployed overlay remains backward-compatible while `newsdata_only` is active.

## Out of scope

- arbitrary user-supplied RSS feeds;
- page scraping or headless browser ingestion;
- RSSHub, arXiv, GDELT, or social-media scraping;
- full-article persistence;
- autonomous drafting or publishing;
- changes to STEP059 LinkedIn authorization, post request, receipt, or unknown-outcome logic;
- changes to Pro entitlement or Stars payment cores.

## Acceptance criteria

- the default source mode preserves the existing NewsData-only path;
- migration 033 is additive and required before multi-source writes;
- provider egress is bounded and allowlisted;
- provider failures are isolated and observable;
- canonical URL and exact-title duplicates collapse to one candidate;
- first-party/direct sources rank above aggregator duplicates;
- NewsData is skipped when the free/direct pool is sufficient;
- Telegram source cards expose both `Draft` and `Open source` actions;
- source selection TTL remains explicit;
- STEP059 publisher imports no multi-source adapter;
- focused source QA passes without live provider or production claims.
