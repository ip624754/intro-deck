# STEP065A1 Handoff

## Canonical source candidate

- Step: `STEP065A1`
- Package: `0.66.0`
- Baseline: exact STEP064B4D2A FULL
- Baseline SHA-256: `b7c6a023facdcb99ba6d6665be573b5b8642cabd2549ed1b27e72ede60c808ed`
- Migration: `038_linkedin_profile_share_attribution_foundation.sql`
- New ENV: none

## Core implementation

- attributed post deep links: `ls_<opaque-128-bit-token>`;
- published-profile exact resolution;
- target-bound 30-day attribution sessions;
- immutable append-only event ledger;
- total and unique profile-open evidence;
- intro/contact/DM start, submission, and approval events;
- best-effort evidence isolation from product actions;
- legacy link compatibility.

## QA

- focused source QA: PASS;
- full inventory: 106/113 PASS;
- baseline PASS regressions: 0;
- seven inherited/environmental NON_PASS remain.

## Deployment order

1. Apply and verify migration 038.
2. Deploy STEP065A1.
3. Verify health.
4. Publish a new post and test from a second account.
5. Verify SQL evidence.

## Rollback warning

Exact STEP064B4D2A rollback is safe only before a public `ls_` link exists. After first publication, preserve `ls_` resolution in any rollback/hotfix.

## Next step after production acceptance

`STEP065A2 — Share Conversion Dashboard`, not started.
