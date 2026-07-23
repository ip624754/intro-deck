# STEP063A-H1A QA Checklist

## Source contract

- [x] Provider-specific preset queries are bounded.
- [x] Exact short-token matching prevents `AI` substring false positives.
- [x] Crypto promotional price-prediction examples are rejected.
- [x] Unrelated Intel/AI examples are rejected from Crypto fallback.
- [x] Relevant exploit and Ethereum examples remain accepted.
- [x] Domain authority tiers replace universal NewsData authority 65.

## Diagnostics

- [x] RSS all-feed failure exposes a sanitized non-null error code.
- [x] RSS registry-level diagnostics exclude secrets and arbitrary URLs.
- [x] HN no-result counters/reason are bounded.
- [x] GitHub release no-result counters/reason are bounded.
- [x] Relevance rejection cardinality is retained in telemetry detail.

## Browse UX

- [x] Search remaining/limit is rendered.
- [x] Reset time is rendered when remaining is zero.
- [x] Hub search action is hidden when exhausted.
- [x] Result `Search again` is hidden after the final claim.
- [x] Historical failed draft is hidden in browse-only mode.
- [x] Quality tier and relevance score render on source cards.

## Boundaries

- [x] No migration added.
- [x] No new ENV required.
- [x] Generator adapters unchanged.
- [x] STEP059 LinkedIn publisher unchanged.
- [x] Browse-only still creates no draft by design.

## Runtime

- [x] Syntax gate passed in provided Node 22.16.0 environment.
- [x] Focused H1A smoke passed.
- [x] Related AI/news and LinkedIn contracts passed.
- [x] Full smoke inventory has zero baseline-PASS regressions.
- [ ] Canonical Node 20 dependency-backed execution.
- [ ] Vercel deployment and production health.
- [ ] Production relevance/provider diagnostics acceptance.
