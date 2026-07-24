# Latest handoff — STEP064B1

Canonical candidate: STEP064B1 over exact STEP064A baseline SHA-256 `4ce8b99159022dd8209ced89c3719cd894dbec478687b09b09ee08b7c81d7d0b`.

Implemented: canonical member glossary, simplified Home/Profile/Directory/Requests/Invite/Story finder/Pro/Help, and user-safe error mapping. No migration or ENV change. No callback, payment, invite attribution, ranking, OAuth, or publishing behavior change.

QA: `npm run check` PASS; full smoke 100 PASS / 18 inherited NON_PASS / 118 total; baseline PASS → candidate NON_PASS = 0. Production not verified.

Next action: deploy and run `doc/98_STEP064B1_OPERATOR_ROLLOUT.md`.

---

# STEP064A CURRENT HANDOFF

## Executive summary

- Project: Intro Deck / LinkedIn Telegram Directory Bot.
- Current source step: `STEP064A`; package `0.64.0`.
- Exact baseline: STEP063B-H2 FULL SHA-256 `0465e70c63f5bbcaaf58feb81087d2defc0d467afd3b8e0ba0fa5ad598e6d59d`.
- Current focus: production acceptance of the single-CTA invite card, canonical inline/forwarding photo renderer, simplified invite menu, Activity surface, and rewards-mode-aware Points entry.
- Migration: none. New ENV: none.
- Must not break: `ii_/ic_/il_` attribution, invite/reward accounting, activation rules, STEP059 explicit publication, browse-only AI/news state.

## Source-confirmed

- Public cards have only `Open Intro Deck` and no owner-navigation callbacks.
- Caption no longer duplicates the CTA with `Join Intro Deck`.
- Inline share and forwarding card use one caption/image/keyboard renderer; only the attributed link differs.
- Forwarding delivery uses `replyWithPhoto` with a bounded text fallback.
- Invite root no longer exposes Refresh or separate History; full history is reached through Activity.
- Points is hidden when off and labeled for earn-only/live/paused modes.
- Full smoke comparison has zero baseline PASS regressions.

## Not verified

- Vercel deployment and `/api/health` STEP064A marker.
- Real inline/forwarding photo card in Telegram production.
- Production invite attribution rows after both share paths.
- Conversion impact.

---

# STEP063B-H2 CURRENT HANDOFF

## Executive summary

- Project: Intro Deck / LinkedIn Telegram Directory Bot.
- Current source step: `STEP063B-H2`; package `0.63.6`.
- Exact baseline: STEP063B-H1R1 FULL SHA-256 `926c71fb8c5a2717bf77ab8833520119c9348e58069d1c24fe8653450baa3e0a`.
- Current focus: production acceptance of phrase-based `For you` query precision and final-fit rejection.
- Migration: none. New ENV: none.
- Must not break: migration 036 readiness, exact claim recovery, persistent search UX, browse-only no-draft invariant, STEP059 explicit publication.

## Source-confirmed

- `For you` provider queries use bounded professional phrases rather than standalone generic OR terms.
- Required anchors are separated from ranking-only profile/audience/angle boosts.
- RSS and Hacker News match complete clauses.
- Primary RSS/GitHub sources may prove fit through bounded personalized registry groups.
- Weak fallback content is rejected with bounded reasons; `no_result` is preferred.
- Telemetry includes a sanitized query plan and final-fit evidence.
- Source/focused QA and full smoke comparison passed with no baseline PASS regressions.
- Production deployment and live relevance evidence are not verified.

---

# 15_NEW_CHAT_HANDOFF

## Executive summary

- Project: LinkedIn Telegram Directory Bot
- Current baseline: STEP063A — Multi-Source News Ingestion & Source Quality Foundation
- Current mode: HEAVY / PROVIDER EGRESS / URL SAFETY / SOURCE EVIDENCE / MIGRATION / ROLLOUT GOVERNANCE
- Current focus: apply migration 033, deploy first in `newsdata_only`, enable bounded operator-only `multi_source`, verify provider telemetry and source diversity, then complete one explicit STEP059 publication loop.
- Must not break: LinkedIn OIDC truth, webhook secret guard, router contract, listed/active browse truth, intro persistence, communications/outbox truth, operator allowlist gating

