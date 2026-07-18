# 00_CURRENT_STATE

## Project
Intro Deck

## Current source baseline
STEP053A — Staging Runtime Acceptance Pack

## Layer
HEAVY / staging acceptance / PostgreSQL concurrency / Telegram Stars evidence

## Source-confirmed
- STEP053 makes `contact_mode` authoritative for new paid direct-contact and DM permission requests.
- Stars now buy request delivery, not guaranteed approval, contact disclosure, or reply.
- Decline/no reply alone has no automatic refund path in the current money core.
- Pro has one bounded combined rolling 24-hour outreach allowance with canonical paid fallback.
- Pair/payment/allowance advisory locks, checkout authorization, policy snapshots, replay checks, and contact audit events are in source.
- Migration `027_contact_contract_payment_honesty.sql` is required; missing STEP053 schema fails closed.
- Invite layer remains a bounded module:
  - `📨 Share invite`
  - `🔗 Link + copy`
  - `🧾 Invite card`
  - `📊 Performance`
  - `📋 Invite history`
- Admin invite snapshot remains read-only under:
  - `👑 Админка` → `🧰 Операции` → `📨 Инвайты`
- Rewards foundation remains implemented in source.
- User read surfaces are now implemented:
  - `🎯 Points` read screen inside invite layer
  - invite root points preview
  - performance/history navigation into points
- Founder/admin invite read truth now includes mode audit, settlement summary, reconciliation warnings, and mode-switch controls on the existing admin invite surface.
- User redeem path remains implemented inside invite rewards surfaces.
- Runtime accrual remains mode-gated.
- Manual settlement batch can now move due pending rewards into available or rejected states.
- Safe default remains `off` until manual verification.

## Rewards activation truth
For Intro Deck, a pending reward can exist only when the invited user:
1. is new to the system;
2. arrived through a valid invite attribution;
3. connected LinkedIn;
4. reached listed-ready state (`profile_state = active`) or is already listed.

Not rewardable:
- raw open
- `/start`
- deep-link open only
- self-invite
- existing user
- profile start without listed-ready threshold

## Pending foundation now in source
- activation reward points: `10`
- confirm window: `24h`
- pending reward is created only when mode is `earn_only` or `live`
- `off` and `paused` do not create new pending rewards
- spendable balance is still `available` only

## Runtime integration points
Pending reward accrual check is now re-run after:
- LinkedIn identity persistence
- profile field save
- skill toggle
- visibility toggle

## Settlement truth now in source
- due pending rewards can be processed through a founder/operator-triggered settlement batch
- confirm writes both `pending_reversal` and `available_credit`
- reject writes `pending_reversal` and a `reject_reason` on the reward event
- repeated settlement runs stay idempotent through event status + ledger entry uniqueness
- `paused` blocks settlement writes

## What this step still does not do
- no cron auto-enable for settlement
- no broad rewards dashboard rewrite
- no new catalog or payout semantics

## What must not break
- LinkedIn OIDC truth
- current invite layer
- admin IA and Russian operator layer
- current monetization / pricing surfaces
- webhook/runtime contracts
- docs canon and artifact protocol

## Live truth boundary
- source-confirmed: yes
- live-confirmed: no
- live status not confirmed — manual verification required

## Redeem truth now in source
- starter catalog:
  - `100 points -> 7 days Pro`
  - `250 points -> 30 days Pro`
- redeem runs only from `available`
- redeem stays blocked in `off`, `earn_only`, and `paused`
- successful redeem uses the canonical Pro subscription rail
- repeated confirm on the same redemption request resolves safely without double-completing that request

## Founder/operator controls now in source
- current mode remains visible in `👑 Админка -> 🧰 Операции -> 📨 Инвайты`
- founder/operator allowlist can switch:
  - `off`
  - `earn_only`
  - `live`
  - `paused`
- recent mode audit is visible in the same admin invite surface

## Rewards corridor continuity
- STEP052.3 — Invite Rewards Foundation remains in source
- STEP052.4 — Invite Rewards Read Surfaces + Founder Read Truth remains in source
- STEP052.5 — Invite Rewards Redeem Foundation + Founder Mode Controls remains in source
- STEP052.6 now adds settlement and live verification hardening on top of that corridor

## Live verification additions now in source
- admin invite surface shows last settlement run summary
- admin invite surface shows reconciliation warning counts
- founder/operator can run a bounded settlement batch from the same invite ops screen
- checklist doc added: `doc/76A_INVITE_REWARDS_LIVE_VERIFICATION_CHECKLIST.md`

## Next recommended step
STEP052.7 — Invite Rewards Ops Polish or broader STEP053 monetization/ops continuation after manual verification


## STEP052.7 polish additions now in source
- admin home / operations / invite top-level copy is now more consistent and action-first
- admin invite surface is now structured as one operator screen: funnel, rewards program, recent signals, settlement, reconciliation, audit, next actions
- admin invite keyboard now groups read actions first and mode writes second
- user invite root copy is now simpler and more action-led
- user points screen now explains pending / available / redeemed in plainer language
- no changes to reward rules, settlement math, redeem mechanics, or role model

## Next recommended step
STEP052.8 — Admin / Invite Deep-Surface Navigation Polish if manual founder pass still finds dead-ends or inconsistent drilldown routing

## STEP052.8 navigation polish additions now in source
- `📨 Инвайты` is now split into focused deep views:
  - overview
  - rewards
  - settlement
  - mode audit
