# Current canonical source step — STEP065A1

- Package: `0.66.0`
- Baseline: STEP064B4D2A FULL SHA-256 `b7c6a023facdcb99ba6d6665be573b5b8642cabd2549ed1b27e72ede60c808ed`
- Migration `038_linkedin_profile_share_attribution_foundation.sql` is required; no new ENV.
- New ordinary profile-share posts use an opaque `ls_<token>` Telegram deep link bound to the exact published share intent.
- Valid tokens resolve only published `profile_share` intents whose target profile is active/listed and attribution is not revoked.
- A 30-day target-bound session propagates attribution to intro, Telegram-contact, and private-chat request paths.
- Immutable events cover profile opens, request starts, submissions, and approvals.
- Total opens are event count; unique opens are distinct internal visitor references.
- No cookies, tracking pixels, browser fingerprinting, LinkedIn scraping, or owner-visible visitor identity were added.
- Attribution persistence failure does not block profile resolution or repeat product/payment side effects.
- Legacy `profile_<id>` links remain supported and unattributed.
- Source QA: candidate 106/113 PASS versus baseline 105/112; baseline PASS regressions 0; seven matching inherited/environmental NON_PASS remain.
- Production migration/deployment/acceptance: not verified.

---

# Current canonical source step — STEP064B4D2

- Package: `0.65.0`
- Baseline: STEP064B4D1A FULL SHA-256 `587229626b5e0fbe43a5c64485063ca109438d53d8247f85be9e0fe57d607ca5`
- Ordinary LinkedIn profile shares now attach a versioned EN/RU Intro Deck branded PNG through the LinkedIn Images API.
- Signed `postLanguage` selects the asset and localized alt text.
- Image preparation failure before Posts API creation falls back to the existing compact text-only post.
- Unknown post outcomes remain fail-closed and automatic retry remains blocked.
- AI/news LinkedIn publishing is unchanged and remains text-only.
- Home CTA is `👤 Profile` / `👤 Профиль`; callback `p:menu` is unchanged.
- Vercel callback bundle explicitly includes assets and uses `maxDuration=60`.
- Migration: none. New ENV: none.
- Source QA: candidate 104/111 PASS versus baseline 103/110; baseline PASS regressions 0; seven matching inherited/environmental NON_PASS remain.
- Production deployment: not verified.

---

# Current canonical source step — STEP064B4D1A

- Package: `0.64.9`
- Baseline: STEP064B4D1 FULL SHA-256 `c82516e0d3885c72eee6b3600996d0af43b277ff5f77da023ff1594dd8dec8b6`
- Migration: none. New ENV: none.
- Ordinary LinkedIn profile-share copy is reduced to two compact paragraphs designed for above-the-fold readability.
- The post no longer repeats the member name, headline, company, or About text already visible in LinkedIn's author header/profile.
- A bounded focus line uses at most three skill labels, then a localized industry/fallback line.
- Emoji policy is `none_arrow_only`; the neutral arrow `→` is retained in the CTA.
- Preview remains exact to the text sent to the existing STEP059 publisher.
- OAuth, callback IDs, publisher transport, exact-once/idempotency, payments, AI/news, migrations, and ENV are unchanged.
- Source QA: candidate 103/110 PASS versus baseline 102/109; baseline PASS regressions 0; seven matching inherited/environmental NON_PASS remain.
- Production deployment: not verified.

---

# Current canonical source step — STEP064B4D1

- Package: `0.64.8`
- Baseline: STEP064B4C1 FULL SHA-256 `46e933c6e9c2ec96c62e0f4471ef4da41e52a7fda28cad3913ad0ea08cceacaf`
- Ordinary profile-share received the initial editorial hook/identity/summary/audience/permission/CTA upgrade.
- Migration: none. New ENV: none. Publisher and callback contracts unchanged.
- Superseded by STEP064B4D1A compact above-the-fold refinement.

---

# Current canonical source step — STEP064B4C1

- Package: `0.64.7`
- Baseline: STEP064B4C FULL SHA-256 `e2323189f64cb8d876835a19cdd834bc20fe18aec93823def123adf4214cf2fa`
- Migration: none. New ENV: none.
- Russian language-settings, profile system labels, and LinkedIn publication-ID labels are consistently localized.
- Callback IDs, raw provider identifiers, user-authored content, payments, OAuth, publisher logic, and AI/news language contracts are unchanged.
- Source QA: candidate 101/108 PASS versus baseline 100/107; baseline PASS regressions 0; seven matching inherited/environmental NON_PASS remain.
- Production deployment: not verified.

---

# Current canonical source step — STEP064B4C

- Package: `0.64.6`
- Baseline: STEP064B4B FULL SHA-256 `8839d3fd224c9bf52761f0869a05889306ad5b72b8a6e3d8abe157969111fec7`
- Migration: none. New ENV: none.
- Stored interface language now controls transaction copy, payment receipts, recipient notifications, OAuth HTML, and OAuth Telegram receipts.
- Notification and scheduled-draft retries preserve an operation/run language snapshot in existing JSON evidence.
- LinkedIn launch/state/transfer language evidence is HMAC-signed; unsigned query language is not trusted.
- Ordinary profile-share post text now uses independent `users.default_post_language`.
- AI/news preset/draft `post_language`, callback IDs, payment payloads/amounts, OAuth scopes, publisher authority/idempotency, rewards, and automatic publishing are unchanged.
- Source QA: candidate 102/107 PASS versus baseline 101/106; baseline PASS regressions 0; five inherited NON_PASS remain.
- Production deployment and live transaction/OAuth acceptance: not verified.

---

# Current canonical source step — STEP064B4B

