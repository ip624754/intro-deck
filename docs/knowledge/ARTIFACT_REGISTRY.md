# Roll Duel — Artifact Registry

Version: `ART-REG-009`
Last synced: 2026-07-20 / STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009

## ART-110R1 — STEP-110A → STEP-110D1 combined release artifacts

Status: `Produced / controlled-live release candidate`
Base: `RollDuel_BASELINE_2026-07.7.zip` (`064867c9125c85efa89c7427ebf467f9449bffe950f783445e35aa4c74dba63d`)
Primary browser artifact: `ROLLDUEL_STEP_110A_TO_110D1_COMBINED_BROWSER_HOTFIX.zip`
Full release candidate: `RollDuel_BASELINE_2026-07.8_STEP110R1_COMBINED_RELEASE_CANDIDATE.zip`
Scope: complete asset-aware foundation and D1 legacy transaction scoping, with GRAM enabled and USDT/SOL/TRX disabled.
Verification: overlay reconstruction PASS; compileall PASS; targeted `371/371 PASS`; full suite `803/803 PASS`; locale parity `1103/1103`; ZIP integrity PASS.
Truth boundary: migration 033 live PostgreSQL execution and post-deploy GRAM acceptance remain pending. Do not promote to production canonical until the controlled-live runbook passes. USDT remains HOLD.

## ART-110D1 — Transactions Asset Scoping review artifacts

Status: `Produced / review-only`
Primary browser artifact: `ROLLDUEL_STEP_110D1_TRANSACTIONS_ASSET_SCOPING_BROWSER_HOTFIX.zip`
Merged review baseline: `RollDuel_STEP110D1_IMPLEMENTED_REVIEW_BASELINE_2026-07-08.zip`
Scope: strict historical transaction asset schema, future writer freeze, canonical winnings helper, asset-scoped leaderboards/social stats, referral idempotency correction, non-monetary ELO serializer and dynamic D1 release-gate evidence.
Verification:

```text
compileall PASS
STEP-110D1 targeted 13/13 PASS
cumulative 803/803 PASS across 105 files
SQLite migration execution PASS
PostgreSQL migration static PASS
PostgreSQL disposable execution NOT VERIFIED
production deploy NOT PERFORMED
USDT LIVE HOLD
```

Truth boundary: apply only to the authoritative STEP-110 review baseline. This artifact does not replace the production canonical baseline.

## ART-CURRENT — 2026-07.3.4 source/test/build baseline candidate

Status: `Current baseline candidate`
Artifact: `RollDuel_BASELINE_2026-07.3.4.zip`
Scope: current source/test/build baseline after STEP-083 through STEP-090A, before final live-release gates.
Verification:

```text
compileall PASS
pytest 215/215 PASS
npm ci PASS
npm run build PASS
npm run lint PASS with existing warning
locale parity 1034/1034
secret scans PASS
ZIP hygiene PASS
```

Truth boundary: not final live-release until Railway env, Telegram webhook, Crypto Pay deposit/withdrawal, TON Connect, restart drill, and full tournament lifecycle smoke are complete.

## ART-091 — STEP-DOCS-CANON-091 artifacts

Status: `Produced`
Scope: docs-only canonicalization of current baseline.
Primary files:

```text
docs/00_CURRENT_STATE.md
docs/AI_CONTEXT_START_HERE.md
handoff-current.md
docs/new_chat/01_NEW_CHAT_START_HERE.md
docs/new_chat/34_STEP_DOCS_CANON_091_HANDOFF.md
docs/knowledge/STEP_DOCS_CANON_091.md
```

---

## Historical artifact registry below

Older 2026-06-29 artifacts are retained as history and do not override ART-CURRENT.

---

## ART-001 — RD_HOTFIX_PROD_CONFIDENCE_001_003.zip

Status: `Produced`
Scope: production-confidence steps 001–003.
Contains: TON Connect boundary, Jetton trust boundary, commit/reveal honesty changes.
Verification: source-level py_compile claimed in handoff; live verification not confirmed in registry.

## ART-002 — RD_FULL_PROD_CONFIDENCE_001_003.zip

Status: `Produced`
Scope: full repo snapshot after steps 001–003.

## ART-003 — RD_HOTFIX_PROD_CONFIDENCE_004.zip

Status: `Produced`
Scope: production-confidence step 004.
Contains: tests and related contract hardening.
Verification: pytest 7 passed claimed in handoff.

## ART-004 — RD_FULL_PROD_CONFIDENCE_004.zip

Status: `Produced`
Scope: full repo snapshot after step 004.

## ART-005 — RD_PROD_CONFIDENCE_004.patch

Status: `Produced`
Scope: patch artifact for step 004.

## ART-006 — STEP-KNOWLEDGE-001 docs artifacts

Status: `Produced in this STEP`
Scope: docs-only Project Knowledge System bootstrap.
Files: `docs/knowledge/*`, `docs/architecture_bible/*`, `docs/README.md`, `docs/diagrams/*`.
Verification: file creation and packaging only.

## ART-007 — RD_HOTFIX_STEP_KNOWLEDGE_002.zip

Status: `Produced in STEP-KNOWLEDGE-002`
Scope: docs-only validation/deduplication control layer.
Contains: updated `docs/knowledge/*`, Architecture Bible planning docs.
Verification: markdown/filesystem packaging only; no runtime verification required.

## ART-008 — RD_FULL_STEP_KNOWLEDGE_002.zip

Status: `Produced in STEP-KNOWLEDGE-002`
Scope: full repo snapshot after docs validation/deduplication layer.


## ART-008 — STEP-BIBLE-001 docs artifacts

Status: `Produced in this STEP`
Scope: Architecture Bible expansion, production readiness matrix, roadmap, governance/release process, disaster recovery runbook.
Verification: docs-only source check; runtime code unchanged.


## STEP-PRE-SMOKE-CLEANUP-001

Artifacts: pending generated handoff ZIP/PATCH from this STEP.
Scope: docs + low-risk pre-smoke cleanup.

## ART-STEP-DOCS-SYNC-003 — Documentation Sync Artifacts

Status: Produced.
Scope: docs synchronization after P0/hotfix/pre-smoke cleanup.
Expected files:
- `RD_HOTFIX_STEP_DOCS_SYNC_003.zip`
- `RD_FULL_STEP_DOCS_SYNC_003.zip`
- `RD_STEP_DOCS_SYNC_003.patch`

Contains:
- updated Knowledge/STEP/Artifact/Validation docs;
- updated Architecture Bible readiness/roadmap references;
- `docs/knowledge/DOCS_SYNC_003_REPORT.md`;
- carried-forward static TON Connect manifest sync to prevent full-zip regression.

Verification:
- docs consistency check only;
- runtime smoke remains not verified.

## STEP-LAUNCH-GOVERNANCE-001 Artifacts

Status: GENERATED.
Primary artifact: `RD_HOTFIX_STEP_LAUNCH_GOVERNANCE_001.zip`.
Reference artifact: `RD_FULL_STEP_LAUNCH_GOVERNANCE_001.zip`.
Patch: `RD_STEP_LAUNCH_GOVERNANCE_001.patch`.
Scope: Launch readiness docs and admin safety case-insensitive confirm hotfix.


## STEP-GRAM-BRANDING-001 artifacts

- `RD_STEP_GRAM_BRANDING_001_HOTFIX.zip` — browser hotfix for display/docs terminology.
- `RD_STEP_GRAM_BRANDING_001_FULL.zip` — full repository reference archive.
- `RD_STEP_GRAM_BRANDING_001.patch` — developer diff.
- `RD_STEP_GRAM_BRANDING_001_QA_CHECKLIST.md` — QA checklist.

---

## Recent Product / UX / Docs Artifacts — 2026-06-26

### STEP-008A1 Share URL Fix artifacts
- `RD_STEP_008A1_SHARE_URL_FIX_HOTFIX.zip`
- `RD_STEP_008A1_SHARE_URL_FIX.patch`
- Scope: private duel/rematch Telegram share URL encoding.

### STEP-008A2 Keyboard i18n Consistency artifacts
- `RD_STEP_008A2_KEYBOARD_I18N_CONSISTENCY_HOTFIX.zip`
- `RD_STEP_008A2_KEYBOARD_I18N_CONSISTENCY_FULL.zip`
- Scope: keyboard helper signature consistency.

### STEP-008A3 i18n UI Consistency artifacts
- `RD_STEP_008A3_I18N_UI_CONSISTENCY_HOTFIX.zip`
- `RD_STEP_008A3_I18N_UI_CONSISTENCY_FULL.zip`
- Scope: RU/EN locale key coverage for new game flows.

### STEP-008A4 Human i18n Polish artifacts
- `RD_STEP_008A4_HUMAN_I18N_POLISH_HOTFIX.zip`
- `RD_STEP_008A4_HUMAN_I18N_POLISH_FULL.zip`
- Scope: user-facing copy polish.

### STEP-008B Player Identity artifacts
- `RD_STEP_008B_PLAYER_IDENTITY_PROGRESSION_HOTFIX.zip`
- `RD_STEP_008B_PLAYER_IDENTITY_PROGRESSION_FULL.zip`
- Scope: profile/rating display.

### STEP-008C Live Matchmaking UX artifacts
- `RD_STEP_008C_LIVE_MATCHMAKING_UX_HOTFIX.zip`
- `RD_STEP_008C_LIVE_MATCHMAKING_UX_FULL.zip`
- Scope: Find Duel / matchmaking UX display.

### STEP-GRAM-BRANDING-001 artifacts
- `RD_STEP_GRAM_BRANDING_001_HOTFIX.zip`
- `RD_STEP_GRAM_BRANDING_001_FULL.zip`
- Scope: GRAM display branding and terminology docs.

