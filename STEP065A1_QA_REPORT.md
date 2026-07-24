# STEP065A1 QA Report

## Status

```text
SOURCE IMPLEMENTED
FOCUSED QA PASSED
FULL REGRESSION COMPARISON PASSED
ZERO BASELINE PASS REGRESSIONS
MIGRATION NOT APPLIED
PRODUCTION NOT DEPLOYED
```

## Focused QA

Verified locally:

- `npm run check`
- `npm run smoke:linkedin-share-attribution`
- `npm run smoke:linkedin-share`
- `npm run smoke:profile-share-media`
- `npm run smoke:profile-share-cta-polish`
- `npm run smoke:intro`
- `npm run smoke:contact-unlock`
- `npm run smoke:dm-relay`
- `npm run smoke:dm-payments`
- `npm run smoke:transaction-language-boundary`

## Regression comparison

```text
STEP064B4D2A baseline: 105 PASS / 7 NON_PASS / 112
STEP065A1 candidate:  106 PASS / 7 NON_PASS / 113
Baseline PASS → candidate NON_PASS: 0
New smoke:linkedin-share-attribution: PASS
```

Inherited/environmental NON_PASS:

- `smoke:ai-news-productization`
- `smoke:broadcast-idempotency`
- `smoke:code-split`
- `smoke:profile-session-schema`
- `smoke:schema-compat`
- `smoke:step053a-pack`
- `smoke:step061-profile-preview-hotfix`

## Verified source invariants

- opaque 128-bit attribution token;
- exact published-profile token resolution;
- legacy `profile_<id>` fallback;
- wrong-profile session isolation;
- immutable event ledger;
- idempotent event keys;
- total/unique open evidence contract;
- self-open exclusion;
- request submission/approval entity linkage;
- attribution failure does not block product actions;
- no external tracking, cookies, pixels, fingerprinting, or LinkedIn scraping;
- payment, OAuth, publisher, image, reward, and AI/news contracts unchanged.

## Not verified

- migration 038 execution in PostgreSQL;
- real immutable-trigger behavior in production;
- production `ls_` link resolution;
- production event chain;
- production unique-open counts;
- live request approval attribution;
- rollback after an `ls_` link becomes public.

Local runtime: Node 22.16.0. Production contract: Node 20.x.
