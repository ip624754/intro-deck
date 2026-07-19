# HANDOFF — Roll Duel Current Canon and Multi-Model Coordination

**Date:** 2026-07-19
**Status:** `BO3 + SHARED BRANDED PREVIEW LIVE ACCEPTED / COMMUNITY EPHEMERAL UX CANDIDATE PENDING`
**Current operator-confirmed live lineage:** `RollDuel_BASELINE_2026-07.18_STEP_SHARED_DUEL_BRANDED_PREVIEW_008_FULL.zip` — SHA-256 `f574265b034673a02669f7a5709aef76bbfd2c2a9fc3cf0ab8f4a7e5b3db88c4`
**Current candidate:** `RollDuel_BASELINE_2026-07.18_STEP_TELEGRAM_COMMUNITY_AND_EPHEMERAL_GROUP_UX_009_FULL.zip` (existing Community/forum canon plus feature-gated Bot API 10.2 private group menus; final SHA-256 is recorded in the external artifact manifest; deployment and operator Community linking pending)
**Coordinator:** ChatGPT
**Implementation partner:** z.ai for explicitly assigned STEP scopes
**Independent auditor when available:** Claude



## 0. Current authoritative update — Telegram Community and ephemeral group UX 009

`STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009` is implemented on top of the operator-confirmed branded-preview live baseline. The existing `@rollduelchat` forum remains canonical; no replacement chat or duplicate topics are created. The official channel, player forum and bot are prepared to be linked through Telegram's operator-side Community settings.

```text
Forum: @rollduelchat
Channel: @RollDuelOfficial
Bot: @rollduelbot
Existing topic IDs: 1 / 35 / 37 / 39 / 41 / 43 / 45 / 47
```

The bot keeps global group commands empty and installs chat-scoped Bot API 10.2 commands only for an explicit allowlist. `/play`, `/balance`, `/tournament` and `/help` use `is_ephemeral=true`; their responses stay in the invoking forum topic but are visible only to that user and the bot. `/balance` and all account state fail closed: raw API failure falls back only to private DM and never to a public group reply.

The repository remains pinned to PTB 20.7. A narrow raw API adapter uses the shared HTTP client for the new fields instead of introducing a broad dependency migration. The feature defaults OFF and accepts `@rollduelchat` or numeric IDs through `TELEGRAM_EPHEMERAL_GROUP_ALLOWLIST`. The group layer is read-only/navigation only; gameplay confirmations, reservations, tournament entry and all money paths remain in private chat and canonical services.

```text
New STEP tests: 8/8 PASS
Targeted community/tournament/locale regression: 69/69 PASS
Exhaustive repository regression: 1174/1174 PASS across 136 test files / 12 partitions
Python compileall: PASS
RU/EN locale parity: 1315/1315; placeholder mismatches: 0
```

Operator gate: link channel/forum/bot into a Community, confirm `@rollduelbot` is admin, deploy with the flag OFF, enable the allowlisted canary, run `/ephemeral_status`, then verify RU/EN `/play`, `/balance`, `/tournament`, `/help` plus DM-only fallback.


## 0. Current authoritative update — Shared Duel branded preview 008

`STEP-SHARED-DUEL-BRANDED-PREVIEW-008` is operator-confirmed LIVE ACCEPTED on top of the deployed lifecycle-aware shared-card lineage. Real and Demo waiting cards keep their editable text/state projection but now include a controlled Roll Duel OG URL, compact localized fallback link and best-effort large preview above the text.

```text
Static media: Roll Duel 1200×630 brand artwork
Dynamic truth: stake, format, state and CTA remain localized text
Canonical destination: validated Telegram start deep link
Failure mode: text/deep-link card remains functional
```

The public runtime exposes `/share/duel/<id>` and `/share/practice/<id>`. These pages provide localized OG metadata and immediately redirect to the canonical `t.me` destination. Preview URLs are state-specific (`waiting`, `active`, `finished`, `expired`, `closed`) and asset-versioned with `v=008`, while the lifecycle sync continues to update the same inline message. PTB 20.7 passes current Bot API `link_preview_options` via `api_kwargs`, requesting large media above the text without changing the pinned production dependency.

