# Roll Duel — STEP Registry

Version: `STEP-REG-023`
Last synced: 2026-07-20 / STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009
Production canonical baseline: `RollDuel_BASELINE_2026-07.12.12_STEP_DEMO_MODE_CORE_COHERENCE_001A_FULL.zip` (operator-confirmed deployed; readiness green)
Current operations corridor: `STEP-LAUNCH-WEEK-GRAM-OPERATIONS-001` (unchanged by this fix)

## STEP-110R1 — Multi-Asset Foundation Combined Release

Status: `PACKAGED / LOCAL QA VERIFIED / CONTROLLED LIVE APPLY PENDING`
Mode: `HEAVY / R4`
Scope: one browser-safe release overlay from the actual production baseline `RollDuel_BASELINE_2026-07.7.zip` through the complete STEP-110A → STEP-110D1 prerequisite chain. GRAM remains live; USDT/SOL/TRX remain disabled.
Verification: exact overlay reconstruction PASS; compileall PASS; STEP-110A→D1 targeted `371/371 PASS`; full repository `803/803 PASS`; locale parity `1103/1103`, missing `0`; no file deletions.
Truth boundary: PostgreSQL migration 033 has not yet executed on live Neon. Production canonical baseline advances only after Railway startup, schema checks and controlled GRAM deposit/duel/withdrawal acceptance. After migration commit, recovery is fix-forward only.
Evidence: `ROLLDUEL_STEP_110A_TO_110D1_COMBINED_QA_REPORT.md`, `ROLLDUEL_STEP_110A_TO_110D1_COMBINED_HANDOFF.md`, `docs/operations/STEP-110R1_MULTI_ASSET_FOUNDATION_CONTROLLED_LIVE_APPLY.md`.

## STEP-110D1 — Transactions Asset Scoping

Status: `IMPLEMENTED / LOCAL SOURCE+TEST VERIFIED / REVIEW BRANCH`
Mode: `HEAVY / R4`
Risk Score: `10/10`
Summary: Added strict `transactions.asset` schema for PostgreSQL and SQLite, backfilled historical rows to GRAM, removed all five future settlement writes to `transactions`, centralized monetary historical reads in `services/winnings.py`, applied ledger precedence and duplicate/conflict policy, made leaderboard/social reads asset-scoped, moved diamond bonus replay protection to ledger idempotency, and split ELO from monetary serializers. No database winnings view or runtime view hashing was introduced.
Evidence: `docs/roadmap/STEP-110D1_TRANSACTIONS_ASSET_SCOPING_IMPLEMENTATION_NOTES.md`, `docs/process/STEP-110D1_RPT_CRITICAL_REPORT.md`, `ROLLDUEL_STEP_110D1_TRANSACTIONS_ASSET_SCOPING_QA_REPORT.md`, `tests/test_step_110d1_transactions_asset_scoping.py`.
QA: compileall PASS; STEP-110D1 targeted `13/13 PASS`; all `803/803` collected tests pass across all 105 test files in five isolated execution groups; SQLite migration execution PASS; PostgreSQL migration static contract PASS.
Truth boundary: PostgreSQL migration 033 was not executed against a disposable PostgreSQL server in this environment; no Neon/production migration or live deployment was performed; external/off-repository consumers were not verified. Four unrelated USDT blockers remain.
Release status: `USDT LIVE HOLD`. Production canonical baseline is not advanced by this review-only implementation artifact.

## Current baseline track — STEP-106B to STEP-107B3

### STEP-106B — TG Balance Menu Copy Merge
Status: `DONE`
Mode: STANDARD/FAST UI-copy merge
Summary: Merged Telegram balance screen copy polish, localized connected/disconnected wallet line, preserved structured balance layout, and kept `/start` main menu copy aligned.
Evidence: `ROLLDUEL_STEP_TG_BALANCE_MENU_COPY_MERGE_106B_APPLY_THIS_README.md`, `ROLLDUEL_STEP_TG_BALANCE_MENU_COPY_MERGE_106B_QA_REPORT.md`.

### STEP-107A — Referral Rake Payout Correctness
Status: `DONE / EXTERNALLY VERIFIED`
Mode: HEAVY / CRITICAL
Risk Score: `12/12`
Summary: Fixed referral rake share idempotency from per referred/referrer pair to per game/settlement, preserving replay dedup while allowing each real settled game to create its own referral payout. Tier ladder now matches public contract: Starter 20%, Bronze 25%, Silver 30%, Gold 35%, Diamond 40%, Legend 45%.
Evidence: `ROLLDUEL_STEP_REFERRAL_RAKE_PAYOUT_CORRECTNESS_107A_QA_REPORT.md`, `tests/test_referral_rake_payout_107a.py`. Operator-provided external review reported full historical suite `370/370 PASS` and independent same-game/different-game payout smoke.
Truth boundary: external full-suite result is operator-provided evidence, not rerun in STEP-107C1 sandbox.

### STEP-107B — Giveaway Launch Eligibility Rules
Status: `DONE / EXTERNALLY VERIFIED`
Mode: HEAVY / CRITICAL
Risk Score: `12/12`
Summary: Added giveaway settings for required sponsor subscription and minimum completed real GRAM duels. Replaced broken `database.set_entry_eligibility(...)` path with unified eligibility evaluator. Unknown sponsor membership fails closed when subscription is required. Practice Mode does not satisfy real-duel requirement.
Evidence: `ROLLDUEL_STEP_GIVEAWAY_LAUNCH_ELIGIBILITY_RULES_107B_QA_REPORT.md`, `tests/test_giveaway_launch_rules_107b.py`. Operator-provided external review reported full historical suite `375/375 PASS` and confirmed practice games cannot satisfy the real-duel rule.
Truth boundary: external full-suite result is operator-provided evidence, not rerun in STEP-107C1 sandbox.

### STEP-107C — Launch Gate Evidence Pack
Status: `DONE / DOCS-ONLY`
Mode: HEAVY / CRITICAL evidence governance
Risk Score: `11/12`
Summary: Added operator evidence pack and fillable live template for token/deploy/webhook hygiene, provider diagnostics, real deposit, real duel settlement, referral payout evidence, giveaway eligibility evidence, withdrawal, controlled restart, and final `/admin/release-gate` verdict.
Evidence: `docs/operations/ROLLDUEL_LAUNCH_GATE_EVIDENCE_PACK_107C.md`, `docs/operations/ROLLDUEL_LAUNCH_GATE_EVIDENCE_TEMPLATE_107C.md`, `ROLLDUEL_STEP_LAUNCH_GATE_EVIDENCE_PACK_107C_QA_REPORT.md`. Operator-provided external review confirmed docs-only state with tests unchanged at `375/375 PASS`.
Truth boundary: this STEP does not prove live production behavior.

### STEP-107C1 — Root Docs and Registry Sync
Status: `DONE / DOCS-ONLY`
Mode: STANDARD / governance-docs
Risk Score: `6/12`
Summary: Synchronized stale root docs and STEP registry after 107A → 107B → 107C. Root `CHANGED_FILES.txt` and `QA_REPORT.md` no longer point to STEP-105. `handoff-current.md` and this registry now identify the current baseline chain through 107C1.
Evidence: `CHANGED_FILES_STEP107C1.txt`, `ROLLDUEL_STEP_ROOT_DOCS_AND_REGISTRY_SYNC_107C1_QA_REPORT.md`.

