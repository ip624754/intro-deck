# LinkedIn Telegram Directory Bot

STEP059 baseline for a Telegram-native professional directory with guided profile activation, listed member profiles, LinkedIn-connected account identity, approval-based contact flows, and a mature operator/admin control plane.

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
- `npm run smoke:positioning-truth`
- `npm run smoke:guided-activation`
- `npm run smoke:contact-rail`
- `npm run smoke:step057-readiness`
- `npm run smoke:linkedin-verified-dev`
- `npm run smoke:linkedin-trust-surfaces`
- `npm run smoke:linkedin-verification-compat`
- `npm run smoke:linkedin-share`
- `npm run step057:preflight`


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
