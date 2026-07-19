# Roll Duel — Decision Registry

Version: `DR-001`
Purpose: record accepted architecture and product decisions so they are not re-litigated every STEP.

---

## DR-001 — Classic Telegram Bot Is Primary Surface

Status: `Accepted`
Rationale: The classic bot path is simpler, Telegram-native, and already operational. Mini App is retained but dormant by default.
Impact: Product work defaults to bot-first unless a STEP explicitly reactivates Mini App.

## DR-002 — PostgreSQL Is Production Backend

Status: `Accepted`
Rationale: Money paths, ledger, reservations, webhook dedupe, and runtime jobs require durable production storage.
Impact: SQLite is local/dev compatibility only.

## DR-003 — Ledger/Reservations Are Money Truth

Status: `Accepted`
Rationale: Direct balance mutation is unsafe for real-money flows.
Impact: Deposits, withdrawals, refunds, settlement, and adjustments must preserve ledger/accounting intent.

## DR-004 — PvP-Only Is Current Product Boundary

Status: `Accepted`
Rationale: Product positioning is player-versus-player. House/bot liquidity creates economic, trust, and perception risk.
Impact: No bot opponent, no hidden house edge, no liquidity engine in near roadmap.

## DR-005 — Quick Duel Is Primary Growth Loop

Status: `Accepted`
Rationale: Time-to-fun is the core retention constraint; lobby-only UX feels like escrow marketplace.
Impact: Quick Duel v2 receives priority after production smoke.

## DR-006 — DB-First Matchmaking Before Redis

Status: `Accepted`
Rationale: Current stage needs product validation and production confidence before adding Redis dependency.
Impact: Redis pools are future scaling, not near-roadmap requirement.

## DR-007 — Production Smoke Before Public Growth Push

Status: `Accepted`
Rationale: Source tests are not enough for real money. Deposit/duel/withdraw must be live-verified.
Impact: Public launch and aggressive marketing wait for STEP-PROD-SMOKE-005.

## DR-008 — CogniForge Truth Boundary Is Mandatory

Status: `Accepted`
Rationale: Project history includes multiple docs and evolving implementation. Claims must distinguish source-confirmed, live-confirmed, inference, and planned.
Impact: Future handoffs and docs must include verified/not-verified status.

## DR-009 — Single Payment Provider for Current Product

Status: `Accepted`
Rationale: Provider-scoped funds, mixed-provider duel provenance, and dual treasury coverage would materially increase money-path complexity before product validation.
Impact: Current Roll Duel remains CryptoBot deposit + CryptoBot withdrawal. xRocket or another provider is backlog/white-label research, not current-bot scope.

## DR-010 — Acquisition Attribution Is Separate from Referrals

Status: `Accepted`
Rationale: Marketing source and inviter economics represent different truths. Combining them would create accidental rewards and corrupt attribution.
Impact: `acq_<code>` records first/last touch and campaign events only. `i_<code>` remains the referral path.

## DR-011 — Controlled Cohort Before Unrestricted Growth

Status: `Accepted`
Rationale: Real-money source QA and dashboards are necessary but not sufficient for unrestricted traffic.
Impact: Start with 5–10 users for 24–48 hours, review money/runtime/support/acquisition evidence, then expand deliberately.

## DR-012 — Multi-Model Canonical Coordinator

Status: `Accepted`
Rationale: Parallel model branches and stale handoffs can silently reintroduce superseded migrations or money paths.
Impact: ChatGPT holds canonical coordination and final acceptance; z.ai implements assigned scopes; Claude performs independent review when available. Old branches require rebase and audit before merge.

## DR-013 — Community Entry Routes Through Verification Topic

Status: `Accepted`
Rationale: Telegram forum newcomers can land in a language topic while Shieldy's CAPTCHA is posted in `Start Here / Rules`, creating a hidden-verification UX failure.
Impact: Generic `Join Community` and `All community topics` links route to topic `/1`. Direct EN/RU chat and Open Duels topic links remain available after verification. The group root remains a reference URL, not the primary unverified-user entry.


## DEC-POSTGRES-STALE-CONNECTION-RETRY-BOUNDARY-001