The approved generated banner replaces the older generic preview artwork in both Railway invite/share assets and landing social variants. All files are exact 1200×630; the primary JPEG is optimized for Telegram crawling. No timer, stake, username or result is embedded into the image.

```text
New STEP tests: 8/8 PASS
Targeted share/lifecycle/runtime regression: 91/91 PASS
Exhaustive repository regression: 1166/1166 PASS across 135 test files / 12 partitions
Python compileall: PASS
RU/EN locale keys: 1301/1301
Placeholder mismatches: 0
```

No game, Demo balance, ledger, reservation, settlement, tournament, referral, deposit, withdrawal, provider, schema or migration behavior changed. Live evidence confirmed the public OG asset, Russian preview metadata, large media above text, compact fallback link and primary CTA on Telegram Desktop. Lifecycle truth remains provided by STEP-007.


## 0. Current authoritative update — Shared Duel live status and conversion 007

`STEP-SHARED-DUEL-LIVE-STATUS-AND-CONVERSION-007` is implemented on top of the Tournament BO3 candidate. Telegram inline share cards for real and Demo waiting duels are now bound to authoritative database lifecycle state through `chosen_inline_result` and a durable best-effort runtime job.

```text
waiting  → join the specific open duel
active   → the slot is occupied; create a new duel
finished → show final score; play/create another duel
expired  → create a fresh duel instead of following a dead link
cancelled/closed → safe conversion CTA
```

Initial share cards no longer embed a static minute countdown that becomes false after publication. One duel may have multiple cards in multiple chats; each binding is updated independently in the sharer's persisted RU/EN language. Telegram edit failures, deleted cards and disabled inline feedback are isolated from game, ledger, tournament and Demo truth.

Persistent state lives in `shared_inline_messages`; migration `042_shared_duel_live_status.sql` is additive and uses `ON DELETE RESTRICT`. Lifecycle delivery uses durable `shared_inline_sync` runtime jobs, bounded edit attempts and a default 14-day binding TTL. Exact waiting expiry, join, cancel and terminal transitions schedule social-card reconciliation only after authoritative state commits.

```text
New STEP tests: 11/11 PASS
Targeted share/Demo/BO3/runtime/locale regression: 128/128 PASS
Exhaustive repository regression: 1159/1159 PASS across 134 test files
Python compileall: PASS
RU/EN locale keys: 1301/1301
Placeholder mismatches: 0
Unexpected Cyrillic in EN: 0
```

Operational requirement: BotFather inline feedback must be enabled for `chosen_inline_result` delivery. Without it, cards remain static but deep links and all gameplay continue safely. Tournament invitation sharing remains a conventional `t.me/share/url` surface and is not editable through this inline binding; no false support claim is made.

Next gate: deploy migration 042, enable BotFather inline feedback, share one real and one Demo waiting duel into two chats, then verify waiting → active → finished and waiting → expired transitions plus deleted-card failure isolation. Tournament BO3 live acceptance remains a separate production gate before Cohort 1.


## 0. Current authoritative update — Tournament BO3 bracket parity 006

`STEP-TOURNAMENT-BO3-BRACKET-PARITY-006` is implemented on top of the operator-confirmed Demo BO3 live lineage. New tournaments snapshot their match format at creation; the canary affects only newly created tournaments and defaults to OFF.

```text
Tournament formats: single | best_of_3
BO3 rule: first to 2 counted round wins
Tournament money: one entry reservation per participant for the whole tournament
Bracket match money: no per-match reservation, payout, rake or referral distribution
Rollout: tournament_series_bo3_enabled=false by default
```

BO3 tournament draws replay the same round through the existing real series state machine. The old cryptographic coin flip remains only for legacy single-round tournaments; a BO3 terminal safety draw has no verified winner and therefore pauses the tournament for operator review instead of inventing bracket truth.

Tournament games and match records now carry persistent `(tournament_id, round, bracket_slot)` identity. Database uniqueness plus row locking makes repeated completion and concurrent next-round creation idempotent. A timeout forfeit records an honest terminal `2–0` score. Recovery covers both critical crash windows: a game settled before bracket advancement, and a fully completed round before next-round/champion creation. Tournament entry reservations are consumed only by final champion payout through the existing tournament economy.