### RD-CANON-001 artifacts
- `RD_CANON_001_BROWSER_HOTFIX.zip`
- `RD_CANON_001_FULL.zip`
- Scope: Product & Platform Canon docs.

### STEP-DOCS-HANDOFF-SYNC-004 artifacts
- `RD_STEP_DOCS_HANDOFF_SYNC_004_HOTFIX.zip`
- `RD_STEP_DOCS_HANDOFF_SYNC_004_FULL.zip`
- `RD_STEP_DOCS_HANDOFF_SYNC_004.patch`
- Scope: current docs handoff, canon merge, registry sync.
- `RD_STEP_008E_DEMO_MODE_ADMIN_TOGGLE_HOTFIX.zip` — apply-this browser artifact for Demo Mode admin toggle.


### STEP-ADMIN-OPS-UX-010 artifacts
- `RD_STEP_ADMIN_OPS_UX_010_HOTFIX.zip` — browser hotfix for operator-friendly admin wording.
- `RD_STEP_ADMIN_OPS_UX_010_FULL.zip` — full repository reference archive.
- `RD_STEP_ADMIN_OPS_UX_010.patch` — developer diff.
- Scope: `/admin/guardrails`, `/admin/failed`, and supporting handoff docs.


### STEP-ADMIN-OPS-011 artifacts
- `RD_STEP_ADMIN_OPS_011_HOTFIX.zip` — browser hotfix for Operator Experience Layer.
- `RD_STEP_ADMIN_OPS_011_FULL.zip` — full repository reference archive.
- `RD_STEP_ADMIN_OPS_011.patch` — developer diff.
- Scope: admin UI operator explanations and admin operator documentation.


## STEP-REAL-DUEL-ZERO-BET-ACTIVE-LOCK-FIX-014

- Status: artifact prepared; live smoke pending.
- Scope: zero-stake private duel guard, active-duel lock UX, private accept roll flow, datetime restore hardening.
- Changed files: handlers.py, services/private_duels.py, services/games.py, keyboards.py, locales/en.json, locales/ru.json, docs/knowledge/STEP_REAL_DUEL_ZERO_BET_ACTIVE_LOCK_FIX_014.md.

### STEP-DUEL-FLOW-015 artifacts
- `RD_STEP_DUEL_FLOW_015_HOTFIX.zip` — browser hotfix for real-duel lifecycle recovery and i18n.
- `RD_STEP_DUEL_FLOW_015_FULL.zip` — full repository reference archive.
- `RD_STEP_DUEL_FLOW_015.patch` — developer diff.
- `RD_STEP_DUEL_FLOW_015_QA_CHECKLIST.md` — live smoke checklist.


### STEP-020 — Ledger Audit
- Hotfix: `RD_STEP_LEDGER_AUDIT_020_HOTFIX.zip`
- Full: `RD_STEP_LEDGER_AUDIT_020_FULL.zip`
- Patch: `RD_STEP_LEDGER_AUDIT_020.patch`
- QA: `RD_STEP_LEDGER_AUDIT_020_QA_CHECKLIST.md`
- Changed files: `database.py`, `services/missions.py`, `storage/migrations/032_ledger_entry_type_alignment.sql`, `docs/knowledge/STEP_LEDGER_AUDIT_020.md`, registry/handoff docs.

## STEP-REMATCH-PRIVATE-FLOW-022
- `RD_STEP_REMATCH_PRIVATE_FLOW_022_HOTFIX.zip` — browser hotfix, apply this.
- `RD_STEP_REMATCH_PRIVATE_FLOW_022_FULL.zip` — full repo snapshot for backup/reference.
- `RD_STEP_REMATCH_PRIVATE_FLOW_022.patch` — developer review diff.
- `RD_STEP_REMATCH_PRIVATE_FLOW_022_QA_CHECKLIST.md` — live smoke checklist.

## STEP-DUEL-FLOW-032
- `RD_STEP_DUEL_FLOW_032_HOTFIX.zip` — browser hotfix.
- `RD_STEP_DUEL_FLOW_032_FULL.zip` — full reference archive.
- `RD_STEP_DUEL_FLOW_032.patch` — developer diff.
- `RD_STEP_DUEL_FLOW_032_QA_CHECKLIST.md` — QA checklist.

- STEP-034 — Production Acceptance & UX Completion — UX/i18n hotfix for invite/support/workspace/active-duel surfaces.

## STEP-058 — Admin Acceptance Evidence & Console Density Polish
- `RD_STEP_058_ADMIN_ACCEPTANCE_EVIDENCE_POLISH_APPLY_THIS.zip` — browser hotfix artifact, apply this.
- `RD_STEP_058_ADMIN_ACCEPTANCE_EVIDENCE_POLISH_FULL.zip` — full repository reference archive.
- `RD_STEP_058_ADMIN_ACCEPTANCE_EVIDENCE_POLISH.patch` — developer review diff.
- `RD_STEP_058_PATCH_AND_QA.zip` — patch + QA/documentation bundle.
- Scope: `/admin/runtime`, `/admin/guardrails`, `/admin/observability`, acceptance evidence docs.



## ART-STEP-061 — Admin UI Safe Polish artifacts

Status: `Produced`.
Scope: one-file admin web UI polish after Claude review + GPT acceptance.
Primary browser artifact: `RollDuel_STEP061_ADMIN_UI_SAFE_POLISH_BROWSER_HOTFIX.zip`.
Patch/report artifact: `RollDuel_STEP061_ADMIN_UI_SAFE_POLISH_PATCH_AND_REPORT.zip`.
Full reference artifact: `RollDuel_BASELINE_2026-06-29_STEP061_ADMIN_UI_SAFE_POLISH_FULL.zip`.
Docs sync artifact: `RollDuel_STEP061D_DOCS_SYNC_BROWSER_HOTFIX.zip`.
Contains:
- `routes/admin_ui.py` safe UI polish;
- STEP-061 QA report;
- docs sync references for current state, registry, handoff, readiness, and admin style guide.
Verification:
- `python -m compileall -q routes/admin_ui.py` PASS;
- `pytest -q tests/test_admin_ops_polish_053.py` => 5 passed;
- available regression subset excluding missing-dependency guardrail suites => 116 passed;
- full pytest not verified in GPT sandbox due missing `aiocryptopay` environment dependency.

## ART-CURRENT — STEP061 ADMIN UI SAFE POLISH canonical baseline

Status: `CURRENT`
Artifact: `RollDuel_BASELINE_2026-06-29_STEP061_ADMIN_UI_SAFE_POLISH_FULL.zip`
Scope: canonical repo baseline after STEP-038 LIVE-SMOKE-PASS, STEP-059C, STEP-DOCS-SYNC-004, and STEP-061 Admin Web UI Safe Polish.
Verification:
- Z.ai source-confirmed: 146/146 tests PASS.
- Locale parity: 1089/1089.
- Admin acceptance: 7/7.
- STEP-061 targeted admin UI QA: compileall PASS, admin ops polish test 5 passed, available regression subset 116 passed.
- Live duel DB rows: games #22/#23/#24 finished with rolls, settlement_id, status_reason, finished_at.
Next artifact expected: STEP-060 post-token-rotation baseline/handoff.


## ART-STEP-TGADMIN-001R — TG Admin Reference Adoption Docs

Status: `Produced`.
Scope: docs-only adoption of reusable admin/operator-layer patterns for Roll Duel TG Admin v2.
Primary browser artifact: `RollDuel_STEP_TGADMIN_001R_ADMIN_REFERENCE_DOCS_BROWSER_HOTFIX.zip`.
Patch/report artifact: `RollDuel_STEP_TGADMIN_001R_ADMIN_REFERENCE_DOCS_PATCH_AND_REPORT.zip`.
Full reference artifact: `RollDuel_BASELINE_2026-06-29_STEP_TGADMIN_001R_ADMIN_REFERENCE_DOCS_FULL.zip`.
QA report: `RollDuel_STEP_TGADMIN_001R_ADMIN_REFERENCE_DOCS_QA_REPORT.md`.
Changed files: docs-only; no code/runtime changes.

## ART-STEP-TGADMIN-002 — Telegram Admin Daily Cockpit Navigation Polish

Status: `Produced`.
Scope: Telegram Admin daily cockpit navigation/read-only polish.
Primary browser artifact: `RollDuel_STEP_TGADMIN_002_DAILY_COCKPIT_BROWSER_HOTFIX.zip`.
Patch/report artifact: `RollDuel_STEP_TGADMIN_002_DAILY_COCKPIT_PATCH_AND_REPORT.zip`.
Full reference artifact: `RollDuel_BASELINE_2026-06-29_STEP_TGADMIN_002_DAILY_COCKPIT_FULL.zip`.
QA report: `RollDuel_STEP_TGADMIN_002_DAILY_COCKPIT_QA_REPORT.md`.
Changed files include `handlers.py`, `keyboards.py`, `tests/test_tg_admin_cockpit_002.py`, and docs/handoff updates.
Verification:
- `python -m compileall -q handlers.py keyboards.py tests/test_tg_admin_cockpit_002.py` PASS;
- `pytest tests/test_tg_admin_cockpit_002.py tests/test_admin_ops_polish_053.py --tb=short` => 10 passed;
- `pytest --ignore=tests/test_guardrails_007c.py --ignore=tests/test_guardrails_breakers.py --tb=short` => 121 passed;
- full pytest not verified in GPT sandbox due missing `aiocryptopay`.

## ART-STEP-TGADMIN-004 — Telegram Admin Withdrawal Confirm Guard

