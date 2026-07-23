# STEP063A-H1 QA Report

## Status

`SOURCE IMPLEMENTED / FOCUSED QA PASSED / PRODUCTION NOT VERIFIED`

- Mode: HEAVY
- Risk score: 12/12
- Package: `0.63.1`
- Source step: `STEP063A-H1`
- Exact baseline: `IntroDeck_STEP063A_FULL_2026-07-23.zip`
- Baseline SHA-256: `70cc1e0b6c572f1acdf0274d71b85915dfabceadf85e067a935e0778ba77adc7`

## Verified — PASS

Executed in the provided environment:

- Node.js `22.16.0`
- npm `10.9.2`

Commands and contracts:

```text
npm run check
node scripts/smoke_ai_news_generator_fallback.js
node scripts/smoke_ai_news_multi_source_quality.js
node scripts/smoke_ai_news_drafts_approval.js
node scripts/smoke_ai_news_presets_subscription.js
node scripts/smoke_ai_news_live_acceptance.js
node scripts/smoke_linkedin_share_profile.js
node scripts/smoke_linkedin_verified_development_integration.js
node scripts/smoke_linkedin_verification_compat_fail_safe.js
node scripts/smoke_linkedin_verified_badges_trust_surfaces.js
node scripts/smoke_positioning_discovery_truth_contract.js
node scripts/smoke_step057_production_readiness.js
```

The STEP063A-H1 focused smoke verifies:

- generator modes `off | template | groq | openai`;
- browse-only source search with no draft callback and no draft-row creation path;
- forced effective scheduler shutdown when the generator is off;
- deterministic RU/EN template output, exact source URL, evidence binding, and zero token cost;
- Groq Chat Completions request contract, strict JSON schema, exact API host, and absence of a `store` field;
- Groq success telemetry plus invalid-key, malformed-JSON, oversized-body, and stalled-body fail-closed paths;
- migration 034 provider constraints;
- unchanged STEP059 explicit LinkedIn publishing boundary.

## Full smoke inventory comparison

The complete local `scripts/smoke_*.js` inventory was executed for both the exact STEP063A baseline and the H1 candidate.

```text
Baseline:  91 PASS / 19 non-PASS / 110 total
Candidate: 92 PASS / 19 non-PASS / 111 total
New H1 smoke: PASS
Baseline PASS → candidate non-PASS regressions: 0
```

The candidate retains 19 pre-existing baseline non-PASS results:

- 17 inherited source-contract failures in unrelated legacy admin, invite, broadcast, profile, and copy checks;
- 2 environment-blocked dependency-backed checks: missing `pg` and missing `grammy` because dependency installation is unavailable in this container.


These inherited results are not reclassified as passing and are not attributed to STEP063A-H1.

## Secret scan

A changed-file scan found no real secret values. Two expected test/example placeholders were detected and retained:

- `.env.example`: illustrative `postgresql://user:password@host/...` value;
- `scripts/smoke_step061_profile_preview_hotfix.js`: synthetic Telegram token used by a smoke contract.

## Failed during implementation — resolved

- The first full-inventory comparison exposed two release-marker tests that rejected the valid `STEP063A-H1` suffix. Their parsing was made forward-compatible; both now pass and the final baseline comparison reports zero new regressions.
- Shared prompt assertions initially referenced only the OpenAI adapter. The contract was moved to the provider-neutral generation module and the legacy smoke was updated to verify that common contract.
- Renderer compatibility defaults were corrected after an existing AI/news contract exposed a false browse-only rendering state.
- A review caught provider credentials being considered for the generation-input hash; credentials were removed so hashes contain only provider/model identity and evidence/profile inputs.
- An accidental unrelated LinkedIn ENV mutation was found during source review and reverted before final QA.

## Blocked / not verified

- Canonical Node.js 20 dependency installation and build in this container.
- Dependency-backed bot smoke with installed `grammy` and `pg`.
- Migration 034 on production Neon.
- Vercel deployment and production `/api/health` for STEP063A-H1.
- Live Groq key, model availability, rate-limit behavior, and external response quality.
- Production template/Groq draft rows and provider telemetry.
- Telegram operator acceptance and explicit LinkedIn publication from a template or Groq draft.

## Residual risks

- The deterministic template is intentionally conservative and lower quality than an LLM-generated post; operator review remains mandatory.
- Groq free availability and rate limits are external runtime constraints and are not a production SLA.
- Migration 034 must exist before enabling `template` or `groq`; both modes fail closed otherwise.
- Browse-only is the safest rollback and requires no migration rollback.
- Existing OpenAI mode remains available, but the previously observed production OpenAI key is invalid until the operator replaces or disables it.

## Production acceptance gate

STEP063A-H1 may be promoted only after:

1. browse-only deployment and health verification;
2. proof that source browsing creates no draft attempts;
3. migration 034 constraint evidence;
4. one successful template or Groq draft and matching telemetry;
5. one edit/review cycle;
6. one explicit STEP059 LinkedIn authorization with exactly one durable receipt.
