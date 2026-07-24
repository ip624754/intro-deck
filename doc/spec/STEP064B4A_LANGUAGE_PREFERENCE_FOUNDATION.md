# STEP064B4A — Language Preference Foundation & Persistent Boundary

## Status

`SOURCE IMPLEMENTED / FOCUSED QA PASSED / MIGRATION NOT APPLIED / PRODUCTION NOT VERIFIED`

## Baseline

- Project: Intro Deck / LinkedIn Telegram Directory Bot
- Exact source baseline: `IntroDeck_STEP064B3_FULL_2026-07-24.zip`
- Baseline SHA-256: `92ab03586a7f216a79c7ae2bb80abd0cf194bdbb1b60ad520c9bee1cc28a1b60`
- Candidate source step: `STEP064B4A`
- Candidate package: `0.64.4`
- CogniForge mode: `HEAVY`
- Risk score: `12/12`

## Goal

Establish a persistent and explicit boundary between:

- the language used by member-facing Telegram surfaces; and
- the default language intended for ordinary LinkedIn profile-share content.

The two settings are independent. Existing AI/news preset-level `post_language` remains canonical and is not replaced.

## Implemented scope

### Persistent user contract

Migration `037_interface_language_boundary.sql` adds:

```sql
users.interface_language text not null default 'en'
users.default_post_language text not null default 'en'
```

Both columns are constrained to `en | ru`.

Existing users retain the legacy English behavior. New users are seeded once from Telegram locale:

- `ru` and `ru-*` -> `ru`;
- every other or unavailable locale -> `en`.

Subsequent Telegram locale changes do not overwrite explicit member preferences.

### Runtime boundary

- Missing migration fails closed for preference writes.
- Legacy runtime reads remain available with deterministic English fallback.
- Interface and post language updates mutate only the selected column.
- Language schema readiness requires both columns and both check constraints.

### Member surface

New command and callbacks:

```text
/language
lang:root
lang:interface:en
lang:interface:ru
lang:post:en
lang:post:ru
```

Existing callback IDs are unchanged.

Initial localized vertical slice:

- Home;
- Profile root;
- Profile preview;
- Help;
- Language settings.

### Health contract

`/api/health` exposes:

- `interfaceLanguagePolicy`;
- `postLanguagePolicy`.

The markers disclose supported values, defaults, migration requirement, first-seen-only locale inference, independent preferences, and preservation of the AI/news preset override.

## Explicitly out of scope

Deferred to STEP064B4B:

- Directory, Requests, DM, Contact unlock, Invite, Pro, Story finder UI, profile editor details, and remaining member copy.

Deferred to STEP064B4C:

- payment and consent copy localization;
- notification recipient-language rendering;
- retry-language snapshots;
- LinkedIn OAuth HTML and Telegram receipts;
- ordinary profile-share post rendering from `default_post_language`;
- signed OAuth language snapshots.

Unchanged in STEP064B4A:

- LinkedIn publisher and OAuth state machines;
- payment amounts, invoices, refunds, and entitlements;
- AI/news source selection, generation, scheduling, and preset language semantics;
- invite rewards and activation accounting;
- admin mutations and immutable diagnostic codes.

## Invariants

1. `interface_language` never implicitly mutates `default_post_language`.
2. `default_post_language` never implicitly mutates `interface_language`.
3. Existing AI/news preset and draft `post_language` values are not rewritten.
4. Existing users receive English defaults after migration.
5. New locale seeding occurs only on first insert.
6. Missing migration blocks writes but preserves a bounded English read fallback.
7. Existing callback IDs and business state machines remain unchanged.