Status: `Produced`.
Scope: Telegram Admin withdrawal approve/reject confirm guard.
Primary browser artifact: `RollDuel_STEP_TGADMIN_004_WITHDRAWAL_CONFIRM_GUARD_BROWSER_HOTFIX.zip`.
Patch/report artifact: `RollDuel_STEP_TGADMIN_004_WITHDRAWAL_CONFIRM_GUARD_PATCH_AND_REPORT.zip`.
Full reference artifact: `RollDuel_BASELINE_2026-06-29_STEP_TGADMIN_004_WITHDRAWAL_CONFIRM_GUARD_FULL.zip`.
QA report: `RollDuel_STEP_TGADMIN_004_WITHDRAWAL_CONFIRM_GUARD_QA_REPORT.md`.
Changed files include `handlers.py`, TG Admin tests, and docs/handoff updates.
Verification:
- `python -m compileall -q handlers.py keyboards.py tests/test_tg_admin_withdrawal_confirm_004.py tests/test_tg_admin_cockpit_002.py` PASS;
- `pytest tests/test_tg_admin_withdrawal_confirm_004.py tests/test_tg_admin_cockpit_002.py tests/test_admin_ops_polish_053.py --tb=short` => 15 passed;
- `pytest --ignore=tests/test_guardrails_007c.py --ignore=tests/test_guardrails_breakers.py --tb=short` => 126 passed;
- full pytest not verified in GPT sandbox due missing `aiocryptopay`.

## ART-STEP-ADMIN-AUDIT-VERIFY-001 — DeepSeek Admin Audit Verification
- Type: audit/docs package.
- Source baseline: `RollDuel_BASELINE_2026-06-29_STEP_TGADMIN_004_WITHDRAWAL_CONFIRM_GUARD_FULL.zip`.
- Primary report: `docs/knowledge/STEP_ADMIN_AUDIT_VERIFY_001_DEEPSEEK_CLAIMS.md`.
- Summary: `docs/admin/ADMIN_AUDIT_VERIFY_001_SUMMARY_RU.md`.
- Handoff: `docs/new_chat/23_STEP_ADMIN_AUDIT_VERIFY_001_HANDOFF.md`.
- Runtime/code changes: none.


## ART-STEP-ADMIN-READMODEL-001 — Risk Queue Real Read Model

Status: `Produced`.
Scope: replace placeholder Risk Queue counters/list with DB-backed read model.
Primary browser artifact: `RollDuel_STEP_ADMIN_READMODEL_001_RISK_QUEUE_BROWSER_HOTFIX.zip`.
Patch/report artifact: `RollDuel_STEP_ADMIN_READMODEL_001_RISK_QUEUE_PATCH_AND_REPORT.zip`.
Full reference artifact: `RollDuel_BASELINE_2026-06-29_STEP_ADMIN_READMODEL_001_RISK_QUEUE_FULL.zip`.
QA report: `RollDuel_STEP_ADMIN_READMODEL_001_RISK_QUEUE_QA_REPORT.md`.

## ART-STEP-WEBADMIN-062 — Admin UI Micro Polish

Status: `Produced`.
Scope: responsive `_html_table()` wrapper and dynamic flash level classes for Web Admin.
Primary browser artifact: `RollDuel_STEP_WEBADMIN_062_ADMIN_UI_MICRO_POLISH_BROWSER_HOTFIX.zip`.
Patch/report artifact: `RollDuel_STEP_WEBADMIN_062_ADMIN_UI_MICRO_POLISH_PATCH_AND_REPORT.zip`.
Full reference artifact: `RollDuel_BASELINE_2026-06-29_STEP_WEBADMIN_062_ADMIN_UI_MICRO_POLISH_FULL.zip`.
QA report: `RollDuel_STEP_WEBADMIN_062_ADMIN_UI_MICRO_POLISH_QA_REPORT.md`.
Changed files include `routes/admin_ui.py`, `tests/test_webadmin_micro_polish_062.py`, and docs/handoff updates.


## ART-STEP-ADMIN-SAFETY-063 — Repair Confirm Hardening

Status: `Produced`.
Scope: typed `CONFIRM` guard for `guard.admin.blocked_actions` repair action in Web Admin.
Primary browser artifact: `RollDuel_STEP_ADMIN_SAFETY_063_REPAIR_CONFIRM_HARDENING_BROWSER_HOTFIX.zip`.
Patch/report artifact: `RollDuel_STEP_ADMIN_SAFETY_063_REPAIR_CONFIRM_HARDENING_PATCH_AND_REPORT.zip`.
Full reference artifact: `RollDuel_BASELINE_2026-06-29_STEP_ADMIN_SAFETY_063_REPAIR_CONFIRM_HARDENING_FULL.zip`.
QA report: `RollDuel_STEP_ADMIN_SAFETY_063_REPAIR_CONFIRM_HARDENING_QA_REPORT.md`.
Changed files include `routes/admin_ui.py`, `tests/test_admin_acceptance_cleanup_056.py`, and docs/handoff updates.

## ART-STEP-TGADMIN-SAFETY-005
- `RollDuel_STEP_TGADMIN_SAFETY_005_CALLBACK_CACHE_AUDIT_BROWSER_HOTFIX.zip`
- `RollDuel_STEP_TGADMIN_SAFETY_005_CALLBACK_CACHE_AUDIT_PATCH_AND_REPORT.zip`
- `RollDuel_BASELINE_2026-06-29_STEP_TGADMIN_SAFETY_005_CALLBACK_CACHE_AUDIT_FULL.zip`
- `RollDuel_STEP_TGADMIN_SAFETY_005_CALLBACK_CACHE_AUDIT_QA_REPORT.md`

## ART-STEP-TGADMIN-SAFETY-006A — Admin Callback Routing Envelope Cleanup

Status: `Produced`.
Scope: TG Admin routing envelope cleanup.
Primary browser artifact: `RollDuel_STEP_TGADMIN_SAFETY_006A_CALLBACK_ROUTING_ENVELOPE_BROWSER_HOTFIX.zip`.
Patch/report artifact: `RollDuel_STEP_TGADMIN_SAFETY_006A_CALLBACK_ROUTING_ENVELOPE_PATCH_AND_REPORT.zip`.
Full reference artifact: `RollDuel_BASELINE_2026-06-29_STEP_TGADMIN_SAFETY_006A_CALLBACK_ROUTING_ENVELOPE_FULL.zip`.
QA report: `RollDuel_STEP_TGADMIN_SAFETY_006A_CALLBACK_ROUTING_ENVELOPE_QA_REPORT.md`.
Changed files include `handlers.py`, `tests/test_tgadmin_safety_006a_callback_routing_envelope.py`, and docs/handoff updates.

## ART-STEP-RUNTIME-SAFETY-064 — Runtime Publish Idempotency

Status: `Produced`
Scope: HEAVY runtime safety micro-step.
Contains:
- `RollDuel_STEP_RUNTIME_SAFETY_064_PUBLISH_IDEMPOTENCY_BROWSER_HOTFIX.zip`
- `RollDuel_STEP_RUNTIME_SAFETY_064_PUBLISH_IDEMPOTENCY_PATCH_AND_REPORT.zip`
- `RollDuel_BASELINE_2026-06-29_STEP_RUNTIME_SAFETY_064_PUBLISH_IDEMPOTENCY_FULL.zip`
- `RollDuel_STEP_RUNTIME_SAFETY_064_PUBLISH_IDEMPOTENCY_QA_REPORT.md`

Verification:
- compileall PASS
- targeted runtime/admin tests PASS
- available regression subset PASS
- full guardrail suites not verified in sandbox due known `aiocryptopay` dependency gap.


## ART-STEP-RUNTIME-SCHEDULER-065 — Timer Restore Throughput Hardening Artifacts

Status: Produced.
Scope: STEP-RUNTIME-SCHEDULER-065 runtime scheduler startup-liveness hardening.
Expected files:
- `RollDuel_STEP_RUNTIME_SCHEDULER_065_TIMER_RESTORE_BROWSER_HOTFIX.zip`
- `RollDuel_STEP_RUNTIME_SCHEDULER_065_TIMER_RESTORE_PATCH_AND_REPORT.zip`
- `RollDuel_STEP_RUNTIME_SCHEDULER_065_TIMER_RESTORE_DOCS_ONLY.zip`
- `RollDuel_BASELINE_2026-06-29_STEP_RUNTIME_SCHEDULER_065_TIMER_RESTORE_FULL.zip`
- `RollDuel_STEP_RUNTIME_SCHEDULER_065_TIMER_RESTORE_QA_REPORT.md`
- `RollDuel_STEP_RUNTIME_SCHEDULER_065_TIMER_RESTORE.patch`

Contains:
- `handlers.py` overdue timer restore scheduler patch;
- `tests/test_runtime_scheduler_065.py`;
- runtime scheduler knowledge and operations notes;
- current-state, new-chat, roadmap, handoff, STEP registry updates.

Verification:
- compileall PASS;
- targeted runtime/admin suite 35 passed;
- available regression subset excluding missing-dependency guardrail suites PASS.



## ART-STEP-TGADMIN-UX-066 — Telegram Admin UX Polish Artifacts

Status: Produced.
Scope: STEP-TGADMIN-UX-066 TG Admin mobile/readability polish.
Expected files:
- `RollDuel_STEP_TGADMIN_UX_066_POLISH_BROWSER_HOTFIX.zip`
- `RollDuel_STEP_TGADMIN_UX_066_POLISH_PATCH_AND_REPORT.zip`
- `RollDuel_STEP_TGADMIN_UX_066_POLISH_DOCS_ONLY.zip`
- `RollDuel_BASELINE_2026-06-29_STEP_TGADMIN_UX_066_POLISH_FULL.zip`
- `RollDuel_STEP_TGADMIN_UX_066_POLISH_QA_REPORT.md`
- `RollDuel_STEP_TGADMIN_UX_066_POLISH.patch`

