# STEP063A-H1A — Source Relevance, Provider Diagnostics & Browse UX

## Status

`SOURCE IMPLEMENTED / FOCUSED QA PASSED / PRODUCTION NOT VERIFIED`

## Objective

Harden the existing STEP063A-H1 browse-only and multi-source path without changing the generator or STEP059 LinkedIn publisher. The step must prefer relevant evidence, reject high-confidence promotional material, expose bounded provider diagnostics, and make rolling search limits explicit in Telegram.

## Invariants

- No automatic generation or publication is added.
- `AI_NEWS_GENERATOR_MODE=off` remains a first-class browse-only mode.
- One provider may fail without collapsing the remaining source pool.
- Provider failure diagnostics contain registry keys and bounded counters, not secrets or arbitrary feed URLs.
- High-confidence price-prediction/presale/advertorial content from non-primary sources is rejected before persistence.
- Topic relevance is evaluated before NewsData fallback candidates fill the result set.
- Search allowance is read from the existing 24-hour window; no migration or counter reset is introduced.
- STEP059 remains the sole explicit-approval LinkedIn publisher.

## Source policy

### Provider-specific queries

Preset queries are resolved separately for RSS, Hacker News, and NewsData. Custom topics remain bounded to 100 characters.

### Relevance gate

- NewsData minimum: 35/100.
- Hacker News minimum: 32/100.
- RSS and GitHub Releases minimum: 24/100.
- Custom topics use lower bounded thresholds because the user supplies the vocabulary.

Scoring uses title, description/excerpt, source/category context, registry affinity, and exact short-token matching. A token such as `AI` does not match substrings such as `chair`.

### Authority tiers

- Primary sources keep explicit 94–98 authority values.
- Selected high-authority editorial domains receive explicit policy scores.
- Unknown editorial domains default to 60 instead of a universal 65.
- Low-quality domains can remain discoverable only when the article passes relevance and promotional gates.

### Promotional gate

High-confidence patterns such as `presale`, `price prediction`, `Can X hit $Y`, guaranteed returns, advertorials, and sponsored content are rejected for non-primary sources. Softer promotional indicators reduce relevance but do not automatically reject every article.

## Provider diagnostics

- RSS returns exact bounded error codes such as `rss_http_503`, `rss_timeout`, or `rss_invalid_xml_document` when all configured feeds fail.
- RSS telemetry includes per-registry-key item, stale, invalid, host-rejection, and query-mismatch counters.
- Hacker News telemetry includes load failures, score filtering, query mismatches, stale/invalid stories, and a bounded `noResultReason`.
- GitHub Releases telemetry includes repository failures, stale/draft/invalid releases, rejected release URLs, and a bounded `noResultReason`.
- NewsData telemetry includes accepted/rejected relevance counts and rejection reason cardinality.

## Browse UX

- The hub shows search allowance remaining and the exact ISO reset time when exhausted.
- `Find fresh news` is hidden when the rolling search allowance is exhausted.
- `Search again` is hidden after the final available search is claimed.
- Historical failed drafts are not shown as a current browse-only error.
- Source cards expose provider, quality tier, authority, and relevance score.
- Failed provider summaries expose only sanitized error codes.

## Migration / ENV

- Migration: none.
- New ENV: none.
- Existing STEP063A-H1 browse-only ENV remains valid.

## Acceptance

1. Deploy the H1A artifact with browse-only mode.
2. Confirm health reports `STEP063A-H1A` and the source quality policy.
3. Run one Crypto search.
4. Confirm obvious price predictions and unrelated Intel/AI stories do not fill the result list.
5. Confirm RSS failure telemetry contains a non-null sanitized error code.
6. Confirm source browsing creates zero draft rows.
7. Exhaust or simulate the last search and confirm repeat-search controls disappear and reset time is shown.
