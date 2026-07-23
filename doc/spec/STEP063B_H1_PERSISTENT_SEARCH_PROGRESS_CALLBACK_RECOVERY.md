# STEP063B-H1 — Persistent Search Progress & Callback Recovery UX

## Goal

Replace the disappearing Telegram progress reply with one persistent message lifecycle:

```text
searching -> results | failed
```

The change is limited to the AI/news search callback, message targeting, failure visibility, duplicate-callback handling, and safe search-claim retry semantics.

## Baseline

- Exact baseline: `IntroDeck_STEP063B_FULL_2026-07-24.zip`
- Baseline SHA-256: `c2005f93fc885b68f0ffbd703f3a0a3a7fb4a2846df67790c195c08384aa7f7e`
- Candidate package: `0.63.4`
- Source step: `STEP063B-H1`

## Invariants

1. The progress state stays visible until replaced by results or a clear failure card.
2. If editing the original Telegram message is impossible, the fallback reply becomes the canonical message target for the rest of the search lifecycle.
3. Duplicate callbacks in the same runtime are rejected without starting a second provider search.
4. The PostgreSQL search claim remains the cross-runtime concurrency boundary.
5. A total provider failure may release only the exact current search claim; a newer claim must never be decremented.
6. No-result searches remain countable because the provider work completed.
7. No draft, LinkedIn authorization, or publication is created by search progress or recovery handling.
8. STEP059 remains the sole LinkedIn publisher.

## UX states

### Searching

The message shows topic, audience, angle, configured providers, and `Search status: searching`.

### Results

The same message reference is edited into the candidate list.

### Failed

The same message reference is edited into a persistent failure card with:

- bounded reason;
- allowance outcome;
- remaining allowance when available;
- retry only when the exact provider-failure claim was safely released;
- return to News settings.

## Search claim release

`releaseAiNewsSourceSearchClaim` updates the row only when `last_search_started_at` equals the exact claimed timestamp. This prevents an old failed request from decrementing a newer search claim.

No schema migration or new ENV is required.