Contains:
- `handlers.py` TG Admin Risk/Duels copy and count indicators;
- `admin/read_models.py` Risk Queue default limit change;
- targeted TG Admin UX tests;
- knowledge, operations, current-state, roadmap, handoff, STEP registry updates.

Verification:
- compileall PASS;
- targeted TG/runtime/admin suite PASS;
- available regression subset excluding missing-dependency guardrail suites PASS.


## ART-STEP-TGADMIN-RU-067 — Telegram Admin Russian Cockpit Polish Artifacts

Status: Produced.
Scope: TG Admin Russian-first cockpit polish and explicit refresh callback.
Expected files:
- `RollDuel_STEP_TGADMIN_RU_067_COCKPIT_POLISH_BROWSER_HOTFIX.zip`
- `RollDuel_STEP_TGADMIN_RU_067_COCKPIT_POLISH_PATCH_AND_REPORT.zip`
- `RollDuel_STEP_TGADMIN_RU_067_COCKPIT_POLISH_DOCS_ONLY.zip`
- `RollDuel_BASELINE_2026-06-29_STEP_TGADMIN_RU_067_COCKPIT_POLISH_FULL.zip`
- `RollDuel_STEP_TGADMIN_RU_067_COCKPIT_POLISH_QA_REPORT.md`
- `RollDuel_STEP_TGADMIN_RU_067_COCKPIT_POLISH.patch`

Verification:
- compileall PASS;
- targeted TG/runtime/admin suite 42 passed;
- available regression subset excluding missing-dependency guardrail suites 156 passed.


## ART-STEP-TGADMIN-COPY-067B — Final TG/Admin Copy Cleanup Artifacts

Status: Produced.
Scope: final copy cleanup after STEP-TGADMIN-RU-067.
Expected files:
- `RollDuel_STEP_TGADMIN_COPY_067B_FINAL_COPY_BROWSER_HOTFIX.zip`
- `RollDuel_STEP_TGADMIN_COPY_067B_FINAL_COPY_PATCH_AND_REPORT.zip`
- `RollDuel_STEP_TGADMIN_COPY_067B_FINAL_COPY_DOCS_ONLY.zip`
- `RollDuel_BASELINE_2026-06-29_STEP_TGADMIN_COPY_067B_FINAL_COPY_FULL.zip`
- `RollDuel_STEP_TGADMIN_COPY_067B_FINAL_COPY_QA_REPORT.md`
- `RollDuel_STEP_TGADMIN_COPY_067B_FINAL_COPY.patch`

Verification:
- compileall PASS;
- targeted TG/runtime/admin suite 46 passed;
- available regression subset excluding missing-dependency guardrail suites 164 passed;
- locale parity leaf keys 953/953.

## ART-STEP-SHARE-RESULT-INLINE-FIX-001 — Telegram-Native Result Share Artifacts

Status: Produced and live applied.
Scope: Telegram presentation-layer share fix on `RollDuel_BASELINE_2026-07.8.zip`.

Expected files:
- `ROLLDUEL_STEP_SHARE_RESULT_INLINE_FIX_001_BROWSER_HOTFIX.zip`
- `RollDuel_BASELINE_2026-07.8.1_STEP_SHARE_RESULT_INLINE_FIX_001_RELEASE_CANDIDATE.zip`
- `ROLLDUEL_STEP_SHARE_RESULT_INLINE_FIX_001_QA_REPORT.md`
- `ROLLDUEL_STEP_SHARE_RESULT_INLINE_FIX_001_HANDOFF.md`
- `ROLLDUEL_STEP_SHARE_RESULT_INLINE_FIX_001_DEVELOPER.patch`

Verification:
- compileall PASS;
- targeted 5/5;
- related 33/33;
- full repository regression 808/808 across 106 test files;
- no money-core or migration files changed.


## ART-STEP-WITHDRAWAL-PROVIDER-MINIMUM-AND-TERMINAL-ERROR-001 — Withdrawal Provider Floor Hotfix

Status: Produced and live applied.
Scope: money-path guard and retry classification fix on the live STEP-110R1 + share-result head.

Expected files:
- `ROLLDUEL_STEP_WITHDRAWAL_PROVIDER_MINIMUM_AND_TERMINAL_ERROR_001_BROWSER_HOTFIX.zip`
- `RollDuel_BASELINE_2026-07.8.2_STEP_WITHDRAWAL_PROVIDER_MINIMUM_AND_TERMINAL_ERROR_001_RELEASE_CANDIDATE.zip`
- `ROLLDUEL_STEP_WITHDRAWAL_PROVIDER_MINIMUM_AND_TERMINAL_ERROR_001_QA_REPORT.md`
- `ROLLDUEL_STEP_WITHDRAWAL_PROVIDER_MINIMUM_AND_TERMINAL_ERROR_001_HANDOFF.md`
- `ROLLDUEL_STEP_WITHDRAWAL_PROVIDER_MINIMUM_AND_TERMINAL_ERROR_001_DEVELOPER.patch`

Verification:
- compileall PASS;
- 6 new regression tests PASS;
- related withdrawal/limits suites PASS;
- full repository regression 814/814 across 107 test files;
- no schema migration required.


## ART-STEP-NEW-CHAT-MIGRATION-2026-07-09 — Live-Accepted Canonical Migration Pack

Status: Produced.
Canonical baseline:
- `RollDuel_BASELINE_2026-07.9_LIVE_ACCEPTED.zip`

Migration artifacts:
- `ROLLDUEL_FULL_HANDOFF_2026-07-09_LIVE_ACCEPTED.md`
- `ROLLDUEL_NEW_CHAT_BOOTSTRAP_2026-07-09.md`
- `ROLLDUEL_CURRENT_STATE_QA_TRUTH_BOUNDARY_2026-07-09.md`
- `ROLLDUEL_NEW_CHAT_README_FIRST_2026-07-09.md`
- `ROLLDUEL_KEY_SOURCE_FILES_2026-07-09.zip`
- `ROLLDUEL_NEW_CHAT_MIGRATION_BUNDLE_2026-07-09.zip`
- `ROLLDUEL_NEW_CHAT_MIGRATION_CHECKSUMS_2026-07-09.txt`

Verification:
- uploaded repository SHA-256 verified;
- content matched the 2026-07.8.2 withdrawal-fix release candidate except one documentation-only file;
- compileall PASS;
- current critical/recent targeted tests 24/24 PASS;
- full 814/814 regression inherited from byte-identical runtime/test tree of the accepted release candidate.

## ART-STEP-LAUNCH-WEEK-GRAM-OPERATIONS-001 — Controlled Launch Operations Package

Status: `Produced / operator execution pending`.
Scope: documentation-only GRAM launch operations package. No runtime or migration files changed.

Expected artifacts:
- `ROLLDUEL_STEP_LAUNCH_WEEK_GRAM_OPERATIONS_001_BROWSER_HOTFIX.zip` — apply this docs-only GitHub overlay;
- `ROLLDUEL_STEP_LAUNCH_WEEK_GRAM_OPERATIONS_001_DEVELOPER.patch` — optional terminal/developer diff;
- `ROLLDUEL_STEP_LAUNCH_WEEK_GRAM_OPERATIONS_001_QA_REPORT.md`;
- `ROLLDUEL_STEP_LAUNCH_WEEK_GRAM_OPERATIONS_001_HANDOFF.md`;
- `RollDuel_BASELINE_2026-07.9.1_STEP_LAUNCH_WEEK_GRAM_OPERATIONS_001_FULL.zip` — full reference tree.

Verification boundary:
- docs-only changed-file allowlist PASS;
- baseline SHA-256 provenance recorded;
- source references for Practice Mode, giveaway rules, referral rates, asset flags, and Admin surfaces checked;
- archive integrity and patch reconstruction verified during packaging;
- no live launch actions performed and no live GO/HOLD/STOP result claimed.

## ART-STEP-REFERRAL-ATTRIBUTION-TERMS-GATE-FIX-001 — Referral Attribution Terms-Gate Fix

Status: Produced / delivered.
Scope: single-file runtime fix (`handlers.py`) + new test file + docs sync. No migration, no schema, no ledger/settlement/withdrawal/provider files touched.

Delivered artifacts:
- `ROLLDUEL_STEP_REFERRAL_ATTRIBUTION_TERMS_GATE_FIX_001_BROWSER_HOTFIX.zip` — overlay: `handlers.py`, `tests/test_referral_attribution_terms_gate_fix_001.py`, `docs/knowledge/STEP_REGISTRY.md`, `handoff-current.md`, `CHANGED_FILES.txt`, `QA_REPORT.md`;
- `ROLLDUEL_STEP_REFERRAL_ATTRIBUTION_TERMS_GATE_FIX_001_DEVELOPER.patch` — unified diff, `handlers.py` only.

Verification boundary:
- `python3 -m py_compile handlers.py` PASS;
- red/green regression proof performed (12/13 new tests fail on unpatched baseline, 13/13 pass on the fix);
- targeted subset (referral/rake/giveaway/tournament/admin-money/guardrails/share-result/STEP-110 asset group) 147/147 PASS;
- fresh full-suite single-process run 827/827 PASS (814 prior baseline + 13 new), 0 failures, 0 errors — closes the previously open Truth Boundary gap from the 2026-07-09 migration pack;
- no live Telegram/Railway smoke performed in this session; operator smoke steps documented in QA_REPORT.md section 6.

Known limitation, not resolved by this artifact: retroactive backfill/compensation for referrals lost before this fix is investigated separately (see STEP_REGISTRY.md entry) and found not reconstructable from DB alone — no operator decision applied yet.

## ART-STEP-REFERRAL-ONBOARDING-AND-STATUS-COHERENCE-001 — Referral Timing + Status Coherence Fix (round 2)

