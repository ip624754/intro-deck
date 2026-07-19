# STEP061 — Personalized News Presets & Subscription Productization

## Status

Source implementation candidate. Runtime acceptance requires migration 031, production configuration, deployment, and operator evidence.

## Goal

Turn the STEP060 operator foundation into a bounded subscriber product without changing the publication-authority model.

A member may save personalized topic/language/tone presets and receive scheduled, reviewable Telegram drafts. A subscription grants access and allowance only. It never grants authority to publish on LinkedIn.

## Mode and risk

- CogniForge mode: HEAVY
- Risk score: 12/12
- Critical zones: subscription entitlements, scheduler claims, provider budgets, Telegram delivery retries, duplicate execution, and LinkedIn publication boundaries

## Product contract

1. STEP059 remains the only LinkedIn publishing core.
2. STEP060 remains the only source-evidence and AI-generation core.
3. STEP061 stores preset configuration and schedules draft-generation attempts.
4. Scheduled execution may create and deliver a Telegram draft only.
5. Every LinkedIn post still requires exact preview and separate one-shot OAuth approval.
6. Pro controls feature access and bounded allowances, not publication authority.
7. Operators retain access for support and controlled rollout.
8. Failed, blocked, or no-source runs remain explicit states and are not presented as delivered drafts.

## User flow

```text
/news
→ configure topic/language/tone
→ save current settings as preset
→ run now OR choose manual/daily/weekdays
→ receive reviewable Telegram draft
→ edit/cancel/approve
→ STEP059 explicit LinkedIn authorization
```

## Access and allowances

- `AI_NEWS_DRAFT_MODE=operator`: operators only.
- `AI_NEWS_DRAFT_MODE=pro`: operators plus active Pro members.
- Default preset limit: 3 per user.
- Existing STEP060 search and draft rolling limits remain authoritative.
- Failed or cancelled generation attempts continue to consume provider allowance.

## Scheduling model

### Vercel daily driver

`AI_NEWS_SCHEDULE_DRIVER=vercel_daily`

- one Vercel cron execution per day authenticated by `CRON_SECRET`;
- all scheduled presets use the configured global UTC window;
- at most one due preset is claimed per user per cron execution;
- unresolved draft protection remains authoritative.

### External hourly driver

`AI_NEWS_SCHEDULE_DRIVER=external_hourly`

- an authenticated external scheduler may call the same cron endpoint hourly;
- members may choose from bounded UTC delivery hours;
- the endpoint requires the same secret and idempotency controls;
- this is an operational driver change, not a second scheduling core.

## State model

### Presets

- `active`
- `paused`
- `deleted`

Schedule kinds:

- `manual`
- `daily`
- `weekdays`

### Runs

- `claimed`
- `searching`
- `generating`
- `draft_ready`
- `delivered`
- `retry_due`
- `blocked`
- `no_source`
- `failed`
- `cancelled`

## Idempotency and concurrency

- user advisory lock for preset creation and run-now actions;
- row locking with `SKIP LOCKED` for scheduler claims;
- one due preset per user per cron execution;
- unique scheduled run per `(preset_id, scheduled_for)`;
- unique draft per preset run;
- Telegram delivery failures alone may enter bounded retry;
- provider/generation failures are not blindly retried;
- scheduled source searches bypass the manual 60-second cooldown but still consume the daily search allowance.

## Migration

`migrations/031_ai_news_presets_subscription.sql`

Adds:

- `ai_news_presets`
- `ai_news_preset_runs`
- preset/run/delivery linkage on `ai_news_drafts`

The migration is additive and requires STEP060 migration 030.

## Security and truth boundaries

- no NewsData/OpenAI/LinkedIn token is exposed in Telegram or diagnostics;
- cron authentication accepts only the configured secret;
- invalid optional scheduler configuration disables scheduling without disabling manual STEP060 drafts;
- scheduled messages explicitly state that nothing was published;
- no scheduler path imports or invokes the LinkedIn publishing service;
- operator diagnostics expose counts and safe status only.

## Out of scope

- automatic LinkedIn publishing;
- unattended OAuth;
- media generation/upload;
- organization posts;
- engagement analytics;
- auto-generated comments;
- unlimited presets or generation;
- a second subscription or publishing core.
