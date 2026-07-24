# LinkedIn Telegram Directory Bot

STEP064A source candidate for a Telegram-native professional directory with guided profile activation, listed member profiles, LinkedIn-connected account identity, approval-based contact flows, and a mature operator/admin control plane.

## What this repo is

A Telegram-first professional directory:
- LinkedIn OIDC for basic account identity plus a gated Verified on LinkedIn trust rail; member-entered professional claims remain separate
- explicit, preview-first Share Profile on LinkedIn with one-shot `w_member_social` authorization and no OAuth token persistence
- self-managed profile completion inside Telegram
- listed/active profile browse visible to bot users, with private contact details hidden by default
- one canonical Request contact entry point with free intro, private-chat, or Telegram-contact outcomes
- persisted intro requests and decisions
- gated member private-chat relay with first-message approval and paid request opening
- Telegram-native invite contacts surface with inline share + raw-link/card fallbacks
- operator shell with communications, delivery, audit, quality, and search
- analytics drilldowns and guarded operator bulk-prep
- runbook/freeze launch discipline

## STEP064A invite card conversion and share menu simplification

- Public invite cards expose one attributed `Open Intro Deck` CTA.
- Inline and forwarding flows use one canonical photo-card renderer; text is only a fallback.
- Public captions contain value and permission boundaries without a duplicate text link.
- Invite root is simplified to Share, Forwarding card, Copy link, Activity, conditional Points, and Home.
- Activity combines performance, source attribution, recent movement, and recent joined contacts.
- Rewards accounting, activation rules, LinkedIn OAuth, and publishing are unchanged.
- No migration or new ENV is required.

## STEP063B-H2 personalized query precision and final-fit gate

- `For you` uses bounded multi-word professional anchors instead of broad single-word OR clauses.
- Profile terms are split into required anchors and ranking-only boosts.
- RSS and Hacker News match complete query clauses.
- Primary RSS/GitHub registry sources carry bounded profile-focus alignment.
- Weak fallback candidates are rejected; `no_result` is preferred to irrelevant content.
- Telemetry records sanitized query-plan and rejection evidence.
- No migration or new ENV is required; STEP059 publishing remains unchanged.

## STEP063B-H1R1 migration safety and exact claim recovery

- Migration `035` now drops legacy constraints before legacy value rewrites and runs atomically.
- Migration `036` idempotently repairs the known partially-applied schema state.
- Audience readiness validates columns plus exact constraints.
- Unexpected post-claim search failures attempt exact allowance restoration and emit phase-tagged diagnostics.

- Search now uses one persistent Telegram message lifecycle: `searching -> results | failed`.
- A fallback reply becomes the canonical target when the original message cannot be edited.
- Duplicate callbacks are suppressed in-process and remain protected by the PostgreSQL claim boundary across runtimes.
- Total provider failure can safely restore only the exact current search claim.
- No migration or new ENV is required; STEP059 publishing is unchanged.

## STEP063B LinkedIn audience-aware discovery

- `For you` uses a bounded subset of the member's public Intro Deck profile: headline, industry, and skills.
- The compact topic taxonomy now includes AI, Startups/Product, Business/Markets, Career/Leadership, Crypto/Web3, and Custom.
- Audience and Editorial Angle selectors define who the story is for and how it should be framed.
- Ranking combines topic, profile affinity, audience fit, angle fit, source authority, freshness, and promotional risk.
- Saved presets persist topic + audience + angle + language + tone + profile-match policy.
- Migration 035 is required; no new ENV is required.
- STEP059 remains the sole explicit-approval LinkedIn publisher.

## STEP063A-H1A source relevance and browse UX

- Preset-specific provider queries reduce broad fallback noise.
- A common relevance gate runs before persistence; obvious price-prediction, presale, advertorial, and unrelated fallback candidates are rejected.
- NewsData authority is domain-tiered instead of universally 65/100.
- RSS/HN/GitHub telemetry exposes bounded error/no-result diagnostics without secrets or arbitrary URLs.
- Browse-only Telegram surfaces show rolling search allowance/reset and hide stale failed-draft status.
- No migration or new ENV is required; STEP059 remains the only LinkedIn publisher.