- Package: `0.64.5`
- Baseline: STEP064B4A FULL SHA-256 `9171532cb405ca1238e286a64b7a73bf43d97296d1873cce24f10477fae90975`
- Migration: none. New ENV: none.
- Persisted member interface language is loaded once per Telegram update.
- RU/EN presentation boundary now covers Profile editors, Directory, Requests, contact unlock, private chats, Pro, Invite owner surfaces, and Story Finder.
- Callback IDs, URLs, switch-inline payloads, state machines, payments, OAuth, publishing, rewards accounting, and AI/news language persistence are unchanged.
- User-provided profile/message/draft content is not translated.
- Payment/OAuth/notification/publication language and the external public invite card remain deferred to STEP064B4C.
- Source QA: candidate 101/106 PASS versus baseline 100/105; baseline PASS regressions 0; five inherited NON_PASS remain.
- Production deployment and Telegram operator acceptance: not verified.

---

# Current canonical source step — STEP064B4A

- Package: `0.64.4`
- Baseline: STEP064B3 FULL SHA-256 `92ab03586a7f216a79c7ae2bb80abd0cf194bdbb1b60ad520c9bee1cc28a1b60`
- Migration `037_interface_language_boundary.sql` is required; no new ENV.
- Persistent `users.interface_language` and `users.default_post_language` are independent EN/RU preferences.
- Existing users retain English defaults; new users are seeded once from Telegram locale.
- Missing migration blocks preference writes and preserves a deterministic English read fallback.
- `/language` and bounded `lang:*` callbacks are added; existing callback IDs are unchanged.
- Initial localized slice: Home, Profile root, Profile preview, Help, and Language settings.
- Existing AI/news preset/draft `post_language` remains unchanged.
- LinkedIn publisher, OAuth state machines, payments, rewards, admin mutations, and ordinary profile-share rendering are unchanged.
- Source QA: candidate 100/105 PASS versus baseline 99/104; baseline PASS regressions 0; five inherited NON_PASS remain.
- Production migration/deployment/Telegram acceptance: not verified.

---

# Current canonical step — STEP064B3

- Package: `0.64.3`
- Baseline: STEP064B2 FULL SHA-256 `2f76c704053a951f6256011915727bd2032528bc55d7599bfb21469838875ca2`
- Admin Telegram labels are unified in Russian; immutable English states/events are rendered separately as bounded `code` values.
- Contextual Back/Home navigation and operator-safe diagnostic copy are standardized.
- No standalone admin web UI exists in the canonical repo; web scope is limited to health/operator diagnostics metadata.
- Callback IDs, admin mutations, auth, payments, rewards, AI/news, and LinkedIn publishing are unchanged.
- No migration or new ENV.
- Source QA: 111/120 PASS versus baseline 101/119; baseline PASS regressions 0; nine inherited NON_PASS remain.
- Production deployment: not verified.

---

# Current canonical step — STEP064B2

- Package: `0.64.2`
- Baseline: STEP064B1 FULL SHA-256 `7552952ba134444dbfa6ed6205bf7b9d4cef9c508750b36f39ed73dd6d245dd3`
- Critical consent, payment, contact-reveal, and LinkedIn publication CTA copy is now object-specific and consequence-explicit.
- Callback IDs, money logic, consent state machines, and the LinkedIn publisher are unchanged.
- No migration or new ENV.
- Source QA: 101/119 PASS versus baseline 100/118; inherited NON_PASS 18; new regressions 0.
- Production deployment: not verified.

---

# Current canonical step — STEP064B1

- Package: `0.64.1`
- Baseline: STEP064A FULL SHA-256 `4ce8b99159022dd8209ced89c3719cd894dbec478687b09b09ee08b7c81d7d0b`
- Member copy and primary navigation are unified through a canonical glossary and user-safe error mapper.
- No migration, ENV, callback, payment, referral, ranking, auth, or publishing change.
- Source QA: 100/118 PASS versus baseline 99/117; inherited NON_PASS 18; new regressions 0.
- Production deployment: not verified.

---

# STEP064A current source delta

- Current source step: `STEP064A`; package `0.64.0`.
- Canonical baseline: STEP063B-H2 FULL SHA-256 `0465e70c63f5bbcaaf58feb81087d2defc0d467afd3b8e0ba0fa5ad598e6d59d`.
- Public invite cards expose exactly one attributed `Open Intro Deck` URL button.
- Inline and forwarding flows use one canonical photo-card renderer with a text fallback.
- Invite root is simplified; Activity combines performance and recent joined contacts.
- Points navigation is hidden/off or labeled for earn-only/live/paused modes.
- Migration: none. New ENV: none.
- Reward accounting, activation rules, LinkedIn OAuth, and publishing are unchanged.
- Source QA passed; production Telegram and attribution evidence are not verified.

---

# 00_CURRENT_STATE

## Current source baseline
STEP063B-H2 — Personalized Query Precision & Final-Fit Gate

## STEP063B-H2 source delta

- Exact input: STEP063B-H1R1 FULL SHA-256 `926c71fb8c5a2717bf77ab8833520119c9348e58069d1c24fe8653450baa3e0a`.
- `For you` no longer sends broad standalone terms such as `product`, `systems`, `builder`, or `development` as OR clauses.
- Required professional phrase anchors are separated from bounded ranking boosts.
- Weak profile/audience/angle fits are rejected and a truthful `no_result` is preferred.
- No migration or new ENV is required.
- STEP059 publishing remains explicit and unchanged.

## Historical state

# STEP063B current source delta

- Current source step: `STEP063B`; package `0.63.3`.
- Exact baseline: `IntroDeck_STEP063A_H1A_FULL_2026-07-24.zip`, SHA-256 `b7f20e26d94872097ad8165a7d2f4f43aa7a9c3a446766b1d5260573f6baff39`.
- `For you`, professional topic taxonomy, Audience, Editorial Angle, public-profile affinity scoring, and expanded saved presets are implemented.
- Only public headline, industry, and skill labels enter the bounded personalization context; private/contact/OAuth data are excluded.
- Migration 035 is required. New ENV: none.
- Source/focused QA passed; production migration, Vercel deployment, live personalization quality, and production preset evidence are not verified.
- STEP059 LinkedIn publishing remains explicit and unchanged; automatic publishing remains disabled.

