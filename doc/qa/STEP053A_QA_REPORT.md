# STEP053A QA Report — Staging Runtime Acceptance Pack

## Scope

Source-level verification of the staging acceptance tooling. This report is **not** a staging runtime acceptance report and does not claim PostgreSQL, deployed health, Telegram webhook, or Telegram Stars proof.

## Canonical local runtime

- Node.js: `20.20.2`
- npm: `10.9.2`
- package: `0.50.1`
- operating system: Linux

## Verified locally

| Check | Result | Evidence boundary |
|---|---|---|
| Baseline FULL ZIP SHA-256 | PASS | `57dd99e433b43e1fea697c00a87598ca2bf572cc80bc078e228389bcff7ae493` |
| `npm ci --ignore-scripts` | PASS | dependencies installed; initial Node 22 invocation emitted the expected engine warning |
| `npm run check` on Node 20 | PASS | syntax/import surface for application and STEP053A scripts |
| `npm run smoke:step053a-pack` on Node 20 | PASS | pack source contract |
| `npm audit --audit-level=high` | PASS | `0 vulnerabilities` |
| Full Node 20 smoke inventory | `68/81` PASS | 13 inherited failures; no new failure versus STEP053 |
| STEP053 Node 20 control inventory | `67/80` PASS | same 13 inherited failures |
| Missing target guard | PASS | preflight and database runner return `FAIL` |
| Wrong database fingerprint guard | PASS | runner returns `FAIL` before pool creation or cleanup |
| Cleanup safety on rejected mutation | PASS | evidence states cleanup was not attempted |
| Evidence template initialization | PASS | creates 13 scenarios with `BLOCKED` default |
| Incomplete evidence rejection | PASS | verifier fails closed |
| Synthetic complete-manifest validator test | PASS | report generation logic verified only; not runtime evidence |
| `git diff --check` | PASS | no whitespace errors |

## Full smoke comparison

### STEP053 control

- Total: `80`
- PASS: `67`
- FAIL: `13`

### STEP053A

- Total: `81`
- PASS: `68`
- FAIL: `13`

### Inherited failure set

- `smoke:env`
- `smoke:code-split`
- `smoke:profile-session-schema`
- `smoke:admin-allowlist`
- `smoke:admin-users`
- `smoke:admin-user-card`
- `smoke:admin-intros`
- `smoke:broadcast-idempotency`
- `smoke:admin-polish`
- `smoke:admin-productivity`
- `smoke:admin-search`
- `smoke:admin-russian-layer`
- `smoke:admin-runbook-freeze`

No new failing contract was introduced. `smoke:step053a-pack` is the additional passing contract.

## Safety checks verified

The mutating runner does not construct a database pool until all of these checks pass:

1. `STEP053A_TARGET=staging`;
2. Node.js 20.x;
3. `STEP053A_MUTATION_ACK=ALLOW_STEP053A_STAGING_FIXTURES`;
4. `STEP053A_DATABASE_ACK` equals the read-only preflight database fingerprint;
5. `STEP053A_ARTIFACT_SHA` is a valid artifact anchor.

Negative tests confirmed that missing target acknowledgement and a wrong fingerprint produce `FAIL` evidence and do not attempt fixture cleanup. Cleanup queries use exact-prefix matching rather than wildcard `LIKE` semantics.

## Evidence-verifier checks verified

The verifier requires:

- all 13 scenarios present and `PASS`;
- valid timestamps;
- at least one non-empty evidence reference per scenario;
- Node.js 20.x in manual and automated evidence;
- exact `STEP053A` step and expected evidence phase;
- matching database fingerprint and artifact SHA across automated/manual evidence;
- automated evidence verdict `PASS` plus matching SHA-256;
- HTTPS staging URL;
- 40- or 64-character hexadecimal artifact SHA;
- explicit operator verdict `GO`.

A synthetic complete manifest was accepted only to test validator mechanics. It is not retained or presented as staging proof.

## Not verified in this workspace

- migration `027` applied to a real staging PostgreSQL database;
- real PostgreSQL advisory-lock and concurrent transaction behavior;
- isolated fixture execution and cleanup against staging;
- deployed `/api/health?full=1` response;
- staging Telegram `getMe` and webhook state;
- real Telegram pre-checkout and successful-payment ordering;
- duplicate Telegram update delivery;
- real Stars charge ownership and replay rejection;
- Pro allowance concurrency against staging data;
- all 13 operator-assisted Telegram scenarios;
- final artifact-bound staging `GO` report.

## Release boundary

STEP053A is **source-implemented and source-verified**. Staging status remains **BLOCKED / NOT VERIFIED** until the exact deployed artifact produces:

1. preflight verdict `PASS`;
2. database runtime verdict `PASS` with cleanup `PASS`;
3. all 13 Telegram scenarios `PASS`;
4. matching evidence hashes;
5. operator verdict `GO`;
6. generated `STEP053A_STAGING_ACCEPTANCE_REPORT.md`.