## Source-confirmed

- STEP063A binds to uploaded STEP061A SHA-256 `658d8fa38fd4340d4fd0bc82c3b7fca796a5a929b80930ffb1c0d9a07250c04e`; the stale SHA from the prior plan is rejected.
- Default `newsdata_only` preserves the existing runtime path and is the rollback state.
- `multi_source` adds allowlisted RSS/Atom, Hacker News, GitHub Releases, canonical deduplication, source authority metadata, and NewsData fallback.
- Migration 033 is required before multi-source writes; runtime fails closed with `migration_033_required`.
- Provider egress is exact-host HTTPS-only, redirect-free, timeout-bounded, response-size-bounded, and fan-out-bounded.
- STEP059 remains the only LinkedIn publisher; no adapter or source-ranking decision grants publishing authority.
- Verified: syntax, STEP063A focused source smoke, inherited STEP060/061/061A AI/news contracts, and focused STEP058/059 LinkedIn compatibility contracts on Node 22.16.0.
- Not verified: canonical Node 20 dependency install/full inventory, migration 033 in Neon, Vercel deployment, live provider telemetry, and operator E2E acceptance.


- STEP061A adds provider usage/cost telemetry, a fail-closed rollout-stage gate, a read-only production preflight, and a manual evidence verifier.
- Provider pricing is never guessed: cost rates default to zero and are operator-configured estimates only.
- Missing migration 032 blocks source search/generation before provider budget is consumed.
- `operator_acceptance` remains the default rollout stage; subscription access never grants publication authority.
- STEP059 remains the only LinkedIn publishing core and every post still requires explicit one-post approval.

- STEP061 adds saved personalized news presets with manual, daily, and weekdays modes.
- Pro membership controls access and bounded allowances; operators retain support/testing access.
- Scheduled delivery creates a reviewable Telegram draft only and never invokes LinkedIn publishing.
- Cron execution uses claims, unique scheduled-run keys, one due preset per user per execution, and retry-only Telegram delivery.
- Migration 031 is required; migration 030 and STEP059 remain prerequisites.

- STEP060 stores a minimized immutable source snapshot before generation and links each AI draft to that evidence hash.
- NewsData.io and OpenAI are isolated providers; their API keys never enter Telegram surfaces or evidence artifacts.
- OpenAI Responses requests use strict JSON schema and `store=false`.
- Draft text must retain the exact source URL. Unsupported numbers and quotations are rejected before approval when not present in the evidence/profile context.
- Users can replace the complete text, cancel the draft, or explicitly approve it. Approval creates a source-bound intent in the existing STEP059 publishing core.
- Exactly one unresolved draft per user and existing LinkedIn share claims prevent duplicate generation/approval/publish races.
- Unknown LinkedIn outcomes remain non-retryable and block new publication attempts until reconciliation.
- Migration 030 is required. Automatic publishing, scheduling, media posts, organization posts, and autonomous news agents are out of scope.


- STEP059 provides one explicit profile-share flow for active/listed profiles.
- The exact post and visibility are rendered before OAuth; nothing publishes automatically.
- `w_member_social` is isolated to the share OAuth intent and is not added to base OIDC scopes.
- Current LinkedIn Posts API `POST /rest/posts` is the canonical provider path.
- Access tokens are used in memory for one provider call and are not stored.
- Migration 029 adds share intents/events, provider receipts, user/unresolved uniqueness, state constraints, and audit history.
- Claim/finalize logic prevents concurrent callbacks from creating two posts.
- Provider 4xx is retryable only through a fresh explicit authorization; network/timeout/5xx/missing post ID and provider-success receipt failures are `unknown` and block retry.
- A `publishing` or `unknown` intent blocks creation of a new share.
- Shared post links open the exact listed member profile through `start=profile_<id>`.
- The Lite upgrade application pack is prepared, but LinkedIn approval is not claimed.

- STEP058B1 keeps optional LinkedIn verification fail-safe: invalid config cannot crash health/webhook/core OIDC.
- `/verificationReport` retries without criteria only after a criteria request returns HTTP 400; request IDs and attempt strategy are retained safely.
- Development/Lite scope canon is `r_profile_basicinfo r_verify`.

