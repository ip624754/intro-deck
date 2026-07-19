# STEP061 QA Report

## Scope

Personalized News Presets & Subscription Productization on top of STEP060.

## Canonical environment

- Node.js: `20.20.2`
- npm: `10.9.2`
- Package: `0.59.0`
- Generated: `2026-07-19T21:18:14Z`

## Verified checks

| Check | Result |
|---|---|
| `npm ci --ignore-scripts` | PASS |
| `npm run check` | PASS |
| `npm run smoke:ai-news-productization` | PASS |
| STEP060 AI/news compatibility | PASS |
| STEP059 LinkedIn Share compatibility | PASS |
| Schema compatibility | PASS |
| Storage contract | PASS |
| Router and commands | PASS |
| Help, pricing, legal, landing | PASS |
| Operator diagnostics | PASS |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |

## Full smoke inventory

| Snapshot | PASS | FAIL | Total |
|---|---:|---:|---:|
| STEP060 baseline | 77 | 13 | 90 |
| STEP061 | 78 | 13 | 91 |

- New passing contract: `smoke:ai-news-productization`
- New failures: `0`
- Resolved inherited failures: `0`
- The 13 inherited failures are unchanged and remain outside STEP061 scope.

## Adversarial coverage

- duplicate preset names fail through a partial unique index;
- preset creation and run-now use the canonical user advisory lock;
- duplicate cron runs are blocked by `(preset_id, scheduled_for)` uniqueness;
- one due preset per user is claimed per scheduler execution;
- users with an unresolved draft are excluded before provider budget is spent;
- scheduled source searches bypass only the manual cooldown, not the daily search allowance;
- provider/generation failures are not blindly retried; only Telegram delivery failure is retryable;
- invalid optional scheduler configuration disables scheduling without disabling manual STEP060 drafting;
- the scheduler does not import or invoke the LinkedIn publishing service;
- every LinkedIn publication still requires STEP059 preview and one-shot authorization.

## Not verified

- migration 031 on production Neon;
- production Pro entitlement access;
- Vercel cron bearer authentication;
- real scheduled NewsData/OpenAI provider calls;
- real Telegram scheduled draft delivery;
- live cron replay/retry behavior;
- live member pause/resume/delete behavior;
- publication of a scheduled draft through STEP059.

## Verdict

`SOURCE VERIFIED / NOT LIVE ACCEPTED`