**Decision:** validate pooled PostgreSQL sessions before checkout and never generically replay a transaction body.

**Reason:** a transport failure may occur after PostgreSQL executed/committed a write but before the client received confirmation. Automatic transaction replay could duplicate a payout, ledger mutation, reservation, withdrawal, or other side effect.

**Allowed bounded retries:** one retry for an explicitly idempotent expired-state DELETE and one retry for session advisory-lock acquisition before the scheduler job body.

**Fail-closed rule:** without confirmed scheduler leadership, skip the tick. User-facing `/start` housekeeping is best-effort because it is nonessential maintenance.

## DECISION — One deterministic share template per duel context

**Step:** `STEP-DUEL-SHARE-COPY-AND-EXPIRY-CONTEXT-001`
**Date:** 2026-07-17

Use stable EN/RU templates populated with authoritative stake and deadline data at the moment Telegram requests the share article. Do not rotate 10–15 random marketing variants before cohort data exists.

Rationale:

- deterministic copy is testable and brand-consistent;
- current `MM:SS` creates honest urgency without artificial scarcity;
- random variants obscure conversion attribution and multiply locale/QA surface;
- private links must preserve invite-code authorization and must not silently acquire referral semantics;
- expired or closed waiting games must fail closed instead of producing a shareable dead link.

## DEC-QUICK-DUEL-STAKE-TRUTH-001 — Search Target Is Not Financial Truth

**Status:** Accepted
**Step:** `STEP-QUICK-DUEL-STAKE-TRUTH-HOTFIX-001`
**Date:** 2026-07-18

Quick Duel may search within a configured tolerance, so the user's requested amount is only a matchmaking target. The authoritative financial amount is the `bet_amount` validated and reserved by the canonical game create/join service and persisted on the game row.

Impact:

- post-match Telegram copy must render canonical `bet_amount`, never the original search target;
- waiting copy renders the amount actually reserved for the created game;
- service result contracts expose `bet_amount` and `asset` explicitly;
- DB `games.bet_amount` is the backward-compatible fallback for older result shapes;
- changing the tolerance or adding pre-reservation consent is a separate product decision, not part of this hotfix.



## DEC-DUEL-SERIES-BO3-001 — Quick Is Speed; Best of 3 Is the Explicit Full Match

**Status:** Accepted
**Step:** `STEP-DUEL-SERIES-BO3-FOUNDATION-001`
**Date:** 2026-07-19

Roll Duel keeps two distinct product contracts:

- `single`: one roll per player, used by Quick Duel and retained as the default;
- `best_of_3`: first to two counted round wins, available only through explicit format selection and a feature-gated canary.

Financial and safety impact:

- one stake and one active reservation per player cover the entire BO3 match;
- round outcomes never create ledger entries or settle funds independently;
- the canonical game settlement executes once after terminal score evidence;
- equal rolls replay the same round and are stored as immutable attempts;
- a bounded draw-attempt limit fails closed as a full refund with no fee;
- Best of 5, ranked queues and separate matchmaking liquidity are not implied by this decision and require evidence plus separate approval.

## DEC-DEMO-STAKE-AND-LOCALE-TRUTH-001D — Demo UX May Be Flexible, but State and Language Remain Participant-Authoritative

**Status:** Accepted  
**Step:** `STEP-DEMO-MODE-LOCALE-AND-STAKE-UX-HOTFIX-001D`  
**Date:** 2026-07-19

Demo Mode follows two explicit contracts:

- each Telegram participant receives cards and prompts through that participant's persisted language, never through the language of the user who triggered the shared transition;
- a newly created Demo Duel may use an affordable preset, the user's full current Demo balance, or a custom amount between the minimum stake and the authoritative current Demo balance.

Safety impact:

- the service remains authoritative for minimum stake, active-game exclusion and balance deduction;
- custom input state is persistent, bounded and cleared on navigation or successful creation;
- all-in means the current Demo wallet balance at callback execution, not a previously rendered amount;
- rematch keeps the original stake and does not silently reopen stake negotiation;
- Demo balance restore remains a recovery-to-playability mechanism, not a repeatable top-up above the minimum-play boundary;
- none of these decisions create real ledger, provider, referral or treasury effects.


