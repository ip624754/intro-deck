# 00_CURRENT_STATE

## Project
Intro Deck

## Current source baseline
STEP060 — AI/News Drafts Approval Foundation

## Layer
HEAVY / AI evidence / external providers / explicit publishing / idempotency / audit

## Source-confirmed
- STEP060 adds an operator-first AI/news drafting flow: topic preset/custom query → NewsData.io source selection → minimized evidence snapshot → OpenAI structured draft → exact preview/edit → explicit approval → existing STEP059 one-shot LinkedIn publishing.
- No background or automatic publishing exists. OpenAI requests use `store=false`; NewsData/OpenAI keys and LinkedIn OAuth tokens are not persisted in draft evidence.
- Draft validation requires the exact source URL, rejects unsupported numeric claims and quotations, and binds structured evidence claims to exact source substrings.
- Migration `030_ai_news_drafts_approval.sql` adds preferences, source snapshots, drafts, audit events, input sessions, and source binding on the canonical LinkedIn share intent.
- STEP059 remains the only LinkedIn publishing core. Unknown provider outcomes remain non-retryable to prevent duplicate posts.
- Media, scheduling, organization posts, analytics, autonomous agents, and unattended publishing remain out of scope.
- Source URLs are normalized, tracking fragments are removed, and credential-bearing/private-network URLs are rejected.
- Article fields are sanitized and treated as untrusted prompt data; source text cannot override AI instructions or expose secrets.
- Operator diagnostics expose rollout/configuration state without provider keys or raw payloads.
- AI/news Help and CTA surfaces remain hidden when the feature is disabled or the member is not eligible.

- STEP059 adds one explicit text-only Share Profile on LinkedIn rail for active/listed profiles.
- The exact post text and visibility are shown before any LinkedIn authorization; listing a profile, connecting LinkedIn, or buying Pro never publishes automatically.
- `w_member_social` is isolated to the signed one-shot share intent and is not added to base `LINKEDIN_SCOPES`.
- Publishing uses the current LinkedIn Posts API path `POST /rest/posts`; the access token is used in memory for that call and is not persisted.
- Migration `029_linkedin_share_profile.sql` adds durable share intents/events, provider receipts, unresolved-user uniqueness, state constraints, and audit history.
- User advisory lock + row claim serialize duplicate/concurrent callbacks. Provider 4xx is confirmed failure; network/timeout/5xx/missing post ID is non-retryable `unknown`.
- Provider success followed by local receipt failure is also non-retryable `unknown`; it is never downgraded to retryable failure.
- A `publishing` or `unknown` intent blocks a new share until evidence-based reconciliation.
- Shared posts deep-link to the exact listed Intro Deck profile using `start=profile_<id>`.
- STEP059 remains text-only and is reused as the publishing core; STEP060 adds AI/news drafting above it without adding automatic publishing.
- STEP059 canonical Node `20.20.2` QA is `76/89` PASS versus STEP058B1 `75/88`, with the same 13 inherited failures and new failures `0`; `npm audit` reports 0 vulnerabilities.
- The Verified on LinkedIn Lite application pack is prepared, but Lite approval remains an operator-controlled LinkedIn review outcome.

- STEP058B1 retries `/verificationReport` once without `verificationCriteria` only after a primary HTTP 400.
- Invalid optional verification ENV disables only Verified on LinkedIn; health, webhook, Telegram, and base OIDC remain available.
- Development/Lite scope is `r_profile_basicinfo r_verify`.
- LinkedIn request IDs and request strategy are retained without tokens or raw payloads.
- OAuth invite-reward reads are sequential on one checked-out PostgreSQL client.
- No migration is required.

- STEP058B introduces a canonical trust resolver for snapshot freshness, exact category badges, public eligibility, and fail-closed reasons.
- Public badge eligibility requires Lite mode, explicit feature enablement, a fresh Lite snapshot, and at least one LinkedIn category.
- Development snapshots remain private and cannot appear in the public directory.
- Directory cards show only exact identity/workplace category wording; professional card claims remain member-provided.
- Owner preview exposes a private badge preview and the exact gate that blocks public display.
- Admin user cards expose read-only trust diagnostics without changing verification data.
- Development/Lite use `r_verify`; `r_verify_details` is a Plus-tier scope and is not used by the current Development/Lite integration.
- STEP058B adds no schema migration and does not change OIDC, payment, contact, entitlement, or invite state machines.

- STEP058A adds a gated Development/Lite Verified on LinkedIn client for `/identityMe` and `/verificationReport`.
- Development mode requests `r_profile_basicinfo` and `r_verify` only for configured Intro Deck operators; LinkedIn remains the app-admin access authority.
- Category-only `IDENTITY` and `WORKPLACE` snapshots are stored after migration `028_linkedin_verified_development.sql`.
- Access, refresh, and ID token values plus single-use verification URLs are not persisted.
- Existing snapshots are retained when a refresh is unavailable; base OIDC remains usable.
- STEP058A exposes private tester status only; public badges, ranking, filters, and entitlements remain unchanged.
- Member-entered professional claims remain member-provided.
- `/identityMe` uses API version `202510.03`; `/verificationReport` uses API version `202510`.
- STEP058A local source QA on Node `22.16.0`: syntax PASS, dedicated smoke PASS, full inventory `73/86` PASS versus STEP057 `72/85`, same 13 inherited failures, new failures `0`.
- Node 20 execution and live LinkedIn API behavior remain not verified.

