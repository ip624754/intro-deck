# STEP058B1 — LinkedIn Verification Compatibility and Fail-Safe Hotfix

## Status

SOURCE IMPLEMENTED / SOURCE VERIFIED

## Purpose

Fix the live `/verificationReport` HTTP 400 path without weakening trust semantics, and ensure the optional Verified on LinkedIn integration cannot crash health, webhook, base OIDC, or the Telegram product when its environment configuration is invalid.

## Canonical scope contract

- Development/Lite: `r_profile_basicinfo r_verify`
- `r_verify_details` is not used by this Development/Lite implementation.
- Base OIDC remains separate: `openid profile email`.

## Compatibility request strategy

1. Call `/verificationReport` with repeated criteria:
   - `verificationCriteria=IDENTITY`
   - `verificationCriteria=WORKPLACE`
2. Only when that request returns HTTP 400, retry once without `verificationCriteria`.
3. Do not retry other HTTP statuses through this compatibility path.
4. Keep the total trust decision fail-closed: no successful report means no accepted snapshot and no badge.

## Safe diagnostics

Retain only:

- endpoint name;
- HTTP status and provider code;
- request attempt name;
- LinkedIn request ID when returned;
- whether the compatibility fallback was attempted.

Do not retain or expose:

- access token;
- refresh token;
- raw provider payload;
- verification URL in audit records.

## Optional configuration fail-safe

Invalid `LINKEDIN_VERIFIED_*` values produce a disabled verification configuration with a safe diagnostic. They must not fail the core runtime.

Required effects:

- `/api/health` remains HTTP 200;
- `linkedInVerificationConfigured=false`;
- verification action is unavailable;
- base LinkedIn OIDC remains available;
- public badges remain disabled.

## PostgreSQL client sequencing

The invite activation read path used during LinkedIn persistence must execute sequentially on one checked-out `pg` client. Concurrent `client.query()` calls on the same client are prohibited.

## Non-goals

- no public badge enablement;
- no Lite upgrade;
- no schema migration;
- no payment/contact/DM changes;
- no claim that the live LinkedIn report now succeeds before operator evidence.