```text
Migration: 041_tournament_bo3_bracket_parity.sql
New tests: 13/13 PASS
Targeted tournament/BO3/money/locale regression: 100/100 PASS
Exhaustive repository regression: 1148/1148 PASS across 133 test files / 12 partitions
Python compileall: PASS
RU/EN locale keys: 1280/1280
Placeholder mismatches: 0
Unexpected Cyrillic in EN: 0
```

No ordinary duel, Demo duel, Quick Duel, deposit, withdrawal, provider, real settlement, referral percentage or tournament entry/payout formula changed. Next gate: deploy with Tournament BO3 OFF, verify migration 041 and a legacy single-round tournament, enable the canary, then run one controlled four-player BO3 tournament including draw replay, 2–0/2–1, timeout, restart recovery, exactly-once final payout and bracket history. After live acceptance, proceed to `STEP-COHORT-1-MONETIZED-SOFT-LAUNCH-001`.



## 0. Current authoritative update — Demo Mode BO3 parity 005

`STEP-DEMO-MODE-BO3-PARITY-005` is implemented on top of the operator-confirmed BO3/live and Share Result Locale Context lineage. Demo Mode now teaches the actual product loop instead of only a one-roll subset.

```text
Demo formats: single | best_of_3
Demo BO3: first to 2 round wins
Money boundary: one Demo stake per player, zero real ledger/reservation effects
Rollout: practice_series_bo3_enabled=false by default
```

The state machine stores durable round score and immutable `(practice_game_id, round_number, attempt_number)` evidence. Draws replay the same round. An optimistic current-round/current-attempt token prevents a rapid stale dice update from becoming an unintended roll in the next round. Final score moves the game to `settling`; the existing Demo settlement applies the payout exactly once. Restart recovery finalizes durable terminal evidence, and timeout anomalies fail closed rather than inventing a winner.

The Telegram flow mirrors real duels: explicit format picker, BO3 recommended but optional, one stake for the whole match, per-participant RU/EN prompts, scoreboard, draw replay, format-preserving rematch, localized share result, keyboard cleanup and a safe CTA toward real play.

```text
Migration: 040_demo_mode_bo3_parity.sql
New tests: 8/8 PASS
Targeted Demo/BO3/locale regression: 108/108 PASS
Exhaustive repository regression: 1135/1135 PASS
Python compileall: PASS
RU/EN locale keys: 1266/1266
Placeholder mismatches: 0
Unexpected Cyrillic in EN: 0
```

No real ledger, reservation, rake, referral, provider, deposit, withdrawal, Quick Duel or live-accepted real BO3 behavior changed. Next gate: deploy with Demo BO3 OFF, verify migration and single-round Demo, enable the canary, then run Demo BO3 2-0, 2-1, draw, timeout and restart recovery. After live acceptance, proceed to `STEP-COHORT-1-MONETIZED-SOFT-LAUNCH-001`.


## 0. Current authoritative update — Share-result locale context hotfix 004

`STEP-SHARE-RESULT-LOCALE-CONTEXT-HOTFIX-004` is implemented on top of the BO3 post-match keyboard-cleanup candidate.

A Russian player could complete a fully localized BO3, press the localized Share Result button, and still publish an English composer card. The game and ELO were already terminal; the defect was presentation-only. `services/social.get_result_share_payload()` built the score, outcome and CTA with hardcoded English after Telegram had already resolved the sharer's language.

The result payload now renders from the sharer's translator/persisted language. RU and EN opponents can share the same authoritative game independently in their own languages. Generic invite/duel/Demo/result payloads also inherit the referrer's locale. The same audit corrected confirmed locale-context omissions in duel history, `/mode`, group deep-link context and Terms-decline retry copy.

```text
New tests: 6/6 PASS
Targeted share/BO3/Demo/locale regression: 45/45 PASS
Exhaustive repository regression: 1127/1127 PASS
Python compileall: PASS
RU/EN locale keys: 1242/1242
Placeholder mismatches: 0
Unexpected Cyrillic in EN locale: 0
Migration: none
```

No game, round, settlement, reservation, fee, payout, ELO, referral attribution, deep-link format, provider, schema or migration behavior changed. Deploy this candidate, verify RU/EN result sharing, then continue `STEP-DUEL-SERIES-BO3-LIVE-ACCEPTANCE-002`.