---

# STEP063A-H1A current source delta

- Current source step: `STEP063A-H1A`; package `0.63.2`.
- Exact baseline: `IntroDeck_STEP063A_H1_FULL_2026-07-23.zip`, SHA-256 `5afac6b06efa4c999f37ad616c301e7a6bb7e5627c7a799918fc084a2d402959`.
- Source relevance, promotional filtering, domain authority tiers, provider diagnostics, and browse search-limit UX are implemented.
- Migration: none. New ENV: none.
- Source QA is passed; Vercel deployment and live production acceptance are not verified.
- STEP059 LinkedIn publishing and generator adapters are unchanged.

---

# 00_CURRENT_STATE

## STEP063A-H1 current source delta

- Current source step: `STEP063A-H1`; package `0.63.1`.
- Exact input: STEP063A FULL SHA-256 `70cc1e0b6c572f1acdf0274d71b85915dfabceadf85e067a935e0778ba77adc7`.
- Generator modes: `off | template | groq | openai`.
- `off` is browse-only: source search/open remain available, draft callbacks are absent, draft allowance is not consumed, and effective scheduling is off.
- `template` is deterministic and uses no external LLM/API key.
- `groq` uses the dedicated Groq adapter and provider-specific telemetry; no hidden OpenAI fallback exists.
- Migration 034 is required before `template` or `groq`; missing compatibility fails closed.
- STEP059 publisher and explicit one-post LinkedIn approval are unchanged.
- Source/focused QA is passed; production migration/deployment/live provider acceptance is not verified.

## Snapshot

- Project: LinkedIn Telegram Directory Bot
- Current STEP: STEP063A-H1
- Phase: browse-only and provider-neutral draft generation on top of STEP063A
- Primary mode: HEAVY / GENERATOR AUTH / SOURCE EVIDENCE / MIGRATION / TELEMETRY / ROLLOUT GOVERNANCE
- Runtime status: STEP063A is the exact uploaded baseline. STEP063A-H1 is source-implemented and focused-QA verified only; migration 034, Node 20 dependency-backed QA, Vercel deployment, live Groq/template telemetry, and operator E2E evidence are not verified.


## STEP063A delta

- Canonical baseline SHA-256: `658d8fa38fd4340d4fd0bc82c3b7fca796a5a929b80930ffb1c0d9a07250c04e`.
- Default source mode remains `newsdata_only`; this is the safe deployment and rollback state.
- `multi_source` adds fixed-registry RSS/Atom, Hacker News trend discovery, GitHub Releases, canonical URL/title deduplication, source authority metadata, and NewsData fallback.
- Migration 033 is required before multi-source writes; missing schema fails closed.
- Provider fetches are bounded by exact HTTPS host allowlists, timeout, response-size, registry breadth, and scan limits.
- Telegram candidates now expose separate `Draft` and `Open source` actions plus provider, primary-source, authority, and TTL context.
- STEP059 LinkedIn publishing remains unchanged and requires exact preview plus explicit one-post approval.
- Verified locally: syntax gate and focused mock-provider smoke on Node 22.16.0.
- Not verified: Node 20, dependency-backed regression suite, live migration/provider calls, production deployment, and operator acceptance.

## What exists now

- STEP061A adds artifact-bound production acceptance for the NewsData → evidence → OpenAI draft → edit/approve → STEP059 LinkedIn receipt loop.
- `AI_NEWS_ROLLOUT_STAGE=operator_acceptance` is the fail-closed default; Pro access requires an explicit post-acceptance ENV change.
- Migration `032_ai_news_live_acceptance_telemetry.sql` records bounded provider usage, OpenAI token counts, duration, outcomes, and optional operator-configured cost estimates without prompts, tokens, keys, or raw provider payloads.
- `step061a:preflight` is read-only and performs no provider calls; the manual verifier issues only GO / GO_WITH_RISKS / NO_GO against the exact deployed artifact.
- Scheduled delivery remains Telegram-draft-only and STEP059 remains the only LinkedIn publishing core.
- Canonical Node 20 QA: 81/93 smoke PASS versus STEP061H1 79/92; `smoke:env` resolved, no new failures, 12 inherited failures remain.

- STEP061H1 fixes the live `p:prev` crash caused by an undefined `aiNewsPresetDiagnostics` reference in `buildProfilePreviewSurface`.
- Profile preview no longer receives operator-only AI/news diagnostics; those diagnostics are passed only to the operator surface.
- A runtime smoke now invokes the actual profile-preview builder and guards against reintroducing the undefined symbol.
- No schema, migration, entitlement, scheduler, AI/news, LinkedIn publishing, or payment behavior changed.
- Future webhook errors are logged as bounded redacted summaries and no longer serialize the grammY context/API token.
- Operator action remains required: rotate the Telegram bot token exposed in copied production logs and redeploy the replacement secret.

- STEP061 adds saved personal news presets, Pro entitlement gating, bounded preset/draft/search allowances, and scheduled delivery of reviewable Telegram drafts.
- Scheduled jobs reuse the canonical STEP060 source/evidence/generation core and never call LinkedIn; STEP059 remains the only publishing core.
- A subscription controls access and allowance only. Every LinkedIn post still requires preview and one explicit OAuth authorization.
- Migration `031_ai_news_presets_subscription.sql` adds presets, scheduler runs, claims/retries, and draft/run binding.
- The default Vercel driver creates at most one scheduled draft per user in a daily window; an authenticated external hourly driver is optional for finer windows.
- Duplicate cron execution, stale claims, duplicate source selection, and Telegram retry paths are fail-closed and auditable.

