# 15_NEW_CHAT_HANDOFF

## Executive summary

- Project: LinkedIn Telegram Directory Bot
- Current baseline: STEP058A — Verified on LinkedIn Development Integration
- Current mode: HEAVY / OAUTH / EXTERNAL TRUST SIGNALS / DATA MINIMIZATION
- Current focus: validate category-only LinkedIn identity/workplace verification with developer-app administrators while preserving base OIDC and keeping public badges disabled.
- Must not break: LinkedIn OIDC truth, webhook secret guard, router contract, listed/active browse truth, intro persistence, communications/outbox truth, operator allowlist gating

## Source-confirmed

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

- syntax/smoke can be run from repo;
- docs canon exists;
- STEP053A syntax and dedicated source contract passed locally on Node `20.20.2`;
- STEP054 positioning truth contract remains green under STEP055;
- STEP055 dedicated guided-activation contract remains green on Node `20.20.2`;
- STEP056 dedicated contact-rail contract remains green;
- STEP057 readiness contract was made forward-compatible with later source steps;
- STEP058A `npm run check` and dedicated Verified on LinkedIn contract PASS on Node `22.16.0`;
- full STEP058A inventory is `73/86` PASS versus STEP057 `72/85`, with the same 13 inherited failures, one new passing STEP058A contract, and new failures `0`;
- canonical Node 20 execution is not verified in this workspace;
- missing-target, wrong-database-fingerprint, and artifact-mismatch paths fail closed.

## Live-confirmed

- Production `/api/health?full=1` operator-confirmed STEP057 at artifact `615d4014f3463bb40b6ec46c47d3e0879a670b55`.
- STEP057 production read-only preflight returned WARN only for local Node 24 and empty directory supply; artifact, webhook, PostgreSQL, migration 027, impossible states, notification health, and policy checks passed.
- STEP058A deployment, migration 028, LinkedIn Development API response, and private Telegram verification surface are not yet live-confirmed.

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
