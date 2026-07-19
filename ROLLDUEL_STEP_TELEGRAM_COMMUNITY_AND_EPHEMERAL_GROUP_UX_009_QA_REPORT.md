# QA Report — STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009

Date: 2026-07-20  
Mode: STANDARD with HEAVY privacy/state verification  
Risk score: 10/12

## Base truth

- Baseline: `RollDuel_BASELINE_2026-07.18_STEP_SHARED_DUEL_BRANDED_PREVIEW_008_FULL.zip`
- SHA-256: `f574265b034673a02669f7a5709aef76bbfd2c2a9fc3cf0ab8f4a7e5b3db88c4`
- ZIP integrity: PASS before implementation.

## Implemented contract

- Existing `@rollduelchat` topic structure is reused; no duplicate group or topics.
- Raw Bot API 10.2 adapter sends ephemeral group messages with `receiver_user_id` and forum `message_thread_id`.
- Chat-scoped `/play`, `/balance`, `/tournament`, `/help` commands use `is_ephemeral=true`.
- Feature flag defaults OFF.
- Empty/missing allowlist fails closed.
- Ephemeral failure falls back only to private DM.
- No fallback sends account or balance data publicly.
- Group surfaces are read-only/navigation only; private canonical action flows are reused.
- PTB remains pinned at 20.7; no broad dependency migration.

## New STEP tests

```text
8/8 PASS
```

Coverage:

- fail-closed allowlist and username/numeric matching;
- raw payload receiver, topic and callback context;
- no public-group fallback;
- private DM fallback;
- `is_ephemeral=true` command synchronization;
- private/topic-scoped balance response;
- existing topic navigation;
- private deep-link targets.

## Targeted regression

```text
69/69 PASS
```

Test files:

- `test_telegram_community_ephemeral_group_ux_009.py`
- `test_community_surfaces_001.py`
- `test_community_duel_topic_feed_001.py`
- `test_community_verification_entry_routing_001.py`
- `test_locale_key_coverage_against_source.py`
- `test_referral_english_locale_purity_001.py`
- `test_tournament_bo3_bracket_parity_006.py`
- `test_tournament_ux_092b.py`

## Exhaustive repository regression

All 136 repository test files were executed in 12 non-overlapping partitions:

```text
74 + 200 + 159 + 69 + 65 + 73
+ 88 + 76 + 78 + 91 + 116 + 85
= 1174/1174 PASS
```

## Static and locale QA

```text
Python compileall: PASS
EN locale keys: 1315
RU locale keys: 1315
Missing keys: 0
Placeholder mismatches: 0
Unexpected Cyrillic in EN: 0
Intentional language-switch label: 1
```

## Artifact QA

```text
PATCH ZIP integrity: PASS
FULL ZIP integrity: PASS
Patch overlay reconstruction: PASS
Full ZIP tree comparison: PASS
No files deleted: VERIFIED
Migration: none
```

Final SHA-256 values are recorded in the external artifact manifest.

## Known warnings

Existing Python 3.12 SQLite datetime-adapter deprecation warnings remain. They predate this STEP and do not represent a STEP-009 regression.

CogniForge executable preflight was not independently rerun because the CogniForge distribution was not mounted in this runtime. Governance requirements were applied manually; no claim of a tool-generated CogniForge PASS is made.

## Not verified in source QA

- Telegram Community linking in the operator client;
- production bot administrator rights;
- Bot API 10.2 acceptance for the production token;
- actual ephemeral delivery on Telegram Desktop/iOS/Android;
- offline delivery behavior;
- production DM fallback;
- live RU/EN command-menu rendering.

These remain live-acceptance gates in the operator runbook.
