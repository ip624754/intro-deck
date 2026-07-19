# STEP057 — Production Readiness and Core Loop Acceptance

## Objective

Provide a production-safe, read-only readiness gate for the deployed Intro Deck artifact and its core Telegram loop without creating fixtures or mutating production state.

## Scope

- exact production target and artifact binding;
- Node 20 runner truth;
- deployed `/api/health?full=1` contract;
- Telegram `getMe` and `getWebhookInfo` diagnostics;
- PostgreSQL read-only schema and invariant checks;
- directory supply and notification-delivery indicators;
- operator-assisted core-loop evidence;
- deterministic `GO`, `GO_WITH_RISKS`, or `NO_GO` verdict.

## Safety invariants

1. The automated runner opens PostgreSQL with `BEGIN READ ONLY`.
2. The runner executes no fixture, payment, callback, profile, or contact mutations.
3. Production target, HTTPS URL, and exact artifact SHA are mandatory.
4. Secrets and connection strings are never written to evidence.
5. Missing required manual scenarios produce `NO_GO`.
6. Missing optional live Stars/replay evidence produces `GO_WITH_RISKS`, not a false `GO`.
7. Any failed or blocked scenario produces `NO_GO`.

## Required manual core loop

- Home;
- guided activation;
- preview/publish/hide;
- directory profile;
- intro-only request;
- paid contact options;
- Contact inbox;
- operator diagnostics.

## Optional high-risk evidence

- Stars invoice/pre-checkout;
- successful Stars payment;
- duplicate callback/payment replay.

## Non-goals

- no staging environment provisioning;
- no production fixtures;
- no migration;
- no payment-core changes;
- no synthetic runtime PASS.