## 0. Current authoritative update — BO3 post-match roll-keyboard cleanup 003

`STEP-DUEL-SERIES-POST-MATCH-ROLL-KEYBOARD-CLEANUP-003` is implemented on top of the Demo locale/flexible-stake candidate. During live BO3 acceptance, the player who sent the final roll retained the persistent `🎲` Telegram reply keyboard even though settlement and ELO completed. The root cause was presentation-only: the terminal BO3 result used inline result actions, while Telegram permits only one reply-markup type and therefore could not remove the persistent reply keyboard on that same message.

The terminal flow now sends the authoritative result with `ReplyKeyboardRemove`, then sends the inline result-action panel separately. The same fail-safe cleanup is applied when a stale dice message reaches the no-active-duel guard, and timeout-forfeit terminal notifications remove the keyboard for both winner and loser.

```text
New tests: 3/3 PASS
Targeted BO3/Demo/timeout/locale regression: 56/56 PASS
Exhaustive repository regression: 1121/1121 PASS
Python compileall: PASS
Migration: none
```

No game state, settlement, reservation, fee, payout, ELO, randomness, provider or balance logic changed. Deploy this candidate, confirm keyboard removal for both users after BO3 2–0/2–1, then continue `STEP-DUEL-SERIES-BO3-LIVE-ACCEPTANCE-002`.

## 0. Current authoritative update — Demo locale and flexible stake UX 001D

`STEP-DEMO-MODE-LOCALE-AND-STAKE-UX-HOTFIX-001D` is implemented on top of the BO3 foundation candidate.

```text
Demo locale invariant:
each participant receives start/reminder copy in that participant's persisted language

Demo stake invariant:
0.5 <= selected stake <= authoritative current Demo balance
```

The mixed-language start defect is removed: an EN joiner no longer causes the RU owner to receive English start cards or roll prompts, and the inverse pairing is covered. Affordable presets remain, while `All Demo Balance` and `Custom Amount` add explicit flexible creation. Custom input accepts comma/dot decimals, rejects invalid/non-finite/over-balance values, rechecks active-game state, and uses the service-returned canonical stake in the created card.

Demo rematch keeps the original stake and now states this explicitly. To change the stake, users create a new Demo Duel. The restore contract remains unchanged: restore is available only below the minimum playable balance and only without a waiting/active Demo Duel.

```text
New tests: 8/8 PASS
Targeted Demo/locale/BO3 regression: 91/91 PASS
Exhaustive repository regression:
404/404 + 284/284 + 248/248 + 182/182 = 1118/1118 PASS
Python compileall: PASS
RU/EN locale keys: 1210/1210
Placeholder mismatches: 0
Migration: none
```

No real balance, ledger, reservation, settlement, provider, deposit, withdrawal, referral activation, Community publication, BO3 real-game state or schema changed. Railway Telegram smoke remains required before this candidate is promoted; after that, continue `STEP-DUEL-SERIES-BO3-LIVE-ACCEPTANCE-002`.

## 0. Current authoritative update — Best-of-3 foundation

`STEP-DUEL-SERIES-BO3-FOUNDATION-001` is implemented on top of the Quick Duel stake-truth candidate. Quick Duel remains one round. Ordinary real duels can use an explicit `Best of 3` format only when the operator enables `duel_series_bo3_enabled`; the default is `false`.

```text
BO3 invariant:
one game + one reservation per player + immutable round history + one final settlement

New migration: 039_duel_series_bo3_foundation.sql
New BO3 tests: 17/17 PASS
Targeted regression: 218/218 PASS
Exhaustive repository regression:
255/255 + 242/242 + 217/217 + 396/396 = 1110/1110 PASS
Python compileall: PASS
Locale JSON: PASS
```

The PostgreSQL game row is locked for each round transition. Duplicate rolls do not mutate state. Draws replay the same round; a bounded repeated-draw limit refunds both stakes with no fee. A process death after a terminal score is recovered from durable `settling` evidence. Public/private waiting cards, share copy, result sharing and rematch preserve the format.

No Quick Duel tolerance, provider, deposit, withdrawal, fee formula, referral percentage, asset gate or legacy single-round semantics changed. Production migration, Telegram flow and restart recovery remain not live-verified.

