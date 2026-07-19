# STEP058A Work History

**Date:** 2026-07-19  
**Mode:** HEAVY  
**Risk Score:** 12/12

## Implemented

- Added Development/Lite verification configuration and scope validation.
- Added a short-lived signed verification launch ticket and bound verification intent/mode into signed OAuth state.
- Restricted Development verification requests to configured Intro Deck operators while leaving standard OIDC available to normal members.
- Added `/identityMe` and `/verificationReport` REST client with timeout and provider-error classification.
- Added app-scoped member ID cross-check and category-only normalization.
- Added migration 028 and schema compatibility support.
- Removed historical raw OAuth token values from persisted JSON in migration 028.
- Changed new OIDC persistence to retain only non-secret token metadata.
- Added category snapshot repository, profile projection, and audit events.
- Added private profile trust-status surface and manual refresh action.
- Kept public directory badges disabled.
- Updated Privacy and Terms boundaries.
- Added the LinkedIn trust/distribution roadmap and STEP058A smoke contract.

## Explicitly unchanged

- existing public directory card;
- profile ranking and filtering;
- payment, contact, DM, invite, and entitlement state machines;
- existing OIDC identity ownership and transfer rules;
- schema before migration 028 remains readable through schema compatibility;
- no background refresh token storage or scheduler.

## QA summary

- Node `22.16.0`; repository requires Node `20.x`.
- `npm ci --ignore-scripts`: PASS with engine warning.
- `npm run check`: PASS.
- `npm run smoke:linkedin-verified-dev`: PASS.
- Full smoke: `73/86` PASS versus STEP057 `72/85`; same 13 inherited failures; new failures `0`.
- `npm audit`: BLOCKED by registry HTTP 502/timeout; no vulnerability claim made.
- Node 20 and live LinkedIn Development API calls remain not verified.