- STEP060 adds an operator-first AI/news drafting flow: topic preset/custom query → NewsData.io source selection → minimized evidence snapshot → OpenAI structured draft → exact preview/edit → explicit approval → existing STEP059 one-shot LinkedIn publishing.
- No background or automatic publishing exists. Provider tokens are not persisted, OpenAI request storage is disabled, and a subscription may grant allowance but never publication authority.
- Draft validation requires the exact source URL, rejects unsupported numeric claims and quotations, and requires evidence claims to point to exact source substrings.
- Migration `030_ai_news_drafts_approval.sql` adds preferences, source snapshots, drafts, events, input sessions, and source binding on the existing LinkedIn share intent.
- STEP059 remains the only canonical LinkedIn publishing core; AI/news drafts do not create a second publisher.


- STEP059 adds one explicit Share Profile on LinkedIn rail for active/listed profiles.
- Telegram shows the exact text and visibility before authorization; `/share` and Profile preview use the same canonical flow.
- `w_member_social` is requested only for the one-shot share intent, not for base LinkedIn login.
- Publishing uses the current LinkedIn Posts API and stores a minimal receipt; OAuth access tokens are never persisted.
- Signed launch ticket + signed OAuth state bind Telegram user, purpose, intent, expiry, and nonce.
- Concurrent/duplicate callbacks are serialized; a stale, timed-out, provider-5xx, network, missing-post-id, or provider-success/local-receipt failure becomes non-retryable `unknown`.
- A user with a `publishing` or `unknown` intent cannot create another share until reconciliation, preventing duplicate posts.
- Shared posts deep-link directly to the member's listed Intro Deck profile.
- Migration `029_linkedin_share_profile.sql` is required.
- STEP059 canonical Node `20.20.2` QA: `76/89` PASS versus STEP058B1 `75/88`, with the same 13 inherited failures, one new passing share contract, and new failures `0`; `npm audit` reports 0 vulnerabilities.
- `doc/85_LINKEDIN_LITE_UPGRADE_APPLICATION_PACK.md` prepares the Development → Lite operator request without claiming approval.

- STEP058B1 adds a fail-safe optional verification config: invalid verification ENV disables only Verified on LinkedIn and leaves health, webhook, base OIDC, and the bot available.
- `/verificationReport` now retries once without `verificationCriteria` after a criteria request receives HTTP 400, matching LinkedIn Development quickstart compatibility behavior.
- Safe diagnostics retain endpoint, request strategy, and LinkedIn request IDs without tokens or raw payloads.
- The OAuth invite-reward path no longer runs concurrent queries on one PostgreSQL client.
- STEP058B1 canonical Node `20.20.2` QA: `75/88` PASS versus STEP058B `74/87`, with the same 13 inherited failures and new failures `0`.

- STEP058B adds one canonical LinkedIn trust resolver shared by owner, preview, directory, health, and admin surfaces.
- Public badges are fail-closed and require all gates: `mode=lite`, explicit `LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED=1`, a fresh snapshot, at least one verified category, and `source_tier=lite`.
- Development snapshots remain private and can only render a private badge preview for eligible testers.
- Directory cards can render only exact category badges: `Identity verified on LinkedIn` and/or `Workplace verified on LinkedIn`.
- Role, company, skills, experience, bio, seniority, and expertise remain member-provided even when a category badge is present.
- Verification sync failures now report a safe endpoint/status/code diagnosis without exposing OAuth tokens or raw provider payloads.
- Development/Lite use `r_verify`; `r_verify_details` is not used by the current integration.
- No database migration or state-machine change is introduced by STEP058B.

- STEP058A adds a gated Verified on LinkedIn Development integration for configured Intro Deck operators that are also LinkedIn developer-app administrators.
- Verification uses category-only `IDENTITY` and `WORKPLACE` signals from `/identityMe` + `/verificationReport`; public badges remain disabled.
- Migration `028_linkedin_verified_development.sql` stores minimized verification snapshots and scrubs historical raw OAuth token values.
- New OIDC persistence stores no access, refresh, or ID token values.
- A private Profile surface shows category status and provides explicit manual refresh; normal members retain the existing base OIDC flow.
- Role, company, title, seniority, skills, experience, expertise, and bio remain member-provided.
- STEP058B canonical Node `20.20.2` QA: dependency install, `npm run check`, dedicated STEP058A/STEP058B contracts, positioning compatibility, and `npm audit` PASS.
- Full STEP058B inventory: `74/87` PASS versus STEP058A `73/86`, with the same 13 inherited failures, one new passing trust-surface contract, and new failures `0`.
- STEP058B1 is operator-confirmed live; `/identityMe` and `/verificationReport` returned a zero-category snapshot plus a LinkedIn completion URL. No public badge is inferred from the empty category set.

- STEP057 production-safe read-only preflight, exact artifact binding, Telegram webhook diagnostics, PostgreSQL invariant checks, and operator-assisted core-loop verdict pack

- STEP056 one canonical `Request contact` entry on profile cards, a deterministic contact-options surface, and one Contact inbox hub while preserving existing intro/contact/DM repositories and payment transitions