## 0. Current authoritative update — Quick Duel stake truth

`STEP-QUICK-DUEL-STAKE-TRUTH-HOTFIX-001` is implemented on top of the current Referral English Locale candidate.

Quick Duel smart matching keeps the configured ±20% tolerance, but the search amount is now explicitly treated as a target rather than financial truth. The canonical game create/join services return the exact validated and reserved `bet_amount` and `asset`; `quick_duel_match()` propagates both `requested_amount` and canonical `bet_amount`; Telegram renders the canonical amount after matching and uses the created reservation amount while waiting.

```text
Financial invariant:
displayed matched stake == games.bet_amount == player-2 active reservation amount

New regression tests: 8/8 PASS
Exhaustive repository regression (split):
196/196 + 269/269 + 333/333 + 295/295 = 1093/1093 PASS
Python compileall: PASS
RU/EN key and placeholder parity: PASS
Migration: none
```

Covered cases: exact match, lower compatible match, higher compatible match, insufficient balance for the higher candidate, service return contract, Telegram display truth, backward-compatible DB fallback and RU/EN copy semantics.

No tolerance, settlement, fee, payout, randomness, referral, provider, schema, migration, timeout or asset-gate behavior changed. Railway live smoke remains required.

## 0. Current authoritative update — English locale purity

`STEP-REFERRAL-ENGLISH-LOCALE-PURITY-FIX-001` is implemented on the canonical `RollDuel_BASELINE_2026-07.18.zip` repository truth.

The reported English Referral Cabinet mixed Russian Weekly Challenge and navigation text because `locales/en.json` contained Russian values. A complete English-locale audit found 79 Cyrillic values: one intentional language-switch label and 78 incorrect values. All 78 were translated, referral fallback defaults were made English, and a regression test now blocks unexpected Cyrillic in the English locale.

```text
English unexpected Cyrillic: 0
RU/EN keys: 1169/1169
Placeholder mismatches: 0
Direct translator render: PASS
Targeted pytest: 10/10 PASS
compileall: PASS
Full repository pytest: environment-blocked by missing python-telegram-bot; no full-suite PASS claimed
```

No referral calculation, rake payout, ledger, balance, settlement, reservation, migration, or callback-routing behavior changed. Deployment smoke remains required.

## 0. Current authoritative update — duel timeout truth

`STEP-DUEL-TIMEOUT-TRUTH-AND-UX-001` is deployed and operator-confirmed through live EN/RU public and Demo creation cards.

`STEP-DUEL-SHARE-COPY-AND-EXPIRY-CONTEXT-001` is QA-passed and awaits Railway smoke. Share messages now disclose stake, current `MM:SS`, one-roll mechanics and context-specific real/private/Demo truth. Expired shares fail closed and existing deep-link/referral contracts remain unchanged.

```text
13/13 new tests PASS
1082/1082 exhaustive repository tests PASS
compileall PASS
```

PostgreSQL stale-connection resilience is deployed and operator-confirmed working. Railway deployment 32 is ACTIVE; first-press `/start` and normal bot behavior were reported healthy.

`STEP-DUEL-TIMEOUT-TRUTH-AND-UX-001` is QA-passed and awaits Railway live smoke. It makes public/private 15m, Quick 30s, Demo 10m, active roll 60s and reminder 30s one authoritative contract across DB deadlines, Telegram jobs, restart recovery, matchmaking, copy and observability.

```text
17/17 new tests PASS
1069/1069 exhaustive repository tests PASS
compileall PASS
```

## 1. Product and stack

Roll Duel is a Telegram-native P2P GRAM dice-duel product with ledger-backed stake reservations, CryptoBot deposits/withdrawals, referrals, tournaments, giveaways, operator guardrails, Web Admin, Telegram Admin, community forum feeds, a Next.js landing, and acquisition analytics.

Stack: Python, `python-telegram-bot`, PostgreSQL/Neon, Railway, Telegram Bot API, Crypto Pay, Next.js/Vercel.

## 2. Current production boundary

```text
GRAM: LIVE
CryptoBot deposits: LIVE
CryptoBot withdrawals: LIVE
USDT: OFF / HOLD
SOL: OFF / HOLD
TRX: OFF / HOLD
Arbitrary Jetton deposits: HARD-DISABLED
Mini App: disabled/dormant
```

