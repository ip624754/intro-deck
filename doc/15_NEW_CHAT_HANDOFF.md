# STEP064B4B Handoff

## Executive summary

- Project: Intro Deck / LinkedIn Telegram Directory Bot
- Current source step: `STEP064B4B`
- Package: `0.64.5`
- Exact baseline: STEP064B4A FULL SHA-256 `9171532cb405ca1238e286a64b7a73bf43d97296d1873cce24f10477fae90975`
- Mode: STANDARD with HEAVY transaction-adjacent regression QA
- Risk score: 10/12
- Migration: none
- New ENV: none

## Source-confirmed

- Stored interface language is loaded once per Telegram update.
- One presentation-only member localization boundary covers Profile editors, Directory, Requests, contact unlock, private chats, Pro, Invite owner surfaces, and Story Finder.
- Callback IDs, URLs, switch-inline payloads, stored states, money logic, OAuth, publisher, reward accounting, and AI/news language persistence are unchanged.
- User-provided content is never machine-translated.
- Admin surfaces retain their separate Russian/operator diagnostic boundary.
- Payment/OAuth/notification/publication language and external invite-card language remain deferred to STEP064B4C.

## QA-confirmed

- Source check: PASS.
- Focused B4B smoke: PASS.
- Full comparison: candidate `101/106 PASS` vs baseline `100/105 PASS`.
- Baseline PASS regressions: 0.
- Five inherited NON_PASS remain unchanged and documented.

## Production baseline evidence

Before B4B implementation, production health independently reported STEP064B4A, docsStep STEP064B4A, and Node 20.20.2. The operator reported migration 037 applied and B4A working. Direct SQL constraint evidence was not collected in B4B.

## Not verified

- B4B deployment;
- B4B production health;
- live EN/RU member walkthrough;
- Node 20 dependency-backed full suite;
- B4C transaction/notification/OAuth/publication language boundary.

## Rollout

Follow `doc/102_STEP064B4B_OPERATOR_ROLLOUT.md`.

## Rollback

Deploy exact STEP064B4A FULL. Keep migration 037 and stored language preferences in place.

## Next corridor

After production acceptance, plan only:

`STEP064B4C — Transaction, Notification & OAuth Language Boundary`

Do not start B4C automatically and do not combine it with publisher or payment redesign.

## Inherited canonical compatibility anchors

- STEP050J migration-required schema compatibility remains active for contact unlock; `migrations/019_contact_unlock_requests.sql` is still the canonical prerequisite for that legacy rail.
- STEP061 AI/news preset and scheduled Telegram-draft-only productization remains active and unchanged by B4B.