## STEP063A-H1 generator fallback

- `/news` can remain available with `AI_NEWS_GENERATOR_MODE=off`; source browsing does not require OpenAI.
- `template` creates a deterministic local evidence-bound draft with zero external LLM calls.
- `groq` uses a dedicated provider adapter and real Groq telemetry.
- `openai` remains optional and backward-compatible.
- Migration 034 is required only for `template` and `groq` draft rows.
- STEP059 remains the sole explicit-approval LinkedIn publisher.

## Current STEP corridor

- STEP039.1 — founder-only admin visibility + `/admin` fallback
- STEP040 — Russian admin analytics drilldowns + funnel readouts
- STEP041 — safe bulk actions
- STEP042 — launch/ops runbook + freeze
- STEP043.1 — live verification / launch rehearsal guidance
- STEP045 — LinkedIn identity auto-seed uplift
- STEP046 — private handle + paid direct contact unlock
- STEP047 — gated member DM relay
- STEP051 — invite contacts / Telegram-native inline share layer
- STEP053 — authoritative contact/payment honesty contract
- STEP053A — runtime acceptance tooling and artifact binding
- STEP054 — positioning and discovery truth alignment
- STEP055 — guided profile activation spine
- STEP056 — core contact rail simplification
- STEP057 — production readiness and core-loop acceptance
- STEP058A — Verified on LinkedIn Development integration
- STEP058B — Verified badges and fail-closed trust surfaces
- STEP058B1 — verification compatibility + optional-config fail-safe
- STEP059 — explicit user-approved Share Profile on LinkedIn
- STEP060 — evidence-bound AI/news drafts with preview/edit and explicit one-post approval
- STEP061 — personalized AI/news presets, Pro access/allowances, and scheduled reviewable Telegram drafts
- STEP061H1 — profile preview runtime and webhook token-log hotfix
- STEP061A — AI/news E2E live acceptance, provider telemetry, and rollout hardening
- STEP063A — multi-source news ingestion, source quality, deduplication, and NewsData fallback
- STEP063A-H1 — browse-only, deterministic template, and Groq/OpenAI generator selection
- STEP063A-H1A — source relevance, provider diagnostics, and browse-only allowance UX
- STEP063B — LinkedIn audience-aware topic discovery, For you, Audience, Angle, and personalized presets
- STEP063B-H1R1 — migration 035 ordering repair, strict schema readiness, and exact post-claim recovery
- STEP063B-H2 — personalized phrase queries and final-fit rejection gate
- STEP064A — invite card conversion and share menu simplification

## Core docs

- `doc/00_CURRENT_STATE.md`
- `doc/15_NEW_CHAT_HANDOFF.md`
- `doc/16_RELEASE_READINESS_CHECKLIST.md`
- `doc/17_START_NEW_CHAT_PROMPT_LINKEDIN_DIRECTORY_BOT.md`
- `doc/73_LAUNCH_OPS_RUNBOOK_V1.md`
- `doc/74_LAUNCH_FREEZE_POLICY_V1.md`
- `doc/76_LIVE_VERIFICATION_PLAYBOOK_V1.md`
- `doc/77_LAUNCH_REHEARSAL_CHECKLIST_V1.md`
- `doc/78_GO_NO_GO_VERDICT_TEMPLATE_V1.md`

## Smoke

- `npm run check`
- `npm run smoke:admin-shell`
- `npm run smoke:admin-russian-layer`
- `npm run smoke:admin-bulk-actions`
- `npm run smoke:admin-runbook-freeze`
- `npm run smoke:admin-live-verification`
- `npm run smoke:dm-relay`
- `npm run smoke:dm-payments`
- `npm run smoke:invite`
- `npm run smoke:invite-conversion`
- `npm run smoke:positioning-truth`
- `npm run smoke:guided-activation`
- `npm run smoke:contact-rail`
- `npm run smoke:step057-readiness`
- `npm run smoke:linkedin-verified-dev`
- `npm run smoke:linkedin-trust-surfaces`
- `npm run smoke:linkedin-verification-compat`
- `npm run smoke:linkedin-share`
- `npm run smoke:ai-news-drafts`
- `npm run step057:preflight`
- `npm run smoke:ai-news-live-acceptance`
- `npm run smoke:ai-news-multi-source`
- `npm run smoke:ai-news-source-relevance`
- `npm run smoke:ai-news-audience-discovery`
- `npm run smoke:ai-news-search-progress`
- `npm run smoke:ai-news-personalized-final-fit`
- `npm run step061a:preflight`
- `npm run step061a:evidence:init`
- `npm run step061a:evidence:verify`