Do not enable USDT/SOL/TRX or arbitrary Jetton deposits from old branches, environment variables, or partial provider work.

## 3. Accepted live sequence

The current production lineage includes:

```text
STEP-110R1 multi-asset schema foundation with GRAM-only release boundary
→ result-sharing and withdrawal-provider minimum fixes
→ Launch Week GRAM operations docs
→ referral onboarding/status coherence Round 2
→ event-driven fast runtime jobs / Neon polling reduction
→ arbitrary Jetton deposit structural disable + live audit
→ Community Surfaces
→ EN/RU Community Duel Topic Feed
→ Community Launch Content pack
→ Withdrawal Failure Resolution
→ Acquisition Attribution Foundation 001A
→ Acquisition Web Cockpit 001B
→ Decimal Audit Hotfix 001B1
→ Acquisition Landing Propagation 001D
→ Acquisition Telegram Cockpit 001C
→ Project Canon and Multi-Model Handoff Sync 001
→ Community Verification Entry Routing 001 (operator-confirmed working)
→ Demo Mode Core Coherence 001A
→ Demo Mode Invite and Referral Parity 001B
→ Demo Mode UX and Live Acceptance 001C
→ PostgreSQL Stale Connection Resilience 001 (operator-confirmed deployed/working)
```

## 4. Community and branding

Official channel: `https://t.me/RollDuelOfficial`
Players community root: `https://t.me/rollduelchat` (`Roll Duel Players`)
Primary community entry: `https://t.me/rollduelchat/1` (`Start Here / Rules`, Shieldy verification)

Topics:

```text
Start Here / Rules:          https://t.me/rollduelchat/1
Open Duels — English:        https://t.me/rollduelchat/35
Открытые дуэли — Русский:    https://t.me/rollduelchat/37
English Chat:                https://t.me/rollduelchat/39
Русский чат:                 https://t.me/rollduelchat/41
Wins & Highlights:           https://t.me/rollduelchat/43
Support & Bugs:              https://t.me/rollduelchat/45
Ideas & Feedback:            https://t.me/rollduelchat/47
```

Live feed binding:

```text
chat_id: -1003938974789
English topic_id: 35
Russian topic_id: 37
```

Operator-confirmed: EN/RU waiting cards publish correctly, Join buttons render, and cards project terminal unavailable/cancelled states. Practice/private/tournament/non-GRAM exclusions are regression-covered.

Branding:

- Bot: two dice + `ROLL DUEL`.
- Official channel: clean `RD` monogram + `ROLL DUEL`.
- Players chat: dynamic green/blue dice without text.

Shieldy accepted production config:

```text
captchaType=button; timeGiven=60; strict=true; restrict=false
banUsers=false; skipVerifiedUsers=true; cas=true; adminLocked=true
```

Generic community CTAs route through topic `/1`; language chats and Open Duels retain direct topic links after verification.

## 5. Acquisition and marketing system

Live capabilities:

```text
acq_<code> first-touch / last-touch attribution
campaign registry and statuses
Web Acquisition Cockpit
Decimal-safe operator audit
/go/<code> tracked redirects
landing ?campaign=<code> propagation
preview/crawler separation
Telegram Acquisition Cockpit
/acquisition
/campaigns
/campaign <code>
```

Acquisition is strictly separate from referrals. Campaign links do not create or modify referral rewards.

Smoke campaigns:

```text
test01: archived
land01: archived
```

Recommended real campaigns:

```text
ch01 — official channel launch post
x01  — personal X launch post
li01 — LinkedIn builder story
dm01 — direct invite cohort
tg01, tg02... — one code per external Telegram placement
```

Use `/go/CODE` for Telegram groups/comments, landing `?campaign=CODE` for X/LinkedIn, and direct bot deep links for personal invites where click telemetry is not required.


## 5A. Demo Mode current truth

`STEP-DEMO-MODE-CORE-COHERENCE-001A` is deployed. It provides authoritative fee-adjusted settlement, Demo-only statistics, low-balance refill, exact waiting/active deadlines, restart recovery and duplicate-finalization protection.