## DECISION — Terminal Telegram Reply Keyboard Removal Precedes Inline Result Actions

- Date: 2026-07-19.
- Status: **ACCEPTED**.
- Context: Telegram `sendMessage.reply_markup` is a tagged union; one message cannot both remove a persistent reply keyboard and carry inline action buttons. BO3 terminal results previously selected inline actions and therefore left the final roller's `🎲` keyboard visible.
- Decision: terminal real-duel flows must first send the authoritative terminal result with `ReplyKeyboardRemove`, then send a separate compact action panel with `InlineKeyboardMarkup`. Stale dice received after terminal state must also remove the reply keyboard before rendering navigation.
- Trade-off: one additional Telegram message at match completion in exchange for deterministic keyboard cleanup for both participants.
- Invariants: this presentation split may not create a second settlement, alter game truth, or treat Telegram delivery as settlement evidence. Database state remains authoritative.

## DEC-SHARE-RESULT-LOCALE-CONTEXT-004 — Share copy belongs to the sharer locale

**Step:** `STEP-SHARE-RESULT-LOCALE-CONTEXT-HOTFIX-004`  
**Date:** 2026-07-19

User-generated Telegram share content must be rendered in the language of the user who opens the share composer. A game has no single global presentation locale: mixed-language opponents may share the same result independently and receive different localized payloads from the same authoritative game row.

Implementation rules:

1. Result payload builders accept a bound translator and fall back to the sharer's persisted language.
2. Structured game truth (score, rolls, outcome, URL) remains language-neutral; only rendering is localized.
3. Inline-query handlers pass the already-resolved user translator into the payload builder.
4. Generic share payloads use the referrer's persisted language rather than a hardcoded English default.
5. Presentation fixes must not change deep-link attribution, game state, money state or settlement semantics.

## DEC-DEMO-BO3-PARITY-005 — Demo mirrors real formats without sharing the money core

**Step:** `STEP-DEMO-MODE-BO3-PARITY-005`  
**Date:** 2026-07-19  
**Status:** ACCEPTED

Demo Mode is an onboarding simulation of the live product, so it exposes the same explicit format choice: `Single Round` and `Best of 3`. The BO3 rules reuse the canonical concepts of first-to-two, draw replay, bounded attempts, score and terminal settlement, but Demo balances remain structurally isolated from the real ledger and reservation system.

Decision rules:

1. One Demo stake per player covers the whole match.
2. Intermediate rounds never mutate balances.
3. Demo round evidence lives in `practice_duel_rounds`, separate from real `duel_rounds`.
4. Final Demo payout is applied exactly once by the existing Demo settlement service.
5. Stale dice updates carry an optimistic round/attempt context and cannot become an unintended roll in the next round.
6. Restart and timeout decisions derive only from database evidence; impossible states fail closed.
7. `Best of 3` is recommended but optional; single-round Demo remains available.
8. Demo BO3 rollout is controlled by a default-OFF operator setting.

Trade-off: an additive Demo-specific table is preferred over polymorphic reuse of the real round table because it keeps real-money audit boundaries explicit and reduces accidental coupling.


## DEC-TOURNAMENT-BO3-BRACKET-PARITY-006 — Tournament matches use verified series truth

**Step:** `STEP-TOURNAMENT-BO3-BRACKET-PARITY-006`  
**Date:** 2026-07-19  
**Status:** ACCEPTED FOR CANDIDATE

A tournament bracket match may advance only from durable verified game evidence. New tournaments may snapshot `Best of 3`; normal tied rounds replay, first to two wins advances, and a terminal state without a verified winner pauses for review. The legacy coin flip is retained only for already-declared single-round tournaments.

Decision rules:

1. Tournament entry stake is reserved once for the whole tournament.
2. Bracket games are no-payout evidence games; they never settle ordinary duel winnings.
3. Tournament format is immutable after creation, so a feature-toggle change cannot alter an active bracket.
4. Bracket slot identity and advancement are database-idempotent.
5. A timeout forfeit may award the match, but history records a terminal score consistent with the declared format.
6. Restart recovery derives winner/round state from committed database evidence and never guesses a BO3 winner.
7. Champion payout remains the single existing tournament settlement and must stay replay-safe.