Status: Produced / delivered. Supersedes ART-STEP-REFERRAL-ATTRIBUTION-TERMS-GATE-FIX-001 (that artifact — not applied to production). This entry replaces the round-1 delivery of the same STEP; round 1's ZIP/patch should not be applied — use round 2's artifacts below.
Scope: `handlers.py`, `services/referrals.py`, `locales/en.json`, `locales/ru.json` + test files. No migration, no schema, no ledger/settlement/withdrawal/provider files touched.

**Required base — explicit, not assumed:** this ZIP's `handlers.py`, `services/referrals.py`, `locales/en.json`, and `locales/ru.json` are **full-file replacements**. They apply cleanly whether or not you ever applied the superseded STEP-REFERRAL-ATTRIBUTION-TERMS-GATE-FIX-001 hotfix — you do not need that prior application as a base. The only file this ZIP does **not** handle automatically is deleting `tests/test_referral_attribution_terms_gate_fix_001.py` if it exists in your tree from having applied the superseded hotfix: ZIP extraction only adds/overwrites files, it never deletes; that stale file must be removed manually (`rm tests/test_referral_attribution_terms_gate_fix_001.py` or equivalent) if present. If you never applied the superseded hotfix, this file won't exist and there's nothing to delete.

Delivered artifacts:
- `ROLLDUEL_STEP_REFERRAL_ONBOARDING_AND_STATUS_COHERENCE_001_BROWSER_HOTFIX.zip` — root-ready (no wrapper folder): `handlers.py`, `services/referrals.py`, `locales/en.json`, `locales/ru.json`, `tests/test_referral_onboarding_and_status_coherence_001.py` (now 15 tests), `tests/test_tournament_economy_092c.py`, `docs/knowledge/STEP_REGISTRY.md`, `docs/knowledge/ARTIFACT_REGISTRY.md`, `handoff-current.md`, `CHANGED_FILES.txt`, `QA_REPORT.md`.
- `ROLLDUEL_STEP_REFERRAL_ONBOARDING_AND_STATUS_COHERENCE_001_DEVELOPER.patch` — unified diff against the clean pre-any-fix baseline (`RollDuel_BASELINE_2026-07.9_LIVE_ACCEPTED.zip`), covering round 1 + round 2 combined in one diff per file.

Verification boundary (round 2):
- `python3 -m py_compile handlers.py services/referrals.py tests/test_tournament_economy_092c.py` PASS;
- red/green regression proof, round 2: the 6 new tests fail 6/6 against round-1-only code (AttributeError on SQLite `handle_ref_list`, wrong `activeReferrals` count, unescaped HTML, missing `get_max_tier_bonus_percent`); all 15 pass against round-2 code; the 9 round-1 tests are unaffected (still 9/9 against round-1 code);
- fresh full-suite single-process run **830/830 PASS** (824 after round 1 + 6 new round-2 tests), 0 failures, 0 errors;
- a pre-existing brittle source-text test (`test_tournament_economy_092c.py::test_tournament_deep_link_handled_before_generic_referral`) was updated a second time to match the round-2 comment rewrite in `start_command`;
- no live Telegram/Railway smoke performed in this session; operator smoke steps documented in QA_REPORT.md, updated for round-2 checks (Waiting/Activated labels on the real `handle_ref_list` screen output, notification survives special-character names).

Known limitation, not resolved by this artifact: retroactive backfill/compensation for referrals lost before either fix remains impossible to reconstruct (no persisted record anywhere of a lost attribution attempt) — fix-forward only, no operator decision needed since there is no data to act on.

## ART-STEP-FAST-RUNTIME-JOBS-EVENT-DRIVEN-WAKEUP-001 — Event-Driven Fast Reconciliation Loop

Status: Produced / delivered.
Scope: `services/runtime_wakeup.py` (new), `database.py`, `services/reconciliation.py`, `services/games.py`, `services/withdrawals.py`, `services/quick_duel.py`, `handlers.py`, `infra/runtime.py`, `services/runtime.py`, `NEON_RULES.md` + new test file. No migration, no schema, no ledger/settlement/withdrawal money-movement logic touched (timing only).

Delivered artifacts:
- `ROLLDUEL_STEP_FAST_RUNTIME_JOBS_EVENT_DRIVEN_WAKEUP_001_BROWSER_HOTFIX.zip` — root-ready overlay.
- `ROLLDUEL_STEP_FAST_RUNTIME_JOBS_EVENT_DRIVEN_WAKEUP_001_DEVELOPER.patch` — unified diff against the clean baseline.