## STEP058B trust-surface rollout

1. Apply `migrations/028_linkedin_verified_development.sql`.
2. Keep public badges disabled.
3. Set `LINKEDIN_VERIFIED_MODE=development` only after the migration is applied.
4. Configure `LINKEDIN_VERIFIED_SCOPES=r_profile_basicinfo r_verify` for Development/Lite. `r_verify_details` is reserved for Plus-compatible configurations.
5. Configure `LINKEDIN_VERIFIED_IDENTITY_API_VERSION=202510.03` and `LINKEDIN_VERIFIED_REPORT_API_VERSION=202510`.
6. Redeploy and test Profile → Refresh LinkedIn verification with a LinkedIn developer-app administrator that is also an Intro Deck operator.
7. Keep `LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED=0` in Development. Public badges require Lite mode, explicit enablement, and a fresh Lite snapshot.

Development mode is testing-only. `IDENTITY` and `WORKPLACE` are separate category-level trust signals; they do not verify member-entered role, title, seniority, skills, experience, or expertise. STEP058B implements the future public badge surface but keeps it fail-closed outside Lite.

Operator runbooks: `doc/82_STEP058A_OPERATOR_ROLLOUT.md` and `doc/83_STEP058B_OPERATOR_ROLLOUT.md`.

Roadmap: `doc/81_LINKEDIN_TRUST_AND_DISTRIBUTION_ROADMAP.md`.


## STEP059 Share Profile on LinkedIn rollout

1. Apply `migrations/029_linkedin_share_profile.sql`.
2. Confirm Share on LinkedIn / `w_member_social` is enabled for the LinkedIn developer app.
3. Configure `LINKEDIN_SHARE_MODE=live` and the STEP059 share ENV contract.
4. Redeploy and confirm `/api/health?full=1` reports `STEP059` and `linkedInShare.enabled=true`.
5. Test Profile preview → Share profile on LinkedIn → exact preview → explicit authorization → one receipt.
6. Confirm the resulting Telegram deep link opens the correct listed profile.
7. Keep automatic posting, token persistence, scheduled posting, media upload, and AI drafting disabled.

Operator runbook: `doc/86_STEP059_OPERATOR_ROLLOUT.md`.
Lite upgrade pack: `doc/85_LINKEDIN_LITE_UPGRADE_APPLICATION_PACK.md`.


## STEP061 personalized news presets and subscription rollout

1. Apply `migrations/031_ai_news_presets_subscription.sql` after migration 030.
2. Set `AI_NEWS_DRAFT_MODE=pro` to grant active Pro members access while retaining operator access.
3. Set `AI_NEWS_SCHEDULE_MODE=live`; use the default `vercel_daily` driver for one daily draft-delivery window, or an authenticated external hourly driver when finer delivery windows are required.
4. Scheduled runs create reviewable Telegram drafts only. They never call LinkedIn and never authorize publication.
5. Configure preset, claim, retry, and batch limits; keep the existing NewsData/OpenAI keys and STEP059 publishing ENV unchanged.
6. Redeploy and confirm health reports STEP061, Pro mode, valid scheduler config, and `scheduledEffect=telegram_draft_only`.
7. Test save preset → run now → daily/weekdays schedule → pause/resume/delete → Telegram delivery → explicit STEP059 approval.

Operator runbook: `doc/88_STEP061_OPERATOR_ROLLOUT.md`.
STEP specification: `doc/spec/STEP061_PERSONALIZED_NEWS_PRESETS_AND_SUBSCRIPTION_PRODUCTIZATION.md`.

## STEP060 AI/news drafts approval rollout