Trade-off: BO3 increases match duration and timeout surface, but removes one-roll/coin-flip advancement from the new competitive format and makes tournament outcomes coherent with ordinary and Demo BO3.

## DEC-SHARED-INLINE-LIFECYCLE-007 — Shared cards follow DB truth and remain outside gameplay truth

**Step:** `STEP-SHARED-DUEL-LIVE-STATUS-AND-CONVERSION-007`  
**Date:** 2026-07-19  
**Status:** ACCEPTED FOR CANDIDATE

A Telegram inline duel card is an acquisition/read surface, never a game-state authority. When Telegram supplies `chosen_inline_result.inline_message_id`, Roll Duel may bind that card to a real or Demo duel and edit it after committed lifecycle transitions.

Decision rules:

1. The database game row is authoritative; Telegram content is a projection.
2. Cards update only on meaningful events, not through per-minute polling.
3. Initial copy contains no static countdown that can become false.
4. Join, expiry, cancellation and completion schedule best-effort asynchronous reconciliation after state commit.
5. One duel may bind multiple cards; each is localized using the sharer's persisted language.
6. A deleted/non-editable card is disabled locally; Telegram failure cannot affect stakes, reservations, settlement, bracket advancement or balances.
7. Terminal/expired cards convert to a fresh-play CTA instead of retaining a dead join button.
8. Bindings have bounded retries and TTL; old social state is not retained indefinitely.
9. `chosen_inline_result` requires BotFather inline feedback. Absence is a safe static-card degradation, not a launch failure in the game core.
10. Conventional tournament share URLs are not falsely represented as editable inline cards; support requires a future tournament inline-query surface.

Trade-off: the system adds one small persistent social projection and asynchronous Telegram edits, in exchange for materially better conversion and removal of misleading stale cards. The projection is deliberately isolated from all money and bracket invariants.

## DEC-SHARED-DUEL-BRANDED-PREVIEW-008 — Brand media is static; duel truth remains dynamic text

**Step:** `STEP-SHARED-DUEL-BRANDED-PREVIEW-008`  
**Date:** 2026-07-19  
**Status:** ACCEPTED FOR CANDIDATE

Shared duel cards may use one stable Roll Duel OG image to improve recognition and conversion, but no stake, timer, username, match result or lifecycle state may be embedded into that image.

Decision rules:

1. The canonical join/create destination remains the validated Telegram deep link.
2. A public `/share/...` URL exists only to provide OG metadata and redirect to that canonical destination.
3. Dynamic state stays localized text rendered from database truth and is updated by the existing shared-inline lifecycle projection.
4. The card includes one compact fallback link and one primary inline CTA; raw URLs are not displayed as visual noise.
5. Large-media/show-above-text options are best-effort presentation parameters, never gameplay dependencies.
6. Missing `APP_BASE_URL`, preview cache failure or Telegram edit failure degrades to a functional text/deep-link card.
7. The branded image is exact 1200×630 and versioned in preview URLs to avoid stale asset cache after rollout.

Trade-off: the STEP adds a small public presentation route and larger static asset, but preserves the existing editable text card instead of introducing non-editable photo messages or duplicating game state in media.


## DR-014 — Community UX Is Private Presentation, Not Money Truth

Status: `Accepted / STEP-009`
Rationale: Telegram Communities and ephemeral group messages improve discovery and reduce forum clutter, but delivery is not guaranteed and Telegram messages must not become canonical game or financial state.
Decision:
- Reuse the existing `@rollduelchat` forum and its current topics.
- Link the official channel, forum and bot through operator-side Telegram Community settings.
- Scope ephemeral commands to an explicit fail-closed allowlist.
- Permit only read-only/navigation group surfaces in the initial rollout.
- Fall back only to private DM; never expose balance or account state publicly.
- Keep database, ledger, reservations, tournament state and private bot confirmations authoritative.
Impact: Future group UX may add private confirmation cards only when the underlying action remains idempotent and independently evidenced by the canonical service layer.
