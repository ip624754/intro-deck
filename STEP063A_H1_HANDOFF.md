# STEP063A-H1 Handoff

## Status

`SOURCE IMPLEMENTED / FOCUSED QA PASSED / PRODUCTION NOT VERIFIED`

## Canonical input

- Artifact: `IntroDeck_STEP063A_FULL_2026-07-23.zip`
- SHA-256: `70cc1e0b6c572f1acdf0274d71b85915dfabceadf85e067a935e0778ba77adc7`
- Package: `0.63.1`
- Source step: `STEP063A-H1`
- Mode: HEAVY
- Risk score: 12/12

## Implemented

- Provider-neutral draft dispatcher: `off | template | groq | openai`.
- Browse-only `/news` flow that preserves source search and original-link access without creating drafts.
- Deterministic built-in template generator with source URL and exact evidence-claim binding.
- Groq Chat Completions adapter for `openai/gpt-oss-20b` with strict JSON schema, exact API-host allowlist, no `store` field, bounded response size, and a shared header/body deadline.
- Real provider identity in draft rows, audit details, usage telemetry, diagnostics, and health.
- Migration 034 expands only generator-provider constraints; existing OpenAI rows remain valid.
- Scheduler is forced effectively off when generator mode is `off`.
- Preset Run now and scheduled execution fail closed in browse-only mode.
- Existing OpenAI adapter now reuses the common generation contract.
- STEP059 LinkedIn publishing core remains unchanged.

## Verified

- `npm run check` — PASS in the provided Node 22.16.0 environment.
- STEP063A-H1 focused generator smoke — PASS.
- STEP063A multi-source smoke — PASS.
- STEP060 draft approval contract — PASS after forward-compatible contract assertions.
- STEP061 preset/subscription contract — PASS.
- STEP061A live acceptance contract — PASS.
- STEP059 LinkedIn share contract — PASS.
- STEP058A, STEP058B, and STEP058B1 compatibility contracts — PASS.
- STEP054 positioning and STEP057 production-readiness contracts — PASS with the H1 release marker.
- Groq mock success, invalid key, malformed JSON, oversized body, and stalled-body deadline paths — PASS.
- Browse-only Telegram rendering hides draft callbacks while retaining source URLs — PASS.
- Full smoke inventory delta: candidate 92/111 PASS versus baseline 91/110 PASS; zero baseline-PASS regressions.
- The 19 candidate non-PASS results are inherited from the exact baseline: 17 unrelated source-contract failures and 2 missing-dependency checks (`pg`, `grammy`).

## Blocked / not verified

- Canonical Node 20 dependency installation and dependency-backed checks (`pg` and `grammy` are absent in this container).
- Migration 034 on production Neon.
- Vercel deployment and production health.
- Live Groq key/model/rate-limit acceptance.
- Template and Groq production draft rows/telemetry.
- Full Telegram source → draft → edit → explicit LinkedIn publication acceptance.

## Safe rollout

1. Deploy browse-only profile first.
2. Verify no new draft attempts are created by source browsing.
3. Apply migration 034 and verify both provider constraints.
4. Enable `template` first for zero-provider acceptance, or enable bounded `groq` with a server-side key.
5. Generate exactly one draft, edit it, and inspect telemetry.
6. Perform one explicit STEP059 LinkedIn authorization only after the draft path is accepted.

## Rollback

Return to browse-only mode. Do not delete migration 034.