1. Apply `migrations/030_ai_news_drafts_approval.sql` after migration 029.
2. Start with `AI_NEWS_DRAFT_MODE=operator`; do not expose the feature broadly until provider/runtime evidence is accepted.
3. Configure NewsData.io and OpenAI API keys as separate Vercel secrets. Never place either key in Telegram messages, logs, or evidence artifacts.
4. Redeploy and confirm `/api/health?full=1` reports `STEP060`, valid providers, `explicitApprovalRequired=true`, and `automaticPublishing=false`.
5. Test `/news`: choose a preset or custom topic → select a current source → generate → review/edit → approve → complete the existing STEP059 one-shot LinkedIn authorization.
6. Confirm one approval produces at most one LinkedIn post and that provider-unknown outcomes remain blocked from automatic retry.
7. Subscription access may control allowance, but it never authorizes automatic publishing.

STEP060 remains text-only and source-evidence-bound. STEP061 adds scheduled delivery of reviewable Telegram drafts, but media generation/upload, background LinkedIn posting, organization posts, autonomous publishing agents, and unattended publication remain out of scope.

Operator runbook: `doc/87_STEP060_OPERATOR_ROLLOUT.md`.
STEP specification: `doc/spec/STEP060_AI_NEWS_DRAFTS_APPROVAL_FOUNDATION.md`.


## STEP061A AI/news live acceptance rollout

1. Apply `migrations/032_ai_news_live_acceptance_telemetry.sql` after migrations 030 and 031.
2. Keep `AI_NEWS_ROLLOUT_STAGE=operator_acceptance` for the first production evidence run.
3. Configure provider cost-rate ENV only from trusted current pricing; leave values at `0` when unknown.
4. Deploy and confirm health reports `STEP061A`, provider telemetry required, and automatic publishing disabled.
5. Run `step061a:preflight` with exact production artifact SHA, database URL, bot token, and optional operator Telegram user ID.
6. Complete the manual source → draft → edit → approval → exactly-one LinkedIn post plus preset/cron scenarios.
7. Verify the evidence manifest. Only a recorded GO permits an explicit move to `limited_pro`; broad `live` remains a later operator decision.

Operator runbook: `doc/89_STEP061A_OPERATOR_ROLLOUT.md`.
STEP specification: `doc/spec/STEP061A_AI_NEWS_E2E_LIVE_ACCEPTANCE_AND_ROLLOUT_HARDENING.md`.


## STEP063A multi-source news ingestion rollout

1. Deploy the overlay in `AI_NEWS_SOURCE_MODE=newsdata_only` first.
2. Apply `migrations/033_ai_news_multi_source_quality_foundation.sql` after migrations 030 and 032.
3. Enable `AI_NEWS_SOURCE_MODE=multi_source` only for `AI_NEWS_ROLLOUT_STAGE=operator_acceptance`.
4. Use allowlisted RSS/Atom, Hacker News, and GitHub Releases as bounded direct/trend sources; NewsData fills only a short candidate pool.
5. Confirm candidate diversity, canonical duplicate removal, provider isolation, source URLs, and provider telemetry.
6. Complete one source → evidence → draft → edit → explicit STEP059 approval loop.
7. Runtime rollback is ENV-only: restore `AI_NEWS_SOURCE_MODE=newsdata_only`; do not remove additive migration 033 during an incident.

Operator runbook: `doc/90_STEP063A_OPERATOR_ROLLOUT.md`.
STEP specification: `doc/spec/STEP063A_MULTI_SOURCE_NEWS_INGESTION_AND_SOURCE_QUALITY_FOUNDATION.md`.

## STEP063A-H1 provider-neutral generator rollout

1. Deploy browse-only with `AI_NEWS_GENERATOR_MODE=off`.
2. Apply migration 034 before enabling `template` or `groq`.
3. Use `template` for a zero-external-LLM draft path or `groq` for bounded external generation.
4. Keep scheduling off during operator acceptance.
5. STEP059 explicit approval remains mandatory for every LinkedIn post.

Operator runbook: `doc/91_STEP063A_H1_OPERATOR_ROLLOUT.md`.
