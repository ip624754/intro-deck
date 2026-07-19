# STEP061A — AI/News End-to-End Live Acceptance & Rollout Hardening

## Goal

Provide an artifact-bound production acceptance gate for the existing STEP060/STEP061 commercial loop without adding a second generation, scheduling, subscription, or LinkedIn publishing core.

## Mode and risk

- CogniForge mode: HEAVY
- Risk score: 12/12
- Critical zones: external providers, AI-generated content, cron, Pro entitlements, LinkedIn publishing, idempotency, cost controls, production rollout

## Product invariants

1. NewsData search, OpenAI generation, scheduled delivery, and subscription access never authorize a LinkedIn post.
2. STEP059 remains the only LinkedIn publishing core.
3. Every post requires exact preview, explicit one-post approval, and a provider receipt.
4. Provider unknown outcomes never retry automatically.
5. One unresolved draft per member remains authoritative.
6. Initial rollout remains operator-only through `AI_NEWS_ROLLOUT_STAGE=operator_acceptance`.
7. Pro rollout requires recorded production evidence and an explicit ENV change.
8. Provider telemetry stores no API keys, prompts, raw provider payloads, OAuth tokens, or article bodies beyond the existing minimized source snapshot.

## Scope

### Runtime telemetry

Migration 032 adds:

- OpenAI input/output/total token counters on `ai_news_drafts`;
- optional estimated generation cost in micro-USD;
- `ai_news_provider_usage_events` for NewsData/OpenAI operation, outcome, request ID, duration, token counts, result count, and optional estimated cost.

Cost values are estimates only. Rates are operator-supplied ENV values and default to zero rather than inventing current provider pricing.

### Rollout gate

`AI_NEWS_ROLLOUT_STAGE`:

- `operator_acceptance` — only operators may access AI/news, even if `AI_NEWS_DRAFT_MODE=pro`;
- `limited_pro` — Pro access is allowed for a bounded rollout;
- `live` — broad configured entitlement rollout.

This gate controls access only. It never controls or grants publication authority.

### Production preflight

`npm run step061a:preflight` performs:

- exact production URL and artifact SHA binding;
- canonical Node 20 evidence from the local runner or the artifact-bound deployed runtime;
- health/config validation;
- Telegram bot/webhook diagnostics;
- PostgreSQL `BEGIN READ ONLY` schema and impossible-state checks;
- provider, draft, preset, scheduler, receipt, and cost counters;
- optional user-specific acceptance snapshot.

It makes no provider calls and mutates no production rows.

### Manual evidence

The verifier requires evidence for:

- active/listed profile;
- fresh NewsData source list;
- valid OpenAI draft;
- user edit;
- explicit approval;
- exactly one LinkedIn post and durable receipt;
- duplicate callback idempotency;
- preset run-now;
- scheduler Telegram draft-only behavior;
- absence of automatic publishing.

Verdicts:

- `GO` — all required and optional evidence passed;
- `GO_WITH_RISKS` — required core passed with automated warnings or optional rollout evidence incomplete;
- `NO_GO` — any required scenario or invariant failed, blocked, or was not run.

## Out of scope

- autonomous LinkedIn posting;
- background OAuth-token storage;
- automatic retry after unknown provider outcome;
- new payment or Pro entitlement core;
- media generation/upload;
- organization posts;
- provider pricing claims not configured by the operator;
- automatic promotion from operator acceptance to Pro/live.

## Acceptance criteria

- migration 032 is additive and idempotent;
- provider usage is recorded without secrets or raw payloads;
- token usage is stored when returned by OpenAI;
- missing migration 032 blocks provider work before budget is consumed;
- operator diagnostics expose bounded 24-hour telemetry;
- health exposes rollout stage and acceptance policy;
- the production preflight is read-only and artifact-bound;
- the manual verifier cannot issue GO with an untested required scenario;
- inherited smoke failures do not expand;
- the stale cross-project `.env.example` contract is replaced by the current Intro Deck ENV template.