- STEP058B canonical trust policy exists across owner, preview, directory, health, and admin surfaces.
- Public badges require Lite mode, explicit flag, fresh Lite snapshot, and at least one verified category.
- Missing, stale, category-empty, Development-tier, or materially future-dated snapshots fail closed.
- Development snapshots and badge previews remain private.
- Exact public wording is limited to Identity verified on LinkedIn and Workplace verified on LinkedIn.
- Professional role, company, skills, experience, seniority, bio, and expertise remain member-provided.
- Safe sync diagnostics now distinguish bad request/version, deprecated version, scope/admin denial, timeout, rate limit, member unavailable, and provider failure.
- No migration is required for STEP058B.
- STEP058B1 live evidence confirms the verification APIs, zero-category snapshot persistence, and completion URL; no completed category is available for the tested operator account.

- STEP058A requests Verified on LinkedIn scopes only for eligible Development testers or all members after an explicit Lite mode switch.
- The integration calls `/identityMe` and `/verificationReport`, cross-checks app-scoped member IDs, and stores only category-level trust facts.
- Migration 028 adds `linkedin_verification_snapshots`, a unique app-member index, and historical OAuth-token scrubbing.
- New OIDC persistence retains non-secret token metadata only; access, refresh, and ID token values are not stored.
- Single-use verification URLs remain transient and are never written to the database or audit trail.
- Verification failures preserve normal OIDC and do not overwrite the previous snapshot.
- Private Profile status and manual refresh exist for eligible testers; public directory badges remain disabled until STEP058B and Lite approval.
- Professional role, company, title, seniority, skills, experience, expertise, and biography remain member-provided.

- STEP057 read-only production preflight exists and binds health, Telegram, PostgreSQL, and evidence to one exact production artifact SHA.
- STEP057 PostgreSQL diagnostics run inside `BEGIN READ ONLY` and create no fixtures.
- STEP057 manual evidence classifies `GO`, `GO_WITH_RISKS`, or `NO_GO`; missing required core-loop scenarios cannot become GO.
- Optional Stars payment/replay evidence may remain incomplete only under GO_WITH_RISKS.

- STEP056 canonical contact entry exists: `🤝 Request contact` on eligible profile cards.
- The contact options surface shows free intro, private chat, or Telegram contact according to authoritative profile mode.
- Exact configured prices or active Pro coverage are visible before entering the existing request flows.
- One Contact inbox hub routes to existing Requests and Private chats surfaces without creating a new inbox repository.
- Legacy callbacks remain active for stale Telegram messages.
- No migration or data rewrite is required.
- STEP053 consent, payment honesty, cooldown, block, replay, Pro allowance, and audit invariants remain unchanged.

- STEP055 canonical activation resolver exists and drives progress/next action across Home, Profile, Skills, Saved, and Preview surfaces.
- Required steps: LinkedIn, display name, headline, industry, about, and at least one skill.
- Optional details/contact settings are separated under `p:opt`.
- Publishing is explicit and preview-gated through `p:pub`; `p:vis` is hide-only.
- No schema, payment, auth, DM, intro, or contact-state-machine changes were made.

- STEP054 positioning contract exists across landing, Telegram, Privacy, Terms, README, state docs, and BotFather-facing copy.
- LinkedIn sign-in is described as basic account identity connection, not professional verification.
- Professional profile fields are described as member-provided.
- Active, listed cards are described as visible to bot users; private contact details remain controlled.
- Intro requests are described as direct requests to the profile owner, not third-party warm introductions.
- STEP053 contact-mode enforcement exists at render, creation, invoice, pre-checkout, and confirmation boundaries.
- STEP053 request-delivery fee disclosure exists in invoice, bot, pricing, receipt snapshot, and Terms surfaces.
- STEP053 bounded combined Pro outreach allowance and paid fallback exist in source.
- STEP053 pair/payment/allowance locks, checkout authorization, replay checks, policy snapshots, and contact audit events exist in source.
- migration `027_contact_contract_payment_honesty.sql` exists and is required for STEP053.
- STEP053A staging acceptance scripts, database fingerprint guard, isolated fixture runner, evidence manifest, and runbook exist in source.

