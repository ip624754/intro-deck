# STEP064B1 — Member Copy System & Primary Navigation

## Goal

Make the member-facing Telegram product read as one coherent Intro Deck interface without changing callbacks, storage, payments, referral accounting, LinkedIn publishing, or AI/news ranking.

## Mode and risk

- CogniForge mode: STANDARD
- Risk score: 10/12
- Canonical baseline: `IntroDeck_STEP064A_FULL_2026-07-24.zip`
- Baseline SHA-256: `4ce8b99159022dd8209ced89c3719cd894dbec478687b09b09ee08b7c81d7d0b`

## Copy contract

### Canonical member surfaces

- `💼 Intro Deck`
- `🧩 Profile`
- `👁 Profile preview`
- `🌐 Directory`
- `👤 Professional profile`
- `📥 Requests & chats`
- `🗞 Story finder`
- `✉️ Invite people`
- `⭐ Intro Deck Pro`
- `❓ Help`

### Button contract

- Sentence case.
- Verb plus object when the action changes state.
- Contextual back labels: `← Back to directory`, `← Back to requests`, `← Back to story finder`.
- `🏠 Home` is the final navigation row.
- Critical actions continue to name their consequence; STEP064B1 does not rewrite payment, approval, or publication mechanics.

### Member/operator boundary

Member surfaces explain:

1. what happened;
2. whether anything changed;
3. what the user can do next.

Member surfaces do not expose migration numbers, SQL/constraint errors, raw internal state keys, rollout stages, provider telemetry, or raw relevance scores.

Operator diagnostics and logs keep technical codes and evidence.

## Implemented scope

- Added a canonical member-copy module and safe reason mapping.
- Simplified Home into identity/status/next-action content.
- Unified Profile, Directory, Requests, Invite, Story finder, Pro, and Help naming.
- Removed raw profile state and directory implementation language from primary member surfaces.
- Replaced Story finder raw provider/ranking output with quality and match labels.
- Added user-safe error handling for persistence, migration, LinkedIn share, and OAuth authorization failures.
- Preserved payment, approval, invite attribution, generator, source-selection, and publishing invariants.

## Out of scope

- Admin-language cleanup.
- RU/EN interface switching.
- Payment and approval CTA redesign.
- Schema migrations.
- Callback ID changes.
- Ranking/provider changes.
- LinkedIn OAuth or publishing behavior changes.