- STEP055 guided activation: exact next required step, progress, separate optional details, preview-before-publish, and explicit publish/hide callbacks
- STEP054 positioning canon: listed member profiles, LinkedIn-connected account identity, member-provided professional claims, and approval-based contact
- STEP053A reproducible staging preflight, isolated PostgreSQL runtime harness, and operator-assisted Telegram Stars evidence verifier
- canonical runtime release marker shared by health and admin surfaces
- LinkedIn OIDC identity bootstrap
- Telegram profile completion, skills, browse, search, intro flow
- operator `/ops` / `/admin` entrypoints with allowlist gating
- Admin / Operations / Communications / System hubs in Russian
- Users, User Card, Notice, Broadcast, Outbox, Intros, Delivery, Quality, Audit
- compact admin counters, trend summaries, funnel drilldowns
- guarded bulk actions from user segments into Notice / Broadcast prep
- STEP045 LinkedIn identity auto-seed uplift for name / given / family / picture / locale persistence
- STEP046 hidden Telegram username + paid direct-contact request flow with owner approval
- STEP047 gated member DM relay with first-message payment + recipient accept/decline/block/report
- honest user-facing LinkedIn import summary and manual-fields reminder
- upgraded one-page public landing with stronger CTA hierarchy, product sections, FAQ, and final CTA
- branded OG/share-preview asset, favicon layer, and full homepage social metadata
- hero now uses a simplified single-master visual with shorter copy, calmer CTA framing, and one trust line instead of the prior rail / plaque density
- post-hero landing narrative is now compressed into clearer workflow, proof, audience, and FAQ layers with less duplication
- `See the workflow` now uses one cleaner gallery system: left-aligned section header, active step copy above the stage, and one active scene swapped by the thumbnail row
- the workflow gallery now defaults to `05 · Continuation`, so the section opens on the most concrete first-message outcome instead of the more abstract identity state
- STEP050H widens the workflow intro, strengthens active thumb emphasis, tightens the active-copy-to-stage rhythm, and raises the visual quality of `Why this works better`, `Who it's for`, and the final CTA without touching runtime/legal layers
- STEP050L replaces the heavy 2-column mobile nav wall with a calmer horizontal chip rail plus separate CTA, collapses the `How it works` bridge into a one-card-per-row mobile stack, and stabilizes workflow thumbnails as a true horizontal strip without overlap/clipping
- STEP050M narrows the public landing meta copy so root `<title>`, standard description, Open Graph, and Twitter preview text all use one cleaner canon: trusted intros and direct contact in Telegram, with LinkedIn as the identity layer
- STEP050M also realigns `scripts/smoke_og_social_contract.js` to the current `assets/social/intro-deck-og-1200x630.png` asset path so OG/social source checks match the repo state
- STEP051 invite contacts / Telegram-native inline share layer with primary inline share CTA, raw-link/card fallbacks, deep-link attribution truth, and honest invited/activated counters
- STEP051.1 upgrades the primary inline invite result from article/text into a photo-card built from the shipped OG preview asset, with caption polish and cached-photo readiness
- STEP051.2 reorganizes the user-facing home/help menu surfaces so the core flow reads more cleanly: profile/browse first, inboxes next, plans before invite, help near the bottom, and founder/operator admin pinned last
- STEP051.3 keeps the STEP051.2 order but compresses the home/help keyboards into cleaner two-button rows where it improves mobile scanning, without changing invite, DM, intro, or LinkedIn contracts
- STEP051.4 fixes command parity: `/start` now has one runtime owner, `/menu` stays the visible home fallback, `/inbox` gets a product-safe fallback path, and the accidental home-surface extra-notice leak is removed
- STEP051.5 restores the broken `Plans` surface by shipping the missing pricing text/keyboard render layer, so `⭐ Plans`, `/plans`, and `plans:root` no longer fail on `renderPricingText is not a function`

## Current truth

- STEP059 never publishes automatically: listing a profile, buying Pro, or connecting LinkedIn is not publication consent.
- One Telegram preview approval is bound to one share intent and at most one provider post.
- Provider success is never downgraded to retryable failure because of local receipt or audit problems.
- `unknown` is a launch-safe duplicate-prevention state and requires feed/operator reconciliation.
- Share access tokens and raw provider payloads are not persisted.
- STEP059 is text-only; media, scheduling, organization posting, analytics, AI drafts, and automatic publishing remain out of scope.
- Lite upgrade submission is an operator action; approval is not source- or live-confirmed.

- STEP058B source readiness does not make a failed Development sync into verification evidence.
- Development mode can never enable a public badge, even if the public-badge env flag is set.
- A stale, missing, failed, non-Lite, category-empty, or materially future-dated snapshot is not public-badge eligible.
- A prior successful snapshot remains authoritative until replaced by another successful snapshot; failed refreshes do not erase it.
- Public badge activation remains blocked until LinkedIn Lite approval and an explicit operator enablement.

- STEP058A is Development testing only; it is not broad production verification coverage.
- `LINKEDIN_VERIFIED_MODE=development` requests verification scopes only for configured Intro Deck operator Telegram IDs; LinkedIn still enforces developer-app administrator eligibility.
- Verification API failure does not break the base OIDC connection and does not erase a prior snapshot.
- No public badge, rank, filter, payment advantage, or contact bypass is introduced.
- Migration 028 is required before enabling Development mode.

- STEP057 changes no product, payment, callback, entitlement, or database state machine; it adds only read-only production diagnostics and evidence governance
- Automated preflight cannot mutate production and uses a PostgreSQL `READ ONLY` transaction
- Required core-loop evidence drives GO/NO_GO; incomplete optional Stars/replay evidence yields GO_WITH_RISKS rather than a false GO

- STEP056 changes the user-facing entry and navigation only: one `dir:contact` rail resolves to free intro, private chat, or Telegram contact according to profile mode
- Existing `dir:intro`, `dir:dm`, and `dir:unlock` callbacks remain supported for stale messages and backend compatibility
- One Contact inbox routes to existing Requests and Private chats surfaces; no request rows or money state are migrated
- STEP056 adds no schema or migration and preserves STEP053 consent, cooldown, block, replay, Pro allowance, and audit invariants