- mature operator/admin layer exists in source
- STEP040 Russian admin analytics drilldowns exist in source
- STEP041 safe bulk actions exist in source
- STEP042 launch runbook and freeze policy exist in source
- STEP043.1 live-verification and rehearsal guidance exist in source
- STEP045 LinkedIn identity auto-seed uplift now exists in source
- STEP046 private handle + paid contact unlock now exists in source
- STEP047 gated member DM relay now exists in source
- LinkedIn callback/user notification copy now explicitly says only the basic identity layer was imported
- profile draft seeding now preserves existing manual display name values on reconnect
- profile-level hidden Telegram username and direct-contact approval flow now exist in source
- rebuilt public landing now exists in source with stronger section architecture and CTA hierarchy
- branded homepage OG/social preview layer now exists in source
- homepage/privacy/terms now point to the refreshed OG master asset in source
- STEP050J schema reality check now exists in source: profile/directory reads are schema-compatible again, while hidden Telegram username writes and direct-contact unlock flows explicitly require STEP046 migration `019_contact_unlock_requests.sql`.

## Locally verified
- STEP059 canonical Node `20.20.2`: dependency install, `npm run check`, dedicated share smoke, STEP058A/B/B1 compatibility, legal/landing/router/commands/schema/invite contracts, and `npm audit` PASS.
- Full STEP059 inventory is `76/89` PASS versus STEP058B1 `75/88`; the same 13 inherited failures remain, with new failures `0`.
- Share preview, signed intent/state, current Posts API request contract, 4xx/unknown separation, no-token persistence, provider-success receipt hardening, and direct profile deep link are source-verified.

- STEP058B1 Node `20.20.2` check and dedicated compatibility smoke passed.
- Full STEP058B1 inventory is `75/88` PASS versus STEP058B `74/87`; the 13-failure baseline set is unchanged.
- Invalid verification config health behavior, HTTP 400 fallback behavior, and same-client sequential query contract are source-verified.

- syntax/smoke can be run from repo;
- docs canon exists;
- STEP053A syntax and dedicated source contract passed locally on Node `20.20.2`;
- STEP054 positioning truth contract remains green under STEP055;
- STEP055 dedicated guided-activation contract remains green on Node `20.20.2`;
- STEP056 dedicated contact-rail contract remains green;
- STEP057 readiness contract was made forward-compatible with later source steps;
- STEP058B canonical Node `20.20.2` dependency install, `npm run check`, STEP058A compatibility, STEP058B trust-surface contract, positioning compatibility, and `npm audit` PASS;
- full STEP058B inventory is `74/87` PASS versus STEP058A `73/86`, with the same 13 inherited failures, one new passing STEP058B contract, and new failures `0`;
- missing-target, wrong-database-fingerprint, and artifact-mismatch paths fail closed.

## Live-confirmed
- STEP058B1 is operator-confirmed live at artifact `a5638bc0908aaf89848678ac1cdf8289698f906b`; verification APIs returned a zero-category snapshot plus completion URL.
- STEP059 is not live-confirmed.
- STEP058B is operator-confirmed live at artifact `c01f7e599ee8a5f8ad0f1c0070f1e6bfdc1d2878`.
- Production health is restored with `verificationScope=r_verify`, Development mode, and public badges disabled.

- Production `/api/health?full=1` operator-confirmed STEP057 at artifact `615d4014f3463bb40b6ec46c47d3e0879a670b55`.
- STEP057 production read-only preflight returned WARN only for local Node 24 and empty directory supply; artifact, webhook, PostgreSQL, migration 027, impossible states, notification health, and policy checks passed.
- STEP058A migration/config are live; STEP058B1 supersedes the initial failed-sync state with a successful zero-category API snapshot and completion URL.

- Production `/api/health?full=1` operator-confirmed STEP056 with artifact `7beaa0657c72dcedf423b17b3c998fc0ea67a6db`.
- STEP057 deployment, automated preflight, and manual core-loop verdict are not yet confirmed.

- Production `/api/health?full=1` operator-confirmed STEP055 with `ok=true`, `docsStep=STEP055`, and artifact `c582529c422915f5bf8b87364be47e957a9e9d71`.
- Database, LinkedIn, Telegram, webhook, persistence, contact unlock, DM relay, pricing, runtime guards, and operator diagnostics flags were true.
- STEP056 deployment and live contact-flow behavior are not yet confirmed.

