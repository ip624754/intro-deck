# STEP061 Operator Rollout

## Prerequisites

- STEP060 is deployed and healthy.
- Migrations 029 and 030 are already applied.
- NewsData.io, OpenAI, and STEP059 LinkedIn Share configuration are valid.
- A database restore point or Neon branch backup exists.

## Apply migration

Run once in Neon SQL Editor:

```text
migrations/031_ai_news_presets_subscription.sql
```

Do not execute individual fragments. The migration must complete as one unit.

## Production configuration

Recommended subscriber rollout:

```env
AI_NEWS_DRAFT_MODE=pro
AI_NEWS_PRESET_LIMIT=3

AI_NEWS_SCHEDULE_MODE=live
AI_NEWS_SCHEDULE_DRIVER=vercel_daily
AI_NEWS_SCHEDULE_DAILY_HOUR_UTC=8
AI_NEWS_SCHEDULE_BATCH_SIZE=5
AI_NEWS_SCHEDULE_CLAIM_TIMEOUT_SECONDS=900
AI_NEWS_SCHEDULE_RETRY_DELAY_SECONDS=900
AI_NEWS_SCHEDULE_MAX_ATTEMPTS=3
CRON_SECRET=<server-side secret>
```

`CRON_SECRET` is required by the default Vercel daily driver because Vercel sends it as the Authorization bearer. `AI_NEWS_CRON_SECRET` is reserved for an authenticated external-hourly caller.

Keep the existing STEP060 and STEP059 provider configuration unchanged.

## Vercel driver

The repository contains one daily Vercel cron call:

```text
/api/cron/ai-news-drafts
10 8 * * *
```

With `vercel_daily`, member presets share this daily UTC delivery window. Use `external_hourly` only when an authenticated external scheduler is available and finer delivery hours are operationally required.

## Deployment checks

Run locally:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run smoke:ai-news-productization
```

After deployment, verify `/api/health?full=1`:

- `step=STEP061`
- `aiNewsDraft.mode=pro`
- `aiNewsDraft.presetLimit=3`
- `aiNewsDraft.schedule.enabled=true`
- `aiNewsDraft.schedule.configurationValid=true`
- `aiNewsDraft.schedule.cronAuthConfigured=true`
- `aiNewsDraft.schedule.scheduledEffect=telegram_draft_only`
- `aiNewsDraft.automaticPublishing=false`

## Manual acceptance

Use one operator and one active Pro member.

1. Open `/news`.
2. Configure topic, post language, and tone.
3. Save current settings as a preset.
4. Confirm duplicate preset creation is rejected.
5. Run the preset now and confirm a draft is created, not a LinkedIn post.
6. Set daily or weekdays delivery.
7. Pause, resume, and delete a disposable preset.
8. Invoke the cron endpoint with valid authentication.
9. Confirm Telegram receives one reviewable draft message.
10. Confirm a repeated cron invocation does not create a duplicate run/draft.
11. Confirm the user must still open, review, and explicitly authorize STEP059 before publication.
12. Confirm a non-Pro member sees the Pro gate and cannot save/run presets.

## Rollback

Disable scheduling without disabling manual drafts:

```env
AI_NEWS_SCHEDULE_MODE=off
```

Disable subscriber access while retaining operator testing:

```env
AI_NEWS_DRAFT_MODE=operator
```

Disable the entire AI/news surface:

```env
AI_NEWS_DRAFT_MODE=off
```

Redeploy after each ENV change. Existing presets, runs, drafts, and audit evidence remain stored.