- STEP055 uses one canonical activation resolver across Home, Profile setup, saved-field, Skills, and Preview surfaces
- Required activation steps are LinkedIn, display name, headline, industry, about, and at least one skill
- Optional company, city, public LinkedIn URL, hidden Telegram username, and contact mode are separated from the required setup path
- Hidden-to-listed publication is available only from the preview surface through `p:pub`; legacy `p:vis` can only hide and cannot publish
- STEP055 changes no schema, LinkedIn, payment, entitlement, intro, DM, or contact-state machine
- STEP054 removes stronger-than-mechanism claims from active landing, Telegram, legal, README, and BotFather-facing copy
- LinkedIn sign-in connects basic account identity; it does not verify member-entered roles, companies, skills, experience, or expertise
- Active, listed profile cards are visible to bot users; private contact details remain hidden by default and contact stays approval-based
- Intro requests go directly to the profile owner and are not represented as third-party warm introductions
- STEP053A remains an acceptance pack; deployed health is confirmed, while complete Stars/concurrency scenario evidence remains partial
- mutating fixture tests require exact staging target, mutation ACK, database fingerprint ACK, and artifact SHA; automated and manual evidence must share that anchor
- STEP053 makes `contact_mode` authoritative for new paid direct-contact and DM permission requests
- STEP053 defines Stars as a non-refundable request-delivery fee on decline/no reply; approval/contact/reply are not guaranteed
- STEP053 bounds Pro outreach with one combined rolling 24-hour allowance and preserves the canonical paid fallback
- STEP053 adds pair/payment/allowance advisory locks, policy snapshots, checkout authorization, charge replay checks, and contact audit events

- LinkedIn login is still identity bootstrap, not full professional import
- STEP045 auto-seeds only the safe identity layer and only seeds profile display name when the local card name is still empty
- existing manual Telegram profile fields are preserved on reconnect
- public browse still depends on listed + active truth
- STEP046 ships hidden Telegram handle + paid direct contact requests with owner approval
- STEP047 now ships the narrow DM request + active thread path
- landing is now structured as a real product entry page instead of a minimal placeholder
- STEP050A shifts the homepage hero from policy-first explanation toward a stronger access/trust/workflow framing
- STEP050B compresses the rest of the landing so the page reads as one product story instead of separate explanatory blocks
- STEP050C upgrades the workflow section from text-led cards into a more premium product gallery with clearer visual authority
- STEP050D tightens section rhythm, card heights, FAQ distribution, and hero/workflow responsive behavior for cleaner tablet/mobile presentation
- STEP050E de-densifies the hero by removing the workflow rail and explanatory plaque, shortening the hero copy, and integrating a cleaner rendered device visual as the main right-side anchor
- privacy and terms pages now share the same visual/navigation standard as the landing
- STEP048 pricing / analytics / ops remains the last shipped product/runtime layer beneath the landing uplift
- STEP051 keeps LinkedIn as the trust/identity bootstrap and adds invite sharing as a narrow Telegram-native growth layer without reward mechanics
- STEP051.1 keeps the STEP051 invite surface contract intact and only upgrades the primary share result to a richer photo-card path
- STEP051.2 keeps the invite/runtime contracts intact and only reorganizes menu entrypoint order plus help-surface discovery, including a first-class `Plans` entry on the home/help surfaces
- STEP051.3 keeps the same menu order but makes the keyboards more compact and organic on mobile by pairing the most related actions into shared rows
- STEP051.4 keeps the paired menu layout intact and only hardens slash-command behavior so `/start`, `/menu`, and `/inbox` behave like honest entrypoints instead of partially diverging from the button flow
- STEP051.5 keeps the STEP051.4 command/menu work intact and only restores the monetization member surface so the promoted `Plans` button is a working product screen again
- invite attribution only applies to first-start new users and differentiates `inline_share`, `raw_link`, and `invite_card` sources

## What must not break

- LinkedIn OIDC flow and callback truth
- Telegram webhook secret guard
- async `createBot()` + awaited `bot.init()`
- listed/active visibility truth
- intro persistence / decision truth
- communications layer and outbox truth
- operator allowlist gating
- docs canon + artifact protocol

## Next recommended step

1. Apply migration `030_ai_news_drafts_approval.sql` after a Neon restore point or branch backup.
2. Configure NewsData.io and OpenAI server-side secrets and start with `AI_NEWS_DRAFT_MODE=operator`.
3. Deploy STEP060 and verify health reports valid providers, explicit approval, no token persistence, and automatic publishing disabled.
4. Run one operator flow: `/news` → source → generate → preview/edit → approve → canonical STEP059 LinkedIn authorization → exactly one post/receipt.
5. Keep Pro rollout disabled until provider/runtime evidence and duplicate protection are accepted.

## STEP039.1 delta

- founder/operator-only admin visibility from `ADMIN_CHAT_ID` + `TG_OPERATOR_IDS`
- `/admin` mirrors `/ops` as operator-only fallback

## STEP040 delta

- Russian admin/operator layer
- compact analytics drilldowns and funnel readouts

## STEP041 delta

- safe bulk actions from user segments into Notice / Broadcast prep
- no destructive bulk mutations

## STEP042 delta

- launch/operator runbook added
- freeze policy added
- System hub now exposes `Регламент запуска` and `Freeze`
- release-readiness / handoff / roadmap / start-new-chat prompt aligned to STEP042

## STEP043.1 delta

- live-verification guidance added
- launch-rehearsal guidance added
- System hub now exposes `Live verification` and `Репетиция запуска`
- verification playbook / rehearsal checklist / go-no-go template added

## STEP045 delta

- LinkedIn OIDC claims now normalize and persist basic identity fields more explicitly
- profile draft seeding now fills display name only when the local card name is still empty/blank
- callback success surfaces now state clearly that only the basic identity layer was imported
- hidden/manual professional fields remain Telegram-managed and are not auto-scraped from LinkedIn

## STEP046 delta