## Inference

- the next safe landing step after deploy is a narrow manual verification pass for STEP049K homepage/mobile/legal behavior plus OG/share-preview cache refresh, not another broad landing rewrite
- the strongest product/runtime rail is now one user-facing Contact entry backed by the existing intro, Telegram-contact, and private-chat mechanisms

## Blocked / unconfirmed

- Complete live Stars, replay, cooldown/block, Pro allowance, and concurrency scenario evidence remains partial.
- STEP054 BotFather profile copy application remains an operator action not verified here.
- STEP056 Contact card → options → request path and Contact inbox require a short manual live pass after deploy.
- live Telegram pre-checkout, Stars charge, stale callback, and duplicate delivery proof are not closed.
- no automatic refund engine exists for decline/no reply.

- fresh production `/api/health` / `/api/health?full=1` verification is not closed here
- real deployed LinkedIn callback verification for STEP045 copy/seed behavior is not closed here
- real deployed Telegram Stars direct-contact request flow is not closed here
- real deployed Telegram Stars DM flow is not closed here
- deployed OG/share preview cache refresh is not confirmed yet
- deployed homepage mobile pass, legal-page polish, and refreshed OG/share preview are not confirmed yet

## Required wording

When deployment proof is missing, say exactly:
- **live status not confirmed — manual verification required**

When contract certainty is missing, say exactly:
- **contract not confirmed — SPIKE required**

## Key source docs

- `doc/81_LINKEDIN_TRUST_AND_DISTRIBUTION_ROADMAP.md`
- `doc/spec/STEP058A_VERIFIED_ON_LINKEDIN_DEVELOPMENT_INTEGRATION.md`
- `doc/82_STEP058A_OPERATOR_ROLLOUT.md`
- `doc/spec/STEP058B_VERIFIED_BADGES_AND_TRUST_SURFACES.md`
- `doc/83_STEP058B_OPERATOR_ROLLOUT.md`
- `doc/qa/STEP058B_QA_REPORT.md`
- `doc/00_CURRENT_STATE.md`
- `doc/spec/STEP045_LINKEDIN_IDENTITY_AUTO_SEED_UPLIFT.md`
- `doc/spec/STEP046_PRIVATE_TELEGRAM_HANDLE_AND_PAID_CONTACT_UNLOCK_V1.md`
- `doc/spec/STEP047_MEMBER_DM_RELAY_V1.md`
- `doc/spec/STEP053_CONTACT_CONTRACT_AND_PAYMENT_HONESTY_LOCK.md`
- `doc/spec/STEP053A_STAGING_RUNTIME_ACCEPTANCE_PACK.md`
- `doc/spec/STEP054_POSITIONING_AND_DISCOVERY_TRUTH_ALIGNMENT.md`
- `doc/spec/STEP055_GUIDED_ACTIVATION_SPINE.md`
- `doc/80_STEP054_BOTFATHER_PROFILE_COPY.md`
- `doc/77_STEP053A_STAGING_RUNTIME_ACCEPTANCE_RUNBOOK.md`
- `doc/spec/STEP049B_LANDING_IMPLEMENTATION.md`
- `doc/spec/STEP049C_OG_SOCIAL_METADATA_UPLIFT.md`
- `doc/spec/STEP049D_FINAL_POLISH_MOBILE_LEGAL_CONSISTENCY.md`
- `doc/process/07_WORK_HISTORY_STEP045.md`
- `doc/process/07_WORK_HISTORY_STEP046.md`
- `doc/process/07_WORK_HISTORY_STEP047.md`
- `doc/process/07_WORK_HISTORY_STEP049B.md`
- `doc/17_START_NEW_CHAT_PROMPT_LINKEDIN_DIRECTORY_BOT.md`


## STEP048.1 hotfix

- Historical intent: keep pre-STEP046 databases operational while migrations were still being applied.
- Current reality after STEP050J: schema-compatible reads are restored through `src/db/schemaCompat.js`, but hidden Telegram username writes and direct-contact unlock flows explicitly require STEP046 migration `019_contact_unlock_requests.sql`.
- Truth boundary: do not claim full STEP046 backward-compat without that migration present.