```text
Starting balance: 20 Demo GRAM
Waiting deadline: 10 minutes
Active roll deadline: 60 seconds
Fee: same effective basis-point rule as real duel, applied to total Demo bank
Real ledger/referral activation/community feed: unchanged and excluded
```

Accepted Demo Mode 001A–001C adds exact referral-aware invites, Terms-safe restoration, lobby/create UX, result sharing, atomic rematch, corrected history, and isolated Demo observability. Candidate 001D adds per-participant locale truth plus all-in/custom stake creation while preserving the existing restore boundary. Demo play remains excluded from real referral activation and referral rake.

## 6. Money and operational evidence

Recent operator evidence:

- liabilities fully covered at the reviewed snapshot;
- CryptoBot diagnostics green;
- guardrails clean;
- recovery center clean after resolving the historical `AMOUNT_TOO_SMALL` withdrawal incident;
- `/healthz` and `/readinessz` return `ok: true`;
- the historical withdrawal was resolved as an operator incident without rewriting its original failed status, provider evidence, ledger, or reserve truth;
- historical Neon audit returned zero `jetton_deposit` ledger rows.

Truth boundary:

```text
CONTROLLED SOFT LAUNCH: HOLD UNTIL DUEL TIMEOUT 001 LIVE SMOKE
FULL UNRESTRICTED LAUNCH: NOT YET FORMALLY ACCEPTED
```

Still capture before claiming unrestricted GO:

1. fresh `/admin/release-gate` screenshot showing `GO` after incident resolution;
2. one current-lineage end-to-end deposit → real duel → settlement → withdrawal cycle.

## 7. Latest QA evidence

```text
Duel Timeout Truth and UX 001 candidate:
17/17 new tests PASS
1069/1069 repository tests PASS
  236/236 + 274/274 + 217/217 + 342/342
Python compileall PASS
No migration; no Vercel change

PostgreSQL resilience 001 deployed base:
10/10 new tests PASS
24/24 targeted PASS
1052/1052 repository tests PASS
Operator-confirmed working on Railway deployment 32
```

The 12.16 timeout candidate remains deployment/live-smoke pending. Do not claim production timing or restart acceptance before the operator checklist.

## 8. Multi-model coordination

### ChatGPT

Canonical coordinator. Owns STEP scope, risk mode, Truth Boundary, independent audit, artifact acceptance, production evidence, and documentation synchronization.

### z.ai

Implementation contributor for explicitly assigned STEP scopes. Current reported pause point:

```text
STEP-110D1 PostgreSQL Acceptance Harness V3 — Final Corrective
```

Treat that work as a parallel historical branch. Do not apply it over the current baseline without a fresh diff, migration/schema audit, asset-gate audit, money-path review, and full regression.

### Claude

Independent auditor/cross-reviewer when available. Current reported pause point:

```text
STEP_WALLET_ARCHETYPES_V1_04B
```

This appears to be another workstream unless explicitly mapped to Roll Duel. When Claude returns, provide the current canonical baseline and `ROLLDUEL_MASTER_COORDINATION_HANDOFF_2026-07-15.md` before requesting review.

## 9. Immediate plan

1. Apply `STEP-DUEL-TIMEOUT-TRUTH-AND-UX-001` over accepted 2026-07.12.15.
2. Verify public/private 15m, Quick 30s, Demo 10m and active 60s/30s reminder copy.
3. Verify lobby `MM:SS`, single refund and restart without deadline extension.
4. Promote 2026-07.12.16, then capture fresh Release Gate `GO`.
5. Continue Cohort 1 only with per-placement acquisition codes.

Do not add timeout presets or per-second Telegram edits without a separate evidence-backed STEP.

## 10. Start-here files for any model or new chat

1. `handoff-current.md`
2. `docs/00_CURRENT_STATE.md`
3. `docs/new_chat/ROLLDUEL_MASTER_COORDINATION_HANDOFF_2026-07-15.md`
4. `docs/new_chat/01_NEW_CHAT_START_HERE.md`
5. `docs/knowledge/STEP_REGISTRY.md`
6. `docs/knowledge/ARTIFACT_REGISTRY.md`
7. `docs/knowledge/DECISION_REGISTRY.md`
8. `docs/00_PROJECT_CANON/RD-CANON-000_Project_Canon.md`
