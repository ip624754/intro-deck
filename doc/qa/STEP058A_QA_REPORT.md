# STEP058A QA Report

**STEP:** STEP058A — Verified on LinkedIn Development Integration  
**Mode:** HEAVY  
**Risk Score:** 12/12  
**Date:** 2026-07-19  
**Baseline:** STEP057 FULL ZIP  
**Baseline ZIP SHA-256:** `ec61851692f1ef621fbf343a3154ae766e6a6b2e741f461b0a564cb45bce8e16`

## Scope verified

- Verification OAuth intent is separated from the normal LinkedIn OIDC connection.
- A short-lived signed launch ticket binds Telegram user and verification-refresh purpose.
- Development access is limited by Intro Deck operator configuration and remains subject to LinkedIn's developer-app-admin gate.
- `/identityMe` and `/verificationReport` use separate current API-version headers.
- `/verificationReport` uses repeated `verificationCriteria` parameters, not a comma-separated value.
- App-scoped member IDs must match before a snapshot is accepted.
- Only category-level trust state, app-scoped member ID, tier, versions, and timestamps are persisted.
- Verification URL and OAuth token values are not persisted.
- Missing migration or provider failure does not break the base LinkedIn connection.
- Failed refresh does not overwrite a previously successful verification snapshot.
- Verification status is private during STEP058A; public directory badges remain disabled.
- Privacy and Terms preserve the boundary between LinkedIn categories and member-provided professional claims.

## Environment

```text
Node.js: 20.20.2 (canonical verification via isolated Node 20 runner)
npm: 10.9.2
Repository engine requirement: Node 20.x
```

Node 20.20.2 execution is **verified** for dependency installation, syntax checks, and the dedicated STEP058A contract. The host shell remains Node 22.16.0, but canonical commands were rerun through an isolated Node 20 runner.

## Automated checks

| Check | Result |
|---|---|
| Baseline ZIP SHA-256 | PASS |
| Node 20 `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund` | PASS |
| `npm run check` | PASS |
| `npm run smoke:linkedin-verified-dev` | PASS |
| `npm run smoke:step057-readiness` | PASS |
| LinkedIn auth contract | PASS |
| OAuth route import contract | PASS |
| LinkedIn callback diagnostics | PASS |
| LinkedIn relink/transfer compatibility | PASS |
| LinkedIn identity-store compatibility | PASS |
| Storage contract | PASS |
| Schema-compatibility contract | PASS |
| Public legal surfaces | PASS |
| STEP054 positioning truth | PASS |
| `git diff --check` | PASS |
| Full smoke inventory | 73/86 PASS, 13 inherited FAIL |
| New failing contracts | 0 |
| `npm audit --audit-level=high` | BLOCKED — registry audit endpoint returned HTTP 502 / timed out |

## Full smoke comparison

| Snapshot | PASS | FAIL | Total |
|---|---:|---:|---:|
| STEP057 baseline | 72 | 13 | 85 |
| STEP058A | 73 | 13 | 86 |

New passing contract:

```text
smoke:linkedin-verified-dev
```

Inherited failures remain unchanged:

```text
smoke:env
smoke:code-split
smoke:profile-session-schema
smoke:admin-allowlist
smoke:admin-users
smoke:admin-user-card
smoke:admin-intros
smoke:broadcast-idempotency
smoke:admin-polish
smoke:admin-productivity
smoke:admin-search
smoke:admin-russian-layer
smoke:admin-runbook-freeze
```

## Adversarial checks

- Missing, invalid, expired, or cross-user verification launch tickets are rejected.
- Normal OIDC does not request verification scopes.
- Development verification is not exposed to ordinary Telegram users.
- API responses with mismatched app-scoped member IDs are rejected.
- Provider errors do not create inferred verification categories.
- A failed optional verification persistence path rolls back to a savepoint instead of aborting the base identity transaction.
- Verification completion URL is accepted only when it is HTTPS on `linkedin.com` or a LinkedIn subdomain.
- The URL is displayed transiently and is excluded from transfer tokens, audit payloads, and database schema.
- Raw access, refresh, and ID token values are stripped from new persistence and scrubbed from historical token JSON by migration 028.
- Public directory rendering remains free of STEP058A verification badge copy.

## Verified

- Source implementation exists and passes the dedicated contract.
- Full smoke failure set did not expand.
- No payment, contact, DM, entitlement, invite, or public-ranking state machine changed.
- No public verification badge is enabled.
- Migration 028 is present and required before snapshot persistence.

## Not verified

- Migration 028 against the live Neon database.
- Actual LinkedIn Development OAuth consent with the app-admin account.
- Live `/identityMe` response.
- Live `/verificationReport` response.
- Private Telegram verification panel after production deploy.
- LinkedIn-provided verification completion URL flow.
- Lite-tier approval.
- Public STEP058B badges.

## Verdict

```text
SOURCE IMPLEMENTED / SOURCE VERIFIED
LIVE STATUS NOT CONFIRMED
MIGRATION 028 REQUIRED
PUBLIC BADGES DISABLED
```
