# STEP063A-H1A QA Report

## Verdict

`SOURCE IMPLEMENTED / FOCUSED QA PASSED / PRODUCTION NOT VERIFIED`

## Baseline

- Artifact: `IntroDeck_STEP063A_H1_FULL_2026-07-23.zip`
- SHA-256: `5afac6b06efa4c999f37ad616c301e7a6bb7e5627c7a799918fc084a2d402959`
- Package: `0.63.1`
- Source step: `STEP063A-H1`

## Candidate

- Package: `0.63.2`
- Source step: `STEP063A-H1A`
- Migration: none
- New required ENV: none

## Verified locally

Environment: Node.js `22.16.0`.

Passed:

```text
npm run check
scripts/smoke_ai_news_source_relevance_browse_ux.js
scripts/smoke_ai_news_generator_fallback.js
scripts/smoke_ai_news_multi_source_quality.js
scripts/smoke_ai_news_drafts_approval.js
scripts/smoke_ai_news_presets_subscription.js
scripts/smoke_ai_news_live_acceptance.js
scripts/smoke_linkedin_share_profile.js
scripts/smoke_linkedin_verified_development_integration.js
scripts/smoke_linkedin_verification_compat_fail_safe.js
scripts/smoke_linkedin_verified_badges_trust_surfaces.js
scripts/smoke_positioning_discovery_truth_contract.js
scripts/smoke_step057_production_readiness.js
```

H1A-specific assertions cover:

- provider-specific query mappings;
- exact short-token matching;
- promotional price-prediction rejection;
- Crypto rejection of unrelated Intel/AI examples;
- retention of relevant exploit/Ethereum examples;
- explicit domain authority tiers;
- exact RSS all-feed failure code;
- bounded RSS/HN/GitHub diagnostics;
- search allowance/reset rendering;
- exhausted-search keyboard behavior;
- historical failed-draft suppression in browse-only;
- unchanged STEP059 publisher boundary.

## Full smoke inventory

Exact baseline:

```text
92 PASS / 19 NON_PASS / 111 total
```

Candidate:

```text
93 PASS / 19 NON_PASS / 112 total
```

Comparison:

```text
Baseline PASS → Candidate NON_PASS: 0
New H1A smoke: PASS
```

The 19 candidate non-PASS scripts are the same inherited set as the exact H1 baseline. This report does not relabel them as PASS.

## Secret scan

Changed-file scan found no real OpenAI, Groq, private-key, or database credentials.

One inherited synthetic Telegram token remains in `scripts/smoke_step061_profile_preview_hotfix.js`; it is test data and existed in the baseline.

## Not verified

- canonical Node 20 dependency-backed execution;
- Vercel deployment;
- production `/api/health` H1A marker;
- live Crypto relevance quality across external provider responses;
- live RSS exact error code and HN/GitHub no-result detail after deployment;
- browser rendering of the final external article page after Telegram link confirmation;
- production search-limit UX after a real final search claim.

## Residual risks

- Relevance scoring is deterministic policy, not semantic understanding; false positives and false negatives remain possible.
- Static domain tiers require periodic review and are not a statement of universal editorial quality.
- Provider feeds and payload shapes can change independently.
- Strict promotional filtering can remove a legitimate analytical article whose title uses price-prediction phrasing.

## Production acceptance

Follow `doc/92_STEP063A_H1A_OPERATOR_ROLLOUT.md`. Roll back to the exact H1 FULL artifact on relevance, latency, telemetry, or UX regression.