## STEP048.3 hotfix

- Scope: LinkedIn connect/relink copy polish + profile editor/preview readability + profile keyboard consistency.
- Product truth: LinkedIn OIDC basics are stored privately; only the initial card name is auto-seeded into public card fields by default.
- UX: profile editor now shows a dedicated LinkedIn block, preview clarifies what is public vs private, and callback success page includes an explicit button back to the bot.
- Buttons: profile preview/input/profile-saved flows now keep Back + Home on one row for tighter Telegram ergonomics.
- No schema changes. Live status not confirmed — manual verification required.


## STEP048.4 hotfix
- Fix: restore STEP048 pricing env contract exports after STEP048.3 UX hotfix accidentally dropped `getSubscriptionConfig` and Pro pricing fields from `src/config/env.js`.
- Impact: Vercel runtime no longer fails on `monetizationStore.js` import during startup.
- Scope: narrow compatibility/hardening only; no product-flow changes.


## STEP049B delta

- Rebuilt the public landing into a stronger one-page product entry page with hero, audience, workflow, product surfaces, FAQ, and final CTA sections.
- Cleaned up CTA hierarchy so legal links no longer compete with the main product action.
- Upgraded `site.css` and aligned `privacy` / `terms` pages to the same navigation and footer standard.


## STEP049C delta

- Added a branded OG/share-preview card plus full homepage Open Graph + Twitter metadata.
- Added favicon and apple-touch icon consistency across landing/legal surfaces.
- Added `robots.txt`, `sitemap.xml`, and a dedicated OG/social smoke test.

## STEP049D delta

- Added homepage/mobile polish with skip-link support, cleaner hero/footer microcopy, and tighter CTA hierarchy.
- Improved mobile nav layout so section links and the bot CTA remain readable instead of collapsing into a loose wrap.
- Rebuilt privacy and terms pages into one consistent legal shell with quick summary blocks and aligned action buttons.
- Added legal-page OG/Twitter metadata and a dedicated landing-polish smoke check.


## STEP049J delta

- Refreshed the social preview master to a new versioned `intro-deck-og-1200x630.png` asset with a matching WEBP companion.
- Updated homepage, privacy, and terms metadata to the new versioned OG path so social platforms can refresh away from older cached preview cards.
- Scope is asset/meta only; no product, schema, billing, or messaging logic changed.


## STEP049K delta

- Landing copy, spacing, and section alignment were tightened for a cleaner production presentation.
- Homepage and legal navigation now use the real Intro Deck brand asset instead of a text-only mark.
- Product preview cards were rebalanced into a full three-card desktop layout.
- Privacy and Terms intro blocks were cleaned up for readability and shell consistency.

## STEP053 handoff delta

### Product contract
- `intro_request`: intro-only; no new paid direct-contact or DM request may be created or paid.
- `paid_unlock_requires_approval`: new paid request rails allowed.
- Stars buy permission-request delivery only. Approval, disclosure, and reply are not guaranteed.
- Decline/no reply does not automatically refund in the current money core.
- Pro allowance default: `10` combined request deliveries per rolling 24 hours, then paid fallback.
- Decline cooldown default: `30` days across both paid rails.

### Runtime configuration
```env
PRO_OUTREACH_DAILY_LIMIT=10
CONTACT_REQUEST_RETRY_COOLDOWN_DAYS=30
PAYMENT_CHECKOUT_AUTH_TTL_MINUTES=30
PAYMENT_CHECKOUT_RETRY_LOCK_SECONDS=1800
```

### Migration order
1. `019_contact_unlock_requests.sql`
2. `020_member_dm_relay.sql`
3. `021_pricing_receipts_ops.sql`
4. `027_contact_contract_payment_honesty.sql`

Before migration `027`, audit existing Telegram/provider charge IDs for duplicates; unique-index creation intentionally fails rather than silently discarding ambiguous payment history.

### Local QA
- package: `0.50.0`
- Node: `22.16.0` (repo requires `20.x`)
- `npm run check`: PASS
- full STEP053 inventory: `67/80` PASS
- baseline control inventory: `64/79` PASS
- new failures versus baseline: none
- existing failures: 13 unrelated baseline contracts