- optional hidden Telegram username added to profile editing
- contact mode toggle added for intro-only vs paid direct-contact requests
- Telegram Stars one-time invoice path added for direct-contact requests
- owner approve/decline + controlled reveal flow added
- inbox/detail surfaces extended to include direct-contact requests


## STEP047 delta

- member DM request entity + compose session + message/event storage added
- first-message payment gate added for DM request delivery
- recipient review controls added: accept / decline / block / report
- active text-only bot-mediated DM thread replies added
- `/dm` inbox and DM thread detail surfaces added


## STEP048.1 hotfix

- Added schema-compatible profile/directory reads so legacy databases without `member_profiles.telegram_username_hidden` do not break LinkedIn transfer confirm or home/profile loads.
- Purpose: keep pre-STEP046 databases operational while migrations are still being applied.
- Note: paid unlock / DM / pricing features still require STEP046-STEP048 migrations to be applied for full functionality.


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

- public `index.html` rebuilt into a production-grade one-page landing with clear section architecture
- hero CTA hierarchy cleaned up: primary bot-open CTA + secondary how-it-works anchor
- added sections for audience, workflow, product surfaces, FAQ, and final CTA
- `site.css` upgraded to a stronger dark premium layout system with better mobile behavior
- `privacy` and `terms` pages aligned to the same navigation and footer standard

## STEP049C delta

- homepage now ships full Open Graph and Twitter-card metadata with canonical/title/description polish
- branded OG card added at `assets/social/intro-deck-og-1200x630-v1.png`
- favicon + apple-touch icon layer added for landing/legal consistency
- `robots.txt` and `sitemap.xml` added for production metadata hygiene
- privacy and terms pages now include aligned canonical + favicon metadata

## STEP049D delta

- homepage polished with skip-link support, cleaner hero/footer microcopy, and tighter CTA hierarchy
- mobile nav layout upgraded so section links and the bot CTA remain readable and intentional
- privacy and terms pages rebuilt into one consistent legal-shell layout with quick summary blocks and aligned actions
- legal pages now include OG/Twitter metadata and landing polish has its own smoke check



## STEP049J delta

- Replaced the homepage/legal social preview asset with a new premium OG master `intro-deck-og-1200x630.png` plus WEBP companion.
- Updated homepage, privacy, and terms metadata to the new versioned OG path for cache-safe share refresh.
- This step is an asset/meta refresh only; no schema or bot runtime behavior changed.


## STEP049K delta

- Landing copy, spacing, and section alignment were tightened for a cleaner production presentation.
- Brand marks on homepage and legal pages now use the real Intro Deck asset instead of text-only placeholders.
- Product preview section now uses three balanced cards so desktop layout no longer leaves an empty column.
- Legal-page intro copy and action shells were cleaned up for better readability and consistency.


## STEP050A delta

- homepage hero rebuilt into a stronger product-first composition with one focal phone sculpture instead of the prior equal-weight feature grid
- hero copy was shifted toward a stronger professional-access framing; STEP054 later replaced that wording with the current account-identity and approval-based contact canon
- added a compact five-step workflow rail so the value path reads immediately from identity to continuation
- kept runtime, legal pages, and product contracts untouched; scope is front-end-only `index.html` + `site.css` plus docs state alignment


## STEP050B delta

- landing narrative after the hero was compressed into a tighter sequence: audience → how it works → see the workflow → why this works better → FAQ
- removed the duplicated `What's inside` / `Product preview` split and replaced it with one unified workflow section
- how-it-works upgraded from four broad steps to a clearer five-step path that matches the product framing introduced in STEP050A
- FAQ shortened and tightened so the landing explains less repeatedly while preserving trust / privacy / LinkedIn truth
- smoke contracts were aligned to the new post-hero landing canon; runtime and legal surfaces remain untouched


## STEP050C delta

- `See the workflow` is now anchored by a larger product-stage showcase instead of a flat row of equally weighted text cards
- workflow section now uses a central master screen plus supporting fragments to express identity, discovery, contact, and continuation as one visual system
- each of the five workflow cards now includes a mini screen-state visual so the section feels product-led rather than copy-led
- kept scope front-end-only on `index.html` + `site.css` plus docs state alignment; runtime and legal layers remain untouched

## STEP050D delta

- responsive layout rhythm tightened after STEP050A-STEP050C so hero, workflow showcase, cards, FAQ, and CTA feel more balanced on tablet/mobile
- hero rail now stacks more cleanly on small screens, trust chips no longer crowd the first screen, and the phone/workflow stage uses calmer mobile heights
- audience/workflow/FAQ grids now keep stronger tablet distribution before collapsing to one column, reducing unnecessary vertical sprawl
- kept scope front-end-only on `site.css` plus docs state alignment; runtime, routing, and legal surfaces remain untouched



## STEP050E delta

- hero was rebuilt around one integrated rendered device visual instead of the prior HTML phone + float-card composition
- removed the hero workflow rail, explanatory plaque, and extra trust chips so the first screen reads shorter and cleaner
- headline/subhead/CTA stack was simplified around professional access; STEP054 later replaced the earlier wording with the current discovery and permission-based contact canon
- scope stays front-end-only on `index.html` + `site.css` + landing smoke alignment; runtime and legal surfaces remain untouched


## STEP050F delta

- moved `Who it's for` below workflow proof + mechanism advantages so the landing no longer drops into audience explanation immediately after the hero
- replaced the prior five-step post-hero explainer with a shorter four-card workflow bridge focused on identity, card, access path, and private continuation
- retuned nav order and hero secondary CTA so the page flows from hero into mechanism before visual proof, then audience/FAQ


## STEP050G-B delta

