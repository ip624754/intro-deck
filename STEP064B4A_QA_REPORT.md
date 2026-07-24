# STEP064B4A QA Report

## Status

`SOURCE IMPLEMENTED / QA PASSED WITH INHERITED NON_PASS / PRODUCTION NOT VERIFIED`

## Baseline

- STEP064B3 FULL SHA-256: `92ab03586a7f216a79c7ae2bb80abd0cf194bdbb1b60ad520c9bee1cc28a1b60`
- Candidate package: `0.64.4`
- Source step: `STEP064B4A`
- Local runtime: Node `22.16.0`
- Canonical candidate runtime Node 20: not executed locally

## Verified locally

- `npm run check`: PASS.
- `npm run smoke:language-boundary`: PASS.
- Focused compatibility smokes passed for commands, Home/Profile/Help member copy, transaction copy, admin language, LinkedIn share, AI/news, invite conversion, router, positioning, and STEP057 readiness.
- Full baseline inventory: `99 PASS / 5 NON_PASS / 104 total`.
- Full candidate inventory: `100 PASS / 5 NON_PASS / 105 total`.
- Baseline PASS -> candidate NON_PASS: `0`.
- New STEP064B4A smoke: PASS.
- Candidate `createBot.js` remains the same trimmed line count as baseline (`190`); B4A does not worsen the inherited code-split failure.
- Static changed-file secret scan found no new real credential material. Existing smoke fixtures contain test-only placeholder tokens.

## Focused contract evidence

Verified by executable smoke:

- `ru`, `ru-RU`, and non-Russian Telegram locale normalization;
- deterministic `en` fallback;
- independent `interface_language` and `default_post_language` resolution;
- Russian and English Home rendering;
- Russian Help, Profile root, Profile preview, and Language settings rendering;
- preservation of existing navigation callback IDs;
- presence of new bounded language callbacks;
- first-insert locale seed without ON CONFLICT reseeding;
- post-language update does not mutate interface language;
- migration 037 contains both columns and both constraints;
- migration 037 does not alter AI/news or LinkedIn publisher tables;
- health policy markers are present;
- existing AI/news `post_language` repository and callbacks remain present.

## Inherited NON_PASS — represented honestly

The same five commands fail in baseline and candidate:

1. `smoke:code-split` — legacy static threshold requires `createBot.js <= 120` lines; baseline and candidate are both 190 trimmed lines.
2. `smoke:profile-session-schema` — inherited STEP025 static contract expects field key `tg` in the old migration text.
3. `smoke:broadcast-idempotency` — inherited static contract expects an obsolete exact source fragment.
4. `smoke:step053a-pack` — dependency-backed command cannot import `pg` because dependencies were not installed in this environment.
5. `smoke:step061-profile-preview-hotfix` — inherited exact-source assertion fails in both baseline and candidate.

None is represented as PASS. No baseline PASS regression was introduced.

## Dependency installation attempt

`npm ci --ignore-scripts` did not complete within the bounded 120-second execution window. The attempt emitted a Node engine warning because the local runtime is Node 22 while the project requires Node 20. No completed dependency install is claimed.

## Not verified

- migration 037 against production Neon;
- PostgreSQL constraint/runtime behavior against a live database;
- dependency-backed full suite on Node 20;
- Vercel deployment and STEP064B4A health response;
- Telegram RU/EN persistence across production restarts;
- new-user first-seen locale seed in production;
- STEP064B4B and STEP064B4C surfaces;
- production rollback.
