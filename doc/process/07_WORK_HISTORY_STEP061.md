# STEP061 Work History

## STEP

Personalized News Presets & Subscription Productization

## Baseline

- Source baseline: STEP060
- Live baseline artifact: `f12e0e3e79de222d314da54f3164a2e9fa2a9d0b`
- Target package: `0.59.0`

## Implemented

- saved personalized news presets;
- manual, daily, and weekdays scheduling;
- Pro/operator entitlement gates;
- transparent preset and draft allowances;
- Vercel-daily and optional external-hourly scheduler drivers;
- authenticated cron endpoint;
- row claims, unique scheduled-run keys, Telegram delivery retry, and audit linkage;
- one due preset per user per scheduler execution;
- reuse of STEP060 source/evidence/generation services;
- explicit reuse of STEP059 publishing approval core;
- operator diagnostics, health surface, legal copy, and rollout documentation.

## Invariants retained

- no automatic LinkedIn publishing;
- no OAuth/provider-token persistence;
- no second publishing core;
- no second subscription core;
- source evidence remains mandatory;
- unknown LinkedIn outcomes remain non-retryable;
- user publication authority remains explicit and per-post.

## Runtime boundary

Source QA does not prove production scheduler delivery. Live acceptance requires migration 031, scheduler ENV, deployed STEP061 health, and manual preset/cron/draft evidence.