- each invite admin deep view now keeps its own keyboard navigation and clear return path to `🧰 Операции`
- mode switches stay on the focused rewards view instead of being mixed into every invite screen
- settlement actions stay on the focused settlement view with a clear batch/reconcile grouping
- user invite root now explains the three share actions more clearly
- user invite card message now includes navigation back to invite root and points, so it no longer hangs as a dead-end message
- invite link, points, performance, and history screens now follow a more consistent bottom navigation pattern

## Next recommended step
Founder manual pass on the nested admin and invite screens, then either:
- one narrow callback/dead-end hotfix if any real navigation edge remains, or
- broader STEP053 continuation if the 052 corridor is now operationally clean


## STEP052.8.1 copy hotfix additions now in source
- admin invite deep views no longer leak raw `<b>` markup into Telegram
- invite admin screens now explain the current mode effect directly
- rewards / settlement / audit views now use clearer Russian admin labels and next-action hints
- mode switch notices now state that the screen already reflects the new state
- settlement notices now read cleanly for operators
- user invite copy is slightly tighter and more action-first without changing mechanics

## Next recommended step
Founder manual pass in Telegram on nested invite/admin views, then only a real micro-hotfix if one more dead-end or unclear label still appears.

## STEP053 — Contact Contract and Payment Honesty Lock

### Source-confirmed delta
- `intro_request` blocks both new paid contact rails at render, request creation, invoice, pre-checkout, and confirmation boundaries.
- `paid_unlock_requires_approval` is the authoritative mode for those rails.
- Direct-contact and DM Stars products are request-delivery fees; recipient approval remains mandatory.
- Pro uses one combined rolling 24-hour allowance across both rails; default `10`, followed by paid fallback.
- Cross-rail decline cooldown defaults to `30` days; pair blocking closes both new paid rails.
- Payment charges are serialized and checked against canonical purchase receipts to detect cross-product replay.
- Contact/DM decisions are serialized per user pair to reduce duplicate callback and decision races.
- Audit events and policy snapshots preserve the contract used for each critical transition.

### Required runtime configuration
```env
PRO_OUTREACH_DAILY_LIMIT=10
CONTACT_REQUEST_RETRY_COOLDOWN_DAYS=30
PAYMENT_CHECKOUT_AUTH_TTL_MINUTES=30
PAYMENT_CHECKOUT_RETRY_LOCK_SECONDS=1800
```

### Schema truth
- STEP050J migration-required schema compatibility remains canonical: `019_contact_unlock_requests.sql` is required for hidden Telegram username writes and direct-contact unlock flows.
- `019_contact_unlock_requests.sql`, `020_member_dm_relay.sql`, and `021_pricing_receipts_ops.sql` remain prerequisites.
- STEP053 additionally requires `027_contact_contract_payment_honesty.sql`.
- Pre-existing duplicate provider/Telegram charge values can block unique-index creation and must be audited before production migration.

### QA truth
- Node `22.16.0`: `npm run check` PASS.
- STEP053 and selected contact/DM/legal/product contracts PASS.
- Full current inventory: `67/80` PASS.
- Exact baseline comparison: `64/79` PASS. No new failure was introduced; `schema-compat` and `storage` changed from FAIL to PASS.
- Node 20, PostgreSQL migration execution, live Telegram Stars, and live concurrency remain not verified.

## Next recommended step after STEP053
1. Stage migration `027` with duplicate-charge preflight.
2. Run the STEP053 runtime acceptance pack on Node 20 and PostgreSQL.
3. Continue to STEP054 — Positioning and Discovery Truth Alignment only after runtime proof.

## STEP053A — Staging Runtime Acceptance Pack

### Source-confirmed delta
- read-only staging preflight validates Node 20, PostgreSQL schema/indexes, payment-charge ownership, impossible financial states, advisory locks, Telegram bot/webhook state, and deployed health;
- mutating database scenarios require an exact staging target, mutation ACK, and database fingerprint ACK;
- isolated fixtures exercise canonical contact, DM, receipt, subscription, and Pro allowance repositories;
- concurrent transactions cover one-winner pre-checkout authorization and the configured Pro limit/N+1 boundary;
- fixture cleanup and residual-row verification are mandatory acceptance checks;
- Telegram Stars/manual callback truth is captured through a 13-scenario evidence manifest and strict validator;
- runtime evidence is ignored by Git and must be archived separately;
- preflight, database runtime, deployed health, and manual evidence are bound to one exact artifact SHA and one database fingerprint.

### Local QA truth
- Node `20.20.2`: syntax and dedicated STEP053A source smoke PASS;
- full Node 20 inventory is `68/81` PASS versus STEP053 `67/80`, with the same 13 inherited failures;
- evidence-template, strict verifier, missing-target guard, and wrong-fingerprint guard are locally verified;
- PostgreSQL staging runtime, deployed health, Telegram webhook, and real Stars flows remain not verified in this workspace.

### Release boundary
STEP053A source implementation does not make STEP053 staging-accepted. A valid `STEP053A_STAGING_ACCEPTANCE_REPORT.md` tied to the exact deployed artifact is required.

## Next recommended step after STEP053A
1. Deploy the STEP053A artifact to staging on Node 20.
2. Run `step053a:preflight` and `step053a:database`.
3. Complete all 13 Telegram/operator-assisted scenarios and generate the staging acceptance report.
4. After GO, continue to STEP054 — Positioning and Discovery Truth Alignment.