### Next action
STEP054 proceeded after operator-confirmed STEP053A deployed health/config. Full Stars/concurrency acceptance remains partial and should be closed through real usage or a focused runtime pass.

## STEP053A handoff delta

### Acceptance commands
```bash
npm run step053a:preflight
npm run step053a:database
npm run step053a:evidence:init -- runtime_evidence/step053a/manual-evidence.json
npm run step053a:evidence:verify -- runtime_evidence/step053a/manual-evidence.json
```

### Safety guards
- only `STEP053A_TARGET=staging` is accepted;
- mutation requires `STEP053A_MUTATION_ACK=ALLOW_STEP053A_STAGING_FIXTURES`;
- mutation also requires `STEP053A_DATABASE_ACK` equal to the preflight fingerprint;
- both automated phases require `STEP053A_ARTIFACT_SHA`, and deployed health/manual evidence must match it;
- Node 20 is mandatory for acceptance;
- fixture cleanup failure is a failed run;
- no production mode or production bypass exists.

### Truth boundary
- source pack: implemented;
- local Node 20 syntax/source QA: PASS;
- local fail-closed target/fingerprint guards: PASS;
- Node 20 staging preflight against real staging services: not run;
- PostgreSQL acceptance scenarios: not run;
- Telegram Stars/manual scenarios: not run;
- staging GO report: not generated.

### Next action
Deploy STEP054, verify live positioning surfaces and BotFather copy, then proceed to STEP055 guided activation. Keep unresolved STEP053A Stars/concurrency scenarios explicit rather than treating them as complete.


## STEP054 delta

- Source step: STEP054.
- Package: 0.51.0.
- Positioning canon: listed member profiles; LinkedIn-connected account identity; member-provided professional claims; approval-based contact.
- No schema or critical money/contact state changes.
- Deploy verification and BotFather text update remain operator actions.

## STEP055 handoff delta

- Source step: STEP055.
- Package: 0.52.0.
- Required activation sequence: LinkedIn → display name → headline → industry → about → skills.
- One primary CTA resolves the next missing step from current evidence.
- Optional details/contact settings are separate.
- Ready hidden profile: Preview → `p:pub`; listed profile: `p:vis` hide only.
- No migration.
- Node 20 QA: `70/83` PASS, same 13 inherited failures, new failures 0.
- Live status not confirmed — manual verification required.


## STEP058B handoff delta

### Source-confirmed

- one canonical trust resolver controls owner, preview, public directory, admin, and health semantics;
- Development mode can never display public badges;
- public eligibility requires Lite mode, explicit enablement, fresh Lite-source snapshot, at least one category, and a sane timestamp;
- exact public labels are limited to Identity verified on LinkedIn and Workplace verified on LinkedIn;
- professional card claims remain member-provided;
- sync failures now expose only private endpoint/status/code diagnostics.

### QA truth
- package: `0.56.0`;
- Node `20.20.2`, npm `10.9.2`;
- `npm ci`, `npm run check`, dedicated STEP058A/STEP058B contracts, positioning contract, and `npm audit` PASS;
- full inventory: `74/87` PASS versus STEP058A `73/86`;
- inherited failures remain exactly 13; new failures: `0`;
- no migration required.

### Live boundary
- STEP058A deployment/config and migration 028 are live-confirmed;
- the initial Development sync failure was superseded by STEP058B1 compatibility evidence;
- a zero-category snapshot does not create or infer a verified category;
- Lite approval, a completed LinkedIn category, and public badge rendering remain unconfirmed.

## STEP058B1 handoff delta

### Source-confirmed

- optional Verified on LinkedIn configuration is parsed fail-safe; invalid values disable only the optional integration;
- health remains available and exposes `configurationValid` plus a safe configuration error;
- Development/Lite scope canon is `r_profile_basicinfo r_verify`;
- `/verificationReport` retries once without criteria only after the criteria request returns HTTP 400;
- request attempt and LinkedIn request ID are retained without tokens or raw provider payload;
- invite reward reads in the LinkedIn persistence transaction are sequential on one `pg` client;
- no migration is required.