- STEP056 exposes one canonical `🤝 Request contact` entry on every eligible non-self profile card.
- `dir:contact:<profileId>:<page>` resolves current profile mode and renders one explicit options screen.
- Intro-only profiles expose one free intro request; paid-contact profiles expose private-chat and Telegram-contact outcomes with exact Stars price or active Pro coverage.
- Existing `dir:intro`, `dir:dm`, and `dir:unlock` callbacks remain supported for historical Telegram messages and backend compatibility.
- Home and Help expose one `📨 Contact inbox` hub; the hub routes to the existing Requests and Private chats surfaces.
- STEP056 changes no schema, migration, purchase receipt, payment confirmation, entitlement, cooldown, block, replay, or audit state machine.
- STEP055 is operator-confirmed live at artifact `c582529c422915f5bf8b87364be47e957a9e9d71`; STEP056 awaits deploy verification.
- STEP055 defines one deterministic activation sequence: LinkedIn, display name, headline, industry, about, and at least one skill.
- Home, profile setup, saved-field, skills, and preview surfaces share the canonical activation resolver.
- Optional company, city, public LinkedIn URL, hidden Telegram username, and contact mode live on a separate surface.
- Publishing is preview-gated in routing: `p:pub` lists a ready hidden profile; `p:vis` only hides.
- Existing profile field/session repositories are reused; no new schema or parallel profile core is introduced.
- STEP054 defines Intro Deck as a Telegram-native directory of active, listed member profiles with approval-based contact paths.
- LinkedIn sign-in connects basic account identity; member-entered professional claims are not verified by LinkedIn or Intro Deck unless explicitly stated.
- Listed profile cards are visible to bot users; private contact details remain hidden by default.
- Intro requests are sent directly to the profile owner and are not described as third-party warm introductions.
- STEP054 aligns landing, Telegram, Privacy, Terms, README, current state, and BotFather-facing copy.
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
- STEP057 deployed health/config and read-only preflight: operator-confirmed at artifact `615d4014f3463bb40b6ec46c47d3e0879a670b55`
- STEP058A source-confirmed: yes
- STEP058A live-confirmed: no
- migration 028 applied: no evidence yet
- BotFather STEP054 profile copy: operator action not verified in this workspace

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
3. STEP054 proceeded after operator-confirmed STEP053A deployed health/config; complete Stars/concurrency evidence remains partial and tracked separately.

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
4. STEP054 is now source-implemented; deploy and verify the aligned landing/Telegram/legal surfaces, then proceed to STEP055 guided activation.


## STEP054 delta

- Active product copy no longer claims `LinkedIn-verified` identity, trusted professionals, warm introductions, private discovery, or a private directory.
- Canon: LinkedIn-connected account identity + member-provided professional profile + listed cards visible to bot users + approval-based private contact.
- No database, callback, payment, entitlement, or contact state-machine changes.
- Next: deploy, verify live surfaces, apply BotFather copy, then proceed to STEP055 guided activation.

## STEP055 delta

### Source-confirmed
- canonical activation resolver and next-action contract live in `src/lib/profile/contract.js`;
- profile setup uses one primary `Continue setup` action until ready;
- saved-field and skills surfaces route to the next missing requirement;
- ready hidden profiles must pass through Preview before `p:pub`;
- stale legacy `p:vis` no longer lists hidden profiles; it is hide-only;
- optional fields/contact settings are isolated on `p:opt`;
- explicit visibility setter reuses the existing canonical profile repository.

### QA truth
- Node `20.20.2`: `npm run check` PASS;
- dedicated `smoke:guided-activation` PASS;
- full inventory: `70/83` PASS versus STEP054 `69/82`;
- inherited failures remain exactly the same 13; new failures: none;
- no migration required.

### Next
Deploy STEP055, confirm `/api/health?full=1` reports STEP055, then manually exercise the activation path in `@introdeckbot`.


## STEP060 handoff delta

### Source-confirmed
- operator-first `/news` flow: preset/custom query → NewsData source → evidence snapshot → OpenAI structured draft → preview/edit → explicit approval;
- STEP059 remains the only LinkedIn publishing and receipt core;
- OpenAI uses strict JSON Schema output and `store=false`;
- article content is treated as untrusted prompt data;
- exact source URL, numerical claims, quotations, and evidence substrings are validated;
- search and draft allowances are bounded and atomic;
- duplicate source, duplicate approval, stale callback, and provider-unknown paths fail closed;
- optional provider configuration is fail-safe and cannot break health/webhook/base OIDC;
- migration `030_ai_news_drafts_approval.sql` is required;
- no automatic publishing, scheduling, media upload, organization posting, background token storage, or unattended subscription posting exists.

### QA truth
- package: `0.58.0`;
- canonical Node `20.20.2`, npm `10.9.2`;
- dependency install, syntax, dedicated STEP060 smoke, STEP059 compatibility, legal/router/commands/schema, and npm audit PASS;
- full inventory: `77/90` PASS versus STEP059 `76/89`;
- inherited failures remain exactly 13; new failures: `0`.

### Live boundary
- STEP059 deployment/config is operator-confirmed live at artifact `18218eafe3942bc5ceee5319dc7117eada43d3c9`;
- STEP060 migration, provider ENV, deployment, NewsData source retrieval, OpenAI generation, and one real approved post remain not verified until operator rollout.