### STEP-107B1 — Giveaway Subscription Toggle Boolean Hotfix
Status: `DONE`
Mode: HOTFIX / production-bug
Risk Score: `7/12`
Summary: Fixed a live production bug reported via Railway logs — every click on the giveaway "Подписка: OFF/ON" toggle raised `psycopg.errors.DatatypeMismatch: column "require_sponsor_subscription" is of type boolean but expression is of type smallint`, so the setting never actually changed. Root cause: `update_giveaway_launch_rules()` in `services/giveaways.py` stored the patch value as a Python `int` (`1`/`0`). SQLite tolerates this via INTEGER type affinity, but the Postgres/Neon column is a real `BOOLEAN`, and psycopg3 infers a bare Python `int` as `smallint`, which Postgres will not implicitly cast to `boolean` in an `UPDATE ... SET` expression. Fix: store a native Python `bool` instead — correct on both backends. Read paths (`_to_bool`, `handlers.py`, `keyboards.py`) already tolerated either representation, so no changes were needed there. The neighboring `min_completed_real_duels` control (STEP-107B) was never affected — it is a genuine `INTEGER` column on both backends, matching the operator's screenshot where "Real duel: 1+" toggled fine while "Подписка" stayed stuck.
Evidence: `services/giveaways.py` (one-line diff), `tests/test_giveaway_subscription_toggle_boolean_hotfix.py` (new regression test, confirmed RED before the fix / GREEN after), `ROLLDUEL_STEP_GIVEAWAY_SUBSCRIPTION_TOGGLE_BOOLEAN_HOTFIX_QA_REPORT.md`.
QA: compileall PASS; full historical suite 376/376 (was 375/375 before this hotfix's own new test), pytest-randomly ×3 stable; targeted suite (giveaway launch rules + referral rake 107A) re-confirmed passing on top of this fix.
Known follow-up resolved in STEP-107B2: the red ❌ next to "Спонсор: my_channel" was source-confirmed to be the sponsor delete button, not a runtime error indicator. STEP-107B2 renamed it to an explicit delete action.

### STEP-107B2 — Sponsor Channel/Chat Input UX
Status: `DONE / EXTERNALLY VERIFIED`
Mode: FAST/STANDARD UX safety
Risk Score: `5/12`
Summary: Clarified giveaway sponsor UX from channel-only to channel/chat, because the actual membership check uses Telegram `get_chat_member()` against any readable chat target. Fixed a functional trap where private invite links like `https://t.me/+...` or `https://t.me/joinchat/...` could be silently normalized into bogus handles and saved as sponsors, causing opaque `subscription_unknown` eligibility failures. Sponsor delete button copy changed from alarming `❌ Sponsor: ...` to explicit `🗑️ Remove: ...` / `🗑️ Удалить: ...`.
Evidence: `handlers.py` (`is_unsupported_sponsor_invite_link`, `normalize_sponsor_input`), `keyboards.py`, `locales/ru.json`, `locales/en.json`, `tests/test_giveaway_sponsor_invite_link_guard_107b2.py`, `ROLLDUEL_STEP_SPONSOR_CHANNEL_CHAT_INPUT_UX_107B2_QA_REPORT.md`.
QA: operator-provided external review reported compileall PASS, full historical suite `394/394 PASS`, pytest-randomly ×3 stable, locale parity `ru=1077 en=1077 missing=0`. This registry sync independently verified compileall and locale parity in sandbox.
Known follow-up: sponsor deletion remains one-tap, but the label now clearly indicates a delete action. Live use of a group/supergroup sponsor is source-supported but not live-verified.

### STEP-107B3 — Sponsor Remove Confirm and Owner Check
Status: `DONE / EXTERNALLY VERIFIED`
Mode: STANDARD / sponsor-flow safety
Risk Score: `6/12`
Summary: Added a confirmation step before removing giveaway sponsors and added action-level owner re-checks for sponsor add/input/remove flows. This closes a silent-failure path where one accidental tap could remove the last sponsor while subscription is required, causing all new entries to fail with `sponsor_required:no_channels` without an obvious operator alert. It also aligns sponsor mutation actions with the project's action-level authorization pattern instead of relying only on cockpit render gating.
Evidence: `handlers.py`, `locales/ru.json`, `locales/en.json`, `tests/test_giveaway_sponsor_owner_check_and_confirm_107b3.py`, `ROLLDUEL_STEP_SPONSOR_REMOVE_CONFIRM_AND_OWNER_CHECK_107B3_QA_REPORT.md`.
QA: operator-provided external review reported compileall PASS, full historical suite `397/397 PASS`, pytest-randomly ×3 stable, locale parity `ru=1080 en=1080 missing=0`. This registry sync independently verified compileall and locale parity in sandbox.
Known follow-up: live sponsor channel/chat membership checks remain part of STEP-107D launch evidence if giveaway is used in launch.

## Current launch gates

```text
Closed internal smoke: GO
Controlled soft launch: CONDITIONAL GO only after P0 evidence passes
Public Launch Week: NO-GO until STEP-107C evidence template is filled with LIVE PASS for all P0 checks
Broad production: NO-GO until several stable soft-launch days and support/abuse telemetry exist
```

## Known operational caveat

Sponsor-channel subscription eligibility is checked/refreshed before draw, but Telegram membership is not synchronously re-verified inside the final draw DB transaction. For long-running giveaways, refresh eligibility shortly before draw or add a future pre-draw subscription refresh STEP. Sponsor deletion now requires confirmation and action-level owner checks after STEP-107B3.

## Known non-money-core UX issues (workspace/TG Admin cockpit) — documented, not fixed

Found during a manual review of the "My Chats" workspace settings screen
(`⭐ Default target`, `🔁 Scope`, and neighboring toggles). Deliberately
recorded here without a code change per operator decision — low risk,
low urgency relative to STEP-107D, but real enough to not silently drop.

1. **`⭐ Группа по умолчанию` / "Default target" — confirmed working as
   designed, not an issue.** Source-verified it drives three real
   behaviors: (a) `publish_open_duel_to_default_workspace` — where an
   open duel gets auto-posted; (b) `publish_result_to_default_workspaces`
   — where a duel result gets auto-posted; (c) which connected group's
   chat-scoped leaderboard is shown when the user checks stats from a
   private chat with the bot. Only matters once an operator has more than
   one connected group. No action needed; documenting so a future
   reviewer doesn't need to re-derive this from source again.

2. **`🔁 Область: {scope}` / "Scope" — copy is unclear about what it
   actually controls.** It only changes what the `🧪 Preview` button
   renders (chat-scoped vs weekly-scoped leaderboard preview). It does
   NOT affect the `🏁 Chat leaderboard` or `🏆 Weekly leaders` publish
   buttons — those always post their own fixed kind regardless of this
   toggle. Current label ("Scope: Chat") reads as if it changes something
   broader. Suggested (not applied) rename: `🔁 Превью-рейтинг: этот чат`
   / `🔁 Превью-рейтинг: неделя` (and EN equivalent), to name the button
   by what it actually gates.

3. **`🟢 Еженедельный дайджест` / "Weekly summary" — FIXED (copy-only).**
   Verified all four registered APScheduler jobs
   (`broadcast-delivery-tick`, `giveaway-scheduled-activation`,
   `tournament-reconciliation`, `vip-expiry-check`) — none auto-publishes
   a weekly leaderboard digest. The toggle only gates whether the
   *manual* `🏆 Weekly leaders` button is allowed to publish. Worse than
   first noted: `workspace.detail.weekly_summary_hint` literally said
   "(weekly top-3 digest every Monday)" / "(дайджест топ-3 каждый
   понедельник)" — a specific, false, user-facing automation promise.
   Found a twin instance in the same review pass:
   `workspace.detail.leaderboard_posts_hint` said "(auto-post leaderboard
   to group)" / "(автопубликация лидерборда в группу)" for
   `leaderboard_posts_enabled`, which is exhaustively confirmed to be
   manual-publish-gate-only too (same non-automation as weekly summary).
   Both hint strings corrected to state plainly that publishing is manual
   via the button below, with no automatic schedule. Contrast: the
   sibling `post_duel_created_enabled` / `post_duel_result_enabled`
   toggles ARE genuinely event-driven (verified call sites:
   `publish_open_duel_to_default_workspace` from `services/quick_duel.py`
   and duel-creation handlers; `publish_result_to_default_workspaces`
   from the settlement path) — those hints were left unchanged since they
   describe real behavior.
   QA: compileall PASS, full suite 397/397 unchanged, locale parity
   ru=1080/en=1080/missing=0.

   A GPT cross-check on this same screen also claimed a duplicated
   `bot.get_chat_member()` call inside `get_workspace_runtime_status()`.
   Source-checked and disproven: line ~2636 checks the *bot's own*
   membership (`get_chat_member(chat_id, me.id)`), line ~2668 separately
   checks the *operator's* membership (`get_chat_member(chat_id,
   int(user_id))`) — two different user_ids, not a duplicate call. No fix
   needed; recording here so this false lead isn't re-investigated later.

## Roadmap note (not blocking) — workspace auto-publication scheduler

Decision: deliberately deferred until after STEP-107D. Manual publish
buttons (`🏁 Chat leaderboard`, `🏆 Weekly leaders`, `👑 Champion`,
`🧪 Preview`) are sufficient for launch week; adding new scheduler
surface area right before the live money drill would widen blast radius
at exactly the wrong time.

When picked up, sequence as:

```text
STEP-108A_WORKSPACE_WEEKLY_LEADERS_AUTOPOST   (first, quieter, weekly cadence)
STEP-108B_WORKSPACE_ACTIVITY_BASED_DAILY_LEADERBOARD   (only if usage data justifies it)
```

Architectural constraints for 108A, decided in advance so this isn't
re-derived or re-argued later:

- **Reuse the existing advisory-lock pattern**, not a new one. The four
  current periodic jobs (`broadcast-delivery-tick`,
  `giveaway-scheduled-activation`, `tournament-reconciliation`,
  `vip-expiry-check`) are already guarded by Postgres advisory locks to
  prevent duplicate execution across horizontally-scaled instances. A
  new weekly-publish job is the same class of risk (multiple Railway
  instances, restart timing) and must use the same mechanism — not a
  from-scratch lock design.
- Idempotency key alone (`workspace_id + week_year + week_number +
  post_type`) protects against duplicate *rows*, but does not replace
  the advisory lock, which protects against two processes *starting* the
  job concurrently. Both layers are needed, not one instead of the
  other.
- **UTC-only for v1.** No per-operator timezone setting in the first
  version — real complexity (storage, conversion, DST edge cases) for a
  feature with zero live-confirmed users yet. Add timezone once real
  multi-region operators actually ask for it, not preemptively.
- Daily/activity-based leaderboard (108B) needs an activity floor (e.g.
  skip posting if fewer than N real duels completed in the window) so
  the bot doesn't spam empty tables into quiet groups.

## STEP-107D — Live Money Drill Execution

Status: `DONE`
Mode: HEAVY / CRITICAL
Risk Score: `12/12`
Goal: Execute the STEP-107C evidence template in production: deposit → webhook credit → real duel → settlement → referral payout → withdrawal → controlled restart → `/admin/release-gate`.

Final result: real deposit (webhook credited, manual re-check correctly
idempotent), two real duel settlements, ELO updates, referral eligibility,
withdrawal, controlled restart, and the deposit-success UX all
live-confirmed working. Two friction issues surfaced mid-drill and closed
by STEP-107D1; one more surfaced during the STEP-107D1 re-drill itself and
closed by STEP-107D2. `/admin/release-gate` reached **GO** after the
STEP-107D1 re-drill; STEP-107D2 is a non-blocking UX polish on top of an
already-GO gate, not a re-open of the verdict.

### STEP-107D1 — Live Drill Recovery and Runtime Warning Fix (merged + corrected)
Status: `DONE`
Mode: HEAVY-lite / money-adjacent
Risk Score: `7/12`

Found live, during the STEP-107D drill itself (not source review):

1. **False runtime warning.** `/admin/runtime` showed `cryptopay_webhook_last_*: invalid stored JSON` for all 3 webhook-diagnostics timestamp keys. Root cause: `_decode_setting_value_safe()` only tolerates a Postgres JSON adapter returning a raw string scalar when the setting's declared `default` is itself a `str`; these 3 keys had no entry in `DEFAULT_SETTINGS` at all, so the tolerance check never fired. The webhook itself was working correctly the whole time — this was a diagnostics-only false positive, but it kept `/admin/release-gate` at `CONDITIONAL-GO`.
2. **Active-duel recovery UX dead-end.** `_describe_active_duel_conflict()` (the "you already have an active duel" text) was called at 13 sites in `handlers.py`, but the real recovery keyboard (`get_active_duel_conflict_keyboard()`, with Cancel/Share/Status actions) was wired at only 1 of those 13. The other 12 fell back to a bare "◀️ Back" button — a live dead-end for a waiting or in-progress duel, exactly as hit during the drill.
3. **`deposit.check.already_credited` missing key**, plus 14 more literal `t(...)` keys found missing from both locales by a systemic static scan triggered by this one production warning (see the `LOCALE_KEY_COVERAGE_FIX` entry above this one in git history / prior registry sync — merged into this STEP's final locale files rather than duplicated as a separate head).

Two independent implementations were produced and adversarially cross-checked before merging:
- GPT's diagnosis of both bugs was source-confirmed correct.
- GPT's first fix for bug #1 (`DEFAULT_SETTINGS["cryptopay_webhook_last_verified_at"] = ""`) caused a real regression: `get_setting(key, default)` does `default = DEFAULT_SETTINGS.get(key, default)`, so adding an entry there silently overrode a caller's explicit `get_setting(key, None)` — collapsing "webhook never fired" (`None`) into "webhook fired with an empty timestamp" (`""`). Caught by the FULL test suite (`test_provider_diagnostics_095.py::test_webhook_health_records_valid_signature`), not by either side's targeted subset — this happened twice across two review rounds before being caught, because neither side's targeted test list happened to include that file.
- Corrected fix: `DEFAULT_SETTINGS` left untouched; string-scalar tolerance in `_decode_setting_value_safe()` scoped to exactly these 3 key names via a new `_WEBHOOK_TIMESTAMP_SETTING_KEYS` frozenset. `get_setting(key, None)` semantics for "row doesn't exist" are unchanged for every other caller.
- GPT's `handlers.py` fix for bug #2 was verified complete and correct across all 13 sites, no changes needed.
- Locale files merged as a union (16 keys from the coverage-scan pass + 5 new `duel.conflict.next_step.*` keys from GPT's status-aware copy) — no key-level collisions between the two independently-produced sets.

QA verified (full suite, both before and after the regression fix, to make the failure/pass delta explicit):
```text
python3 -m compileall -q .                PASS
python3 -m pytest                          405 passed (full suite; was 403 passed / 1 failed
                                            with GPT's original DEFAULT_SETTINGS approach)
python3 -m pytest -p randomly (x3)         405 passed, stable
locale parity                              ru=1101 en=1101 missing=0
static t(...) source-to-locale scan        0 missing (introduced by the coverage-fix pass,
                                            re-verified still 0 after this STEP's new keys)
secret-pattern grep                        clean
```

Applied artifact: `ROLLDUEL_STEP_107D1_MERGED_AND_CORRECTED.zip` / `ROLLDUEL_STEP_107D1_TRULY_FINAL.zip` (same content, second name reflects the final adversarial-check round after GPT's own combined-package attempt still carried the regression forward).

Required re-drill before final `/admin/release-gate` verdict:
```text
1. /admin/runtime — cryptopay_webhook_last_* warnings must be gone.
2. Create a waiting duel, then hit /create or Find Duel again —
   must show Cancel/Share/Status, not just Back.
3. Cancel the waiting duel — stake must return to balance.
4. Create and settle one small real duel end-to-end.
5. /admin/failed and /admin/release-gate — re-check final verdict.
```

Re-drill result: `/admin/release-gate` reached **GO**. Runtime warnings gone,
waiting-duel recovery keyboard confirmed (Cancel/Share/Status), cancel
correctly returned the stake, one real duel settled end-to-end,
`/admin/failed` clean. STEP-107D live money loop is confirmed working.

### STEP-107D2 — Deposit Success Locale and Navigation Fix (corrected)
Status: `DONE`
Mode: FAST/STANDARD, non-money-core UX polish
Risk Score: `3/12`

Found live, during the STEP-107D1 re-drill, after release-gate had
already reached GO: the asynchronous CryptoPay webhook success message
was still hardcoded English (`"✅ Your balance was topped up by {amount}
TON!"`) regardless of the user's language, and carried no navigation
keyboard — a dead-end screen right after a real deposit. The manual
invoice-check path was already localized and navigable; the webhook
credit path was not.

Fix: reused the existing `balance.topped_up` locale key (no new keys
needed, no locale parity change) for both the webhook notification
(`routes/cryptopay_webhook.py`, new `_build_deposit_credit_message()`
helper) and the internal notifier (`handlers.py::notify_successful_deposit`,
which had its own separate hardcoded-English string).

Two corrections made after source-level verification of GPT's original
fix, following the same adversarial cross-check pattern as 107D1:
1. `_build_deposit_credit_message()` hardcoded `demo_mode_enabled=True`
   for the new keyboard, instead of sourcing it from the operator setting
   via `_is_demo_mode_enabled()` like every other call site in the
   codebase. Fixed with a lazy import (no circular dependency —
   `handlers.py` has no module-level import of `routes.cryptopay_webhook`),
   fail-open to `True` only if the settings lookup itself fails.
2. `handle_cryptopay_webhook()` called `_build_deposit_credit_message()`
   *outside* the `try/except` that guarded message sending — only
   `except RuntimeError` protected the send/schedule step. An unexpected
   exception from message-building (e.g. a future i18n formatting bug)
   would have propagated up and turned an already-successfully-credited
   deposit into a webhook-level error response. Fixed: moved the call
   inside the try block, added `except Exception` after the existing
   `except RuntimeError`, so any notification-building failure is caught
   and logged without ever affecting the already-applied credit or the
   webhook's `ok=True` response. Proven with a test using `ValueError`
   (deliberately not `RuntimeError`, to fairly exercise the new except
   clause rather than the pre-existing one): confirmed RED (real
   traceback propagating out of `handle_cryptopay_webhook`) before the
   fix, GREEN after.

QA verified (full suite, both before and after the two corrections):
```text
python3 -m compileall -q .                PASS
python3 -m pytest                          410 passed (full suite; GPT's
                                            package as delivered already
                                            passed the full suite at 409 —
                                            this STEP's corrections are
                                            defensive/consistency fixes,
                                            not regression fixes, unlike
                                            107D1)
python3 -m pytest -p randomly (x3)         410 passed, stable
locale parity                              ru=1101 en=1101 missing=0
                                            (unchanged — existing key reused)
secret-pattern grep                        clean
```

Applied artifact: `ROLLDUEL_STEP_107D2_CORRECTED.zip` (3 files: `handlers.py`,
`routes/cryptopay_webhook.py`, the test file — applied as a direct
overwrite on top of GPT's original `ROLLDUEL_STEP_DEPOSIT_SUCCESS_LOCALE_AND_NAVIGATION_FIX_107D2_BROWSER_HOTFIX.zip`,
safe because both are full-file replacements of the same 3 paths, not patches).

Required after deploy: one small live deposit smoke test — confirm the
webhook success message is localized with navigation buttons, then
`/admin/failed` and `/admin/release-gate` stay clean/GO.

### STEP-107D3 — Deposit Unpaid Invoice UX (+ guard correction)
Status: `DONE`
Mode: FAST/STANDARD, non-money-core UX + money-adjacent guard fix
Risk Score: `4/12`

Found live: an operator/user with an existing unpaid CryptoBot invoice
(e.g. ran short on CryptoBot balance) who tried to deposit again got a
brand new invoice silently, every time, with no indication an older one
was still open.

Fix: `handle_deposit_amount()` now checks
`get_active_unpaid_invoice_for_user()` (new, `services/payments.py`)
before creating a new invoice. If found, shows a warning naming the
existing amount with three choices — reopen the old invoice, create a
new one anyway (`deposit_confirm_new_{amount}` callback, amount encoded
directly, no extra state needed), or go to Balance. Invoice-creation
logic was extracted into a shared `_create_and_send_deposit_invoice()`
helper so the normal flow and the confirm path can't drift apart.

**Adversarial cross-check caught two real bugs in the first delivery,
both fixed before this was accepted as DONE:**

1. GPT's finding, source-confirmed: `_handle_deposit_confirm_new()`
   created the new invoice without re-checking
   `_check_product_access(user_id, "deposit")` — bypassing the operator's
   `deposits_enabled`/`maintenance_mode` runtime switches **and**
   per-user risk restrictions (`risk_service.can_user_perform`), just
   because the warning screen had already been shown once. Fixed by
   adding the same guard at the top of the confirm handler.
2. Found independently while fixing #1, pre-existing (not introduced by
   this STEP): `handle_deposit_amount()` itself referenced `t` inside
   `get_back_button(..., t=t)` in its `_check_product_access()` failure
   branch, but `t` was assigned several lines *below* that branch — a
   real `NameError`, not a graceful error message, would fire exactly
   when an operator disables deposits or a user is risk-blocked. Copying
   that ordering into the new confirm handler (written fresh, not copied)
   would have propagated the bug into new code. Fixed in both places:
   translator setup now happens before the guard check.

QA: compileall PASS; full suite 424/424 (was 421 after 107D4 + 3 new
guard-correction tests); locale parity `ru=1103 en=1103 missing=0`
unchanged; red/green proof on the guard-bypass test (reverted the guard,
confirmed the test fails with a clear message, restored, confirmed
green).

### STEP-107D4 — Invoice Auto-Reconcile Give-Up
Status: `DONE`
Mode: STANDARD, reuses existing safe-close logic
Risk Score: `5/12`

**Major corrected understanding, discovered mid-implementation:** the
original framing ("invoices have no auto-expiry, they pile up forever")
was wrong in one critical respect. `services.reconciliation.
process_runtime_jobs()` is NOT dead code — it runs continuously every
`RECONCILIATION_INTERVAL_SECONDS` (20s default) via
`reconciliation_worker()`, an asyncio background task started
unconditionally in `infra.runtime.WebhookRuntime.start()` (confirmed this
is the runtime `main.py` actually imports; the separate
`services/runtime.py` copy is unused/legacy). So unpaid invoices were
already being polled every 20 seconds via CryptoBot's real API — they
just never gave up polling, forever, for invoices nobody will ever pay.
That is the real gap this STEP closes.

Fix: the `invoice_reconcile` branch now checks invoice age; past
`INVOICE_RECONCILE_GIVE_UP_AFTER_SECONDS` (default 1 hour — buffer past
CryptoBot's own 15-minute pay_url TTL), it calls the existing
`mark_invoice_stale_unpaid()` (`money_mutation=False`, refuses if any
paid/ledger evidence exists, invoice row preserved for a late webhook)
and completes the job instead of retrying forever. Reuses 100% existing,
already-audited safe-close logic.

**Independently-discovered, more serious side finding, fixed in the same
pass:** `process_runtime_jobs()` also used to call `services.giveaways.
check_and_auto_draw_giveaways(bot=None)` on every ~20-second tick.
Because giveaway auto-draw claims are atomic
(`ends_at <= now AND drawn_at IS NULL`), this `bot=None` path was
overwhelmingly likely to win the claim race against the dedicated
30-minute `giveaway-scheduled-activation` job (which passes a real `bot`
and sends winner notifications) — 20 seconds vs 30 minutes, essentially
every time a giveaway's deadline passed. This means winner notifications
for auto-drawn giveaways were very likely **never sent in production**,
for the system's entire history. Fixed by removing the vestigial call;
the 30-minute job is now the sole path that can claim and draw expired
giveaways, so notifications should now actually send going forward.

**Flagged, not fixed (out of scope for this STEP, needs its own
investigation):** the 20-second continuous DB-polling cadence of
`reconciliation_worker()` is very likely a pre-existing, separate
violation of this project's own `NEON_RULES.md` ("никаких фоновых задач
с интервалом < 5 минут" / new scheduled jobs minimum 10 minutes). This
predates STEP-107D3/D4 and was not introduced here. Not changed because
`RECONCILIATION_INTERVAL_SECONDS` also governs `withdrawal_reconcile` and
`duel_timeout_check` retry latency — slowing it down carelessly would
hurt withdrawal/duel-timeout responsiveness. Recommend a dedicated STEP
with actual Neon compute measurement before touching this cadence.

QA: compileall PASS; full suite verified alongside 107D3 above; red/green
proof on the give-up-after-age logic (disabled the age check, confirmed
an old invoice stayed active/pending forever, restored, confirmed it
correctly transitions to stale_unpaid + job completed).

### STEP-107D3_GUARD_CORRECTION
Status: `DONE`
Mode: FAST, money-adjacent guard fix
Risk Score: `4/12`

GPT's adversarial review of STEP-107D3 caught a real guard bypass:
`_handle_deposit_confirm_new()` (the "create new anyway" button shown
after the existing-unpaid-invoice warning) created a new CryptoBot
invoice without re-checking `_check_product_access(user_id, "deposit")`
-- bypassing both the operator's `deposits_enabled`/`maintenance_mode`
runtime switches and per-user risk restrictions
(`risk_service.can_user_perform`). Fixed by adding the same guard at the
top of the confirm handler.

Found independently while fixing the above, pre-existing (not introduced
by 107D3): `handle_deposit_amount()` itself referenced `t` inside
`get_back_button(..., t=t)` in its own guard-failure branch, but `t` was
assigned several lines *below* that branch -- a real `NameError`, not a
graceful error message, would have fired exactly when deposits are
disabled or a user is risk-blocked. Fixed in both places: translator
setup now happens before the guard check.

QA: compileall PASS; full suite 424 passed (was 421 + 3 new guard-
correction tests); red/green proof on the guard-bypass test (reverted,
confirmed clear failure message, restored, confirmed green).

### STEP-107E — Neon Reconciliation Loop Investigation
Status: `DONE` (investigation-only, no runtime changes)
Mode: STANDARD / production investigation
Risk Score: `6/12`

Live-evidence investigation into `reconciliation_worker()`'s ~20-second
background loop, per operator-supplied Neon dashboard/CSV data. Key
findings, all evidence-based (see full report at
`docs/operations/ROLLDUEL_NEON_RECONCILIATION_LOOP_INVESTIGATION_107E.md`):

- Historical proof of the exact failure mode STEP-107D4 fixed: an
  `invoice_reconcile` job batch was retried **93,141 times** (~21.6 days
  of continuous polling) before landing in `stale`.
- Two unconditional per-tick queries (`runtime_jobs` check, practice
  cleanup) confirmed firing together on every tick (36,142 vs 36,139
  calls, near-identical counts).
- Neon compute: 58.81 CU-hrs over ~5 days -> ~353 CU/month projected,
  vs this project's own documented 10-25 CU/month target -- roughly
  14-35x over.
- **New finding, outside original scope:** `draw_giveaway_winners()`
  holds an open transaction with a giveaway-level lock while looping a
  per-entrant real-duel-count query that cannot use the existing
  composite index. Live-confirmed: 13 calls, 140s average, 30.3 min
  total -- the same transaction-held-open-too-long anti-pattern
  STEP-045 fixed elsewhere, found here in a code path STEP-045 didn't
  touch.
- `JETTON_DEPOSIT_ADDRESS` confirmed absent from Railway env -- ruled
  out as a contributing factor.

Decisive recommendation (not hedged, given the evidence): proceed to
STEP-107F (split cadence) and STEP-107G (index fix for the giveaway-lock
risk).

### STEP-107G — Giveaway Real-Duel Index and Draw Lock Risk Fix
Status: `DONE`
Mode: STANDARD, schema/performance fix
Risk Score: `5/12`

Root cause (live-confirmed via STEP-107E): `games` only had a composite
index `idx_games_players (player1_id, player2_id)`, which cannot serve
`count_completed_real_duels_for_user()`'s `WHERE (player1_id = ? OR
player2_id = ?)` query efficiently -- contrast with `practice_games`,
which already has individual indexes on both columns. Fix: `CREATE INDEX
IF NOT EXISTS idx_games_player2_id ON games (player2_id)`, added to all
3 of this project's established schema-creation paths (Postgres branch,
SQLite branch, unconditional `_ensure_indexes()` run on every startup)
so it applies automatically on next deploy.

QA: compileall PASS; full suite 427 passed (was 424 + 3 new tests);
verified with a direct isolated before/after comparison (minimal
reproduction plans to a bare `SCAN games` without the index, to
`MULTI-INDEX OR` with it) -- noted honestly that the full-schema SQLite
planner picks a different valid index either way, so the shipped test
suite pins index-existence and functional correctness, not the exact
Postgres query-plan improvement (that evidence is Postgres-specific,
from STEP-107E's live data).

### STEP-107F — Reconciliation Loop Cadence Split
Status: `DONE`
Mode: STANDARD / infra optimization
Risk Score: `6/12`

Split `process_runtime_jobs()` into `process_fast_runtime_jobs()`
(`withdrawal_reconcile`, `duel_timeout_check`, `stuck_game_reconcile` --
unchanged 20s cadence via `reconciliation_worker()`) and
`process_slow_runtime_jobs()` (`invoice_reconcile`, Jetton check,
practice cleanup -- new 15-minute APScheduler job
`slow-reconciliation-tick`, using the existing `scheduler_job_lock`
pattern). Resolved an ambiguity in the pre-implementation design
discussion (whether `invoice_reconcile`'s poll should stay fast) using
hard evidence: `invoice_reconcile` completed only **12 times** across
this project's entire history via this backup-to-webhook path, settling
the decision to move it entirely to the slow loop.

`database.acquire_due_runtime_jobs()` gained a backward-compatible
`job_types` filter parameter (`None` preserves original behavior).

QA: compileall PASS; full suite 432 passed (was 427 + 5 new tests);
red/green proof on the most critical test (fast loop must never acquire
`invoice_reconcile`) -- simulated a broken filter, confirmed clear
failure, restored, confirmed green.

One doc-precision correction after GPT review: the original
`CHANGED_FILES` claimed "runtime_jobs SELECT call count growth rate
should drop sharply" -- corrected to clarify the fast loop still queries
`runtime_jobs` every ~20s, just with a different (filtered) query text;
the real, visible win is `practice_games` SELECT disappearing from the
20s cadence entirely.

Required post-deploy verification: see
`docs/operations/ROLLDUEL_POST_107F_NEON_OBSERVATION_CHECKLIST.md`
(12-24h Neon Query Performance comparison against STEP-107E's baseline
numbers).

### STEP-109 — Multi-Asset (USDT-First) Design Spec (v4, Z.ai-audited + Claude re-verified)
Status: `DONE` (docs-only design spec; STEP-110A implementation not started)
Mode: HEAVY / money-core design
Risk Score: N/A (no runtime changes)

Source-verified inventory of every place the codebase currently assumes
a single asset, produced to support a future USDT (then SOL/TRX)
money-core expansion. Full document:
`docs/roadmap/STEP-109_MULTI_ASSET_USDT_FIRST_DESIGN_SPEC.md`.

Key confirmed facts: "GRAM" is pure UI branding for a balance backed
1:1 by real TON (`cryptopay.py` hardcodes `asset="TON"` in the actual
CryptoBot API calls); 3 of 5 relevant tables already have an `asset`
column in schema (likely pre-GRAM-pivot residue) but the balance-read
code (`_available_balance_in_tx`) ignores it entirely, summing across
all assets blindly; `users.balance` is a single cached column,
structurally unable to represent multiple assets; settings keys bake
the asset into the key NAME (`min_stake_ton`), not a value.

**v3 corrections, from Z.ai's independent adversarial audit (both
verified true by direct source inspection before accepting):**

1. The v1/v2 claim that provider-asset string `"TON"` is confined to
   `cryptopay.py` alone was **incomplete**. Confirmed leaks:
   `services/miniapp_duels.py` (`create_duel_entrypoint()` hardcodes
   `asset: Any = "TON"` as a default AND explicitly *rejects* any other
   value with `"Only TON duels are supported in this step."` -- a
   second, independent duel-creation entry point, separate from
   `handlers.py`'s bot-side flow, that STEP-110A must also update);
   `database.py`'s `_create_ledger_entry()` and the `balance_reservations`
   insert both hardcode `'TON'` **directly in the INSERT statement**
   (not just as a column default); `database.py:3552`'s
   `count_waiting_games(asset: str = "TON")` (open-duel matchmaking
   search, found during verification of Z.ai's claim, not in Z.ai's
   original list); `services/wallet_links.py`'s `SUPPORTED_CHAIN = "TON"`.
2. The v1/v2 proposal `_available_balance_in_tx(conn, user_id,
   asset='GRAM')` is **unsafe as a first step** without a preceding data
   migration. Confirmed: `_create_ledger_entry()` hardcodes `'TON'` in
   every INSERT -- meaning **100% of existing ledger_entries rows have
   `asset='TON'`, not `'GRAM'`, and zero rows currently say `'GRAM'`**.
   If STEP-110A added an `asset='GRAM'` filter to balance reads without
   first running `UPDATE ledger_entries/balance_reservations/
   withdrawal_requests SET asset='GRAM' WHERE asset='TON'`, every
   existing user's balance would read as zero. Migration order is
   load-bearing: backfill UPDATE first, code filter second, never the
   reverse.

Document updated to v3 incorporating both corrections into Section 1.1,
3.4, and 6.1-6.2 (see the document's own changelog note at the top of
Section 1.1).

**v4 update:** `STEP-110A_MULTI_ASSET_TOUCHPOINT_MATRIX.md` and
`STEP-110A_SCHEMA_AND_ASSET_AWARE_BALANCE_CORE_PLAN.md` (Z.ai-authored)
have now been independently re-verified line-by-line by Claude, the
same adversarial standard as every GPT artifact in this chain. Result:
the vast majority of both documents CONFIRMED accurate by direct source
inspection (function signatures, line numbers, the SQLite
`ALTER COLUMN` limitation, the existing `duels_enabled` kill-switch
precedent). Two things came out of the re-check:

1. A methodological weakness (not a factual error): Z.ai's blueprint
   proposed `test_count_waiting_games_default_gram`, described as
   testing that the function "defaults to GRAM" -- but
   `count_waiting_games()`'s `asset` parameter is never referenced in
   its query body at all (confirmed: called exactly once in the whole
   codebase, with no argument). A test checking only the default value
   would pass trivially while giving false confidence that per-asset
   counting works. STEP-110A must add the actual `AND asset = ?` filter,
   not just change a default string.
2. A real, previously-uncaught P0-class finding, missed by both Z.ai's
   matrix and Claude's own earlier drafts: `services/ledger.py`'s
   `check_balance_consistency()` -- **actively used by
   `services/guardrails/engine.py`'s balance-integrity check** -- sums
   `ledger_entries` with no asset filter and compares against the
   GRAM-only `users.balance` cache. Once any second-asset ledger entry
   exists, this guardrail would false-positive for every user holding a
   non-GRAM balance. Sibling `verify_double_entry()` has the same
   pattern but is confirmed unused/dead code today -- lower priority,
   fix in the same pass regardless.

Both added to Section 1.3 (v4 changelog) and Section 6.2 (new item 1b).
No further Z.ai-artifact claims remain unverified as of this pass.

QA: compileall PASS; full suite 432 passed (unchanged, docs-only);
secret-pattern grep clean.

## Next active step

STEP-107D through 107G are DONE. `/admin/release-gate` reached GO after
the STEP-107D1 re-drill; STEP-107D2/D3/D4/E/G/F were non-blocking
UX/reconciliation-correctness/infra-cost fixes layered on top of that
already-GO gate, not a re-open of the verdict.

Immediate priority, in order (per operator sign-off):

```text
1. Live smoke test for STEP-107D3 (existing-invoice warning + guard
   bypass fix) and STEP-107D4 (give-up path), if not already re-checked
   after the latest deploy.
2. 12-24h Neon observation post-STEP-107F deploy, per
   docs/operations/ROLLDUEL_POST_107F_NEON_OBSERVATION_CHECKLIST.md --
   confirm the cadence split actually reduced background compute cost
   against the STEP-107E baseline (58.81 CU-hrs/~5 days).
3. STEP-109 Section 10 sign-off checklist, including the still-BLOCKED
   live CryptoBot API probe for USDT/SOL/TRX (needs real credentials;
   neither Claude, GPT, nor Z.ai's sandbox had access as of this sync).
4. Then decide: controlled soft launch (GRAM) vs starting STEP-110A
   (multi-asset). Do not start STEP-110A before GRAM soft launch is
   stable and item 3 is closed.
```

Closed by STEP-109 v4: the two Z.ai-authored companion artifacts
(`STEP-110A_MULTI_ASSET_TOUCHPOINT_MATRIX.md`,
`STEP-110A_SCHEMA_AND_ASSET_AWARE_BALANCE_CORE_PLAN.md`) were
independently re-verified by Claude. The v4 re-check added the missing
P0 `check_balance_consistency()`/guardrail false-positive risk and the
`count_waiting_games()` dead-parameter caveat to the design spec.

STEP-107D is functionally closed: live deposit, real duel settlement,
referral payout path, giveaway eligibility, withdrawal, controlled
restart, deposit-success UX, unpaid-invoice UX, and invoice/giveaway
reconciliation correctness are all live-confirmed or fixed. Recommended
next, in priority order:
1. Live smoke test for STEP-107D3 (existing-invoice warning + guard
   bypass fix) and STEP-107D4 (give-up path) per the checklists above.
2. Separate investigation STEP: measure actual Neon compute cost of the
   20-second `reconciliation_worker()` loop before considering any change
   to its cadence.
3. Decide between controlled soft launch rollout vs STEP-108A (deferred
   workspace auto-publication scheduler, see roadmap note above).
decide between (a) proceeding to a controlled soft launch per the
Launch Gate Evidence Pack phased rollout, or (b) picking up
STEP-108A (deferred workspace auto-publication scheduler, see roadmap
note above) if growth/retention work takes priority first.

---

## Historical registry below

The entries below are retained for implementation history. Older 2026-06-29 / STEP-060 references are historical and do not override the current baseline candidate above.


## Status labels

- `DONE` — implemented in current baseline or accepted artifact.
- `IN PROGRESS` — current active work.
- `PLANNED` — approved near roadmap.
- `FUTURE` — valid idea, not current roadmap.
- `ARCHIVED` — superseded.

---

## Current Live Acceptance Series — STEP-038 to STEP-061

### STEP-038 — Live Acceptance QA Runbook + Live Smoke
Status: `LIVE-SMOKE-PASS`
Mode: HEAVY
Summary: Live Telegram duel smoke accepted after source QA, screenshots/logs, and DB rows.
Evidence: `docs/knowledge/STEP_038_LIVE_ACCEPTANCE_RUNBOOK.md`, DB games #22/#23/#24, admin acceptance 7/7.

### STEP-059 / STEP-059B / STEP-059C — Duel Onboarding, Roll UX & Rematch Hardening
Status: `DONE`
Mode: HEAVY-lite
Summary: New-user language fallback, 18+ i18n, Quick Duel roll prompt to both players, rematch from history, log redaction, rematch label microfix.
Evidence: `handlers.py`, `keyboards.py`, `infra/logging.py`, `locales/en.json`, `locales/ru.json`, `docs/knowledge/STEP_059_DUEL_ONBOARDING_ROLL_UX.md`.

### STEP-DOCS-SYNC-004 — Documentation Sync to STEP059C LIVE PASS
Status: `DONE`
Mode: STANDARD
Summary: Synchronize current-state docs, new-chat handoff, readiness matrices, roadmap, registry, artifact registry, and docs audit to current canonical baseline.
Evidence: `docs/knowledge/STEP_DOCS_SYNC_004.md`, `docs/knowledge/DOCS_CONSISTENCY_AUDIT_STEP059C.md`, `handoff-current.md`.

### STEP-061 — Admin Web UI Safe Polish
Status: `DONE`
Mode: STANDARD
Risk Score: `6/12`
Summary: Accepted one-file admin UI polish for `routes/admin_ui.py`: CSS/status tokens, cards/badges, table wrapping, focus states, mobile touch targets, flash variants, sidebar icons via render layer, and RU admin output polish. No backend, auth, settlement, withdrawal, payment, guardrail logic, or DB changes.
Evidence: `docs/knowledge/STEP_061_ADMIN_UI_SAFE_POLISH.md`, `routes/admin_ui.py`, QA: `compileall PASS`, `tests/test_admin_ops_polish_053.py 5 passed`, available regression subset `116 passed`.

### STEP-061D — Documentation Sync for STEP-061 Admin UI Safe Polish
Status: `DONE`
Mode: FAST/STANDARD docs-only
Risk Score: `3/12`
Summary: Synchronized repo docs after accepted STEP-061: current state, new-chat handoff, STEP/artifact registries, readiness matrix, roadmap, admin UI style guide, and handoff-current.
Evidence: `docs/knowledge/STEP_061D_DOCS_SYNC.md`.


### STEP-TGADMIN-001R — Admin Reference Adoption for Roll Duel TG Admin
Status: `DONE`
Mode: STANDARD docs-only
Risk Score: `4/12`
Summary: Reviewed reusable admin/operator-layer materials and adapted them to Roll Duel. Defines TG Admin as daily mobile cockpit, Web Admin as heavy control plane, single source of truth, counters→drilldowns, read/mutation separation, and next code scope for STEP-TGADMIN-002. No code/runtime changes.
Evidence: `docs/knowledge/STEP_TGADMIN_001R_ADMIN_REFERENCE_ADOPTION.md`, `docs/admin/TG_ADMIN_OPERATOR_LAYER_BLUEPRINT_RU.md`, `docs/admin/TG_ADMIN_COCKPIT_V2_SCOPE_RU.md`, `docs/operations/TG_ADMIN_DAILY_OPS_RUNBOOK_RU.md`.

### STEP-TGADMIN-002 — Telegram Admin Daily Cockpit Navigation Polish
Status: `PLANNED`
Mode: STANDARD
Risk Score: `7/12`
Goal: Reorganize existing TG admin navigation into compact daily cockpit, preserve allowlist guards and Web Admin deep links, improve read-only entrypoints and Russian operator copy.
Non-goals: payout/settlement/payment execution, DB migrations, broad rewrite, bot-only state, destructive TG admin actions.


### STEP-RUNTIME-SCHEDULER-065 — Timer Restore Throughput Hardening
Status: `DONE`
Mode: HEAVY / runtime scheduler
Risk Score: `9/12`
Summary: Overdue active games restored after restart are scheduled through APScheduler date jobs with bounded stagger instead of sequential inline `await handle_timeout(...)`, preventing startup blocking and DB/Telegram storm.
Evidence: `handlers.py`, `tests/test_runtime_scheduler_065.py`, `docs/knowledge/STEP_RUNTIME_SCHEDULER_065_TIMER_RESTORE.md`.


### STEP-TGADMIN-UX-066 — Telegram Admin UX Polish
Status: `DONE`
Mode: STANDARD
Risk Score: `3/12`
Summary: Narrow TG Admin readability/mobile polish: Risk Queue list limit `25`, count indicator and overflow hint, Duels stuck sample RU label/count indicator, and RU refresh button copy on TG Admin surfaces. No money, settlement, ledger, auth, DB schema, scheduler, callback routing, or Web Admin behavior changed.
Evidence: `handlers.py`, `admin/read_models.py`, `tests/test_tgadmin_ux_066.py`, `docs/knowledge/STEP_TGADMIN_UX_066_TELEGRAM_ADMIN_UX_POLISH.md`.

### STEP-060 — Pre-Launch Secret Rotation & Final Release Handoff
Status: `DONE` (confirmed by operator 2026-07-06 -- this entry sat stale
at `NEXT` for an extended period, resurfacing as a false "P1 blocker" in
a later STEP-109 audit chain document before being traced back here and
closed at the source; see STEP-109's registry entry above for the full
resurfacing/correction history)
Mode: HEAVY / security-ops
Goal: Rotate Telegram Bot Token, update Railway env, redeploy, verify `/start`, webhook, one callback, `/admin/acceptance 7/7`, and clean logs.
Non-goals: feature work, settlement changes, ledger changes, payout changes, migrations.

## Production Confidence Series

### STEP-PROD-CONFIDENCE-001 — TON Connect Boundary
Status: `DONE`
Mode: HEAVY
Summary: Separate public payload from server-only session/private key material.
Evidence: `services/ton_connect.py`, tests.
Live status: manual verification required.

### STEP-PROD-CONFIDENCE-002 — Jetton Trust Boundary
Status: `DONE`
Mode: HEAVY
Summary: External Jetton webhook path must not trust arbitrary `user_id`; resolve through linked wallet.
Evidence: `services/jetton_deposits.py`, `routes/jetton_webhook.py`, tests.
Live status: manual verification required.

### STEP-PROD-CONFIDENCE-003 — Commit/Reveal Honesty
Status: `DONE`
Mode: HEAVY
Summary: Add deterministic roll contract and avoid false user-facing verifiable-randomness claims.
Evidence: `game_logic.py`, tests.
Live status: manual verification required.

### STEP-PROD-CONFIDENCE-004 — Money/Security Contract Tests
Status: `DONE`
Mode: HEAVY
Summary: Add pytest contract tests for security boundaries and deterministic roll behavior.
Evidence: `pytest.ini`, `tests/test_security_contracts.py`.
Verified: source-level pytest smoke only.

### STEP-PROD-SMOKE-005 — Live Production Smoke
Status: `PLANNED`
Mode: HEAVY
Goal: `/start -> wallet connect -> deposit -> create duel -> join -> roll -> settle -> ledger -> withdraw -> reconciliation`.
Exit criteria: live smoke report with verified/not-verified matrix.

### STEP-OBSERVABILITY-006 — Runtime Observability
Status: `PLANNED`
Mode: STANDARD/HEAVY depending on scope
Goal: add practical metrics/alerts for deposits, withdrawals, games, webhook failures, DB availability, and reconciliation.

## Product / PvP Roadmap

### STEP-QUICK-DUEL-V2-007 — DB-First Quick Duel v2
Status: `PLANNED`
Mode: HEAVY
Goal: improve time-to-fun with DB-first PvP-only matching, stake buckets, better searching UX.
Non-goals: Redis pools, bot opponent, house liquidity.

### STEP-TIMEOUT-REFUND-008 — Auto-timeout + Ledger Refund
Status: `PLANNED`
Mode: HEAVY
Goal: expire waiting duels safely and refund through ledger/reservation idempotent paths.

### STEP-PRIVATE-DUELS-009 — Invite-Based Private Duels
Status: `PLANNED`
Mode: HEAVY
Goal: private duel invite flow with authorization, expiry, and refund.

### STEP-REMATCH-010 — Instant Rematch
Status: `PLANNED`
Mode: HEAVY
Goal: same-player same-stake rematch with anti-farm and chain limits.

### STEP-RANKED-ELO-011 — ELO / Ranked Mode
Status: `FUTURE`
Mode: STANDARD/HEAVY
Goal: ranking and seasonal progression after real duel volume exists.

### STEP-REDIS-POOLS-012 — Redis Matchmaking Pools
Status: `FUTURE`
Mode: HEAVY
Goal: Redis-backed queues/locks when DB-first matching is insufficient.

### STEP-LIQUIDITY-ENGINE-013 — Liquidity Assist
Status: `FUTURE`
Mode: HEAVY
Goal: research only until product traction, risk controls, and legal/economic framing are stronger.

### STEP-MINIAPP-014 — Mini App Expansion
Status: `FUTURE`
Mode: STANDARD/HEAVY
Goal: web app expansion after bot-first loop is production-proven.

## Documentation / Knowledge Series

### STEP-KNOWLEDGE-001 — Knowledge Registry Bootstrap
Status: `DONE`
Mode: STANDARD
Goal: create Project Knowledge System registries and first Architecture Bible scaffold.
Artifacts: docs-only hotfix/full zip.

### STEP-KNOWLEDGE-002 — Deduplication + Truth Validation
Status: `PLANNED`
Mode: STANDARD
Goal: review old docs, mark superseded notes, and align registry with repo reality.

### STEP-BIBLE-001 — Architecture Bible v1 Content Expansion
Status: `PLANNED`
Mode: STANDARD
Goal: expand Bible sections from validated registries.

### STEP-BIBLE-002 — Living Documentation Integration
Status: `FUTURE`
Mode: STANDARD/HEAVY
Goal: connect STEP/Audit/ADR updates into a repeatable update protocol.


## Knowledge / Documentation Series

### STEP-KNOWLEDGE-001 — Project Knowledge System Bootstrap
Status: `DONE`
Mode: STANDARD
Summary: Added initial registries and Architecture Bible scaffold.
Evidence: `docs/knowledge/*`, `docs/architecture_bible/*`, `docs/diagrams/*`.

### STEP-KNOWLEDGE-002 — Truth Validation & Documentation Dedup
Status: `DONE`
Mode: STANDARD
Summary: Added validation matrix, deduplication plan, and Architecture Bible generation plan.
Evidence: `docs/knowledge/VALIDATION_MATRIX.md`, `docs/knowledge/DOCS_DEDUPLICATION_PLAN.md`, `docs/knowledge/BIBLE_GENERATION_PLAN.md`.

### STEP-BIBLE-001 — Architecture Bible Expansion
Status: `DONE`
Mode: STANDARD
Summary: Expanded Architecture Bible and added Production Readiness Matrix, roadmap view, governance/release process, and disaster recovery runbook.
Evidence: `docs/architecture_bible/ROLL_DUEL_ARCHITECTURE_BIBLE_V1.md`, `PRODUCTION_READINESS_MATRIX.md`, `ROADMAP_NOW_NEXT_LATER.md`, `GOVERNANCE_AND_RELEASE_PROCESS.md`, `DISASTER_RECOVERY_RUNBOOK.md`.

### STEP-BIBLE-002 — Living Documentation Integration
Status: `PLANNED`
Mode: STANDARD
Goal: Add repeatable update protocol/templates so STEP/Audit/ADR/Readiness updates stay synchronized after each future implementation.


## STEP-PRE-SMOKE-CLEANUP-001 — Pre-Smoke Audit Cleanup

Status: DONE.
Mode: STANDARD.
Risk: R3.
Scope: migration duplicate cleanup, jetton balances, admin cache scoping, docker-compose env hygiene, schema snapshot labeling.
Next gate: STEP-PROD-SMOKE-005.

## STEP-DOCS-SYNC-003 — Documentation Baseline Sync

Status: DONE.
Mode: STANDARD.
Risk: R2.
Scope: synchronize Knowledge Registry / Architecture Bible after Claude P0 fixes, manifest sync, and pre-smoke cleanup.

Source-confirmed updates:
- TON proof verification fix documented.
- TON Connect manifest fixes documented.
- Static manifest sync carried forward.
- Dynamic platform fee display documented.
- Pinned requirements documented.
- Pre-smoke cleanup facts documented.

Current runtime gate: STEP-PROD-SMOKE-005.

## STEP-PRODUCTION-GUARDRAILS-007 — Production Guardrails

Status: PLANNED.
Mode: HEAVY.
Goal: add runtime safety checks for ledger mismatch, payout anomalies, duplicate settlement, invalid webhook spikes, TON API degradation, and suspicious duel patterns.
Gate: after STEP-OBSERVABILITY-006.

## STEP-BIGINT-AUDIT-008 — Telegram ID Type Audit

Status: PLANNED.
Mode: STANDARD/HEAVY depending on migration scope.
Goal: verify all PostgreSQL-created Telegram ID columns use BIGINT where applicable.
Non-goal: broad schema rewrite without concrete mismatch evidence.

## STEP-TRANSACTION-AUDIT-009 — Atomicity Audit

Status: PLANNED.
Mode: HEAVY.
Goal: audit tournament payouts, giveaway draw, settlement, withdrawal and bulk payout flows for multi-write operations outside a transaction boundary.
Non-goal: broad refactor before confirmed gaps are identified.

## STEP-LAUNCH-GOVERNANCE-001 — Launch Readiness Matrix

Status: DONE.
Mode: STANDARD.
Risk: R2.
Scope: documentation/governance plus STEP-007-C1 admin safety confirm hotfix.
Summary: Added `LAUNCH_READINESS_MATRIX.md` with Engineering, Operations, Product, and Business readiness axes; updated Truth Boundary to source-confirmed Soft Launch Ready and not Production Ready.
Evidence: `docs/architecture_bible/LAUNCH_READINESS_MATRIX.md`, `services/guardrails/admin_safety.py`.
Next gate: `STEP-PROD-SMOKE-005` and Soft Launch Operations.


## STEP-GRAM-BRANDING-001 — GRAM display branding

Status: source-confirmed
Mode: STANDARD
Scope: user-facing display/docs only

Summary:
- User-facing balances, stakes, winnings, deposits, and withdrawals now use `GRAM`.
- Network, wallet, TON Connect, TON API, and internal technical names remain `TON`.
- `docs/GRAM_BRANDING_GUIDE.md` is the source of truth for naming.

Truth boundary:
- Source-confirmed: display/docs terminology updated.
- Not changed: DB columns, ledger internals, function names, external API contracts.

---

## Recent Product / UX / Docs Series — 2026-06-26

### STEP-008A — Private Duel UX + Instant Rematch
Status: `SOURCE-CONFIRMED`
Mode: STANDARD
Scope: product UX/game flow surface.
Summary: Exposed Challenge Friend / Private Duel and added Rematch UX. Corrected callback design so rematch derives opponent and bet amount from DB game data, not callback payload.
Evidence: `handlers.py`, `keyboards.py`, recent handoff.
Live: user-applied in current baseline; full production traffic not yet verified.

### STEP-008A1 — Telegram Share URL Fix
Status: `SOURCE-CONFIRMED`
Mode: FAST
Scope: share URL encoding.
Summary: Telegram share URLs now encode deep link parameters correctly.
Evidence: `handlers.py`.

### STEP-008A2 — Keyboard i18n Consistency
Status: `SOURCE-CONFIRMED / LIVE-REPORTED`
Mode: STANDARD
Scope: keyboard helper API contracts.
Summary: Fixed `get_waiting_games_keyboard(..., t=t)` signature drift. Contract scan found no missing `t` keyboard helper contracts after patch.
Evidence: `keyboards.py`.
Live: user reported `Find Duel / Найти дуэль` works after applying.

### STEP-008A3 — i18n UI Consistency
Status: `SOURCE-CONFIRMED`
Mode: STANDARD
Scope: RU/EN locale coverage for new game flows.
Summary: Added missing EN/RU locale keys for Challenge Friend, Rematch, Private Duel, Find Duel, share/cancel/back flows.
Evidence: `locales/en.json`, `locales/ru.json`, `handlers.py`, `keyboards.py`.

### STEP-008A4 — Human i18n Polish
Status: `SOURCE-CONFIRMED`
Mode: STANDARD
Scope: human-readable user-facing copy.
Summary: Improved Quick Duel, Private Duel, bet selection, and related text to sound more natural and less technical.
Evidence: `locales/en.json`, `locales/ru.json`, `handlers.py`, `keyboards.py`.

### STEP-008B — Player Identity & Progression
Status: `SOURCE-CONFIRMED / SCREENSHOT-REVIEWED`
Mode: STANDARD
Scope: profile display only.
Summary: Replaced user-facing `ELO` terminology with `Player rating / Игровой рейтинг`, added display leagues and next-league copy without changing DB or rating calculation.
Evidence: `handlers.py`, `locales/en.json`, `locales/ru.json`.
Live: user screenshot reviewed; profile appears improved.

### STEP-008C — Live Matchmaking UX
Status: `SOURCE-CONFIRMED`
Mode: STANDARD
Scope: Find Duel / matchmaking screen display only.
Summary: Added live summary, empty state, and CTA buttons for Quick Duel, Challenge Friend, refresh, and main menu. No matchmaking algorithm or money logic changes.
Evidence: `handlers.py`, `keyboards.py`, `locales/en.json`, `locales/ru.json`.

### STEP-GRAM-BRANDING-001 — GRAM Display Branding
Status: `SOURCE-CONFIRMED`
Mode: STANDARD
Scope: display/docs terminology only.
Summary: User-facing balances, stakes, winnings, deposits, and withdrawals now display as GRAM; network/wallet/TON Connect/API remain TON. Internal names are intentionally unchanged.
Evidence: `docs/GRAM_BRANDING_GUIDE.md`, `locales/en.json`, `locales/ru.json`, `handlers.py`, `keyboards.py`.

### RD-CANON-001 — Product & Platform Canon
Status: `SOURCE-CONFIRMED / DOCS-PACKAGED`
Mode: HEAVY docs
Scope: product/architecture/operations/roadmap docs.
Summary: Added canonical product docs defining PvP-only boundary, matchmaking pools vs liquidity pools, anti-patterns, future research boundaries, and platform evolution.
Evidence: `docs/00_PROJECT_CANON/*`, `docs/product/*`, `docs/architecture/*`, `docs/operations/*`, `docs/roadmap/*`.

### STEP-DOCS-HANDOFF-SYNC-004 — Current Handoff Sync
Status: `DONE`
Mode: STANDARD
Scope: docs-only.
Summary: Added current AI handoff entrypoint and recent STEP handoff summary so another AI can understand what was completed in this track.
Evidence: `docs/AI_CONTEXT_START_HERE.md`, `docs/knowledge/RECENT_STEP_HANDOFF_2026-06-26.md`, updated `handoff-current.md`.
- `STEP-008E-DEMO-MODE-ADMIN-TOGGLE` — added `demo_mode_enabled` operator toggle, entry guards, migration 031, docs handoff.

### STEP-ADMIN-OPS-UX-010 — Operator Admin UX Polish
Status: `SOURCE-CONFIRMED`
Mode: STANDARD
Scope: admin UI wording/explanations only.
Summary: `/admin/guardrails` and `/admin/failed` were rewritten into operator-friendly Russian with clear guidance for payment recovery, runtime jobs, kill switches, and circuit breakers. No money logic, ledger logic, or recovery semantics changed.
Evidence: `routes/admin_ui.py`, `docs/knowledge/STEP_ADMIN_OPS_UX_010.md`.


### STEP-ADMIN-OPS-011 — Operator Experience Layer
Status: `SOURCE-CONFIRMED / ARTIFACT-PREPARED`
Mode: STANDARD
Scope: admin UI operator explanations + docs only.
Summary: Added a reusable operator status panel and upgraded Runtime, Monitoring, Guardrails, Recovery Center, Platform Settings, and Ambassadors pages toward a three-question operator model: what is happening, is it normal, what should I do. Added admin operator docs and recovery playbooks. No backend money/runtime semantics changed.
Evidence: `routes/admin_ui.py`, `docs/admin/*`, `docs/knowledge/STEP_ADMIN_OPS_011.md`.


## STEP-REAL-DUEL-ZERO-BET-ACTIVE-LOCK-FIX-014

- Status: artifact prepared; live smoke pending.
- Scope: zero-stake private duel guard, active-duel lock UX, private accept roll flow, datetime restore hardening.
- Changed files: handlers.py, services/private_duels.py, services/games.py, keyboards.py, locales/en.json, locales/ru.json, docs/knowledge/STEP_REAL_DUEL_ZERO_BET_ACTIVE_LOCK_FIX_014.md.

### STEP-DUEL-FLOW-015 — Full Duel Lifecycle QA/Fix
Status: `SOURCE-CONFIRMED / AUTOMATED-SMOKE-PASS / LIVE-SMOKE-PENDING`
Mode: HEAVY
Scope: real duel lifecycle, timeout/reconciliation recovery, active unlock UX, real-duel i18n, state-machine QA supplement.
Summary: Reconciles both-roll active duels from timeout/runtime jobs instead of retrying forever; improves settlement failure recovery text; localizes real-duel status and roll confirmation; fixes bad real-duel log references. Source QA supplement adds 21 automated state-machine smoke tests and a manual Telegram live QA checklist. This does not claim production-ready until live money/game evidence is captured.
Evidence: `handlers.py`, `services/games.py`, `locales/en.json`, `locales/ru.json`, `tests/test_duel_flow_015.py`, `docs/knowledge/STEP_DUEL_FLOW_015.md`, `docs/knowledge/STEP_DUEL_FLOW_015_QA.md`.

### STEP-038 — Live Acceptance QA Pack
Status: `RUNBOOK-PREPARED / LIVE-EVIDENCE-PENDING`
Mode: STANDARD for callback/RU QA; HEAVY for live money/game state-machine evidence.
Scope: manual Telegram verification of STEP-037 callbacks/RU screens plus STEP-DUEL-FLOW-015 two-user duel smoke, admin guardrails, runtime jobs, and evidence capture.
Summary: Adds operator runbook for exactly what to click, which screenshots/logs/DB rows to capture, and how to report live results back without exposing secrets. No code or money semantics changed.
Evidence: `docs/knowledge/STEP_038_LIVE_ACCEPTANCE_RUNBOOK.md`.


### STEP-020 — Ledger Audit
Status: `SOURCE-AUDITED / HOTFIX-PREPARED / LIVE-DB-VERIFICATION-PENDING`
Mode: HEAVY
Scope: ledger schema alignment, mission reward meta serialization, money-path audit.
Summary: Audited D28 ledger/balance/reservation flows and found verified entry_type schema drift: withdrawal, mission, and referral reward code used ledger entry types not allowed by earlier CHECK constraints. Added migration 032 and aligned fresh bootstrap schema. Fixed mission `meta_json` serialization.
Evidence: `database.py`, `services/missions.py`, `storage/migrations/032_ledger_entry_type_alignment.sql`, `docs/knowledge/STEP_LEDGER_AUDIT_020.md`.

### STEP-REMATCH-PRIVATE-FLOW-022 — Private/rematch join UX + stake consistency
Status: `ARTIFACT_PREPARED`
Mode: HEAVY-lite
Summary: Fixes private/rematch accepted screen showing `0.00 GRAM` by returning `bet_amount` from `join_private_game`; mirrors public join UX by notifying challenger with dice keyboard after invite acceptance.
Evidence: `services/private_duels.py`, `handlers.py`, `docs/knowledge/STEP_REMATCH_PRIVATE_FLOW_022.md`.
Live status: pending smoke with two Telegram accounts.

## STEP-DUEL-FLOW-032 — Duel / Share / Chat Publishing Polish
- Status: artifact prepared; live smoke pending.
- Scope: workspace/chat publishing i18n, result share UX, GRAM display in group posts, STEP-031 referral/invite carry-forward.
- Critical invariant: no money/ledger/settlement logic changed.

- STEP-034 — Production Acceptance & UX Completion — UX/i18n hotfix for invite/support/workspace/active-duel surfaces.

### STEP-DOCS-RU-002 — Operator Documentation Language Layer
Status: `DONE`
Mode: FAST
Scope: docs-only language governance and RU operator documentation. No code/runtime/money-path changes.
Summary: Added Russian documentation language policy, Russian operator documentation index, Russian matchmaking roadmap summary, and rewrote operator-facing admin/operations/QA docs into Russian while preserving technical identifiers in English.
Evidence: `docs/DOCS_LANGUAGE_POLICY_RU.md`, `docs/OPERATOR_DOCS_INDEX_RU.md`, `docs/product/RD-MATCH-RU-000_OPERATOR_SUMMARY.md`, `docs/admin/*`, `docs/operations/*`, `docs/knowledge/STEP_DUEL_FLOW_015_QA.md`, `docs/README.md`, `docs/product/README.md`.

### STEP-039 — Live QA Findings Hotfix: Giveaway Join + RU Polish
Status: `SOURCE-CONFIRMED / HOTFIX-PREPARED / LIVE-RETEST-PENDING`
Mode: STANDARD
Scope: public giveaway participation DB insert, RU/i18n polish, support operator copy. No payment, settlement, ledger, payout, refund, or reservation internals changed.
Summary: Fixed live-confirmed public giveaway join failure caused by inserting `NULL` into `giveaway_entries.is_eligible` despite NOT NULL constraint. Added regression tests, localized invite card/share copy, random duel flavor lines, support operator copy, and giveaway edit-session errors. Added `gw_edit_starts` handling so start-time input no longer falls into the expired-session branch.
Evidence: `services/giveaways.py`, `handlers.py`, `keyboards.py`, `game_logic.py`, `locales/en.json`, `locales/ru.json`, `tests/test_giveaway_join_039.py`, `docs/knowledge/STEP_039_LIVE_QA_FINDINGS_HOTFIX.md`.
Live status: retest pending — verify `🎁 Участвовать` creates entry and owner screen shows `Заявок: 1 / Допущено: 1`.

### STEP-040 — Giveaway Draw Finalization & New Draft Recovery Hotfix
Status: `SOURCE-CONFIRMED / HOTFIX-PREPARED / LIVE-RETEST-PENDING`
Mode: STANDARD
Scope: giveaway draw transaction, empty giveaway finalization, new draft recovery UX. No payment, settlement, ledger, payout, refund, or reservation internals changed.
Summary: Fixed Postgres draw transaction abort by removing unsafe transaction-isolation command after advisory lock. Empty ended giveaways now finalize to `WINNERS_DRAWN` with no winners instead of throwing, and terminal giveaway screens expose `🎁 Create new giveaway`. Added regression tests.
Evidence: `services/giveaways.py`, `handlers.py`, `keyboards.py`, `locales/en.json`, `locales/ru.json`, `tests/test_giveaway_draw_040.py`, `docs/knowledge/STEP_040_GIVEAWAY_DRAW_RECOVERY.md`.
Live status: retest pending — verify ended empty giveaway draws without `InFailedSqlTransaction`, status becomes `WINNERS_DRAWN`, and new draft can be created.

### STEP-041 — Giveaway Participation Confirmation + Start/Deadline UX
Status: `SOURCE-CONFIRMED / HOTFIX-PREPARED / LIVE-RETEST-PENDING`
Mode: STANDARD
Scope: giveaway public join feedback, public-post refresh attempt, start/deadline quick presets, RU error copy. No payment, settlement, ledger, payout, refund, or reservation internals changed.
Summary: Adds visible success/already-joined feedback for `🎁 Участвовать`, logs giveaway join outcomes, attempts non-blocking public post refresh after join, adds start/deadline quick preset buttons, supports clearing `starts_at` back to immediate, and localizes invalid start/deadline window errors.
Evidence: `handlers.py`, `keyboards.py`, `services/giveaways.py`, `locales/en.json`, `locales/ru.json`, `tests/test_giveaway_start_ux_041.py`, `docs/knowledge/STEP_041_GIVEAWAY_PARTICIPATION_START_UX.md`.
Live status: retest pending — verify visible join feedback, owner stats update, public post participant count refresh, and start/deadline preset UX.

### STEP-043 — Giveaway Final UX & Callback Closure
Status: `SOURCE-CONFIRMED / HOTFIX-PREPARED / LIVE-RETEST-PENDING`
Mode: STANDARD
Scope: giveaway public post RU/default state, sponsor/check callback closure, participant-facing public result keyboard, main menu giveaway label. No payment, settlement, ledger, payout, refund, or reservation internals changed.
Summary: Public giveaway posts/results now use RU translator by default; pending-start posts say the giveaway has not started and use `⏳ Ещё не начался`; active posts use `🎁 Участвовать`. `handlers.py` imports `database` module to close sponsor/check `NameError` callbacks. Public results expose only `🎲 Открыть Roll Duel`, while owner-only `🎁 Новый розыгрыш`/`⬅️ Назад к группе` remain inside owner bot screens. Hardcoded `Private Giveaways` was replaced with i18n label.
Evidence: `handlers.py`, `keyboards.py`, `locales/en.json`, `locales/ru.json`, `tests/test_giveaway_final_ux_043.py`, `docs/knowledge/STEP_043_GIVEAWAY_FINAL_UX_CALLBACK_CLOSURE.md`.
Live status: retest pending — verify public RU post, pending-start state, sponsor add, check eligibility, public result button, and main-menu private giveaways label.


## STEP-044 — Giveaway Navigation & Lifecycle Clarity
Status: SOURCE-CONFIRMED / LIVE-QA-PENDING. Added giveaway dashboard, history, clearer lifecycle copy, and removed ambiguous main-menu private giveaway counter.

## STEP-045 — Webhook DB Pool Resilience + Giveaway Scheduler Decoupling
Status: SOURCE-CONFIRMED / HOTFIX-PREPARED / LIVE-RETEST-PENDING. Fixed live log-confirmed webhook PoolTimeout by moving Telegram update dedupe to memory-first mode; decoupled giveaway scheduled activation/auto-draw from long DB transactions; removed invalid auto-draw PROCESSING state before draw. No payment, settlement, ledger, payout, refund, or duel reservation logic changed.

## STEP-046 — Neon Launch Runtime Documentation
Status: DOCS-ONLY / READY. Documented Neon Launch paid-plan decision, STEP-045 deployment recommendation, memory-first update dedupe env, scheduler truth boundary, and future pool-tuning gate. No code/runtime changes.

## STEP-047 — Giveaway Dashboard Routing Repair
Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING. Fixed live-confirmed `NameError: get_giveaway_dashboard_keyboard is not defined` that prevented `🎁 Управление розыгрышами` from opening the STEP-044 dashboard. No payment, ledger, settlement, payout, refund, or reservation logic changed.

## STEP-048 — Giveaway Final UX Polish & Acceptance
Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING. Final Giveaway UX polish: visible first-join group notice, history pagination, clearer My Groups navigation, owner detail field labels, and scheduled activation copy. No payment, ledger, settlement, payout, refund, or reservation logic changed.
## STEP-049 — Final Bot UX Polish: Menus / History / Public Cards
Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING. Final navigation and public-card polish: removed duplicate Quick Duel button, separated participant `🎁 Розыгрыши` from operator `🛠 Розыгрыши групп`, paired My Groups keyboard rows, added giveaway history filters while hiding empty cancelled drafts by default, improved owner detail visual blocks, and polished public leaderboard/champion cards. No payment, ledger, settlement, payout, refund, or reservation logic changed.


## STEP-050 — Giveaway History Callback Limit Repair
Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING. Fixed live-confirmed `Button_data_invalid` on Giveaway history by replacing long filter/page callbacks with short `gh_` callbacks and keeping legacy `giveaway_history_` handler support. No payment, ledger, settlement, payout, refund, or reservation logic changed.

## STEP-051 — RU Copy Polish: Share Duel + Leaderboard Buttons
Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING. Fixed final RU/i18n gaps found in live QA: `📨 Поделиться дуэлью` no-active/active share copy and `🌐 Глобальный лидерборд` scope buttons now use locale keys instead of hardcoded English. No payment, ledger, settlement, payout, refund, or reservation internals changed.

## STEP-052 — Leaderboard RU Callback Repair
- Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING.
- Mode: FAST.
- Scope: final leaderboard RU/i18n polish only.
- Changes:
  - Passed the current translator into `get_leaderboard_keyboard(...)` from leaderboard handlers.
  - Made leaderboard rows i18n-aware via `leaderboard.row.standard` and `leaderboard.row.elo`.
  - Prevented English workspace service note from overriding RU `leaderboard.workspace_note`.
  - Added regression test `tests/test_leaderboard_ru_callbacks_052.py`.
- No payment, ledger, settlement, payout, refund, or reservation internals changed.

## STEP-053 — Admin Console Ops Polish & Acceptance Readiness
- Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING.
- Mode: HEAVY by admin/guardrails critical-zone override.
- Scope: admin UI/ops readability, launch-readiness summaries, acceptance evidence page, live failed-item counts, runtime guidance.
- Changes:
  - Added `/admin/acceptance` read-only evidence checklist for STEP-038 / soft-launch readiness.
  - Added launch-readiness panel to overview, guardrails, runtime, failed items, observability and acceptance pages.
  - Replaced hardcoded demo counts in `failed_items_snapshot()` with live read-only DB counts.
  - Improved runtime switch guidance and safe-fallback warning copy.
  - Added regression test `tests/test_admin_ops_polish_053.py`.
- No payment, ledger, duel settlement, payout execution, auth, DB schema, or guardrail engine semantics changed.
- Live retest pending: `/admin`, `/admin/acceptance`, `/admin/guardrails`, `/admin/runtime`, `/admin/failed`, `/admin/observability`, `/admin/audit`.

## STEP-054 — Admin Operator Cockpit & Runtime Job Hygiene
- Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING.
- Mode: HEAVY by admin/runtime/recovery critical-zone override.
- Scope: admin operator UX, runtime job hygiene actions, guardrails/runtime cockpit presentation, audit filters.
- Changes:
  - Added audit-safe runtime job lifecycle actions: retry, mark stale, cancel.
  - No hard delete: stale/cancel keeps history and writes `operator_actions`.
  - Excluded `completed/cancelled/stale` runtime jobs from active failed-job counts.
  - Reworked `/admin/failed` runtime jobs into action cards with recommendation, reason and confirmation.
  - Reworked `/admin/runtime` switches into operator cockpit cards explaining impact, use case and post-check.
  - Reworked `/admin/guardrails` protection controls into clearer cards for withdrawals, deposits and treasury mode.
  - Localized `/admin/acceptance` checklist labels and added audit filters.
- No payment execution, ledger math, duel settlement, payout execution, auth, DB schema, or guardrail engine semantics changed.
- Live retest pending: `/admin/failed?tab=jobs`, `/admin/audit?type=runtime`, `/admin/runtime`, `/admin/guardrails`, `/admin/acceptance`.

## STEP-055 — Admin Layout Crash Fix
- Status: SOURCE-CONFIRMED / HOTFIX-PREPARED / LIVE-RETEST-PENDING.
- Mode: HEAVY by admin UI runtime critical-zone override.
- Root cause: STEP-054 added new CSS inside the `_layout(...)` Python f-string using single braces, so runtime evaluated `{ display:grid; ... }` as Python and crashed with `NameError: name 'display' is not defined`.
- Fix: escaped STEP-054 CSS blocks with double braces and added `tests/test_admin_layout_runtime_055.py` to render `_layout(...)` under `ADMIN_CSRF_SECRET`.
- No payment execution, ledger math, duel settlement, payout execution, auth, DB schema, guardrail engine semantics, or runtime job lifecycle semantics changed.
- Live retest pending: `/admin/`, `/admin/acceptance`, `/admin/guardrails`, `/admin/runtime`, `/admin/failed`, `/admin/observability`, `/admin/audit`.

## STEP-056 — Admin Acceptance Cleanup: Settings Repair + Audit Taxonomy
- Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING.
- Mode: HEAVY by admin/runtime/settings/evidence override.
- Scope: safe repair for malformed `guard.admin.blocked_actions`, audit taxonomy cleanup, acceptance evidence polish.
- Changes:
  - Added `/admin/runtime` repair card for malformed `guard.admin.blocked_actions` warnings.
  - Repair requires reason + confirmation and writes via `settings.set_setting("guard.admin.blocked_actions", "")`, preserving audit trail.
  - Invalid guard admin blocklist warning can now be fixed without direct SQL.
  - Runtime job cleanup actions now appear in both `Recovery` and `Рантайм` audit filters.
  - Audit rows add operator-friendly labels while preserving technical action names.
  - Added regression test `tests/test_admin_acceptance_cleanup_056.py`.
- No payment execution, ledger math, duel settlement, payout execution, auth, DB schema, guardrail engine semantics, or runtime job execution semantics changed.
- Live retest pending: repair setting from `/admin/runtime`, verify `/admin/acceptance`, `/admin/audit?type=settings`, `/admin/audit?type=recovery`, `/admin/audit?type=runtime`.


## STEP-056B — Settings Repair Verification Fix
- Status: DONE
- Scope: fix false runtime warning after `guard.admin.blocked_actions` repair.
- Changed: `services/settings.py`, tests, docs.
- Verified: targeted tests added for Postgres/native JSON string scalar handling.

## STEP-057 — Admin Money Clarity & Operator UX Polish
- Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING.
- Mode: HEAVY by admin + money-adjacent visibility override.
- Scope: admin money clarity, pending deposit inspector, audit-safe stale unpaid invoice cleanup, ambassador operator cockpit UX.
- Changes:
  - Added `/admin/liabilities` pending deposit inspector for active invoices counted as pending deposits.
  - Added `mark_invoice_stale_unpaid` operator recovery action with reason + confirmation + audit trail.
  - Cleanup refuses invoices with paid payment event or deposit ledger evidence.
  - Cleanup does not mutate balances, create ledger entries, delete invoices, delete payment events, or delete runtime jobs.
  - `/admin` money snapshot now explains pending deposits as active invoices and links to liabilities details.
  - Reworked `/admin/ambassadors` into a card-based operator cockpit with summary cards, filters, user/referral links and safer bonus edit forms.
  - Reworked `/admin/liabilities` integrity tools into confirmed operator cleanup cards and added `integrity_*` audit entries.
  - Added regression test `tests/test_admin_money_clarity_057.py`.
- No payment credit logic, ledger math, duel settlement, payout execution, auth, DB schema, or guardrail engine semantics changed.
- Live retest pending: `/admin`, `/admin/liabilities`, `/admin/audit?type=money`, `/admin/audit?type=recovery`, `/admin/ambassadors`.

## STEP-057B — Ambassadors Timestamp Hotfix
- Status: SOURCE-CONFIRMED / LIVE-RETEST-PENDING.
- Mode: FAST.
- Scope: fix `/admin/ambassadors` read-only crash caused by comparing `bonus_expires_at` timestamp with empty string.
- Changes:
  - Removed `bonus_expires_at <> ''` from ambassador filters and summary count query.
  - Added regression test to prevent timestamp-to-empty-string comparisons in admin ambassador query code.
- Verified targeted QA: ambassador/money clarity test 5/5 PASS; admin acceptance targeted suite 23/23 PASS.
- No payment credit logic, ledger math, duel settlement, payout execution, referral tier calculation, ambassador write semantics, auth, DB schema, or guardrail engine semantics changed.
- Live retest pending: `/admin/ambassadors` and filters.

## STEP-058 — Admin Acceptance Evidence & Console Density Polish
- Status: SOURCE-CONFIRMED / ARTIFACT-PREPARED / LIVE-RETEST-PENDING.
- Mode: STANDARD.
- Scope: admin acceptance evidence, compact operator cockpit presentation for runtime/guardrails/observability.
- Changes:
  - Preserved `/admin/acceptance` as read-only soft-launch evidence page after user-provided `7/7` green screenshot.
  - Made `/admin/runtime` “Пульт работы” cards more compact while preserving reason + confirmation.
  - Made `/admin/guardrails` “Пульт защиты” cards more compact while preserving guardrail confirmations.
  - Grouped `/admin/observability` telemetry sections into compact `ops-grid` panels.
  - Added `tests/test_admin_acceptance_polish_058.py`.
- No money execution, ledger math, duel settlement, payout execution, auth, DB schema, runtime worker execution, or guardrail engine semantics changed.
- Verified targeted QA: `py_compile routes/admin_ui.py` PASS; STEP-058/admin layout/operator/money tests 13/13 PASS.
- Full pytest not completed because sandbox lacks `aiocryptopay`.
- Live retest pending: `/admin/acceptance`, `/admin/runtime`, `/admin/guardrails`, `/admin/observability`, `/admin/failed`, `/admin/liabilities`, `/admin/ambassadors`.

## STEP-TGADMIN-002 — Telegram Admin Daily Cockpit Navigation Polish
- Status: SOURCE-CONFIRMED / DONE.
- Mode: STANDARD.
- Risk Score: 7/12.
- Scope: TG Admin navigation/read-only cockpit only.
- Changes:
  - Switched main Telegram Admin shell to grouped daily cockpit navigation.
  - Updated fallback admin keyboard to the same cockpit shape.
  - Reworked `/admin` overview into compact operator pulse with drilldown hints.
  - Added read-only `admin_duels` surface for duel counters/stuck sample visibility.
  - Improved `admin_risk` to use `_admin_reply` edit-first behavior plus Refresh/Web Admin routing.
  - Added `tests/test_tg_admin_cockpit_002.py`.
- Explicitly unchanged: withdrawal approve/reject behavior, settlement, ledger, payment execution, withdrawal execution, auth, DB schema, migrations, guardrail logic, old FIXED v4.2 module import/copy.
- Verified QA: compileall PASS; TG admin cockpit/admin ops tests 10 passed; available regression subset excluding missing-dependency guardrail suites 121 passed.
- Full pytest not verified in GPT sandbox due missing `aiocryptopay`.
- Next admin safety step: STEP-TGADMIN-004 — Withdrawal Confirm Guard (HEAVY).

## STEP-TGADMIN-004 — Telegram Admin Withdrawal Confirm Guard
- Status: DONE.
- Mode: HEAVY.
- Risk Score: 11/12.
- Scope: Telegram Admin withdrawal approve/reject confirmation guard.
- Changes:
  - First approve/reject tap opens a read-only confirm card.
  - Existing withdrawal services execute only from compact `admin_wd_*_yes_` callbacks.
  - Legacy withdrawal callback prefixes are routed to confirmation, not direct execution.
  - Queue is reread after mutation.
  - Added static regression tests for callback routing, access guard, callback length, and no direct first-tap service call.
- Explicitly unchanged: settlement, payout engine, ledger math, withdrawal service semantics, auth, DB schema, migrations, Web Admin, TON/CryptoBot transfer logic.
- Verified QA: compileall PASS; TG admin withdrawal confirm/admin ops tests 15 passed; available regression subset excluding missing-dependency guardrail suites 126 passed.
- Full pytest not verified in GPT sandbox due missing `aiocryptopay`.

## STEP-ADMIN-AUDIT-VERIFY-001 — DeepSeek Admin Audit Claims Verification
- Status: DONE.
- Mode: STANDARD audit-only.
- Risk Score: 5/12.
- Scope: verify DeepSeek admin audit claims against current source without runtime/code changes.
- Verified:
  - TG withdrawal confirm guard is source-confirmed.
  - Duplicate mark-sent branch returns before ledger consume.
  - risk queue read model is still placeholder/hardcoded.
  - table-wrap and dynamic flash recommendations are valid micro-polish candidates.
  - repair_blocked_actions_setting lacks typed CONFIRM.
  - broad production-ready and all-audit-atomic claims are too strong.
- Changed runtime files: none.
- Next recommended implementation: STEP-ADMIN-READMODEL-001 — Risk Queue Real Read Model.


## STEP-ADMIN-READMODEL-001 — Risk Queue Real Read Model
- Status: DONE.
- Mode: STANDARD.
- Risk Score: 7/12.
- Scope: DB-backed read model for Risk Queue from `users` + `user_risk_flags`.
- Runtime changed: `admin/read_models.py`.
- Tests added: `tests/test_admin_risk_readmodel_001.py`.
- Safety boundary: read-only, no mutations, no DB schema/migrations, no money/settlement/auth changes.
- QA: compileall PASS; targeted suite 18 passed; available regression subset 129 passed.

## STEP-WEBADMIN-062 — Admin UI Micro Polish
- Status: DONE.
- Mode: FAST/STANDARD.
- Risk Score: 5/12.
- Scope: Web Admin visual/readability polish for generated tables and flash messages.
- Runtime changed: `routes/admin_ui.py`.
- Tests added: `tests/test_webadmin_micro_polish_062.py`.
- Safety boundary: no settlement, payout, ledger, auth, DB schema, migrations, withdrawal execution, risk mutation, or TG Admin behavior changes.
- QA: compileall PASS; targeted suite 8 passed; combined admin/TG/readmodel suite 21 passed; available regression subset rc=0.

## STEP-ADMIN-SAFETY-063 — Repair Confirm Hardening
- Status: DONE.
- Mode: HEAVY / admin-safety.
- Risk Score: 9/12.
- Scope: require typed `CONFIRM` for Web Admin `guard.admin.blocked_actions` repair action.
- Runtime changed: `routes/admin_ui.py`.
- Tests updated: `tests/test_admin_acceptance_cleanup_056.py`.
- Safety boundary: no settlement, payout, ledger, withdrawal execution, auth, DB schema, migrations, risk mutation actions, operator recovery, or TG Admin callbacks changed.
- QA: compileall PASS; targeted suite 13 passed; available regression subset excluding missing-dependency guardrail suites 133 passed.

## STEP-TGADMIN-SAFETY-005 — Admin Callback Sensitivity & Cache Audit
**Status:** DONE
**Mode:** STANDARD / audit-only
**Risk Score:** 6/12
**Changed runtime code:** none
**Artifacts:** callback/cache audit, sensitivity matrix, safety risk register.
**Next recommended step:** STEP-TGADMIN-SAFETY-006A — Admin Callback Routing Envelope Cleanup.

## STEP-TGADMIN-SAFETY-006A — Admin Callback Routing Envelope Cleanup
- Status: DONE.
- Mode: HEAVY / admin callback safety.
- Risk Score: 10/12.
- Scope: normalize TG Admin routing envelope and dispatcher access guard before any nonce/TTL work.
- Runtime changed: `handlers.py`.
- Tests added: `tests/test_tgadmin_safety_006a_callback_routing_envelope.py`.
- Safety boundary: no nonce/TTL, no money/settlement/ledger/auth/DB schema changes, no broad `handlers.py` refactor.
- QA: compileall PASS; targeted suite 20 passed; available regression subset PASS excluding missing-dependency guardrail suites.

### STEP-RUNTIME-SAFETY-064 — Publish Idempotency & Callback Block Path Verification
Status: `DONE`
Mode: HEAVY
Risk Score: 10/12
Summary: Closed `safe_publish_result` TOCTOU race with atomic DB claim and documented at-most-once public result publish trade-off. Verified active callback block-check path uses `is_user_blocked()` cache; unused `@require_login` was not treated as hot path.
Evidence: `handlers.py`, `tests/test_runtime_safety_064.py`, `docs/knowledge/STEP_RUNTIME_SAFETY_064_PUBLISH_IDEMPOTENCY.md`.


## STEP-TGADMIN-RU-067 — Telegram Admin Russian Cockpit Polish
- Status: DONE.
- Mode: STANDARD.
- Risk Score: 4/12.
- Scope: Russian-first TG Admin cockpit copy and navigation polish.
- Runtime changed: `handlers.py`, `keyboards.py`.
- Tests added/updated: `tests/test_tgadmin_ru_polish_067.py`, `tests/test_tg_admin_cockpit_002.py`, `tests/test_tgadmin_ux_066.py`.
- Safety boundary: no settlement, ledger, payout, withdrawal execution, auth, DB schema/migrations, scheduler, routing envelope, or Web Admin route changes.
- QA: compileall PASS; targeted TG/runtime/admin suite 42 passed; available regression subset 156 passed.


## STEP-TGADMIN-COPY-067B — Final TG/Admin Copy Cleanup
- Status: DONE.
- Mode: FAST/STANDARD.
- Risk Score: 2/12.
- Scope: final Russian TG Admin button/copy cleanup and approved RU/EN user-facing main menu text.
- Runtime changed: `handlers.py`, `locales/en.json`, `locales/ru.json`.
- Tests added: `tests/test_tgadmin_copy_067b.py`.
- Safety boundary: no money, settlement, ledger, payout, auth, DB schema/migrations, scheduler, Web Admin, or admin routing behavior changed.
- QA: compileall PASS; targeted TG/runtime/admin suite 46 passed; available regression subset 164 passed; locale parity 953/953.

## STEP-SHARE-RESULT-INLINE-FIX-001 — Telegram-Native Result Share
- Status: LIVE APPLIED / OPERATOR CONFIRMED.
- Mode: STANDARD.
- Risk Score: 3/12.
- Baseline: `RollDuel_BASELINE_2026-07.8.zip`.
- Scope: replace result share `t.me/share/url` button with `switch_inline_query`; route `result_`, `duel_`, and existing invite inline queries.
- Runtime changed: `keyboards.py`, `handlers.py`.
- Tests added: `tests/test_share_result_inline_fix_001.py`.
- Safety boundary: no settlement, ledger, payments, withdrawals, balances, migrations, asset flags, or STEP-110R1 money-core changes.
- QA: compileall PASS; targeted 5/5; related 33/33; full repository regression 808/808 across 106 files.
- Live verification: operator confirmed deployed behavior works after Railway apply.


## STEP-WITHDRAWAL-PROVIDER-MINIMUM-AND-TERMINAL-ERROR-001 — CryptoBot Provider Floor & Terminal Retry Stop
- Status: LIVE APPLIED / OPERATOR CONFIRMED.
- Mode: HEAVY / R4.
- Risk Score: 8/12.
- Baseline: `RollDuel_BASELINE_2026-07.8.1_STEP_SHARE_RESULT_INLINE_FIX_001_RELEASE_CANDIDATE.zip`.
- Incident: a 0.5 GRAM withdrawal passed the operator-configured minimum but CryptoBot returned `AMOUNT_TOO_SMALL`; the error was treated as retryable and produced repeated provider calls/audit rows.
- Runtime changed: `services/reconciliation.py`, `services/withdrawals.py`, `handlers.py`, `routes/admin_ui.py`.
- Tests added: `tests/test_withdrawal_provider_minimum_terminal_error_001.py`.
- Resolution: classify `AMOUNT_TOO_SMALL` as terminal; complete the runtime job and release the reservation; enforce a 1 GRAM provider floor at the money-service boundary; clamp Telegram UI validation; reject admin values below 1 GRAM.
- Safety boundary: no DB migration, no duel settlement changes, no STEP-110R1 ledger architecture changes, no USDT enablement.
- QA: compileall PASS; targeted withdrawal/limits suite PASS; full repository regression 814/814 across 107 test files (executed in isolated groups).


## STEP-110R1-LIVE-ACCEPTANCE — Multi-Asset Foundation in GRAM-Only Production
- Status: LIVE ACCEPTED.
- Date: 2026-07-08/09.
- Production intent: asset-aware foundation live; GRAM enabled; USDT/SOL/TRX disabled.
- PostgreSQL evidence: `transactions.asset` is `TEXT NOT NULL`, has no default, supported-asset CHECK is validated, capability marker is present, both canonical indexes exist, invalid rows = 0, historical archive = 75 GRAM rows.
- Live settlement evidence: game `55` produced two `bet_reserve` entries (-0.1 each), one `win_credit` (+0.19), one platform `game_fee` (+0.01), all `asset=GRAM`; no new legacy `transactions` row was created for the game.
- Railway evidence: clean initialization, webhook 200s, real duel settlement and ELO update completed without runtime exception.
- Migration incident: manual execution of migration 033 in Neon SQL Editor used per-statement autocommit and lost an `ON COMMIT DROP` temp table; operator completed the missing CHECK/comment/index portion in an explicit transaction and verified canonical schema. Runtime migration semantics remain single-transaction.
- Rollback boundary: FIX-FORWARD ONLY. Do not return to pre-STEP-110R1 application code after migration 033.

## STEP-NEW-CHAT-MIGRATION-2026-07-09 — Canonical Handoff Refresh
- Status: DONE (docs-only).
- Runtime changed: none.
- Canonical baseline: `RollDuel_BASELINE_2026-07.9_LIVE_ACCEPTED.zip`.
- Supersedes the misleading uploaded filename `RollDuel_BASELINE_2026-07.8.1.zip`; its code matched the 2026-07.8.2 withdrawal-fix release candidate plus one documentation file.
- Next corridor: operate/soft-launch in GRAM mode; keep USDT disabled; resume multi-asset rollout only through a separate STEP after product demand and remaining release-gate blockers are addressed.

## STEP-LAUNCH-WEEK-GRAM-OPERATIONS-001 — Controlled GRAM-Only Launch Operations
- Status: IMPLEMENTED / SOURCE-VERIFIED / OPERATOR EXECUTION PENDING.
- Mode: HEAVY / R4.
- Risk Score: 9/12 with critical-zone override for live financial operations.
- Baseline: `RollDuel_BASELINE_2026-07.9_LIVE_ACCEPTED.zip`.
- Scope: docs-only launch runbook, GRAM-only preflight, Practice Mode onboarding, bounded giveaway, Days 2–3 money/coverage observation, Day 4 referral push, GO/HOLD/STOP criteria, incident boundary, and live evidence template.
- Runtime changed: none.
- Safety boundary: GRAM remains the only live asset; USDT/SOL/TRX remain disabled; no settlement, ledger, deposit, withdrawal, provider, reconciliation, migration, schema, or money-core changes; fix-forward only.
- Source verification: Practice Mode defaults to 20 Demo GRAM; giveaway supports sponsor subscription and minimum completed real duels; Practice Mode cannot satisfy the real-duel rule; referral defaults to 20% base and tier growth up to 45% under current settings; operator surfaces and asset flags exist.
- Truth boundary: the documentation package is verified locally; launch execution and all live GO/HOLD/STOP decisions remain operator evidence and are not claimed complete.
- Evidence: `docs/operations/STEP-LAUNCH-WEEK-GRAM-OPERATIONS-001.md`, `docs/operations/STEP-LAUNCH-WEEK-GRAM-OPERATIONS-001_LIVE_EVIDENCE_LOG.md`.

## STEP-REFERRAL-ATTRIBUTION-TERMS-GATE-FIX-001 — Referral Attribution Lost at 18+/Terms Gate
- Status: **SUPERSEDED by STEP-REFERRAL-ONBOARDING-AND-STATUS-COHERENCE-001** — root cause diagnosis (terms-gate swallowing start_arg) was correct and remains valid, but the pending_ref/user_states/TTL mechanism this STEP introduced was replaced with unconditional upfront attribution, and an independent audit found this STEP incomplete: it did not fix the pre-existing status='created' vs 'valid' mismatch in get_referral_dashboard/get_referral_leaderboard, nor the games_played-based (Practice-Mode-polluted) "Activated" contract. Do not re-apply this STEP's ZIP; superseded entirely by the STEP below. Not applied to production.
- Mode: HEAVY (Category A override — referral rake is a money-payout path, independent of numeric Risk Score).
- Risk Score: 6/12 (infra impact 2 — single file; uncertainty 1 — root cause source-confirmed; external deps 2 — Telegram send_message + existing DB-KV; rollback 1 — pure code revert, no migration).
- Baseline: `RollDuel_BASELINE_2026-07.9_LIVE_ACCEPTED.zip`.
- Reported by operator: inviter received no notification and no referral count increment when a new user joined via referral link.
- Root cause (source-confirmed): in `start_command`, the 18+/Terms gate `return`ed for every first-time user before `start_arg` (the deep-link `i_<code>` value) was ever read. `handle_accept_terms` (the gate's callback) never re-read the original deep-link and never called `attempt_referral_attribution`. Result: no `user_referrals` row is ever created for a first-time referred user — not just a missing notification. `credit_referral_rake_share()` looks up the referral by `invited_user_id` and silently no-ops if absent, so referrers were also not paid rake share (20% base, up to 45% at Legend tier) on any game played by a first-time referred user. The notification block itself was unregistered (no STEP tag, no test, not in STEP_REGISTRY) prior to this fix.
- Runtime changed: `handlers.py` only.
  - Added `_extract_referral_start_param()` — classifies a raw `/start` arg as referral-shaped or not (menu commands / empty / pure `tournament_<id>` excluded; `i_<code>_tournament_<id>` combo links reduced to `i_<code>`).
  - Added `_attempt_referral_attribution_and_notify()` — shared helper wrapping `attempt_referral_attribution` + referrer notification; replaces the previously inline, unregistered duplicate in `start_command`.
  - `start_command`: `start_arg`/`normalized_arg` now captured before the 18+/Terms gate; if the gate is shown, a referral-shaped `start_arg` is persisted via the existing DB-backed `user_states` KV (`pending_ref:<param>`, default 45 min TTL) — no new table/migration.
  - `handle_accept_terms`: after marking `accepted_terms_at`, pops any `pending_ref:` state and completes attribution + notification via the shared helper.
- Explicitly out of scope: retroactive backfill/compensation for referrals lost before this fix (open operator decision, would need its own HEAVY STEP); giveaway; ledger/settlement/withdrawal; rake percentages; terms-screen UX/copy.
- Idempotency: unaffected — `attempt_referral_attribution` still checks `get_referral_by_invited_user` first (`attributionStatus="existing"` on replay), so the new post-terms call path cannot double-attribute even if both call sites were somehow reached for the same user.
- Tests added: `tests/test_referral_attribution_terms_gate_fix_001.py` (13 tests: start-arg classifier, direct attribution+notify, idempotent replay, full pending-ref round trip through the real `user_states` KV, and a negative test confirming no spurious attribution when no pending state exists).
- QA (fresh, this STEP):
  - `python3 -m py_compile handlers.py` — PASS.
  - Red/green proof: new test file run against unpatched baseline — 12/13 FAIL (`AttributeError`, confirms the test catches the regression); run against patched code — 13/13 PASS.
  - Targeted subset (referral, rake payout, giveaway eligibility/sponsor, tournament deep-link, admin accounting/money-clarity, guardrails, share-result, STEP-110 asset/settlement group) — 147/147 PASS.
  - **Fresh full-suite run, single process, this session: 827/827 PASS** (814 prior baseline + 13 new), 0 failures, 0 errors, 37.89s. This also closes the previously open Truth Boundary gap from the 2026-07-09 migration pack, where a fresh full-suite run could not be completed in time.
- Safety boundary: no DB migration, no ledger/settlement/withdrawal/provider change, no asset-flag change, no USDT enablement. GRAM remains the only live asset. Fix-forward only.

## STEP-REFERRAL-ONBOARDING-AND-STATUS-COHERENCE-001 — Referral Attribution Timing + Status/Activated Coherence
- Status: IMPLEMENTED / SOURCE-VERIFIED / QA PASSED (fresh full-suite run, round 2) / OPERATOR DEPLOY PENDING.
- Mode: HEAVY (Category A override — referral rake is a money-payout path, independent of numeric Risk Score).
- Risk Score: 9/12, money-adjacent override, per independent-audit STEP spec.
- Baseline: `RollDuel_BASELINE_2026-07.9_LIVE_ACCEPTED.zip`.
- Supersedes: STEP-REFERRAL-ATTRIBUTION-TERMS-GATE-FIX-001 (see that entry — SUPERSEDED, not applied to production).
- Trigger (round 1): independent second-opinion audit of the prior STEP found it incomplete and issued a HOLD verdict against applying it. Each finding was independently re-verified against source (not accepted on narrative) before being fixed.
- Findings round 1, all source-confirmed independently:
  1. `attempt_referral_attribution()` is the only production writer of `user_referrals` and always writes `status='valid'`. `get_referral_dashboard()`'s `total_invited` and `get_referral_leaderboard()` both filtered `status = 'created'` — a value no production code path ever writes — so both silently showed 0/empty for every real referral. `handle_invite_main()` then overwrote the (correct) snapshot `invitedCount` with this broken dashboard value, so the Invite screen showed "Invited: 0" even after a successful attribution.
  2. Attribution + referrer notification were deferred to `accept_terms` via a single-slot, 45-minute-TTL `user_states` entry (`pending_ref:`). Fragile (TTL expiry, single-slot collision with any other flow, `pop()` clearing on unrelated `/start`) and unnecessary: attribution is a data link between two accounts, not a bet or charge, and does not need to wait for this user's own terms acceptance.
  3. The UI explicitly promises `invite.activated_hint`: "Activated = an invited friend who has completed at least 3 real duels." But `get_referral_dashboard`'s `active_invited`, `get_referral_list`'s active/waiting filter, and the item-level Waiting/Active label all used `users.games_played > 0` — a mixed counter that `services/practice.py` also increments for Practice Mode games.
- Round-1 runtime changed: `handlers.py`, `services/referrals.py`, `locales/en.json`, `locales/ru.json` — see git diff / DEVELOPER.patch for the round-1 shape; superseded in detail by round 2 below.
- Trigger (round 2, same STEP — not a new STEP number): a second independent-audit HOLD verdict found the round-1 fix left coherence gaps: one remaining `games_played`-based status render, a backend-parity crash (`sqlite3.Row` has no `.get()`), an inconsistent `activeReferrals` query in the Earnings screen, an unescaped HTML injection risk in the notification, a hardcoded "45%" maximum, and a stale ordering comment. All independently re-verified against source before fixing.
- Findings round 2, all source-confirmed independently:
  4. `handle_ref_list` (Telegram referral-list screen) still computed its own `🟢 Активен` / `🟡 Ожидает` label via `ref.get("games_played", 0) > 0`, bypassing the round-1 dashboard/list fix entirely — confirmed at the call site, a query result never touched by round 1's changes. A second, separate occurrence of the same pattern existed in the referral-cabinet "recent invitations" mini-list (`r.get("games_played", 0) > 0`).
  5. `get_referral_list`'s SQL rows are returned as-is: `sqlite3.Row` on SQLite (no `.get()`), `CompatRow` (a `Mapping`) on PostgreSQL. `handle_ref_list` calls `.get()` on each item — works on Postgres, raises `AttributeError` on SQLite. Confirmed by reproducing the crash directly. Round-1's own test suite never called `handle_ref_list` itself, so it never caught this.
  6. `get_referral_revenue_stats.activeReferrals` used `COUNT(DISTINCT g.player1_id) + COUNT(DISTINCT g.player2_id)` over any matched game with `status IN ('finished','timed_out')` — no bet/settlement-id/threshold filter, and structurally capable of counting a referral's *opponent* (not a referral) since it sums both player columns without checking which one is actually the referred user. Confirmed by reproducing: one real duel produced `activeReferrals == 2` (should be 0, since 3 real duels are required and the opponent isn't a referral at all).
  7. The referrer notification interpolated `invited_name` (untrusted, user-controlled `first_name`) directly into an HTML-`parse_mode` message with no escaping. A name containing `<`, `>`, or `&` would break `send_message`, and the failure would be silently swallowed by the existing broad `except Exception` around the send — the referrer would simply never receive the notification, with only a log line as evidence.
  8. The notification hardcoded "up to 45% at Legend" while the base rate was already read dynamically from `referral_rake_share_bps` — if that setting is ever changed, the advertised maximum silently becomes wrong (e.g. base 30% would actually cap at 55%, not 45%).
- Round-2 runtime changed: `handlers.py`, `services/referrals.py`, `locales/en.json`, `locales/ru.json` (same four files as round 1, additional changes layered on top — no new files):
  - `handlers.py`: `handle_ref_list` and the referral-cabinet recent-list renderer now read `is_activated` (a field the data layer now provides) instead of `games_played`. Notification: `invited_name` is now `html.escape()`-d before interpolation (module already imports `escape` from `html`); the advertised maximum is now `base_pct + services.referrals.get_max_tier_bonus_percent()` instead of the literal `45`. Stale comment ("Tournament deep-links must be handled before generic referral attribution", inaccurate since round 1 moved attribution earlier) rewritten to describe what ordering is actually still protected (tournament-card UI vs. main-menu fallthrough, not attribution).
  - `services/referrals.py`: added `_activated_invited_user_ids(conn, referrer_user_id, min_games=3)`, a shared helper computing the canonical Activated set once per call, reused by both `get_referral_dashboard` (recent-referrals list) and `get_referral_list` (items + filter) — single source of truth instead of three ad-hoc queries. `get_referral_list`'s `items` are now normalized to plain `dict` (via `dict(row)`) with an explicit `is_activated` boolean field added, fixing both the backend-parity crash and the display bug in one change. `get_referral_revenue_stats.activeReferrals` now calls `database.count_active_referrals_for_referrer(user_id, min_games=3)` — the same canonical counter used by the dashboard, list, and tier. Extracted the previously-inline tier ladder to a module-level `REFERRAL_TIER_LADDER` constant and added `get_max_tier_bonus_percent()` (single source of truth for both `get_referrer_tier` and the notification's dynamic maximum).
  - `locales/en.json` / `locales/ru.json`: `referral.notify_joined` now takes a `{max}` placeholder alongside `{base}`, both dynamic.
- Explicitly out of scope, unchanged: retroactive backfill (remains impossible to reconstruct — no persisted record anywhere of a lost attribution attempt). Ledger/settlement/withdrawal/provider/asset-flag files. Giveaway. Rake percentage *values* themselves (only their display accuracy).
- Tests: `tests/test_referral_onboarding_and_status_coherence_001.py` grew from 9 to 15 tests (6 new, covering: `handle_ref_list` called for real on SQLite with Practice-only / 1-real-duel / 3-real-duel states, `get_referral_revenue_stats.activeReferrals` at 0/0/1 across the same three states, HTML-escaping of a deliberately malicious `first_name`, and a dynamic-max-percent test that monkeypatches `referral_rake_share_bps` to a non-default value and asserts the new percentage appears while "45%" does not). `tests/test_tournament_economy_092c.py`'s stale-comment assertion updated again to match the round-2 comment rewrite (kept in the same test, since it's still checking the same ordering property, just via updated text).
- QA (round 2):
  - `python3 -m py_compile handlers.py services/referrals.py tests/test_tournament_economy_092c.py` — PASS.
  - Red/green proof: the 6 new tests run against the round-1-only code (before today's coherence-gap fixes) — 6/6 FAIL (AttributeError on SQLite, wrong `activeReferrals` count, unescaped HTML, missing `get_max_tier_bonus_percent`), confirming they catch exactly what round 2 fixes. All 9 round-1 tests still pass unchanged against round-1 code (no regression introduced by round 2's tests themselves). Full 15/15 PASS against round-2 code.
  - **Fresh full-suite single-process run, this session: 830/830 PASS**, 0 failures, 0 errors, 36.01s (824 after round 1 + 6 new round-2 tests).
  - No live Telegram/Railway smoke performed this session — see QA_REPORT.md for the recommended operator smoke sequence, updated with round-2 checks (Waiting/Activated labels on the actual referral-list screen, notification not silently dropped on special-character names).
- Packaging: browser hotfix ZIP delivered **root-ready** (files at archive root, no wrapper folder). Required base is explicit in CHANGED_FILES.txt: this ZIP is a full-file replacement for `handlers.py`, `services/referrals.py`, and the two locale files regardless of whether the superseded STEP's ZIP was ever applied — it does not assume or depend on that prior application, and does not (cannot — ZIPs never delete on merge) remove the superseded STEP's stale test file automatically; that deletion is called out as a manual step.
- Safety boundary: no DB migration, no schema change, no ledger/settlement/withdrawal/provider/asset-flag files touched. GRAM remains the only live asset. Fix-forward only.

## STEP-FAST-RUNTIME-JOBS-EVENT-DRIVEN-WAKEUP-001 — Event-Driven Fast Reconciliation Loop + Tournament Tick Interval

- Status: IMPLEMENTED / SOURCE-VERIFIED / QA PASSED (fresh full-suite run) / OPERATOR DEPLOY PENDING.
- Mode: HEAVY (Category A override — withdrawal/duel-timeout recovery latency, money-adjacent).
- Risk Score: 9/12 (raised from an initial 5/12 across three independent-audit review rounds — concurrency/threading class of risk was underweighted at first, not the numeric infra-impact/rollback-simplicity factors).
- Baseline: `RollDuel_BASELINE_2026-07.9_LIVE_ACCEPTED.zip` + all accepted referral-onboarding fixes.
- Trigger: live Neon billing evidence (~110 CU-hrs/9 days, ~366 CU-hrs/month projected on Launch plan, ~$38/month for pure idle keepalive) traced via `pg_stat_activity` to `reconciliation_worker()`'s fixed 20-second sleep — a real DB transaction every tick regardless of queue state, well under Neon's 5-minute scale-to-zero threshold. Prior investigation `docs/operations/ROLLDUEL_NEON_RECONCILIATION_LOOP_INVESTIGATION_107E.md` (STEP-107E, already in the repo) had already diagnosed the two *unconditional* per-tick queries (fixed by STEP-107F); this STEP addresses the cadence of the queue-check itself, which STEP-107F left unchanged.
- Went through three independent-audit review rounds before EXECUTE; each round found real, source-confirmed defects, not stylistic nitpicks:
  - **Round 1 (own initial PLAN, self-caught before audit):** naive fixed-interval reduction would either keep Neon awake regardless (if under 5 min) or delay withdrawal/duel-timeout recovery by minutes (if over 5 min) — ruled out an interval bump alone as insufficient.
  - **Round 2 audit findings (all independently re-verified against source before fixing):**
    1. Wake-on-insert alone (no next-due timer) would wake the loop before a future `scheduled_for` (confirmed `RETRY_DELAY_SECONDS = 60` in `services/withdrawals.py`), find nothing due, then sleep the full safety-sweep — delaying withdrawal retry from 60s to ~9 minutes and duel-timeout by up to the sweep interval.
    2. `services/tournaments.py`'s job types (`tournament_forming_timeout`, `tournament_match_timeout`) were incorrectly counted among "fast call sites" in the initial PLAN — confirmed neither is in `FAST_RECONCILE_JOB_TYPES`; tournaments.py must not wake the fast loop.
    3. `routes/admin_ui.py`'s `handle_admin_request` is called synchronously inside `_WebhookHandler.do_GET`/`do_POST`, which runs inside `ThreadingHTTPServer` — confirmed a real, separate OS thread per admin request, not the asyncio loop. A plain `asyncio.Event.set()` from withdrawal-approval admin actions would be unsafe; `loop.call_soon_threadsafe(event.set)` is required.
    4. `services/reconciliation.py` already imports `services.games`/`services.withdrawals`/`services.payments` at module level — confirmed a circular-import risk if those modules imported back into it to call a wake function. Resolved via a neutral, dependency-free `services/runtime_wakeup.py`.
  - **Round 3 audit findings (all independently re-verified against source before fixing):**
    1. `tournament-reconciliation` (APScheduler, `handlers.py`) still runs every 5 minutes — confirmed this alone would prevent Neon scale-to-zero even after removing the fast loop's 20s polling. Confirmed `NEON_RULES.md` (already in the repo) explicitly requires "минимум 10 минут интервал, предпочтительно 15–30" for scheduled jobs, and this job was never brought into compliance (added after the rules table was last updated). Confirmed `cancel_tournament()`'s own docstring says "Releases all participant reservations" and the tick also auto-progresses matches via coin flip — genuinely money-adjacent, not cosmetic bookkeeping. Rejected splitting this out as a separate STANDARD hotfix (as the initial PLAN proposed); folded into this same HEAVY STEP with an explicitly accepted SLA change.
    2. `FAST_LOOP_SAFETY_SWEEP_SECONDS` at 600s (10 min) was still too frequent given the precise next-due timer is now the primary protection for money-adjacent timing, not the safety sweep — raised to 1800s (30 min), matching `NEON_RULES.md`'s own "15–30 минут" upper bound.
    3. `database.get_next_pending_runtime_job_at()` was outside any `try/except` in the worker loop — a single transient DB/SSL error would have killed `reconciliation_worker` entirely (the pre-STEP 20s loop tolerates exactly this kind of error via its own broad `except`). Fixed with a bounded 30s retry fallback.
    4. Missing `if not job_types: return None` guard and missing naive-datetime-to-UTC normalization after `fromisoformat()` in the new DB function — both are real `TypeError`/`SQL syntax error` risks, fixed.
    5. `asyncio.Event.set()`-based wake had no lifecycle cleanup (`unregister_worker_loop`) — after `task.cancel()`, module-level globals would keep referencing a dead loop/event. Fixed via a `finally` block.
    6. `stop_event` was not responsive while the worker was inside its wait (`asyncio.wait_for(wake_event.wait(), ...)` alone doesn't see a `stop_event.set()` until the timeout elapses or the top-of-loop check runs again) — fixed via `asyncio.wait([...], return_when=FIRST_COMPLETED)` on both `wake_event.wait()` and `stop_event.wait()` together.
    7. `asyncio.wait_for(wake_event.wait(), timeout=0)` for the due-backlog case relies on murky edge-case semantics — replaced with an explicit `if timeout <= 0: continue`.
    8. `asyncio.wait(...)`'s `pending` tasks were cancelled but never awaited — a real "Task was destroyed but it is pending" / orphan-task risk over many wake cycles, especially under cancellation. Fixed by awaiting (`asyncio.gather(*wait_tasks, return_exceptions=True)`) after cancelling.
    9. `infra/runtime.py`'s `WebhookRuntime.stop()` called `self._reconcile_task.cancel()` without awaiting it — confirmed the `finally` block (registration cleanup) is not guaranteed to run before shutdown proceeds without an `await` under `contextlib.suppress(asyncio.CancelledError)`. Fixed; `services/runtime.py` (confirmed dead/legacy per STEP-107E, `main.py` only imports `infra.runtime`) kept in sync to avoid silent divergence.
    10. `runtime_wakeup`'s loop/event stored as two separate globals could theoretically be read mid-update during a restart — changed to a single atomic tuple (`_worker_target`), which has no such intermediate state in CPython.
- Runtime changed: `services/runtime_wakeup.py` (new), `database.py` (new `get_next_pending_runtime_job_at`), `services/reconciliation.py` (event-driven `reconciliation_worker`, new constants `FAST_LOOP_SAFETY_SWEEP_SECONDS`=1800, `FAST_LOOP_DB_ERROR_RETRY_SECONDS`=30; `RECONCILIATION_INTERVAL_SECONDS` unchanged, kept only for its `retry_in_seconds` role), `services/games.py` + `services/withdrawals.py` + `services/quick_duel.py` (call `runtime_wakeup.notify_fast_job_available()` after scheduling a fast job — the only 3 call sites confirmed to create `FAST_RECONCILE_JOB_TYPES` job types), `handlers.py` (`tournament-reconciliation` 5→15 min + docstring), `infra/runtime.py` + `services/runtime.py` (await cancelled reconcile task).
- `services/tournaments.py` and `services/payments.py`: explicitly NOT touched — confirmed by source they create job types the fast loop doesn't dispatch (`tournament_forming_timeout`, `tournament_match_timeout`, `invoice_reconcile`).
- Explicitly out of scope: multi-replica coordination (Postgres LISTEN/NOTIFY) — `database.scheduler_job_lock()`'s own docstring confirms Roll Duel runs as exactly one Railway instance today; `SELECT ... FOR UPDATE SKIP LOCKED` in `acquire_due_runtime_jobs` — pre-existing single-instance assumption, not touched; slow loop (`process_slow_runtime_jobs`, STEP-107F) — untouched; Railway Healthcheck Path (`/healthz` vs `/readinessz`) — operator-side dashboard setting, not code.
- **Honest scope statement, not overclaimed:** this STEP does not guarantee zero Neon compute cost. Between 15-minute APScheduler ticks (`tournament-reconciliation` and siblings), Neon *can* reach `INACTIVE`, but every 15-minute tick re-wakes it for at least a 5-minute billing window regardless. Real economic effect is confirmed only by post-deploy Neon dashboard metrics, not promised in advance.
- Tests: new `tests/test_fast_runtime_jobs_event_driven_wakeup_001.py` (26 tests) covering next-due-timer correctness, safety-sweep capping, withdrawal-retry-timing regression (RETRY_DELAY_SECONDS=60 preserved exactly), all 3 notify call sites (and confirmed absence in tournaments.py/payments.py), real cross-thread (`threading.Thread`, not just another asyncio task) wake, startup recovery, stop_event responsiveness, notify-before-safety-sweep, register/unregister lifecycle across cancel+restart, no leaked tasks after cancellation, transient-DB-error resilience, `timeout<=0` uses `continue` not `wait_for(timeout=0)`, tournament-reconciliation registered at 15 min, tournament reconciliation correctness (doesn't fire before deadline, idempotent on repeat tick), STEP-107F source-pin still holds, and empty-queue quietness (zero extra fast-worker DB calls between wakes — scoped explicitly to the fast worker, not the whole system, since APScheduler ticks are independent).
- QA:
  - `python3 -m py_compile` on all changed files — PASS.
  - Real import test (not just `py_compile`) confirming zero circular-import errors across `database.py` → `services/games.py` → `services/withdrawals.py` → `services/quick_duel.py` → `services/reconciliation.py` → `services/runtime_wakeup.py` → `handlers.py`.
  - Red/green proof: new test file fails to even *import* against the pre-STEP baseline (`ModuleNotFoundError: services.runtime_wakeup` — the module doesn't exist there), which is stronger evidence than an individual test failure that these tests exercise genuinely new functionality.
  - Targeted regression (STEP-107F reconciliation split, invoice give-up, webhook pool resilience, tournament economy/UX/preview-card, guardrails, STEP-110 settlement hardening, plus the new file) — 98/98 PASS.
  - **Fresh full-suite single-process run, this session: 856/856 PASS** (830 prior total + 26 new), 0 failures, 0 errors, 36.61s.
- `NEON_RULES.md` updated: full current scheduler-job table (previously only listed 2 of what are now 5 registered jobs + the fast worker), tournament-reconciliation interval change noted, explicit "no zero-compute promise" honesty note added.
- Safety boundary: no DB migration, no schema change, no ledger/settlement/withdrawal-money-movement logic touched (only the *timing* of when existing, unchanged reconciliation logic runs). GRAM remains the only live asset. Fix-forward only.

## STEP-JETTON-DEPOSITS-DISABLE-001 — Hard-Disable Arbitrary Jetton Deposit Acceptance

- Status: **LIVE APPLIED / OPERATOR CONFIRMED / HISTORICAL LEDGER AUDIT PASS / LIVE ACCEPTED**.
- Mode: HEAVY / R4 at final acceptance (deposit/ledger critical-zone override; implementation removed risk but still changed a payment-adjacent acceptance path).
- Baseline: `RollDuel_BASELINE_2026-07.12.zip` (exact filename corrected from the earlier underscore typo; includes STEP-FAST-RUNTIME-JOBS-EVENT-DRIVEN-WAKEUP-001).
- Trigger: product discussion about admin-configurable arbitrary Jetton token support for duels (marketing idea — announce "play dice on token X" to a token's community). Investigation into feasibility surfaced two real, pre-existing defects in the *existing* (unrelated, already-shipped) Jetton deposit pathway; operator decided not to pursue arbitrary-Jetton support and asked to close the hole instead, focusing exclusively on the existing GRAM/USDT/SOL/TRX asset set.
- Findings, both source-confirmed independently before any fix:
  1. **Silent mis-crediting.** `services/jetton_deposits.py`'s `process_jetton_deposit()` called `ledger.create_entry(...)` without an `asset=` argument, which defaults to `"GRAM"` (`services/ledger.py:create_entry`). Any Jetton actually sent to the configured deposit address — not necessarily the intended one — would have been credited to the user's GRAM balance 1:1 by raw token amount, with zero price/value awareness of what was actually received. (The asset-aware foundation from STEP-110 — `services/assets.py`'s `PRODUCT_ASSETS = frozenset({"GRAM","USDT","SOL","TRX"})` — was never wired into this pathway at all; it predates or was built in parallel to STEP-110 and was never reconciled with it.)
  2. **Dead admin switch.** The `jetton_deposit_enabled` platform setting (default `True`, editable via `/admin/platform_settings`) was never read anywhere in `services/jetton_deposits.py` or its callers. An operator toggling it "off" believing it stopped Jetton acceptance was not actually stopping anything.
  3. **(Found during the fix, not the trigger, but worth recording)** the removed `check_jetton_deposits()` imported `services.ton_api.get_jetton_transfers_to_address` — a function that does not exist in `services/ton_api.py` (only `get_jetton_balances`/`get_ton_balance` do). The polling path would have raised `ImportError` on every actual invocation where `JETTON_DEPOSIT_ADDRESS` was set, always caught by the surrounding broad `except Exception` in `services/reconciliation.py`'s slow loop and logged as "Jetton deposit check failed" — i.e. this specific path may never have worked correctly even before this STEP.
- Runtime changed: `services/jetton_deposits.py` (every entry point hard-disabled — not gated behind the env var / settings flag that a config change could silently undo), `routes/jetton_webhook.py` (docstring only — behavior already correctly reports zero-processed via the disabled `process_jetton_deposit`, route was already unreachable in production per STEP-107E: `main.py` only imports a placeholder `router = None`), `routes/admin_ui.py` (removed the dead `jetton_deposit_enabled` toggle from `EDITABLE` and `ALLOWED_PLATFORM_KEYS` — a misleading UI surface, not just a no-op setting), `services/settings.py` (`jetton_deposit_enabled` default flipped `True` → `False`, documented as vestigial), `services/reconciliation.py` (clarifying comment only — the slow-loop call to `check_jetton_deposits()` is left in place as a guaranteed no-op, not removed, so any future re-enable is a one-file change).
- Explicitly a **structural** disable, not a configuration one: the module no longer imports `database`/`services.ledger`/`services.idempotency` at all — the money-crediting code path is physically absent from the file, not merely gated behind `JETTON_DEPOSITS_DISABLED = True` (which is also present, as a second layer, but the real guarantee is the missing imports).
- No user-facing bot text referenced Jetton deposits anywhere (`locales/en.json`/`locales/ru.json` grep returned nothing) — nothing to clean up there. `get_jetton_deposit_address()` was never called from any bot menu or admin screen either.
- `admin/read_models.py`'s deposit-sum query (includes `entry_type IN ('deposit', 'jetton_deposit')`) left untouched — it's a read-only historical aggregate; any pre-existing `jetton_deposit` ledger rows (if any exist) should still be correctly summed for accounting purposes; going forward no new such rows can ever be created.
- Tests: new `tests/test_jetton_deposits_disable_001.py` (10 tests) — every entry point refuses unconditionally even given a well-formed, would-have-matched event; the internal-poller bypass path (`_internal_call=True` with a pre-resolved `user_id`) doesn't become a backdoor; `check_jetton_deposits()` is a true no-op (no network call attempted, confirmed by source no longer referencing `services.ton_api`); structural confirmation the module doesn't import `database`/`ledger`/`idempotency`; disable isn't backed by an env var; webhook handler reports zero processed; admin UI no longer offers the toggle; settings default is `False`. Also updated two pre-existing tests in `tests/test_security_contracts.py` (`test_external_jetton_deposit_ignores_payload_user_id`, `test_external_jetton_deposit_rejects_unlinked_wallet`) that tested the *old* behavior (payload-user_id-spoofing resistance, unlinked-wallet rejection) — both properties are now moot since everything is refused regardless, but the tests were updated (not deleted) to assert the new unconditional-refusal behavior, with the original security requirement documented in each docstring as a condition for any future re-enablement.
- QA:
  - `python3 -m py_compile` on every changed file — PASS.
  - Red proof: new 10-test file run against the pre-fix baseline — 7/10 FAIL (confirms the tests catch the actual old behavior, not vacuous). Existing `test_security_contracts.py` tests failed against the *new* code before being updated (2 failures), confirming they were genuinely exercising the old code path and needed a deliberate update, not a mechanical one.
  - **Fresh full-suite single-process run, this session: 866/866 PASS** (856 prior total + 10 new), 0 failures, 0 errors, 52.43s.
- Explicitly out of scope: no migration, no schema change (the `entry_type='jetton_deposit'` value remains valid in `ledger_entries`/`transactions` for any historical rows — not retroactively touched). GRAM/USDT/SOL/TRX asset handling (`services/assets.py`, `services/asset_flags.py`, `services/usdt_release_gate.py`) — completely untouched, remains the sole focus going forward per this STEP's explicit trigger.

- Live evidence, 2026-07-12: operator applied the Browser Hotfix and executed both canonical Neon queries for `ledger_entries.entry_type='jetton_deposit'`; aggregate result 0 rows, detail result 0 rows. Historical production mis-credit was not found; no reversal or compensation required. Evidence: `docs/operations/STEP-JETTON-DEPOSITS-DISABLE-001_LIVE_EVIDENCE.md`.

## STEP-JETTON-DEPOSITS-DISABLE-DOCS-SYNC-001 — Live Acceptance Documentation Sync

- Status: **DONE / DOCS-ONLY / LIVE ACCEPTANCE RECORDED**.
- Mode: FAST; Risk Score 2/12.
- Baseline: production state after `STEP-JETTON-DEPOSITS-DISABLE-001`.
- Scope: corrected canonical baseline naming, promoted Jetton disable to LIVE ACCEPTED after zero-row Neon audit, removed misleading active Jetton env configuration, synchronized handoff/QA/registries, and added the live evidence record.
- Runtime changed: none.
- Database/schema changed: none.
- QA: exact changed-file diff reviewed; Markdown links/paths checked; ZIP integrity and root-ready layout verified; Python compileall and full tests not rerun because no executable Python file changed.
- Artifact: `ROLLDUEL_STEP_JETTON_DEPOSITS_DISABLE_DOCS_SYNC_001_BROWSER_HOTFIX.zip`.
- Canonical full baseline: `RollDuel_BASELINE_2026-07.12.1_JETTON_DISABLE_LIVE_ACCEPTED.zip`.

## STEP-COMMUNITY-SURFACES-001 — Official Channel, Player Community, Bot and Landing Navigation

- Status: LIVE APPLIED / OPERATOR CONFIRMED.
- Date: 2026-07-15.
- Mode: STANDARD.
- Risk Score: 6/12.
- Baseline: `RollDuel_BASELINE_2026-07.12.1_JETTON_DISABLE_LIVE_ACCEPTED.zip`.
- Product decision: one English official channel (`@RollDuelOfficial`) plus one forum player community (`@rollduelchat`) with English/Russian topics. No duplicate RU channel or separate language groups at launch.
- Runtime: added dependency-free `services/community.py`; localized Community screen; canonical language routing; Community entry points in Full Suite, Help, Demo Mode, Referral, and public duel-created UI.
- Landing: added Community navigation/section, official channel, language-specific Open Duels and player chat links, safety copy, corrected footer, and community CTAs.
- Configuration: documented 10 canonical `COMMUNITY_*` environment variables with operator-created URLs as safe defaults.
- Safety boundary: no DB migration, schema, money-core, settlement, ledger, reservation, deposit, withdrawal, provider, referral accounting, or asset-flag change. No automatic topic publishing or topic binding in this STEP.
- QA: 12/12 new tests PASS; relevant targeted suite 24/24 PASS; Next.js production build PASS; ESLint 0 errors (1 pre-existing warning); Python `py_compile` PASS; repository total 877/877 PASS across exhaustive split-run. Single-process full run reached 82% with zero failures before environment timeout.
- Next STEP: `STEP-COMMUNITY-DUEL-TOPIC-FEED-001` (HEAVY/R4) for admin-only topic binding, post-commit idempotent publication, retry, and lifecycle edits.

## STEP-COMMUNITY-DUEL-TOPIC-FEED-001 — Automatic EN/RU Public Duel Topic Feed

- Status: LIVE APPLIED / CORE LIVE SMOKE PASS / OPERATOR CONFIRMED.
- Date: 2026-07-15.
- Mode: HEAVY / R4.
- Risk Score: 9/12 (post-commit money boundary, Telegram delivery ambiguity, persistent idempotency, runtime concurrency, Terms-gate navigation, and private-game privacy invariant).
- Required base: `RollDuel_BASELINE_2026-07.12.2_STEP_COMMUNITY_SURFACES_001_FULL.zip`.
- Product routing: public real waiting GRAM duels created by English users route to the English Open Duels topic; Russian users route to the Russian topic; unknown language falls back to English. Topic language does not restrict who may join.
- Operator controls: admin-only `/bind_duel_feed en`, `/bind_duel_feed ru`, and `/community_status`. Binding captures real Telegram forum `chat_id` and `message_thread_id` and persists them in audited platform settings.
- Publication boundary: only committed public waiting GRAM games are eligible. Practice, private invite, tournament-internal, failed/rolled-back, already-matched-before-first-send, and non-GRAM games are excluded.
- Money boundary: game creation and stake reservation commit before community scheduling. Telegram/API failure is best-effort and cannot roll back a valid game or reservation.
- Neutral official-feed link: cards use `start=duel_<game_id>` with no player invite code. Automatic platform distribution does not silently award referral attribution to the listed duel creator; personal share links remain referral-aware.
- Persistence: migration `034_community_duel_publications.sql` creates `community_duel_publications` and `user_start_intents`. One row per game prevents duplicate mappings; deterministic runtime job IDs model waiting/matched/cancelled/expired/completed projection states.
- Lifecycle: the original Telegram card is edited on matched, cancelled, expired, and completed status; Join markup is removed after waiting ends.
- Delivery semantics: reuses the event/deadline-driven fast runtime worker; no new poller. Missing binding becomes `waiting_binding`. Ambiguous initial send becomes `uncertain` and is never auto-resent. BadRequest/edit/network retries are bounded by `COMMUNITY_DUEL_FEED_MAX_ATTEMPTS` (default 3), then surfaced as `blocked`/`retry_exhausted`; rebinding is the explicit unpublished-card recovery action.
- Terms gate: a dedicated short-lived `user_start_intents` row preserves the public-duel destination across first-time Terms acceptance without overwriting existing deposit/admin/input runtime state. The game is revalidated as public/waiting/GRAM before the Join prompt is shown.
- Runtime changed: `database.py`, `handlers.py`, `main.py`, `services/games.py`, `services/miniapp_duels.py`, `services/quick_duel.py`, `services/reconciliation.py`, `services/referrals.py`, new `services/community_duel_feed.py`, locales, migration/schema wiring, `.env.example`, and `NEON_RULES.md`.
- Explicitly out of scope: official-channel auto-posting, topic creation/management, tournament feed, public winner identity, multi-replica coordination, non-GRAM enablement, and any settlement/referral-reward value change.
- QA: 20/20 new tests PASS; targeted duel/community/reconciliation/referral/tournament set 130/130 PASS; locale parity 1120/1120 keys; migration split/static checks PASS; Python compile PASS; full repository 897/897 PASS across four exhaustive chunks (322 + 212 + 147 + 216), zero failures and zero collection errors. Single-process run reached >80% after the locale-key correction without further failure before environment timeout.
- Live evidence (2026-07-15): runtime registered; English bound to chat `-1003938974789` topic `35`; Russian bound to the same chat topic `37`; English game `#65` (`0.12 GRAM`) and Russian game `#66` (`0.21 GRAM`) published as waiting cards and projected cancellation state. Evidence: `docs/operations/STEP-COMMUNITY-DUEL-TOPIC-FEED-001_LIVE_EVIDENCE.md`. Residual matched/completed/Terms/negative live branches remain operational observation items and are automated-regression covered.

## STEP-COMMUNITY-LAUNCH-CONTENT-001 — Official Channel, Community Pins, and Launch Social Pack

- Status: IMPLEMENTED / DOCS-ONLY / OPERATOR PUBLISHING PENDING.
- Date: 2026-07-15.
- Mode: FAST / DOCS-CONTENT.
- Risk Score: 2/12.
- Base: `RollDuel_BASELINE_2026-07.12.3_STEP_COMMUNITY_DUEL_TOPIC_FEED_001_FULL.zip`.
- Scope: ready-to-paste official-channel profile and bilingual pinned navigation; bilingual `Start Here / Rules`; English/Russian topic welcomes; Wins/Support/Feedback starter posts; seven-day English-first channel calendar; X and LinkedIn launch copy; moderation/publishing runbook; and a Founding Duel Challenge draft whose prize/date/money values remain deliberately unapproved placeholders.
- Product decision: official channel remains English-first; Russian routing is handled by one bilingual pinned navigation post plus Russian forum topics.
- Safety boundary: no runtime code, migration, schema, ledger, settlement, deposit, withdrawal, referral economics, giveaway configuration, prize budget, or asset flag changed. The challenge draft is marked `DO NOT PUBLISH YET` until a separate HEAVY/R4 approval.
- QA: exact changed-file set reviewed; all canonical bot/channel/community/landing links checked; placeholder and unsafe-claim review performed; Markdown files inspected; no executable files changed, so full Python/Next.js suites were not rerun.
- Next decision: operator publishes the pinned/community pack, completes GRAM launch preflight, then opens `LAUNCH-WEEK-FOUNDING-DUEL-CHALLENGE-001` only after prize funding and eligibility are locked.

## STEP-WITHDRAWAL-FAILURE-RESOLUTION-001 — Audited Resolution of Historical Terminal Withdrawal Failures

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-15.
- Mode: HEAVY / R4.
- Risk Score: 9/12.
- Base: `RollDuel_BASELINE_2026-07.12.4_COMMUNITY_FEED_LIVE_ACCEPTED_AND_LAUNCH_CONTENT.zip`.
- Trigger: a historical operator-owned `0.5 GRAM` withdrawal failed with CryptoBot `AMOUNT_TOO_SMALL`, was already terminal, had zero active reserve and later successful withdrawals, but continued to appear forever as an active failed withdrawal and Release Gate blocker.
- Decision: preserve canonical money truth (`status=failed`, provider error, reservation and ledger evidence) and introduce a separate audited incident-resolution state rather than deleting the row, falsely marking it sent, or retrying it.
- Runtime changed: `services/withdrawals.py` (resolve/reopen metadata-only actions), `admin/read_models.py` (active vs resolved counting and archive), `routes/admin_ui.py` (typed-confirm operator actions and archive UI), `database.py` + migration 035 (resolution metadata columns).
- Safety gates: only failed/rejected withdrawals; mandatory reason; typed `RESOLVE`; active reservation blocks resolution; active runtime job blocks resolution; idempotent repeat; audited reversible `REOPEN`; no provider call, ledger mutation, reservation mutation, payout retry or withdrawal-status rewrite.
- Release semantics: only unresolved failed/rejected withdrawals count as active Problems and release blockers. Resolved failures remain in full history and `Проблемы → Архив выводов`.
- QA: 12/12 new tests; 37/37 targeted withdrawal/admin/release tests; 909/909 full repository tests across exhaustive split-run (326 + 218 + 150 + 215); compileall PASS; schema-tolerant legacy fixtures PASS.
- Live acceptance requires: Railway migration 035 success, resolving the known historical withdrawal, active failed count 0, archived count 1, unchanged money totals, and Release Gate GO.

## STEP-ACQUISITION-ATTRIBUTION-FOUNDATION-001A — Universal Campaign First/Last Touch

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Mode: **HEAVY / R4**.
- Risk score: **9/12** because the STEP changes the shared Telegram `/start` router that also carries referrals, duel links, tournament links, workspace links, and the first-time Terms gate.
- Base: `RollDuel_BASELINE_2026-07.12.5_STEP_WITHDRAWAL_FAILURE_RESOLUTION_001_FULL.zip`.
- New schema: migration `036_acquisition_attribution_foundation.sql` creates `acquisition_campaigns`, `user_acquisition_attribution`, and `acquisition_touch_events`.
- Deep-link contract: exact `acq_<code>` only; malformed, unknown, or inactive campaigns are ignored.
- First touch is immutable; later valid starts update last touch and increment touch count.
- Telegram `update_id` is stored as an event idempotency key when available, preventing duplicate attribution on webhook redelivery.
- Acquisition state is analytics-only and structurally isolated from referral attribution/rewards.
- Attribution happens before the Terms return, so first source is not lost during first-time onboarding.
- Downstream funnel stages remain derived from authoritative users/practice/invoice/ledger/game data; this STEP does not duplicate financial truth.
- Explicitly out of scope: Web Admin cockpit, TG Admin cockpit, landing propagation, `/go/<code>`, click tracking, IP/fingerprinting, and external ad pixels.
- QA: 27/27 new tests PASS; targeted deep-link suite PASS; full repository exhaustive split-run 936/936 PASS; compileall PASS.

## STEP-ACQUISITION-WEB-COCKPIT-001B — Universal Growth Web Admin

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-15.
- Mode: STANDARD on top of the HEAVY/R4 attribution foundation.
- Base: `RollDuel_BASELINE_2026-07.12.6_STEP_ACQUISITION_ATTRIBUTION_FOUNDATION_001A_FULL.zip`.
- Web route: `/admin/acquisition`.
- Capabilities: campaign creation/update, statuses, cost metadata, canonical bot links, first-touch funnel, campaign user drilldown, D1/D7 meaningful-action retention, deposit volume, proportional attributed platform fee, CSV export and audited writes.
- Data truth: funnel stages are read from authoritative users, practice games, invoices, ledger entries and settled games. No parallel balance/revenue store is introduced.
- Safety: acquisition remains isolated from referrals; no ledger, balance, deposit, withdrawal, reservation or settlement mutation; no external pixels, IP storage or fingerprinting.
- Date handling: optional campaign start/end windows are validated; an Active campaign outside its window does not record new touches.
- QA: 10/10 new tests; 82/82 targeted; 946/946 repository tests across exhaustive split-run; compileall PASS.
- Next STEP: `STEP-ACQUISITION-TG-COCKPIT-001C` or `STEP-ACQUISITION-LANDING-PROPAGATION-001D` after live Web Cockpit smoke.

## STEP-ACQUISITION-WEB-COCKPIT-DECIMAL-AUDIT-HOTFIX-001B1 — PostgreSQL Decimal Audit Serialization

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-15.
- Mode: STANDARD / R3 targeted production hotfix.
- Base: `RollDuel_BASELINE_2026-07.12.7_STEP_ACQUISITION_WEB_COCKPIT_001B_FULL.zip`.
- Trigger: campaign update/archive committed successfully, but the Web Admin request crashed while serializing PostgreSQL `Decimal` `cost_amount` into `operator_actions.payload_json`.
- Fix: the shared audit logger serializes `Decimal` as exact decimal text and continues to reject unsupported object types.
- Safety: no schema, attribution, referral, ledger, balance, deposit, withdrawal, settlement or provider behavior changed.
- QA: 3/3 new tests; 40/40 targeted acquisition tests; 949/949 full repository exhaustive split-run PASS.
- Live acceptance: campaign detail loads after archive/update, success redirect works, no Decimal traceback, audit row present.

## STEP-ACQUISITION-LANDING-PROPAGATION-001D — Landing Campaign Propagation and Privacy-Minimal Click Tracking

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-15.
- Mode: STANDARD / R3.
- Base: `RollDuel_BASELINE_2026-07.12.7.1_ACQUISITION_DECIMAL_AUDIT_HOTFIX_001B1_FULL.zip`.
- Adds `/?campaign=<code>` landing propagation with 30-day local persistence and rewrites every landing bot CTA through `/go/<code>`.
- Adds migration `037_acquisition_landing_propagation.sql` and privacy-minimal `acquisition_redirect_events`. No IP, cookie, Telegram identity, raw user-agent or full referrer URL is stored.
- `/go/<code>` accepts only active/in-window campaigns, records best-effort click telemetry, and redirects to `?start=acq_<code>`. Inactive/unknown/archived links degrade to the generic bot without attribution.
- Click classes separate probable browser clicks from social preview and crawler hits; Bot starts remains product truth.
- Web Admin and CSV now show tracked redirect, landing and direct bot links plus click→start conversion.
- Safety boundary: referrals, rewards, ledger, deposits, withdrawals, settlement, provider calls and asset flags are unchanged. Telemetry failure never blocks the redirect.
- QA: 14/14 new tests PASS; 54/54 acquisition targeted tests PASS; repository 963/963 PASS across exhaustive split-run; Python compileall PASS; Next.js production build PASS; ESLint 0 errors (one pre-existing PostCSS warning).


## STEP-ACQUISITION-TG-COCKPIT-001C — Telegram Growth Cockpit

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-15.
- Mode: STANDARD / read-only operator surface.
- Base: `RollDuel_BASELINE_2026-07.12.8_STEP_ACQUISITION_LANDING_PROPAGATION_001D_FULL.zip`.
- Adds `📈 Привлечение` to Telegram Admin, 7/30-day funnel views, top campaign drilldowns, Web Admin links, and commands `/acquisition`, `/campaigns`, `/campaign CODE`.
- Diagnostic hints identify clicks without starts, starts without Practice, and Practice without first real duel.
- Safety: no migration, scheduler, push alert, campaign mutation, referral mutation, or money-path mutation. Web Admin remains the campaign write surface.
- QA: 13/13 new tests, 80/80 targeted acquisition/TG Admin tests, 976/976 full repository exhaustive split-run PASS.
- Live acceptance: operator menu button, 7/30 switch, campaign drilldown and three commands work in Telegram.

## STEP-PROJECT-CANON-AND-MULTIMODEL-HANDOFF-SYNC-001

- Date: 2026-07-15
- Mode: FAST / docs-only
- Base: `RollDuel_BASELINE_2026-07.12.9_STEP_ACQUISITION_TG_COCKPIT_001C_FULL.zip`
- Status: DONE / CANONICAL PROMOTION
- Scope: synchronize current state, new-chat bootstrap, project canon, roadmap, decisions, registries, and multi-model coordination; include `ROLLDUEL_MASTER_COORDINATION_HANDOFF_2026-07-15.md` in root and `docs/new_chat/`.
- Runtime/schema/migrations: unchanged.
- Canonical output: `RollDuel_BASELINE_2026-07.12.10_PROJECT_CANON_AND_MULTIMODEL_HANDOFF_SYNC_CANONICAL.zip`.
- Truth boundary: controlled soft launch ready; unrestricted launch still requires fresh Release Gate GO and current-lineage end-to-end money smoke.

## STEP-COMMUNITY-VERIFICATION-ENTRY-ROUTING-001 — Shieldy-Aware Community Entry

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-16.
- Mode: FAST.
- Risk Score: 3/12.
- Base: `RollDuel_BASELINE_2026-07.12.10_PROJECT_CANON_AND_MULTIMODEL_HANDOFF_SYNC_CANONICAL.zip`.
- Trigger: generic community CTAs could open the forum root while Shieldy posts newcomer verification in `Start Here / Rules` topic `/1`, so a user entering another forum topic could miss the CAPTCHA.
- Decision: introduce `COMMUNITY_ENTRY_URL` as a dedicated primary entry contract. Keep `COMMUNITY_CHAT_URL` as the forum root and keep direct EN/RU chat/Open Duels topic links unchanged.
- Runtime changes: bot `All community topics` now uses `CommunityLinks.entry`; landing hero/final/footer generic community CTAs use `/1`.
- Operator documentation: accepted Shieldy production config is recorded, including button CAPTCHA, 60-second limit, strict mode, temporary kick (`banUsers=false`), globally verified-user bypass, CAS and admin command lock.
- Safety boundary: no migration, database write path, money path, referral/acquisition attribution, duel feed, moderation permissions, or topic binding changed.
- QA: 6 new tests plus updated Community Surfaces tests PASS; exhaustive repository coverage 982/982 PASS across bounded split runs; Python compileall PASS; Next.js production build PASS; ESLint 0 errors / 1 pre-existing warning.
- Live acceptance: verify bot generic entry, landing generic CTAs and footer all open `/1`; direct `/35`, `/37`, `/39`, `/41` navigation remains unchanged; perform one external Shieldy newcomer smoke.

## STEP-DEMO-MODE-CORE-COHERENCE-001A — Production-Grade Demo Core

- Status: **DEPLOYED / OPERATOR-CONFIRMED WORKING / EXTENDED LIVE BRANCHES TEST-COVERED**.
- Date: 2026-07-17.
- Mode: **HEAVY / R4**.
- Risk score: **9/12** due to game-state concurrency, timeout/restart recovery and settlement semantics, while remaining isolated from real money.
- Base: `RollDuel_BASELINE_2026-07.12.11_STEP_COMMUNITY_VERIFICATION_ENTRY_ROUTING_001_FULL.zip`.
- Runtime: authoritative fee-adjusted Demo settlement; Demo-only statistics; low-balance refill; exact waiting/active deadlines; restart timer restoration; overdue safety reconciliation; duplicate-finalization protection; stale-cancel fix.
- Schema: migration `038_demo_mode_core_coherence.sql` adds immutable settlement evidence columns to `practice_games`.
- Safety: no real ledger, real balance, reservation, deposit, withdrawal, referral activation, Community feed or asset-gate behavior changed.
- Explicitly deferred: referral-aware Demo share/deep links and Terms-safe Demo invite restoration (`STEP-DEMO-MODE-INVITE-AND-REFERRAL-PARITY-001B`).
- QA: 21/21 new tests; 161/161 targeted; 1003/1003 repository tests across exhaustive split-run; compileall PASS; old baseline red-proof 21/21 failed.
- Deployment evidence: operator reported working; `/readinessz` returned `ok: true`; supplied Railway log showed PostgreSQL/bootstrap and timer restoration without traceback. Extended fee/draw/timeout/refill/restart branches remain automated-test covered unless separately evidenced.

## STEP-DEMO-MODE-INVITE-AND-REFERRAL-PARITY-001B — Referral-Aware Exact Demo Invites

- Status: **DEPLOYED / OPERATOR-CONFIRMED WORKING**.
- Date: 2026-07-17.
- Mode: **HEAVY / R4**.
- Risk score: **9/12** because the STEP extends shared `/start`, Terms restoration, referral attribution and active-duel routing while preserving real-money isolation.
- Base: `RollDuel_BASELINE_2026-07.12.12_STEP_DEMO_MODE_CORE_COHERENCE_001A_FULL.zip`.
- Deep-link contract: `p_<invite_code>_g<practice_game_id>` with `kind=practice`, `shareSource=share_practice`, exact `practiceGameId`, and no real `duelId`.
- Runtime: waiting creators receive Telegram-native `Share Demo Duel`; inline cards open the exact Demo Duel; first-time recipients are attributed before Terms and return to the exact join prompt after acceptance.
- Integrity: referral code must belong to the Demo Duel creator; code/game-owner mismatch fails attribution. Typed start-intent reads cannot consume another intent type.
- Safety: Demo play does not activate referrals, create referral rake, touch real ledger/balances, or publish to Community Open Duels. No migration or Vercel change.
- QA: 17/17 new tests; 78/78 targeted; 1020/1020 repository tests in four exhaustive 255-test groups; compileall PASS; red proof 15 new feature assertions failed on the old baseline while 2 pre-existing boundary assertions remained green.
- Live acceptance: creator share → clean recipient → Terms → exact join → settlement, plus referral-unactivated and fail-closed negative checks.


## STEP-DEMO-MODE-UX-AND-LIVE-ACCEPTANCE-001C — Production UX, Atomic Rematch and Demo Observability

- Status: **DEPLOYED / OPERATOR-CONFIRMED WORKING**.
- Date: 2026-07-17.
- Mode: **HEAVY / R4**; escalated from STANDARD because same-opponent rematch crosses a concurrent create/join boundary.
- Risk score: **9/12**.
- Base: `RollDuel_BASELINE_2026-07.12.13_STEP_DEMO_MODE_INVITE_AND_REFERRAL_PARITY_001B_FULL.zip`, operator-confirmed working.
- Runtime: balance-aware stake keyboard; conditional Restore Demo Balance; bounded lobby with creator/stake/expiry; result next-actions; generic `m_<invite_code>` Demo result sharing; atomic same-opponent rematch; actual payout in practice history; HTML-safe opponent rendering.
- Admin: `/admin/observability` exposes waiting/active/overdue, 24-hour completions/timeouts, Demo players, wallet supply, reserved stakes, total simulated supply and simulated fee, explicitly outside real liabilities and treasury.
- Integrity: duplicate rematch clicks reserve once; opponent joins the same child; participants and stake come from DB; nonparticipants and insufficient balance fail closed.
- Safety: no real balance, ledger, provider, deposit, withdrawal, settlement, referral activation, Community feed, acquisition, asset gate, migration or Vercel change.
- QA: 22/22 new tests PASS; 110/110 Demo/referral/community targeted PASS; exhaustive repository split-run 240/240 + 258/258 + 256/256 + 288/288 = **1042/1042 PASS**; compileall PASS; locale source coverage PASS; old baseline red proof **22/22 FAILED** as expected.
- Live acceptance: operator reported the deployed flow working; supplied Railway logs confirm two complete Demo rounds, rematch scheduling and clean settlement timer removal. Residual balance/share/admin/EN-RU branches remain automated-test covered unless separately evidenced.


## STEP-POSTGRES-STALE-CONNECTION-RESILIENCE-001 — Neon Idle Session Resilience

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-17.
- Mode: **HEAVY / R4**; risk score 10/12 due to shared PostgreSQL transaction and scheduler infrastructure.
- Base: `RollDuel_BASELINE_2026-07.12.14_STEP_DEMO_MODE_UX_AND_LIVE_ACCEPTANCE_001C_FULL.zip`, operator-confirmed working.
- Trigger: Railway logs confirmed stale Neon SSL sessions reaching the first `/start` query and scheduler advisory-lock acquisition; operator observed first `/start` hanging and second attempt succeeding.
- Runtime: pool validates every checkout using `ConnectionPool.check_connection`; surplus idle sessions retire after 300 seconds; deployment floor is `psycopg_pool>=3.2.8`.
- Retry boundary: no generic transaction replay. One retry is permitted only for idempotent expired runtime-state cleanup and pre-side-effect scheduler lock acquisition.
- User path: `/start` and startup cleanup are best-effort; housekeeping failure cannot suppress the menu.
- Scheduler: retry once, then fail closed and skip the tick rather than run without leadership.
- Error truth: rollback failure no longer masks the original exception.
- Safety: no migration, schema, ledger, balance, provider, deposit, withdrawal, referral, acquisition, duel settlement, Community feed, or asset-gate change.
- QA: 10/10 new tests; 24/24 targeted; 1052/1052 exhaustive repository tests; compileall PASS; old-baseline red proof 10/10 failed.
- Live acceptance: idle-wakeup `/start` must succeed once; broadcast/giveaway scheduler ticks must complete without stale-SSL APScheduler errors before 12.15 promotion.

## STEP-DUEL-TIMEOUT-TRUTH-AND-UX-001 — One Authoritative Duel Clock

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-17.
- Mode: **HEAVY / R4**; risk score 10/12 because the STEP changes real stake reservation expiry, active-game deadlines, scheduler recovery and concurrent join boundaries.
- Base: `RollDuel_BASELINE_2026-07.12.15_STEP_POSTGRES_STALE_CONNECTION_RESILIENCE_001_FULL.zip`, operator-confirmed deployed and working.
- Trigger: private copy said 10 minutes while mechanism used 15; active Telegram timeout used 60 seconds while the database/fallback deadline used 300 seconds.
- Product policy: Public 15m, Private 15m, Quick 30s, Demo 10m, started duel 60s, reminder after 30s.
- Runtime: per-kind waiting deadlines are atomic; expired/private rows are excluded from public and Quick matching; expired joins fail before player-2 reservation; active join stores `started_at` and a 60-second deadline atomically; runtime uses two reminders plus one shared timeout; restart recovery uses the stored deadline.
- UX: created cards state duration/refund; lobby and status show `MM:SS`; private 10-minute lie removed; expiry surfaces refund/create-again actions; admin observability exposes the same policy.
- Deliberate exclusions: no per-second edits and no user-selectable timeout presets.
- Safety: no migration, financial formula, provider, ledger, deposit, withdrawal, referral, acquisition, Community eligibility or asset-gate change.
- QA: 17/17 new; exhaustive repository split 236/236 + 274/274 + 217/217 + 342/342 = **1069/1069 PASS**; compileall PASS; old-baseline red proof 15 feature assertions failed while 2 policy-helper assertions passed.
- Live acceptance: Railway health, 15m/30s/10m copy, lobby countdown refresh, 60s active deadline, refund, restart-without-extension and admin policy panel remain operator smoke requirements.

## STEP-DUEL-SHARE-COPY-AND-EXPIRY-CONTEXT-001 — Deterministic Deadline-Aware Share Copy

- Status: **IMPLEMENTED / QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-17.
- Mode: **STANDARD**.
- Risk score: **6/12**.
- Base: `RollDuel_BASELINE_2026-07.12.16_STEP_DUEL_TIMEOUT_TRUTH_AND_UX_001_FULL.zip`.
- Runtime: public/Quick, private and Demo waiting-duel shares render stake, current `MM:SS`, one-roll mechanics and context-specific EN/RU truth at inline-query time.
- Deep-link boundary: public/Demo referral-aware links unchanged; private continues to use `duel_<private_invite_code>` without new referral attribution.
- Failure boundary: non-owner, closed, expired and malformed share requests return no dead-link article.
- Deliberate exclusions: no random copy rotation, no per-second edits, no settlement/referral/money changes.
- QA: 13/13 new; 89/89 targeted; 1082/1082 exhaustive repository regression; compileall and locale JSON PASS; old baseline red proof 12 feature failures / 1 existing boundary pass.
- Candidate: `RollDuel_BASELINE_2026-07.12.17_STEP_DUEL_SHARE_COPY_AND_EXPIRY_CONTEXT_001_FULL.zip`.

## STEP-REFERRAL-ENGLISH-LOCALE-PURITY-FIX-001 — English Referral Cabinet and Locale Purity

- Status: **IMPLEMENTED / TARGETED QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-18.
- Mode: **STANDARD**.
- Risk score: **8/12** because the fix spans the complete English locale and referral presentation fallbacks, while remaining outside money/referral calculation paths.
- Base: `RollDuel_BASELINE_2026-07.18.zip`; SHA-256 `a74c4d7fc730b18e850d0f90cc37d256de316db46568621a10f0eff9926b20c5`.
- Trigger: English Referral Cabinet displayed Russian Weekly Challenge copy and Russian navigation labels.
- Audit: `locales/en.json` contained 79 Cyrillic values; one (`btn.lang_switch_to_ru = 🌐 Русский`) is intentional, 78 were incorrect English-locale content.
- Runtime: translated all unintended Cyrillic values; referral inline fallback defaults now fail safe to English rather than Russian.
- Regression guard: English locale purity test allowlists only the Russian language-switch label and checks the reported Weekly Challenge/navigation strings plus source fallback defaults.
- Safety: no referral attribution, activation, rake-share, tier, weekly challenge calculation, ledger, balance, provider, settlement, reservation, schema, migration, or callback-routing change.
- QA: English unexpected Cyrillic `0`; RU/EN keys `1169/1169`; placeholder mismatches `0`; direct translator render PASS; targeted pytest `10/10 PASS`; compileall PASS.
- Full-suite boundary: collection environment-blocked by missing `python-telegram-bot`; dependency installation timed out, therefore no full-suite PASS is claimed.
- Live acceptance: deployment smoke must confirm English Referral Cabinet/subpages and unchanged Russian mode.

## STEP-QUICK-DUEL-STAKE-TRUTH-HOTFIX-001 — Canonical Matched-Stake Rendering

- Status: **IMPLEMENTED / EXHAUSTIVE SOURCE QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-18.
- Mode: **HEAVY / CRITICAL**.
- Risk score: **12/12** because the change crosses Quick Duel smart matching, canonical money reservation service returns, concurrent join behavior and user-facing financial truth.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_REFERRAL_ENGLISH_LOCALE_PURITY_FIX_001_FULL.zip`; SHA-256 `0f4a4420ef21ec3e23d61f0b37238c0e5da29101dfb9d62f2f79a0f3bdd9bca9`.
- Trigger: Quick Duel could request `1.00 GRAM`, match a compatible `1.20 GRAM` waiting game, reserve `1.20 GRAM`, then render the original `1.00 GRAM` search amount.
- Contract: `requested_amount` is the search target; `bet_amount` from the canonical game service is financial truth. Post-match UI must render `bet_amount`, with DB `games.bet_amount` as compatibility fallback.
- Runtime: `create_game_with_reservation()` and `join_game_with_reservation()` now return canonical `bet_amount` and `asset`; `quick_duel_match()` returns requested and actual amounts; waiting and matched cards distinguish target, reserved and final stakes.
- Safety: ±20% tolerance unchanged; no settlement, fee, payout, randomness, referral, provider, schema, migration, timeout or asset-gate change.
- QA: 8/8 new tests PASS; exhaustive repository split `196/196 + 269/269 + 333/333 + 295/295 = 1093/1093 PASS`; compileall PASS; locale key/placeholder parity PASS.
- Live acceptance: deploy and confirm exact, lower and higher matched stake cards in EN/RU; verify the displayed amount against the game and active reservation in operator evidence.



## STEP-DUEL-SERIES-BO3-FOUNDATION-001 — Feature-Gated Best-of-3 Real Duels

- Status: **IMPLEMENTED / EXHAUSTIVE SOURCE QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-19.
- Mode: **HEAVY / CRITICAL**.
- Risk score: **12/12** because the STEP adds a PostgreSQL migration and concurrent multi-round state transitions above real stake reservations and exactly-once settlement.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_QUICK_DUEL_STAKE_TRUTH_HOTFIX_001_FULL.zip`; SHA-256 `03463260f25a285dc8064b51913118784b819f4de5e381bf72fb224c531e6c7f`.
- Product contract: Quick Duel remains single-round. `Best of 3` is an explicit ordinary-duel format, first to two counted round wins, with one stake per player for the whole match.
- Money contract: one existing reservation per player; no per-round ledger mutation; one call to canonical `settle_game()` only after final score or timeout/draw-limit terminal evidence.
- Concurrency: PostgreSQL locks the game row with `FOR UPDATE`; SQLite tests use `BEGIN IMMEDIATE`; duplicate rolls are idempotently rejected; `(game_id, round_number, attempt_number)` uniquely identifies immutable round evidence.
- Recovery: intermediate rounds refresh the existing durable duel timeout; process death after score completion is recovered from `status='settling'`; one-sided timeout awards the whole match once; impossible two-roll unprocessed state fails closed with a refund.
- UX: explicit format picker, BO3 scoreboard, draw replay, final score, format-preserving rematch, format-aware waiting/share/community cards and Telegram Admin canary toggle.
- Rollout: setting `duel_series_bo3_enabled` defaults to `false`; deployment does not expose BO3 until an operator enables the canary.
- Safety: Quick Duel matching/tolerance, deposits, withdrawals, provider integration, fee formula, referral percentages, asset gates and the legacy single-round state machine remain unchanged.
- QA: 17/17 new tests PASS; 218/218 targeted regression PASS; exhaustive repository split `255/255 + 242/242 + 217/217 + 396/396 = 1110/1110 PASS`; compileall and locale JSON PASS.
- Live acceptance: Railway migration/startup, Admin toggle, EN/RU BO3 create/join, 2–0, 2–1, draw replay, timeout forfeit, restart recovery, settlement/reservation evidence and Quick Duel single-round regression remain operator smoke requirements.

## STEP-DEMO-MODE-LOCALE-AND-STAKE-UX-HOTFIX-001D — Per-Participant Locale and Flexible Demo Stake UX

- Status: **IMPLEMENTED / EXHAUSTIVE SOURCE QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-19.
- Mode: **STANDARD with HEAVY boundary checks**.
- Risk score: **9/12** because the STEP changes persistent Telegram input state, Demo create callbacks, same-opponent rematch copy and participant notifications, while remaining isolated from real money.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_DUEL_SERIES_BO3_FOUNDATION_001_FULL.zip`; SHA-256 `b31a408d224a99ae23b91e271aba77cbef0ca857b7cdbcda099b70f960f6bf3d`.
- Locale truth: a Demo join now resolves the owner and joiner translator independently; one participant's language can no longer leak into the other participant's start card or roll prompt.
- Stake UX: affordable presets remain; playable users also receive `All Demo Balance` and `Custom Amount`; custom input is bounded by `0.5 <= stake <= current Demo balance`, accepts comma or dot decimals, rejects non-finite/invalid/stale values, and revalidates active-game and balance state before creation.
- Rematch truth: a Demo rematch explicitly preserves the previous stake and tells users to create a new Demo Duel to choose a different stake.
- Restore policy: unchanged — restore is available only below the 0.5 Demo GRAM minimum and only without a waiting/active Demo Duel; restore returns the balance to the configured training seed.
- Safety: no real GRAM, ledger, reservation, settlement, provider, deposit, withdrawal, referral activation, Community publication, BO3 real-game state, schema or migration change.
- QA: 8/8 new tests; 91/91 Demo/locale/BO3 targeted; 1118/1118 exhaustive repository regression across four non-overlapping groups; compileall PASS; locale parity `1210/1210`; placeholder mismatches `0`.
- Live acceptance: deploy, confirm RU owner + EN joiner and inverse language pairing, custom/all-in creation, rematch copy, restore boundary, then resume BO3 live acceptance.


## STEP-DUEL-SERIES-POST-MATCH-ROLL-KEYBOARD-CLEANUP-003 — Terminal Dice Keyboard Cleanup

- Status: **IMPLEMENTED / EXHAUSTIVE SOURCE QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-19.
- Mode: **STANDARD with HEAVY terminal-state checks**.
- Risk score: **9/12** because the patch changes terminal Telegram lifecycle behavior after real-game settlement and timeout, while leaving all money and game-state mutations untouched.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_DEMO_MODE_LOCALE_AND_STAKE_UX_HOTFIX_001D_FULL.zip`; SHA-256 `85fa5a9809b9ba50f238cd156b08f72c714b2e8435e59e7e8c1ea37919ce1fec`.
- Trigger: during live BO3 acceptance, the player who sent the final roll retained the persistent `🎲` reply keyboard after the match had settled; later dice messages correctly hit the no-active-duel guard but the stale keyboard remained.
- Root cause: Telegram accepts only one `reply_markup` type per message. The BO3 terminal card used `InlineKeyboardMarkup` for result actions, so it could not simultaneously send `ReplyKeyboardRemove` to the final roller.
- Runtime: each BO3 terminal result now removes the reply keyboard first and then sends a compact inline result-actions card; stale post-terminal dice also remove the keyboard before returning the main menu. Timeout-forfeit winners and losers both receive explicit keyboard removal.
- Safety: no settlement, reservation, fee, payout, ELO, randomness, round-state, timeout policy, schema, migration, provider, balance or referral change.
- QA: 3/3 new regression tests PASS; 56/56 targeted BO3/Demo/timeout/locale tests PASS; exhaustive repository partitions total **1121/1121 PASS**; compileall PASS.
- Live acceptance: deploy and verify that both players lose the `🎲` reply keyboard after BO3 `2–0` and `2–1`; one deliberate stale dice update must return the menu without leaving the keyboard visible.

## STEP-SHARE-RESULT-LOCALE-CONTEXT-HOTFIX-004 — Per-User Share and Player-Surface Locale Truth

- Status: **IMPLEMENTED / EXHAUSTIVE SOURCE QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-19.
- Mode: **STANDARD**.
- Risk score: **8/12** because the STEP changes Telegram inline share composition and several locale-context call sites, while remaining outside game, money and settlement state.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_DUEL_SERIES_POST_MATCH_ROLL_KEYBOARD_CLEANUP_003_FULL.zip`; SHA-256 `443cab7cf12b338a11c04e229331b98fcf8869b80280571c9f51becff42b5a29`.
- Trigger: a Russian player shared a completed BO3 result and Telegram composed an English post (`I just played an epic duel`, `Best of 3`, `Final score`, `Rematch`, `Join me`).
- Root cause: `services/social.get_result_share_payload()` generated user-facing copy with hardcoded English literals after the result UI itself had already resolved the player's locale.
- Runtime: result-share payloads now resolve the sharer's persisted language or accept the active translator explicitly; BO3 score, single-round score, outcome, streak, CTA and composer text are locale-backed. Generic invite/duel/Demo/result share payloads use the referrer's locale as well.
- Additional audit fixes: duel-history command/deep-link calls now pass the active translator; waiting-opponent and date rendering no longer leak English; `/mode`, group deep-link context and Terms-decline retry preserve the user's language.
- Safety: no game state, round state, settlement, reservation, fee, payout, ELO, referral attribution, deep-link format, provider, schema or migration change.
- QA: 6/6 new tests PASS; 45/45 targeted share/BO3/Demo/locale regression PASS; exhaustive repository partitions total **1127/1127 PASS**; compileall PASS; RU/EN locale parity `1242/1242`; placeholder mismatches `0`; unexpected Cyrillic in EN locale `0`.
- Live acceptance: deploy and confirm RU and EN result sharing for BO3 and single-round, plus RU history, `/mode`, group deep-link and Terms-decline surfaces.

## STEP-DEMO-MODE-BO3-PARITY-005 — Feature-Gated Best-of-3 Demo Duels

- Status: **IMPLEMENTED / EXHAUSTIVE SOURCE QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-19.
- Mode: **HEAVY / CRITICAL**.
- Risk score: **12/12** because the STEP adds an additive PostgreSQL migration, a concurrent multi-round Demo state machine, timeout/restart recovery and exactly-once Demo balance settlement.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_SHARE_RESULT_LOCALE_CONTEXT_HOTFIX_004_FULL.zip`; SHA-256 `d56a519787f7dbeb2c89b765f389c0119e00b12196baf68da44340abf3a88865`.
- Product contract: Demo Mode now mirrors real-duel format choice: `Single Round` or recommended `Best of 3`; one Demo stake covers the whole match and no real GRAM is used.
- State: `practice_games` stores format, wins required, round score, current round and current attempt; `practice_duel_rounds` stores immutable round/attempt evidence.
- Concurrency: PostgreSQL row locks and SQLite immediate transactions serialize transitions; optimistic `(current_round, current_attempt)` context rejects stale rapid dice updates crossing a round boundary.
- Settlement: one Demo balance debit per player at join/create; no per-round mutation; one idempotent `settle_practice_game()` after final score, timeout or safety draw.
- Recovery: `status='settling'` is durable restart evidence; draw replay, bounded draw attempts and impossible timeout states fail closed without inventing outcomes.
- UX: per-participant RU/EN cards, format-aware lobby/join/share/result/rematch, scoreboard, draw replay, keyboard cleanup and real-duel CTA.
- Rollout: `practice_series_bo3_enabled` defaults to `false`; operator canary toggle is exposed in Telegram Admin.
- Safety: real ledger, reservations, rake, referrals, deposits, withdrawals, CryptoBot, Quick Duel and accepted real BO3 logic are unchanged.
- QA: 8/8 new; 108/108 targeted; exhaustive 1135/1135 across 132 files and 12 partitions; compileall, locale parity, placeholder parity and English purity PASS.
- Live acceptance: migration 040, single-round regression, Demo BO3 2-0/2-1/draw/timeout, restart recovery and Demo balance evidence remain operator smoke requirements.


## STEP-TOURNAMENT-BO3-BRACKET-PARITY-006 — Feature-Gated Best-of-3 Tournament Brackets

- Status: **IMPLEMENTED / EXHAUSTIVE SOURCE QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-19.
- Mode: **HEAVY / CRITICAL**.
- Risk score: **12/12** because the STEP changes tournament schema, bracket advancement, timeout/restart recovery and the path leading to the single final tournament payout.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_DEMO_MODE_BO3_PARITY_005_FULL.zip`; SHA-256 `ed55646823097f05371255b8e47abb1e729cc751cf6aa646382060fbb4530a6c`.
- Format contract: each new tournament snapshots `single` or `best_of_3`; the default-OFF setting affects only tournaments created after a toggle. BO3 is first to two round wins and normal tied rounds replay.
- Money contract: tournament entry stakes remain reserved once per participant; bracket games stay `settlement_mode=no_payout`; no match-level reservation, payout, rake or referral mutation is added; only the champion receives the existing final prize settlement.
- Bracket truth: BO3 advancement occurs only after a verified `2:x` terminal score or explicit timeout forfeit. A BO3 terminal draw/safety limit pauses the bracket for review and never falls back to the legacy coin flip.
- Idempotency: `(tournament_id, tournament_round, tournament_slot)` identifies one game and `(tournament_id, round, bracket_slot)` identifies one match record; database uniqueness and row locks prevent duplicate advancement/next-round creation.
- Recovery: a terminal game whose bracket hook did not run is recovered from committed `games.winner_id`; a fully completed round whose next round/champion action did not run is resumed idempotently. Settlement replay restores bracket progression without duplicate terminal cards.
- UX: format-aware create/list/status/history/start cards, BO3 scoreboards, localized next-round/champion/manual-review messages and a Telegram Admin canary toggle.
- Safety: legacy single-round tournaments remain available while the flag is OFF; ordinary real duels, Demo, Quick Duel, deposits, withdrawals, provider integration, tournament fee formula and referral economics remain unchanged.
- QA: 13/13 new tests PASS; 100/100 targeted regression PASS; exhaustive repository split totals 1148/1148 PASS across 133 test files and 12 non-overlapping partitions; compileall and locale parity PASS.
- Live acceptance: migration 041, flag-OFF single tournament regression, flag-ON four-player BO3 bracket, draw replay, 2–0, 2–1, timeout, restart-at-score, exactly-once champion payout and admin/history evidence remain operator smoke requirements.

## STEP-SHARED-DUEL-LIVE-STATUS-AND-CONVERSION-007 — Lifecycle-Aware Inline Duel Cards

- Status: **IMPLEMENTED / EXHAUSTIVE SOURCE QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-19.
- Mode: **STANDARD with HEAVY lifecycle/replay QA**.
- Risk score: **10/12** because the STEP adds persistent shared state, Telegram chosen-inline feedback, asynchronous editing, lifecycle races and durable retries, while remaining outside the money core.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_TOURNAMENT_BO3_BRACKET_PARITY_006_FULL.zip`; SHA-256 `c2d6d304eb170197cc97e0f19d6da4a89eab8568ad9a2bf0cd2fed465b2efdc9`.
- Trigger: shared waiting-duel cards embedded a countdown that became stale and remained a dead join CTA after join, expiry, cancellation or completion.
- Contract: initial inline copy is stable and countdown-free; `chosen_inline_result.inline_message_id` binds a card to authoritative real/Demo duel state; lifecycle transitions render a state-appropriate CTA.
- Persistence: additive `shared_inline_messages` table; unique inline-message binding; per-card locale; TTL; bounded edit attempts; disabled/expired terminal binding states.
- Runtime: `shared_inline_sync` is a durable fast reconciliation job. Join, cancel, waiting expiry and terminal settlement schedule reconciliation only after game-state commit. Telegram delivery is best-effort and cannot rollback or mutate game/money truth.
- Conversion states: waiting→specific join; active→create own; finished→score + play; expired/cancelled/closed→fresh duel CTA.
- Scope boundary: real and Demo inline-query cards are supported. Tournament sharing currently uses conventional `t.me/share/url`, which provides no `inline_message_id`, so dynamic tournament-card editing is explicitly excluded rather than simulated.
- Operational dependency: BotFather inline feedback must be enabled for `chosen_inline_result`. Missing feedback degrades to the existing static deep-link card without gameplay impact.
- QA: 11/11 new tests PASS; 128/128 targeted PASS; exhaustive repository evidence `1159/1159 PASS` across all 134 test files; compileall PASS; locale parity `1301/1301`; placeholder mismatch `0`; unexpected Cyrillic in EN `0`.
- Live acceptance: deploy migration 042, enable inline feedback, verify multi-chat waiting→active→finished, waiting→expired, RU/EN independent rendering and deleted-card isolation.

## STEP-SHARED-DUEL-BRANDED-PREVIEW-008 — Branded OG Preview for Lifecycle-Aware Duel Cards

- Status: **IMPLEMENTED / EXHAUSTIVE SOURCE QA PASSED / DEPLOYMENT PENDING**.
- Date: 2026-07-19.
- Mode: **STANDARD with HEAVY lifecycle compatibility checks**.
- Risk score: **9/12** because the STEP changes Telegram inline rendering, public redirect/OG routes and lifecycle edits while remaining outside gameplay and money state.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_SHARED_DUEL_LIVE_STATUS_AND_CONVERSION_007_FULL.zip`; SHA-256 `eff82b3f5b3434647543583e634bbd178929addb2ec59b0a8e2a450c585b6ed1`.
- Product contract: waiting real/Demo inline cards use a stable 1200×630 Roll Duel brand preview, a compact fallback link and one canonical CTA; dynamic stake/status remains text derived from repository truth.
- Runtime: `/share/duel/<id>` and `/share/practice/<id>` serve localized OG metadata and immediately redirect to the validated Telegram start parameter. Lifecycle edits use state-specific preview URLs and Bot API large-media/show-above-text options via PTB `api_kwargs`.
- Degradation: when no public `APP_BASE_URL` exists, cards remain text-only and canonical `t.me` buttons continue working. Preview routing and Telegram cache/edit failures cannot mutate game state.
- Assets: the generated banner is normalized to exact `1200×630` JPEG/PNG/WebP variants and replaces the prior generic OG artwork used by Railway invite/share routes and the landing metadata.
- Safety: no game, Demo balance, ledger, reservation, settlement, tournament, referral, deposit, withdrawal, provider, schema or migration change.
- QA: 7/7 new tests PASS; 91/91 targeted share/lifecycle/Demo/tournament/runtime tests PASS; exhaustive repository partitions total **1166/1166 PASS** across 135 test files; compileall, locale coverage, asset geometry and artifact reconstruction PASS.
- Live acceptance: deploy, confirm `/app/assets/og_preview.jpg` and one `/share/...` page, then share one RU Demo and one EN real duel and verify large preview, compact fallback link, CTA, and waiting→active→finished/expired lifecycle edits.


## STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009 — Existing Community + Private Group Menus

- Status: **IMPLEMENTED / SOURCE QA IN PROGRESS / DEPLOYMENT PENDING**.
- Date: 2026-07-20.
- Mode: **STANDARD with HEAVY privacy/state checks**.
- Risk score: **10/12** because the STEP uses a newly released raw Bot API surface, private balance presentation, group administration rights and delivery fallback behavior, while remaining outside all money mutations.
- Base: `RollDuel_BASELINE_2026-07.18_STEP_SHARED_DUEL_BRANDED_PREVIEW_008_FULL.zip`; SHA-256 `f574265b034673a02669f7a5709aef76bbfd2c2a9fc3cf0ab8f4a7e5b3db88c4`.
- Community truth: the existing `@rollduelchat` forum and its topic IDs remain canonical; no replacement group or duplicate topics are introduced. The official channel, forum and bot are intended to be linked through Telegram Community by an operator.
- UX: allowlisted group commands `/play`, `/balance`, `/tournament` and `/help` are registered through raw Bot API 10.2 with `is_ephemeral=true`; responses preserve the invoking forum topic and are visible only to the invoking user and the bot.
- Privacy: balance and account state never fall back to a public group message. If ephemeral delivery fails, the only fallback is the user's private bot chat; if DM is unavailable, delivery fails closed.
- Compatibility: the repository remains pinned to `python-telegram-bot==20.7`; a narrow raw Bot API adapter is used instead of a broad dependency upgrade.
- Rollout: `TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED=0` by default; `TELEGRAM_EPHEMERAL_GROUP_ALLOWLIST` fails closed and is configured for `@rollduelchat`. Global group commands remain empty.
- Money boundary: group commands are read-only/navigation surfaces; duel join, reservation, tournament entry, deposit, withdrawal and settlement remain in the established private bot flow.
- QA: `New tests 8/8 PASS; targeted 69/69 PASS; exhaustive 1174/1174 PASS across 136 test files / 12 non-overlapping partitions; compileall PASS; locale parity 1315/1315; placeholder mismatches 0; unexpected Cyrillic in EN 0 excluding the intentional Russian language-switch label.`.
- Live acceptance: operator links the existing channel/forum/bot into a Community, confirms bot admin rights, enables the feature, runs `/ephemeral_status`, verifies RU/EN private commands and validates DM fallback without a public data leak.
- Evidence: `docs/operations/STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009_OPERATOR_RUNBOOK.md`, `docs/process/STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009_RPT.md`, `tests/test_telegram_community_ephemeral_group_ux_009.py`.