### QA truth
- package: `0.56.1`;
- canonical Node `20.20.2`, npm `10.9.2`;
- dependency install, syntax, dedicated compatibility smoke, STEP058A/STEP058B compatibility, and npm audit PASS;
- full inventory: `75/88` PASS versus STEP058B `74/87`;
- inherited failures remain exactly 13; new failures: `0`.

### Live boundary
- STEP058B is live-confirmed at artifact `c01f7e599ee8a5f8ad0f1c0070f1e6bfdc1d2878`;
- the live criteria request still returns `/verificationReport` HTTP 400;
- STEP058B1 fallback success, request ID evidence, and removal of the production pg warning are not verified until deploy and operator retest;
- public badges remain disabled.


## STEP060 — AI/News Drafts Approval Foundation

### Source-confirmed

- source step `STEP060`, package `0.58.0`;
- operator-first source/evidence/draft/preview/edit/approval flow;
- NewsData.io source adapter and OpenAI strict-schema generator are optional and fail-safe;
- source evidence is minimized, hashed, and treated as untrusted data;
- the exact source URL plus numeric/quotation evidence is validated before approval;
- member edits are revalidated and AI claim annotations are cleared;
- one atomic approval creates one source-bound canonical STEP059 share intent;
- unknown provider outcomes remain non-retryable;
- migration `030_ai_news_drafts_approval.sql` is required;
- no automatic/background publication or provider-token persistence.

### QA truth
- Node `20.20.2`, npm `10.9.2`;
- `npm ci`, `npm run check`, `smoke:ai-news-drafts`, STEP059/058 compatibility, router/commands/legal/schema, and `npm audit` PASS;
- full smoke inventory `77/90` PASS against STEP059 `76/89`;
- inherited failures `13`, new failures `0`.

### Operator handoff
1. Apply migration 030.
2. Add NewsData/OpenAI server secrets.
3. Start with `AI_NEWS_DRAFT_MODE=operator`.
4. Deploy and confirm STEP060 health/config.
5. Run one exact operator source → draft → edit → approval → one LinkedIn post flow.
6. Keep Pro mode off until runtime evidence is accepted.

## STEP061 — Personalized News Presets & Subscription Productization

Source implementation adds:

- source step `STEP061`, package `0.59.0`;
- migration `031_ai_news_presets_subscription.sql`;
- saved member presets for topic, source filters, output language, and tone;
- manual, daily, and weekdays schedule states;
- Pro/operator entitlement gates and bounded preset/search/draft allowances;
- authenticated `/api/cron/ai-news-drafts` execution;
- Vercel daily and optional external-hourly scheduler drivers;
- one due preset per user per scheduler execution;
- unique scheduled run and one draft per run;
- bounded Telegram delivery retry without provider-generation retry;
- explicit reuse of STEP060 generation and STEP059 publication cores;
- health, operator diagnostics, Privacy, Terms, landing, and rollout documentation.

Required production sequence:

1. Apply migration 031 after migrations 029 and 030.
2. Configure `AI_NEWS_DRAFT_MODE=pro` for subscriber rollout.
3. Configure the scheduler. The Vercel daily driver requires `CRON_SECRET` and a fixed 08:00 UTC window matching `vercel.json`.
4. Deploy and confirm STEP061 health/config.
5. Verify preset save/run-now/schedule/pause/resume/delete.
6. Verify one authenticated cron execution produces at most one reviewable Telegram draft per user.
7. Verify no LinkedIn post is created before a separate STEP059 authorization.

Truth boundary: source QA does not prove production cron execution, provider calls, Telegram delivery, or Pro entitlement behavior.

## STEP061H1 — Profile Preview Runtime Hotfix

- Fixes production `ReferenceError: aiNewsPresetDiagnostics is not defined` on `p:prev`.
- Removes operator-only diagnostics arguments from profile preview and passes the preset summary to the operator diagnostics renderer where it belongs.
- Adds `smoke:step061-profile-preview-hotfix`, including a real invocation of `buildProfilePreviewSurface`.
- Webhook exception logging now emits a bounded token-redacted summary and does not serialize grammY `ctx` or `api.token`.
- No migration required. Telegram token rotation is an outstanding operator security action because the token appeared in copied logs.
