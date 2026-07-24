# STEP064B4B QA Report

## Status

`SOURCE IMPLEMENTED / QA PASSED WITH INHERITED NON_PASS / PRODUCTION NOT VERIFIED`

## Baseline

- STEP064B4A FULL SHA-256: `9171532cb405ca1238e286a64b7a73bf43d97296d1873cce24f10477fae90975`
- Candidate package: `0.64.5`
- Source step: `STEP064B4B`
- Local runtime: Node `22.16.0`
- Production baseline runtime observed before implementation: Node `20.20.2`
- Migration: none
- New ENV: none

## Verified locally

- `npm run check`: PASS.
- `npm run smoke:member-language-rendering`: PASS.
- Existing language foundation, member copy, transaction copy, admin language, directory, filters, intro, contact unlock, DM, invite, invite conversion, and AI/news focused smokes: PASS.
- Full STEP064B4A baseline inventory: `100 PASS / 5 NON_PASS / 105 total`.
- Full STEP064B4B candidate inventory: `101 PASS / 5 NON_PASS / 106 total`.
- Baseline PASS -> candidate NON_PASS: `0`.
- New STEP064B4B smoke: PASS.
- Candidate and baseline `createBot.js` have the same trimmed line count (`190`); B4B does not worsen the inherited code-split result.

## Focused contract evidence

Executable QA verifies:

- English presentation remains unchanged through the localization boundary;
- RU rendering for Pro, Profile editor, Directory, Requests/DM, Invite, and Story Finder representative fixtures;
- raw member profile content remains unchanged;
- callback IDs, URLs, and switch-inline payloads remain identical before and after localization;
- user-safe raw state labels are translated for RU presentation without mutating persisted states;
- admin surfaces do not import the member localization layer;
- payment disclosure remains explicitly deferred to STEP064B4C;
- external public invite-card content remains canonical English and is declared as deferred.

## Inherited NON_PASS

The same five commands remain NON_PASS in baseline and candidate:

1. `smoke:code-split` — legacy threshold requires `createBot.js <= 120`; both baseline and candidate report 190 trimmed lines.
2. `smoke:profile-session-schema` — inherited STEP025 static migration assertion for field key `tg`.
3. `smoke:broadcast-idempotency` — inherited obsolete exact-source fragment assertion.
4. `smoke:step053a-pack` — dependency-backed command cannot import `pg` because dependencies are not installed in this environment.
5. `smoke:step061-profile-preview-hotfix` — inherited exact-source assertion fails in baseline and candidate.

None is represented as PASS.

## Not verified

- STEP064B4B Vercel deployment;
- production health markers for STEP064B4B;
- Telegram operator EN/RU walkthrough in production;
- live callback/retry behavior after deployment;
- dependency-backed suite on canonical Node 20;
- STEP064B4C transaction, notification, OAuth, and publication-language rendering.
