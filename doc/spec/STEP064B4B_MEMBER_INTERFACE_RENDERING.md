# STEP064B4B — Member Interface Language Rendering

## Goal

Complete the stored-language RU/EN presentation boundary for member-facing Telegram surfaces without changing callbacks, state machines, payments, OAuth, publishing, rewards accounting, or AI/news language persistence.

## Baseline

- Exact source baseline: STEP064B4A FULL.
- Baseline SHA-256: `9171532cb405ca1238e286a64b7a73bf43d97296d1873cce24f10477fae90975`.
- Candidate package: `0.64.5`.
- Candidate source step: `STEP064B4B`.
- Migration: none.
- New ENV: none.

## Rendering boundary

Each Telegram update loads the persisted language preference once and exposes:

- `ctx.interfaceLanguage`;
- `ctx.defaultPostLanguage`;
- `ctx.languageSchemaReady`.

Member surfaces are rendered through one presentation-only localization wrapper. The wrapper may change text and button labels, but must preserve:

- `callback_data`;
- URLs;
- `switch_inline_query` payloads;
- member-provided profile text;
- member messages;
- draft/source content;
- persisted enums and state transitions.

## Localized member surfaces

The B4B boundary covers:

- Profile editors and optional profile controls;
- Directory, filters, cards, and request entry points;
- Intro/contact request inbox and detail presentation;
- Private-chat inbox, thread states, and prompts;
- Pro/fair-use presentation;
- Invite owner menu, activity, history, points, and redemption presentation;
- Story Finder settings, search progress, audience, angle, presets, and user-safe reason presentation;
- existing B4A Home, Profile root/preview, Help, and Language settings.

## Explicitly deferred to STEP064B4C

B4B does not localize or mutate:

- payment invoice copy and payment confirmation receipts;
- critical consent disclosures;
- notification/retry recipient-language snapshots;
- LinkedIn OAuth HTML pages or callback receipts;
- LinkedIn publication authorization copy;
- ordinary profile-share post language integration;
- external public invite-card copy.

The public invite card remains canonical English in B4B because it is recipient-facing content rather than the sender's private interface. Its language contract must be decided explicitly in B4C or a later public-content step.

## Invariants

1. English rendering remains byte-compatible unless the source step marker/version changes.
2. RU rendering never mutates callback IDs, URLs, or switch-inline payloads.
3. Admin surfaces retain their independent Russian/operator diagnostic boundary.
4. Existing AI/news `post_language` remains the canonical per-preference/per-preset/per-draft language.
5. `default_post_language` is not consumed by the LinkedIn publisher in B4B.
6. Unknown or unavailable interface language resolves to English.
7. User-provided content is not machine-translated.
