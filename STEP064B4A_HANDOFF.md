# STEP064B4A Handoff

## Executive summary

- Project: Intro Deck / LinkedIn Telegram Directory Bot
- Current source step: `STEP064B4A`
- Package: `0.64.4`
- Exact baseline: STEP064B3 FULL `92ab03586a7f216a79c7ae2bb80abd0cf194bdbb1b60ad520c9bee1cc28a1b60`
- Mode: HEAVY
- Risk score: 12/12
- Focus: persistent, independent interface and default post language preferences
- Migration: `037_interface_language_boundary.sql` required
- New ENV: none

## Source-confirmed

- `users.interface_language` and `users.default_post_language` are additive EN/RU preferences.
- Existing users keep English defaults.
- New users are seeded once from Telegram locale; existing preferences are never reseeded on conflict.
- Missing migration blocks preference mutation and preserves an English read fallback.
- `/language` and bounded `lang:*` callbacks manage both preferences independently.
- Home, Profile root, Profile preview, Help, and Language settings have an EN/RU rendering contract.
- Existing AI/news per-preset and per-draft `post_language` remains canonical and unchanged.
- Existing callback IDs, publisher, OAuth state machines, payments, rewards, and admin mutations are unchanged.

## QA-confirmed

- `npm run check`: PASS.
- STEP064B4A focused smoke: PASS.
- Full comparison: candidate 100/105 PASS vs baseline 99/104 PASS.
- Baseline PASS regressions: 0.
- Five inherited NON_PASS remain and are listed in `STEP064B4A_QA_REPORT.md`.

## Not verified

- migration 037 in production Neon;
- candidate on canonical Node 20 with installed dependencies;
- Vercel deployment;
- production Telegram RU/EN persistence and first-seen seeding;
- B4B/B4C localization surfaces.

## Rollout

Follow `doc/101_STEP064B4A_OPERATOR_ROLLOUT.md`.

Required order:

1. apply migration 037;
2. verify columns and constraints;
3. deploy exact candidate;
4. verify health markers;
5. run the four-combination preference matrix and first-seen seed acceptance.

## Rollback

Deploy the exact STEP064B3 artifact. Leave additive migration 037 in place; STEP064B3 ignores the new columns. Do not drop the columns during incident rollback.

## Next corridor

After production acceptance:

- `STEP064B4B — Member RU/EN Rendering`;
- then `STEP064B4C — Transaction, Notification & OAuth Language Boundary`.

Do not combine B4B and B4C into one broad rewrite.