- `See the workflow` was rebuilt as one cleaner gallery system with a single active stage, short active copy, and five thumbnail switches instead of the prior triple-duplicated explainer layout
- each workflow step now uses one shared master scene asset for both mini preview and expanded stage so the gallery stays visually consistent and easier to maintain
- added optimized workflow assets under `assets/workflow/` and wired lightweight thumb switching directly in `index.html` so the section behaves like a product gallery rather than a content wall
- kept scope front-end-only on `index.html` + `site.css` + workflow assets + docs/smoke alignment; runtime and legal surfaces remain untouched


## STEP050H delta

- widened the workflow intro note, strengthened the active thumbnail state, and tightened the reading rhythm between active step copy and the large stage
- upgraded `Why this works better` into a more product-grade proof grid with clearer value labeling and stronger card hierarchy
- upgraded `Who it's for` with tighter audience copy, clearer micro-positioning, and calmer premium card styling
- rebuilt the final CTA into a cleaner action stage with a more compact message and a stronger right-side action stack

## STEP050M delta
- root landing meta copy updated so `<title>`, `meta name="description"`, `og:title`, `og:description`, `twitter:title`, and `twitter:description` all share the new trusted-intros/direct-contact wording
- no runtime, layout, OG-image, or legal-surface changes


## STEP051 delta

- `/invite` command and `📨 Invite contacts` user surface added
- primary share path now uses Telegram inline mode with raw-link and invite-card fallbacks
- `member_invites` stores first-start invite attribution truth
- home/help surfaces now expose invite entrypoints for connected members
- invite counters stay honest: `Friends invited` and `Activated`
- no reward mechanics, no quota bonuses, no leaderboard layer

## STEP051.1 delta

- primary inline invite result now prefers a photo-card instead of article/text
- shipped JPEG invite asset at `assets/social/intro-deck-og-1200x630.jpg` derived from the production OG preview
- inline invite caption now uses the tighter landing canon: trusted intros and direct contact in Telegram
- cached-photo readiness added via optional `INVITE_PHOTO_FILE_ID` env; when absent, the bot falls back to the public JPEG asset URL
- `Show link` and `Get invite card` remain unchanged as fallback paths


## STEP051.2 delta

- home surface buttons are now ordered more intentionally for member flow: profile/edit first, browse second, inboxes next, `Plans` before growth/share, help near the bottom, and admin still last
- help surface text now mentions plans / Pro status explicitly and the help keyboard mirrors the same core navigation order
- `⭐ Plans` is now promoted from a hidden shortcut/fallback path into the main home/help navigation so monetization entry is easier to discover without cluttering the invite flow
- scope is UI-order polish only; no schema, invite attribution, DM, intro, or LinkedIn auth contracts changed


## STEP051.3 delta

- home keyboard now uses paired rows where it improves readability on mobile: `Profile/Edit + Browse`, `Intro inbox + DM inbox`, and `Plans + Invite contacts`
- unconnected users now see a tighter compact row for `Browse directory + Plans` beneath `Connect LinkedIn`
- help keyboard mirrors the same paired navigation structure so home/help feel like one coherent surface instead of two different layouts
- `❓ Help` and founder/operator `👑 Админка` remain single-row actions so the bottom of the menu still reads clearly
- scope is layout polish only; no command routing, schema, invite attribution, DM, intro, or LinkedIn auth contracts changed

## STEP051.4 delta

- removed the duplicate `/start` runtime ownership so start/deep-link handling now lives in one place instead of rendering home twice
- `/menu` remains the explicit visible home fallback, separate from the hidden system `/start` entrypoint
- hardened `/inbox` with a product-safe fallback render and text clamping so the slash-command path no longer fails silently when the inbox surface cannot be rendered cleanly
- removed the accidental extra-notice leak on home renders where `appBaseUrl` could be passed into the home surface as if it were a notice
- updated command/router smoke coverage to assert one `/start` handler and the `/inbox` fallback path

## STEP053 delta

- `intro_request` now blocks creation, invoice, pre-checkout, and confirmation of new paid direct-contact and DM requests.
- `paid_unlock_requires_approval` remains the only mode that permits those new paid request rails.
- Stars purchase delivery of a permission request; recipient approval, contact disclosure, and reply are not guaranteed.
- Decline or no reply alone does not trigger an automatic refund in the current money core.
- Pro uses a combined rolling 24-hour allowance across direct-contact and DM request deliveries; default `10`, with paid fallback after exhaustion.
- Cross-rail decline cooldown defaults to `30` days; recipient block closes both new paid rails for the pair.
- New critical transitions use PostgreSQL advisory locks, short-lived checkout authorization, policy snapshots, charge replay checks, and audit events.
- Required migration: `migrations/027_contact_contract_payment_honesty.sql`.
- Package version: `0.50.0`.
- Local source result: `67/80` smoke PASS versus baseline `64/79`; no new failing smoke contract.
- Live status not confirmed — manual verification required.

## Next recommended step after STEP053

1. Apply migration `027` in staging after a duplicate-charge preflight.
2. Run Node 20 + PostgreSQL + Telegram Stars runtime acceptance, including duplicate/stale callback and Pro concurrency cases.
3. STEP054 proceeded after operator-confirmed STEP053A health/config; remaining payment/concurrency scenarios stay tracked as partial runtime evidence rather than blocking copy alignment.

## STEP055 delta

- Profile editor replaced by a guided setup spine with one primary next action.
- Activation progress is canonical and deterministic: LinkedIn + four required fields + skills.
- Optional details/contact settings moved to a separate surface.
- Field prompts now use edit-in-place where Telegram permits.
- Incomplete previews cannot publish; ready hidden previews expose `p:pub`; listed previews expose hide only.
- Explicit visibility writes replace the old toggle path in runtime routing.
- Package version: `0.52.0`.
- Node 20 full smoke: `70/83` PASS versus STEP054 `69/82`, with the same 13 inherited failures and one new passing STEP055 contract.
- No migration required.
- Live status not confirmed — manual verification required.