Verification boundary:
- `python3 -m py_compile` on every changed file PASS;
- real (not just syntax) import test across the full dependency chain confirms zero circular imports;
- red proof: new test module fails to import at all against the pre-STEP baseline (module doesn't exist there);
- targeted regression (reconciliation split, invoice give-up, webhook pool resilience, tournament economy/UX, guardrails, settlement hardening) 98/98 PASS;
- fresh full-suite single-process run 856/856 PASS (830 prior + 26 new), 0 failures, 0 errors;
- three independent-audit review rounds completed before EXECUTE, each with source-confirmed findings (not accepted on narrative) — see STEP_REGISTRY.md for the full finding list;
- no live Railway/Neon post-deploy verification performed in this session (cannot be — requires actual deployment). Recommended operator check: Neon dashboard compute-active-time over 24-48h post-deploy, confirming intermittent `INACTIVE` between the 15-minute APScheduler ticks.

Known, explicitly accepted trade-offs, not hidden:
- tournament-reconciliation SLA changed from "deadline + up to 5 min scheduler lag" to "deadline + up to 15 min scheduler lag" for both forming-timeout (60 min configured deadline) and match-timeout (30 min configured deadline) cases.
- No zero-Neon-compute guarantee — 15-minute ticks still periodically wake compute for a 5-minute billing window each; real savings confirmed only by post-deploy metrics.

## ART-STEP-JETTON-DEPOSITS-DISABLE-001 — Hard-Disable Arbitrary Jetton Deposits

Status: **Live applied / operator confirmed / historical ledger audit PASS / LIVE ACCEPTED**.
Scope: `services/jetton_deposits.py`, `routes/jetton_webhook.py`, `routes/admin_ui.py`, `services/settings.py`, `services/reconciliation.py` + test files. No migration, no schema change.

Delivered artifacts:
- `ROLLDUEL_STEP_JETTON_DEPOSITS_DISABLE_001_BROWSER_HOTFIX.zip` — root-ready overlay.
- `ROLLDUEL_STEP_JETTON_DEPOSITS_DISABLE_001_DEVELOPER.patch` — runtime-only unified diff against `RollDuel_BASELINE_2026-07.12.zip`; Browser Hotfix is the primary complete STEP artifact.

Verification boundary:
- `python3 -m py_compile` on every changed file PASS;
- red proof: new test file 7/10 fail against pre-fix code;
- two pre-existing `test_security_contracts.py` tests deliberately updated (not deleted) to match the new unconditional-refusal behavior, with the original security requirement preserved as documentation for any future re-enablement;
- fresh full-suite single-process run 866/866 PASS (856 prior + 10 new), 0 failures, 0 errors.

Findings closed (both pre-existing, found during investigation of an unrelated feature request):
1. `process_jetton_deposit()` credited any received Jetton to the user's GRAM balance 1:1 (missing `asset=` argument to `ledger.create_entry`, defaults to GRAM) — silent mis-crediting, zero price awareness.
2. The `jetton_deposit_enabled` admin toggle was never read anywhere — a dead switch.

Also discovered (documented, not separately actioned): the removed polling path imported a `services.ton_api` function (`get_jetton_transfers_to_address`) that doesn't exist in that module — this pathway likely never worked correctly even before this STEP.

Disable is structural: `services/jetton_deposits.py` no longer imports `database`/`services.ledger`/`services.idempotency` at all.

## ART-STEP-JETTON-DEPOSITS-DISABLE-DOCS-SYNC-001 — Live Acceptance Docs Sync

Status: Produced / docs-only / canonical promotion.

Primary apply artifact:
- `ROLLDUEL_STEP_JETTON_DEPOSITS_DISABLE_DOCS_SYNC_001_BROWSER_HOTFIX.zip` — root-ready docs/config overlay.

Optional developer artifact:
- `ROLLDUEL_STEP_JETTON_DEPOSITS_DISABLE_DOCS_SYNC_001_DEVELOPER.patch` — docs/config-only unified diff.

Canonical full baseline:
- `RollDuel_BASELINE_2026-07.12.1_JETTON_DISABLE_LIVE_ACCEPTED.zip`.

Scope:
- `.env.example`;
- `handoff-current.md`;
- `QA_REPORT.md`;
- `docs/knowledge/STEP_REGISTRY.md`;
- `docs/knowledge/ARTIFACT_REGISTRY.md`;
- `docs/operations/STEP-JETTON-DEPOSITS-DISABLE-001_LIVE_EVIDENCE.md`;
- `CHANGED_FILES.txt`.

Verification boundary:
- no runtime Python code changed;
- no migration or schema change;
- live Neon aggregate and detail audits both returned zero `jetton_deposit` rows;
- root-ready ZIP integrity verified;
- canonical baseline filename corrected to dotted `2026-07.12.1` form.

## ART-STEP-COMMUNITY-SURFACES-001 — Community Navigation and Landing Surfaces

Status: Produced / source-verified / QA passed / live applied / operator confirmed.

Primary apply artifact:
- `ROLLDUEL_STEP_COMMUNITY_SURFACES_001_BROWSER_HOTFIX.zip` — root-ready Browser/GitHub overlay.

Optional developer artifact:
- `ROLLDUEL_STEP_COMMUNITY_SURFACES_001_DEVELOPER.patch` — unified diff against `RollDuel_BASELINE_2026-07.12.1_JETTON_DISABLE_LIVE_ACCEPTED.zip`.

Reference full package:
- `RollDuel_BASELINE_2026-07.12.2_STEP_COMMUNITY_SURFACES_001_FULL.zip` — complete source/reference candidate, not promoted to LIVE ACCEPTED until deployment smoke.

Scope:
- `.env.example`;
- `services/community.py`;
- `keyboards.py`;
- `handlers.py`;
- `locales/en.json`;
- `locales/ru.json`;
- `lib/site-config.ts`;
- `components/site.tsx`;
- `app/page.tsx`;
- `tests/test_community_surfaces_001.py`;
- docs/registries/handoff/QA manifests.

Verification boundary:
- no migration or schema change;
- no automatic duel-feed publication in this STEP;
- 877/877 repository tests PASS across exhaustive split-run;
- Next.js production build PASS;
- live Telegram and deployed landing smoke remain operator-only evidence.

## ART-STEP-COMMUNITY-DUEL-TOPIC-FEED-001 — Automatic Public Duel Forum Feed

Status: Produced / source-verified / QA passed / live applied / core live smoke pass / operator confirmed.

Primary apply artifact:
- `ROLLDUEL_STEP_COMMUNITY_DUEL_TOPIC_FEED_001_BROWSER_HOTFIX.zip` — root-ready Browser/GitHub overlay; apply on top of `RollDuel_BASELINE_2026-07.12.2_STEP_COMMUNITY_SURFACES_001_FULL.zip` or an equivalent repository containing STEP-COMMUNITY-SURFACES-001.

Optional developer artifact:
- `ROLLDUEL_STEP_COMMUNITY_DUEL_TOPIC_FEED_001_DEVELOPER.patch` — complete diff against the exact Community Surfaces full baseline; must pass `git apply --check` before delivery.

Reference full package:
- `RollDuel_BASELINE_2026-07.12.3_STEP_COMMUNITY_DUEL_TOPIC_FEED_001_FULL.zip` — complete source/reference candidate; not LIVE ACCEPTED until Railway migration, topic binding, and Telegram live smoke pass.

Scope:
- migration `034_community_duel_publications.sql` plus runtime bootstrap/schema wiring;
- persistent community publication and Terms-intent state;
- post-commit public-game publication scheduling and lifecycle sync;
- event-driven runtime dispatcher integration;
- admin-only topic binding/status commands;
- neutral official-feed deep links;
- EN/RU card copy and Terms restoration;
- tests, product/operations docs, registries, handoff, QA and changed-file manifests.

Verification boundary:
- GRAM remains the only live asset;
- no settlement formula, fee, balance, deposit, withdrawal, or referral reward calculation changed;
- 897/897 repository tests PASS across exhaustive split-run;
- migration has not yet been verified against live Neon in this STEP;
- real Telegram topic delivery/editing and bot permissions remain operator-only live evidence.

## ART-STEP-COMMUNITY-LAUNCH-CONTENT-001 — Launch-Ready Community Content Pack

Status: Produced / docs-only / operator publishing pending.

Primary apply artifact:
- `ROLLDUEL_STEP_COMMUNITY_LAUNCH_CONTENT_001_BROWSER_HOTFIX.zip` — root-ready Browser/GitHub docs overlay.

Optional developer artifact:
- `ROLLDUEL_STEP_COMMUNITY_LAUNCH_CONTENT_001_DEVELOPER.patch` — unified diff against `RollDuel_BASELINE_2026-07.12.3_STEP_COMMUNITY_DUEL_TOPIC_FEED_001_FULL.zip`.

Canonical full package after this docs sync:
- `RollDuel_BASELINE_2026-07.12.4_COMMUNITY_FEED_LIVE_ACCEPTED_AND_LAUNCH_CONTENT.zip`.

Scope:
- live evidence for the deployed EN/RU duel feed;
- official channel profile, bilingual pinned navigation, and first launch post;
- bilingual community rules and language-topic welcomes;
- Wins/Support/Feedback starter posts;
- seven-day Telegram, X, and LinkedIn copy;
- publishing/moderation runbook;
- Founding Duel Challenge draft marked not approved for publication;
- STEP/Artifact registries, handoff, QA, and changed-file manifests.

Verification boundary:
- no executable source, migration, schema, or runtime configuration changed;
- no prize or giveaway was created;
- no money-sensitive placeholder is represented as approved;
- direct live evidence covers topic binding, EN/RU waiting cards, and cancellation projection;
- remaining live lifecycle branches stay explicitly listed as residual observations.

## STEP-WITHDRAWAL-FAILURE-RESOLUTION-001

- Primary apply artifact: `ROLLDUEL_STEP_WITHDRAWAL_FAILURE_RESOLUTION_001_BROWSER_HOTFIX.zip` — root-ready browser upload.
- Developer artifact: `ROLLDUEL_STEP_WITHDRAWAL_FAILURE_RESOLUTION_001_DEVELOPER.patch` — must pass `git apply --check` against baseline 2026-07.12.4.
- Candidate full package: `RollDuel_BASELINE_2026-07.12.5_STEP_WITHDRAWAL_FAILURE_RESOLUTION_001_FULL.zip` — reference/candidate until live resolution evidence is complete.
- Checksums: `ROLLDUEL_STEP_WITHDRAWAL_FAILURE_RESOLUTION_001_CHECKSUMS.txt`.
- Base: `RollDuel_BASELINE_2026-07.12.4_COMMUNITY_FEED_LIVE_ACCEPTED_AND_LAUNCH_CONTENT.zip`.
- Status: IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING.

## STEP-ACQUISITION-ATTRIBUTION-FOUNDATION-001A

- Primary apply artifact: `ROLLDUEL_STEP_ACQUISITION_ATTRIBUTION_FOUNDATION_001A_BROWSER_HOTFIX.zip` — root-ready browser upload.
- Developer artifact: `ROLLDUEL_STEP_ACQUISITION_ATTRIBUTION_FOUNDATION_001A_DEVELOPER.patch`.
- Candidate full package: `RollDuel_BASELINE_2026-07.12.6_STEP_ACQUISITION_ATTRIBUTION_FOUNDATION_001A_FULL.zip` — not canonical live until deployment/migration smoke.
- Checksums: `ROLLDUEL_STEP_ACQUISITION_ATTRIBUTION_FOUNDATION_001A_CHECKSUMS.txt`.
- Base: `RollDuel_BASELINE_2026-07.12.5_STEP_WITHDRAWAL_FAILURE_RESOLUTION_001_FULL.zip`.
- Status: IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING.

## STEP-ACQUISITION-WEB-COCKPIT-001B

- Primary apply artifact: `ROLLDUEL_STEP_ACQUISITION_WEB_COCKPIT_001B_BROWSER_HOTFIX.zip` — root-ready browser/GitHub overlay.
- Developer artifact: `ROLLDUEL_STEP_ACQUISITION_WEB_COCKPIT_001B_DEVELOPER.patch` — diff against baseline 2026-07.12.6.
- Candidate full package: `RollDuel_BASELINE_2026-07.12.7_STEP_ACQUISITION_WEB_COCKPIT_001B_FULL.zip` — reference/candidate until Railway/Web Admin live smoke.
- Checksums: `ROLLDUEL_STEP_ACQUISITION_WEB_COCKPIT_001B_CHECKSUMS.txt`.
- No migration is added. Existing migration 036 is required.
- Status: IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING.

## STEP-ACQUISITION-WEB-COCKPIT-DECIMAL-AUDIT-HOTFIX-001B1

- Primary apply artifact: `ROLLDUEL_STEP_ACQUISITION_WEB_COCKPIT_DECIMAL_AUDIT_HOTFIX_001B1_BROWSER_HOTFIX.zip`.
- Developer artifact: `ROLLDUEL_STEP_ACQUISITION_WEB_COCKPIT_DECIMAL_AUDIT_HOTFIX_001B1_DEVELOPER.patch`.
- Candidate full package: `RollDuel_BASELINE_2026-07.12.7.1_ACQUISITION_DECIMAL_AUDIT_HOTFIX_001B1_FULL.zip`.
- Base: `RollDuel_BASELINE_2026-07.12.7_STEP_ACQUISITION_WEB_COCKPIT_001B_FULL.zip`.
- Migration: none.
- Status: IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING.

## STEP-ACQUISITION-LANDING-PROPAGATION-001D

- Primary apply artifact: `ROLLDUEL_STEP_ACQUISITION_LANDING_PROPAGATION_001D_BROWSER_HOTFIX.zip`.
- Developer artifact: `ROLLDUEL_STEP_ACQUISITION_LANDING_PROPAGATION_001D_DEVELOPER.patch`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.12.8_STEP_ACQUISITION_LANDING_PROPAGATION_001D_FULL.zip`.
- Base: `RollDuel_BASELINE_2026-07.12.7.1_ACQUISITION_DECIMAL_AUDIT_HOTFIX_001B1_FULL.zip`.
- Status: IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING.


## STEP-ACQUISITION-TG-COCKPIT-001C

- Primary apply artifact: `ROLLDUEL_STEP_ACQUISITION_TG_COCKPIT_001C_BROWSER_HOTFIX.zip`.
- Developer artifact: `ROLLDUEL_STEP_ACQUISITION_TG_COCKPIT_001C_DEVELOPER.patch`.
- Candidate full package: `RollDuel_BASELINE_2026-07.12.9_STEP_ACQUISITION_TG_COCKPIT_001C_FULL.zip`.
- Base: `RollDuel_BASELINE_2026-07.12.8_STEP_ACQUISITION_LANDING_PROPAGATION_001D_FULL.zip`.
- Migration: none.
- Status: IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING.

## ART-STEP-PROJECT-CANON-AND-MULTIMODEL-HANDOFF-SYNC-001

Status: Produced / docs-only / canonical promotion.

Primary apply artifact:
- `ROLLDUEL_STEP_PROJECT_CANON_AND_MULTIMODEL_HANDOFF_SYNC_001_BROWSER_HOTFIX.zip` — root-ready documentation overlay.

Optional developer artifact:
- `ROLLDUEL_STEP_PROJECT_CANON_AND_MULTIMODEL_HANDOFF_SYNC_001_DEVELOPER.patch` — docs-only diff against baseline 2026-07.12.9.

Canonical full baseline:
- `RollDuel_BASELINE_2026-07.12.10_PROJECT_CANON_AND_MULTIMODEL_HANDOFF_SYNC_CANONICAL.zip`.

Key included coordination document:
- `ROLLDUEL_MASTER_COORDINATION_HANDOFF_2026-07-15.md` at repository root and under `docs/new_chat/`.

Verification boundary:
- no executable, migration, schema, environment, or money-path files changed;
- runtime lineage is byte-identical to baseline 2026-07.12.9 outside the documented file set;
- controlled soft launch readiness is preserved; unrestricted-launch evidence is not overclaimed.

## ART-STEP-COMMUNITY-VERIFICATION-ENTRY-ROUTING-001

Status: Produced / QA passed / deployment pending.

Primary apply artifact:
- `ROLLDUEL_STEP_COMMUNITY_VERIFICATION_ENTRY_ROUTING_001_BROWSER_HOTFIX.zip` — root-ready overlay for browser/GitHub upload.

Optional developer artifact:
- `ROLLDUEL_STEP_COMMUNITY_VERIFICATION_ENTRY_ROUTING_001_DEVELOPER.patch` — clean diff against canonical baseline 2026-07.12.10.

Candidate full baseline:
- `RollDuel_BASELINE_2026-07.12.11_STEP_COMMUNITY_VERIFICATION_ENTRY_ROUTING_001_FULL.zip`.

Verification boundary:
- generic community entry routes through Shieldy topic `/1`;
- language-specific chat/Open Duels links remain direct;
- no migration or money-path change;
- live Telegram/Shieldy placement remains operator-confirmed after deployment.

## STEP-DEMO-MODE-CORE-COHERENCE-001A artifacts

- `ROLLDUEL_STEP_DEMO_MODE_CORE_COHERENCE_001A_BROWSER_HOTFIX.zip` — primary root-ready browser/GitHub apply artifact.
- `ROLLDUEL_STEP_DEMO_MODE_CORE_COHERENCE_001A_DEVELOPER.patch` — clean developer diff against baseline 2026-07.12.11.
- `ROLLDUEL_STEP_DEMO_MODE_CORE_COHERENCE_001A_CHECKSUMS.txt` — artifact hashes.
- `RollDuel_BASELINE_2026-07.12.12_STEP_DEMO_MODE_CORE_COHERENCE_001A_FULL.zip` — operator-confirmed deployed baseline; readiness green.
- Verification: 21/21 new, 161/161 targeted and 1003/1003 exhaustive repository regression PASS; operator supplied clean startup/readiness evidence after deployment.

## STEP-DEMO-MODE-INVITE-AND-REFERRAL-PARITY-001B artifacts

- Primary apply artifact: `ROLLDUEL_STEP_DEMO_MODE_INVITE_AND_REFERRAL_PARITY_001B_BROWSER_HOTFIX.zip` — root-ready browser/GitHub overlay.
- Developer artifact: `ROLLDUEL_STEP_DEMO_MODE_INVITE_AND_REFERRAL_PARITY_001B_DEVELOPER.patch` — diff against deployed baseline 2026-07.12.12.
- Checksums: `ROLLDUEL_STEP_DEMO_MODE_INVITE_AND_REFERRAL_PARITY_001B_CHECKSUMS.txt`.
- Accepted deployed baseline: `RollDuel_BASELINE_2026-07.12.13_STEP_DEMO_MODE_INVITE_AND_REFERRAL_PARITY_001B_FULL.zip` — operator-confirmed working.
- Migration: none. Railway deploy required; Vercel deploy not required.
- Verification: 17/17 new, 78/78 targeted and 1020/1020 exhaustive repository tests PASS; compileall PASS; final package/apply verification recorded in the QA report/checksum artifact.


## STEP-DEMO-MODE-UX-AND-LIVE-ACCEPTANCE-001C artifacts

- Primary apply artifact: `ROLLDUEL_STEP_DEMO_MODE_UX_AND_LIVE_ACCEPTANCE_001C_BROWSER_HOTFIX.zip` — root-ready browser/GitHub overlay.
- Developer artifact: `ROLLDUEL_STEP_DEMO_MODE_UX_AND_LIVE_ACCEPTANCE_001C_DEVELOPER.patch` — diff against accepted baseline 2026-07.12.13.
- Checksums: `ROLLDUEL_STEP_DEMO_MODE_UX_AND_LIVE_ACCEPTANCE_001C_CHECKSUMS.txt`.
- Accepted deployed baseline: `RollDuel_BASELINE_2026-07.12.14_STEP_DEMO_MODE_UX_AND_LIVE_ACCEPTANCE_001C_FULL.zip` — operator-confirmed working; Railway logs confirm two complete Demo rounds and rematch lifecycle.
- Migration: none. Railway deploy required; Vercel deploy not required.
- Verification: 22/22 new tests; 110/110 targeted; 1042/1042 exhaustive repository regression across four complete groups; compileall and locale source coverage PASS; old baseline red proof 22/22 failed.


## STEP-POSTGRES-STALE-CONNECTION-RESILIENCE-001 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_POSTGRES_STALE_CONNECTION_RESILIENCE_001_BROWSER_HOTFIX.zip` — root-ready Railway/GitHub overlay.
- Developer artifact: `ROLLDUEL_STEP_POSTGRES_STALE_CONNECTION_RESILIENCE_001_DEVELOPER.patch` — diff against accepted baseline 2026-07.12.14.
- Checksums: `ROLLDUEL_STEP_POSTGRES_STALE_CONNECTION_RESILIENCE_001_CHECKSUMS.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.12.15_STEP_POSTGRES_STALE_CONNECTION_RESILIENCE_001_FULL.zip`.
- Migration: none. Railway deploy required; Vercel deploy not required.
- Verification: 10/10 new tests; 24/24 targeted; 1052/1052 exhaustive repository regression; compileall PASS; red proof 10/10 failed on old baseline.
- Promotion boundary: candidate until idle-wakeup `/start` and scheduler live log evidence pass.

## STEP-DUEL-TIMEOUT-TRUTH-AND-UX-001 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_DUEL_TIMEOUT_TRUTH_AND_UX_001_BROWSER_HOTFIX.zip` — root-ready Railway/GitHub overlay.
- Developer artifact: `ROLLDUEL_STEP_DUEL_TIMEOUT_TRUTH_AND_UX_001_DEVELOPER.patch` — clean diff against accepted baseline 2026-07.12.15.
- Checksums: `ROLLDUEL_STEP_DUEL_TIMEOUT_TRUTH_AND_UX_001_CHECKSUMS.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.12.16_STEP_DUEL_TIMEOUT_TRUTH_AND_UX_001_FULL.zip`.
- Migration: none. Railway deploy required; Vercel deploy not required.
- Verification: 17/17 new tests; 1069/1069 exhaustive repository regression in four deterministic partitions; compileall PASS; red proof 15 feature failures on the old baseline.
- Promotion boundary: candidate until timeout/refund/restart and observability live smoke passes.

## STEP-DUEL-SHARE-COPY-AND-EXPIRY-CONTEXT-001 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_DUEL_SHARE_COPY_AND_EXPIRY_CONTEXT_001_BROWSER_HOTFIX.zip` — root-ready Railway/GitHub overlay.
- Developer artifact: `ROLLDUEL_STEP_DUEL_SHARE_COPY_AND_EXPIRY_CONTEXT_001_DEVELOPER.patch` — diff against accepted baseline 2026-07.12.16.
- Checksums: `ROLLDUEL_STEP_DUEL_SHARE_COPY_AND_EXPIRY_CONTEXT_001_CHECKSUMS.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.12.17_STEP_DUEL_SHARE_COPY_AND_EXPIRY_CONTEXT_001_FULL.zip`.
- Migration: none. Railway deploy required; Vercel deploy not required.
- Verification: 13/13 new tests; 89/89 targeted; 1082/1082 exhaustive repository regression; compileall and locale JSON PASS; red proof 12 feature assertions failed on old baseline.
- Promotion boundary: candidate until RU/EN public, Demo, private and expired-share live smoke passes.


## STEP-DUEL-SERIES-BO3-FOUNDATION-001 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_DUEL_SERIES_BO3_FOUNDATION_001_PATCH.zip` — overlay for the accepted Quick Duel stake-truth full candidate.
- Developer artifact: `ROLLDUEL_STEP_DUEL_SERIES_BO3_FOUNDATION_001.patch` — unified diff against that candidate.
- Checksums: `ROLLDUEL_STEP_DUEL_SERIES_BO3_FOUNDATION_001_ARTIFACT_SHA256.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.18_STEP_DUEL_SERIES_BO3_FOUNDATION_001_FULL.zip`.
- Migration: `039_duel_series_bo3_foundation.sql`; Railway deploy required; Vercel deploy not required.
- Verification: 17/17 new tests; 218/218 targeted; 1110/1110 exhaustive repository regression across four complete partitions; compileall and locale JSON PASS.
- Promotion boundary: feature flag remains OFF until migration/startup and controlled Telegram/PostgreSQL BO3 live acceptance pass.

## STEP-DEMO-MODE-LOCALE-AND-STAKE-UX-HOTFIX-001D artifacts

- Primary apply artifact: `ROLLDUEL_STEP_DEMO_MODE_LOCALE_AND_STAKE_UX_HOTFIX_001D_PATCH.zip` — overlay for the BO3 foundation full candidate.
- Developer artifact: `ROLLDUEL_STEP_DEMO_MODE_LOCALE_AND_STAKE_UX_HOTFIX_001D.patch` — unified diff against that candidate.
- Checksums: `ROLLDUEL_STEP_DEMO_MODE_LOCALE_AND_STAKE_UX_HOTFIX_001D_ARTIFACT_SHA256.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.18_STEP_DEMO_MODE_LOCALE_AND_STAKE_UX_HOTFIX_001D_FULL.zip`.
- Migration: none. Railway deploy required; Vercel deploy not required.
- Verification: 8/8 new tests; 91/91 targeted; 1118/1118 exhaustive repository regression across four complete partitions; compileall, locale parity and placeholder parity PASS.
- Promotion boundary: candidate until per-participant RU/EN join, custom/all-in stake, rematch copy and restore-boundary Telegram smoke pass; BO3 live acceptance then resumes.


## STEP-DUEL-SERIES-POST-MATCH-ROLL-KEYBOARD-CLEANUP-003 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_DUEL_SERIES_POST_MATCH_ROLL_KEYBOARD_CLEANUP_003_PATCH.zip` — overlay for the Demo locale/flexible-stake full candidate.
- Developer artifact: `ROLLDUEL_STEP_DUEL_SERIES_POST_MATCH_ROLL_KEYBOARD_CLEANUP_003.patch` — unified diff against that candidate.
- Checksums: `ROLLDUEL_STEP_DUEL_SERIES_POST_MATCH_ROLL_KEYBOARD_CLEANUP_003_ARTIFACT_SHA256.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.18_STEP_DUEL_SERIES_POST_MATCH_ROLL_KEYBOARD_CLEANUP_003_FULL.zip`.
- Migration: none. Railway deploy required; Vercel deploy not required.
- Verification: 3/3 new tests; 56/56 targeted; 1121/1121 exhaustive repository regression; compileall and artifact reconstruction PASS.
- Promotion boundary: candidate until BO3 final-result keyboard cleanup is confirmed for both players in live Telegram, after which `STEP-DUEL-SERIES-BO3-LIVE-ACCEPTANCE-002` continues.

## STEP-SHARE-RESULT-LOCALE-CONTEXT-HOTFIX-004 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_SHARE_RESULT_LOCALE_CONTEXT_HOTFIX_004_PATCH.zip` — overlay for the BO3 post-match keyboard-cleanup full candidate.
- Developer artifact: `ROLLDUEL_STEP_SHARE_RESULT_LOCALE_CONTEXT_HOTFIX_004.patch` — unified diff against that candidate.
- Checksums: `ROLLDUEL_STEP_SHARE_RESULT_LOCALE_CONTEXT_HOTFIX_004_ARTIFACT_SHA256.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.18_STEP_SHARE_RESULT_LOCALE_CONTEXT_HOTFIX_004_FULL.zip`.
- Migration: none. Railway deploy required; Vercel deploy not required.
- Verification: 6/6 new tests; 45/45 targeted; 1127/1127 exhaustive repository regression; compileall, locale parity, placeholder parity and artifact reconstruction PASS.
- Promotion boundary: candidate until RU/EN Telegram result-share and the audited player-surface locale checks pass live; then resume `STEP-DUEL-SERIES-BO3-LIVE-ACCEPTANCE-002`.

## STEP-DEMO-MODE-BO3-PARITY-005 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_DEMO_MODE_BO3_PARITY_005_PATCH.zip` — overlay for the accepted Share Result Locale Context full candidate.
- Developer artifact: `ROLLDUEL_STEP_DEMO_MODE_BO3_PARITY_005.patch` — unified diff against that candidate.
- Checksums: `ROLLDUEL_STEP_DEMO_MODE_BO3_PARITY_005_ARTIFACT_SHA256.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.18_STEP_DEMO_MODE_BO3_PARITY_005_FULL.zip`.
- Migration: `040_demo_mode_bo3_parity.sql`; Railway deploy required; Vercel deploy not required.
- Verification: 8/8 new tests; 108/108 targeted; 1135/1135 exhaustive repository regression across 12 complete partitions; compileall, locale parity, placeholder parity and English purity PASS.
- Promotion boundary: deploy with Demo BO3 OFF, verify migration and single-round regression, then enable canary and complete 2-0, 2-1, draw, timeout and restart-recovery live smoke.


## STEP-TOURNAMENT-BO3-BRACKET-PARITY-006 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_TOURNAMENT_BO3_BRACKET_PARITY_006_PATCH.zip` — overlay for the Demo BO3 parity full candidate.
- Developer artifact: `ROLLDUEL_STEP_TOURNAMENT_BO3_BRACKET_PARITY_006.patch` — unified diff against that candidate.
- Checksums: `ROLLDUEL_STEP_TOURNAMENT_BO3_BRACKET_PARITY_006_ARTIFACT_SHA256.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.18_STEP_TOURNAMENT_BO3_BRACKET_PARITY_006_FULL.zip`.
- Migration: `041_tournament_bo3_bracket_parity.sql`; Railway/Neon deploy required; Vercel deploy not required.
- Verification: 13/13 new tests; 100/100 targeted; 1148/1148 exhaustive repository regression across 133 files/12 partitions; compileall, locale parity and English purity PASS; CogniForge patch-scope preflight PASS with a documented generic SQL warning; artifact reconstruction PASS.
- Promotion boundary: deploy with flag OFF, verify migration and legacy single tournament, then enable canary and complete a controlled four-player BO3 tournament with draw/restart/timeout/final-payout evidence.

## STEP-SHARED-DUEL-LIVE-STATUS-AND-CONVERSION-007 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_SHARED_DUEL_LIVE_STATUS_AND_CONVERSION_007_PATCH.zip` — overlay only for the Tournament BO3 parity full candidate.
- Developer artifact: `ROLLDUEL_STEP_SHARED_DUEL_LIVE_STATUS_AND_CONVERSION_007.patch` — unified diff against that candidate.
- Checksums: `ROLLDUEL_STEP_SHARED_DUEL_LIVE_STATUS_AND_CONVERSION_007_ARTIFACT_SHA256.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.18_STEP_SHARED_DUEL_LIVE_STATUS_AND_CONVERSION_007_FULL.zip`.
- Migration: `042_shared_duel_live_status.sql`; Railway/Neon deploy required; Vercel deploy not required.
- Operational prerequisite: enable BotFather inline feedback so Telegram emits `chosen_inline_result.inline_message_id`.
- Verification: 11/11 new tests; 128/128 targeted; 1159/1159 exhaustive repository evidence across 134 files; compileall, locale parity, English purity and artifact reconstruction PASS.
- Promotion boundary: migration/startup plus real/Demo multi-card waiting→active→finished and waiting→expired live evidence; Telegram edit failures must remain gameplay-neutral.

## STEP-SHARED-DUEL-BRANDED-PREVIEW-008 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_SHARED_DUEL_BRANDED_PREVIEW_008_PATCH.zip` — overlay only for the Shared Duel Lifecycle 007 full candidate.
- Developer artifact: `ROLLDUEL_STEP_SHARED_DUEL_BRANDED_PREVIEW_008.patch` — unified diff against that candidate.
- Checksums: `ROLLDUEL_STEP_SHARED_DUEL_BRANDED_PREVIEW_008_ARTIFACT_SHA256.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.18_STEP_SHARED_DUEL_BRANDED_PREVIEW_008_FULL.zip`.
- Migration: none. Railway deploy required; Vercel deployment is optional only if the same public assets are served there.
- Verification: 7/7 new tests; 91/91 targeted; 1166/1166 exhaustive repository regression across 135 files/12 partitions; compileall, locale coverage, exact 1200×630 asset geometry and artifact reconstruction PASS.
- Promotion boundary: confirm public OG asset/route, RU and EN preview rendering, button/fallback redirect truth, and lifecycle edits in Telegram Desktop/mobile.


## STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009 artifacts

- Primary apply artifact: `ROLLDUEL_STEP_TELEGRAM_COMMUNITY_AND_EPHEMERAL_GROUP_UX_009_PATCH.zip` — overlay only for the Shared Duel Branded Preview 008 full baseline.
- Developer artifact: `ROLLDUEL_STEP_TELEGRAM_COMMUNITY_AND_EPHEMERAL_GROUP_UX_009.patch` — unified diff against that baseline.
- Checksums: `ROLLDUEL_STEP_TELEGRAM_COMMUNITY_AND_EPHEMERAL_GROUP_UX_009_ARTIFACT_SHA256.txt`.
- Candidate full baseline: `RollDuel_BASELINE_2026-07.18_STEP_TELEGRAM_COMMUNITY_AND_EPHEMERAL_GROUP_UX_009_FULL.zip`.
- Migration: none. Railway deployment and operator-side Telegram Community linking are required; Vercel deployment is not required.
- Verification: `New tests 8/8 PASS; targeted 69/69 PASS; exhaustive 1174/1174 PASS across 136 test files / 12 non-overlapping partitions; compileall PASS; locale parity 1315/1315; placeholder mismatches 0; unexpected Cyrillic in EN 0 excluding the intentional Russian language-switch label.`.
- Promotion boundary: feature remains OFF until `@rollduelchat` admin rights, Bot API command sync, `/ephemeral_status`, RU/EN private menus and DM-only fallback are proven live.
