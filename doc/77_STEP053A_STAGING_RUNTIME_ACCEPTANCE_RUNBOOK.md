# STEP053A — Staging Runtime Acceptance Runbook

## Release boundary

This runbook produces staging evidence only. The source remains **NOT live-confirmed** until every phase passes on the deployed staging artifact.

## 1. Prepare staging

Required runtime:

- Node.js 20.x;
- PostgreSQL staging database;
- migrations applied in order through `027_contact_contract_payment_honesty.sql`;
- staging Telegram bot token and webhook;
- deployed staging URL;
- dedicated requester and recipient Telegram test accounts.

Required STEP053 settings:

```env
PRO_OUTREACH_DAILY_LIMIT=10
CONTACT_REQUEST_RETRY_COOLDOWN_DAYS=30
PAYMENT_CHECKOUT_AUTH_TTL_MINUTES=30
PAYMENT_CHECKOUT_RETRY_LOCK_SECONDS=1800
```

Acceptance-only settings:

```env
STEP053A_TARGET=staging
STEP053A_EVIDENCE_DIR=runtime_evidence/step053a
STEP053A_ARTIFACT_SHA=<exact deployed commit or artifact SHA>
```

The deployed `/api/health?full=1` must expose the same SHA through the platform commit variable or `RELEASE_ARTIFACT_SHA`. Do not add acceptance mutation ACK values to the permanent deployment environment.

## 2. Run read-only preflight

```bash
npm ci
npm run check
npm run smoke:step053a-pack
npm run step053a:preflight
```

Expected result:

- verdict `PASS`;
- evidence JSON and Markdown under `runtime_evidence/step053a/<run-id>/`;
- a 16-character database fingerprint in the output;
- deployed health `artifactSha` exactly matches `STEP053A_ARTIFACT_SHA`.

`--skip-telegram`, `--skip-health`, and `--allow-node-mismatch` are diagnostic-only. Any run using them is not a release acceptance run.

## 3. Run isolated database acceptance

Set the fingerprint printed by preflight:

```env
STEP053A_MUTATION_ACK=ALLOW_STEP053A_STAGING_FIXTURES
STEP053A_DATABASE_ACK=<exact fingerprint>
```

Then run:

```bash
npm run step053a:database
```

Expected result:

- verdict `PASS`;
- exactly one concurrent checkout authorization;
- combined Pro allowance stops at the configured limit;
- charge replay attempts remain attached to the original entity;
- fixture cleanup reports zero residual users.

If cleanup fails, stop rollout and remove only rows with the exact run-specific fixture prefix after inspection. Do not use an unescaped SQL `LIKE` pattern.

## 4. Capture Telegram Stars runtime evidence

Create the manifest:

```bash
npm run step053a:evidence:init -- runtime_evidence/step053a/manual-evidence.json
```

Use two Telegram test accounts and capture message links, screenshots, Telegram update IDs, database query exports, or structured logs for every scenario:

1. intro-only card has no paid contact or DM buttons;
2. both pre-checkout paths reject after the target switches to intro-only;
3. paid direct-contact reaches `paid_pending_approval` once;
4. paid DM reaches `pending_recipient` once;
5. wrong currency or amount is rejected;
6. duplicate successful-payment delivery creates no second receipt/message;
7. cross-entity charge replay is rejected;
8. two near-simultaneous pre-checkout callbacks yield one authorization;
9. Pro increments the combined allowance once;
10. the first request after the configured Pro limit shows paid fallback;
11. stale Pro DM draft is blocked after cross-rail decline;
12. block prevents a new direct-contact request;
13. pricing, invoice disclosure, receipt, and Terms use the same contract.

Populate:

- operator name;
- exact artifact SHA or commit;
- staging URL;
- Node/PostgreSQL/bot versions;
- automated evidence paths and SHA-256 values;
- `PASS` plus at least one proof reference for every scenario;
- `operatorVerdict: "GO"` only after review.

Validate:

```bash
npm run step053a:evidence:verify -- runtime_evidence/step053a/manual-evidence.json
```

The validator creates `STEP053A_STAGING_ACCEPTANCE_REPORT.md` only when all evidence is complete.

## 5. Go / no-go rule

**GO** requires:

- preflight `PASS` on Node 20;
- database runtime `PASS` with cleanup `PASS`;
- all 13 Telegram scenarios `PASS`;
- evidence hashes matching;
- preflight and database evidence fingerprints matching;
- preflight, database, health, and manual evidence artifact SHA matching;
- operator verdict `GO`;
- artifact SHA matching the deployed staging artifact.

Anything else is **NO-GO / BLOCKED**.

## 6. After acceptance

- archive the complete evidence directory outside the repository;
- remove `STEP053A_MUTATION_ACK` and `STEP053A_DATABASE_ACK` from the environment;
- update handoff with exact staging artifact SHA and report hash;
- proceed to STEP054 only after the report is reviewed.
