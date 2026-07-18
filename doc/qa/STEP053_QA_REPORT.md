# STEP053 QA Report — Contact Contract and Payment Honesty Lock

## Scope

Source-level verification for STEP053 on the accepted Intro Deck baseline.

- Input baseline commit: `83daf57f95a2e3238d353266928d5978b50e88ef`
- Input ZIP SHA-256: `d79797a0e766e8803d115f22fd510502c302d7031b5ad848ea599a587bb9a14b`
- Package version: `0.50.0`
- Governance mode: HEAVY
- Test date: 2026-07-18

## Environment

- Node.js: `22.16.0`
- npm: `10.9.2`
- Repository engine requirement: Node.js `20.x`
- PostgreSQL service: unavailable in this workspace
- Telegram live runtime: unavailable in this workspace

Node 22 results are source evidence, not canonical Node 20 or production-runtime proof.

## Verified checks

| Check | Result |
|---|---|
| ZIP baseline integrity | PASS |
| Dependency install (`npm ci --ignore-scripts`) | PASS with Node engine warning |
| Syntax/import contract (`npm run check`) | PASS |
| STEP053 dedicated smoke | PASS |
| Direct-contact render/contract smoke | PASS |
| Direct-contact payment payload smoke | PASS |
| DM relay smoke | PASS |
| DM payment smoke | PASS |
| Schema compatibility smoke | PASS |
| Storage compatibility smoke | PASS |
| Legal surfaces smoke | PASS |
| Product surfaces smoke | PASS |
| Landing smoke | PASS |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |

## Full smoke inventory

### Baseline control

- Total: 79
- PASS: 64
- FAIL: 15

### STEP053 source

- Total: 80
- PASS: 67
- FAIL: 13

### Regression comparison

- New smoke added: `smoke:contact-contract` — PASS.
- Existing failures newly introduced by STEP053: **none**.
- Existing contracts changed from FAIL to PASS:
  - `smoke:schema-compat`
  - `smoke:storage`
- Remaining 13 failures match the baseline failure set and are outside STEP053 scope.

## Remaining baseline failures

| Smoke | Existing failure |
|---|---|
| `smoke:admin-allowlist` | stale operator denial-copy expectation |
| `smoke:admin-intros` | stale Admin Intros title expectation |
| `smoke:admin-polish` | stale Russian admin copy expectation |
| `smoke:admin-productivity` | stale admin quick-action expectation |
| `smoke:admin-runbook-freeze` | stale runbook surface expectation |
| `smoke:admin-russian-layer` | stale Russian admin fragment expectation |
| `smoke:admin-search` | stale admin search shortcut expectation |
| `smoke:admin-user-card` | stale User Card title expectation |
| `smoke:admin-users` | stale Users title expectation |
| `smoke:broadcast-idempotency` | source/contract drift in broadcast batching expectation |
| `smoke:code-split` | `createBot.js` line-count contract exceeded before STEP053 |
| `smoke:env` | baseline `.env.example` still lacks `CRON_SECRET` |
| `smoke:profile-session-schema` | STEP025 migration contract still lacks `tg` field key |

These failures are recorded as inherited QA debt. They are not reclassified as PASS.

## STEP053 invariants covered at source level

- Intro-only profiles do not expose paid direct-contact or DM buttons.
- New paid requests require `paid_unlock_requires_approval` at render, creation, invoice, pre-checkout, and confirmation boundaries.
- DM invoice creation rechecks current pair block/cooldown state.
- Stars currency and amount are validated against the request snapshot before checkout authorization and request confirmation.
- Invoice descriptions stay within Telegram's 255-character limit.
- Paid request copy states that the purchase is request delivery, not guaranteed approval/contact/reply.
- Decline/no reply does not falsely claim an automatic refund path.
- Pro uses one combined rolling 24-hour allowance with paid fallback.
- Pro allowance and contact-pair locks use deterministic lock order.
- A stale Pro DM draft rechecks pair block/cooldown before delivery.
- Payment charges are serialized and checked against canonical receipts for replay.
- Recipient decisions are serialized per pair and remain idempotent at source level.
- Migration `027` performs prerequisite and duplicate-charge preflight checks.
- Critical transitions write policy/amount/currency evidence to audit/receipt snapshots.

## Not verified

- Migration `027` execution against a real PostgreSQL staging database.
- Existing production data duplicate-charge preflight result.
- PostgreSQL advisory-lock behavior under real concurrent transactions.
- Node.js 20 execution.
- Telegram `pre_checkout_query` timing and duplicate delivery behavior.
- Telegram Stars successful-payment runtime ordering.
- Live Pro quota concurrency.
- Live recipient notification delivery/retry behavior.
- Telegram/provider refund or dispute operations.
- Legal review of Terms language.

## Release boundary

STEP053 is **source-implemented and source-verified**, but is **not production-ready or live-confirmed** until:

1. migration `027` passes staging preflight and applies successfully;
2. Node 20 checks pass;
3. direct-contact, DM, Pro, stale callback, duplicate callback, charge replay, cooldown, block, and concurrency cases pass against PostgreSQL and Telegram;
4. runtime evidence is captured in a staging acceptance pack.
