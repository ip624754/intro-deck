# STEP059 QA Report — Share Profile on LinkedIn

## Scope

STEP059 adds one explicit, user-approved Share Profile on LinkedIn flow using the current LinkedIn Posts API. It does not add automatic posting, token persistence, media upload, scheduling, organization posting, analytics, or AI drafting.

## Baseline

- Parent source step: `STEP058B1`
- Parent package: `0.56.1`
- Parent full smoke: `75/88 PASS`, `13 FAIL`
- Target source step: `STEP059`
- Target package: `0.57.0`

## Canonical local environment

- Node.js: `20.20.2`
- npm: `10.9.2`

## Verified checks

| Check | Result |
|---|---|
| `npm ci --ignore-scripts` | PASS |
| `npm run check` | PASS |
| `npm run smoke:linkedin-share` | PASS |
| STEP058B1 compatibility | PASS |
| STEP058B compatibility | PASS |
| STEP058A compatibility | PASS |
| Privacy / Terms contract | PASS |
| Landing contract | PASS |
| Router / command contract | PASS |
| Schema compatibility contract | PASS |
| Invite/deep-link contract | PASS |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |

## Full smoke inventory

| Snapshot | PASS | FAIL | Total |
|---|---:|---:|---:|
| STEP058B1 baseline | 75 | 13 | 88 |
| STEP059 | 76 | 13 | 89 |

- New passing contract: `smoke:linkedin-share`
- New failing contracts: `0`
- Resolved inherited failures: `0`
- The inherited 13-failure set is unchanged.

Inherited failures:

- `smoke:env`
- `smoke:code-split`
- `smoke:profile-session-schema`
- `smoke:admin-allowlist`
- `smoke:admin-users`
- `smoke:admin-user-card`
- `smoke:admin-intros`
- `smoke:broadcast-idempotency`
- `smoke:admin-polish`
- `smoke:admin-productivity`
- `smoke:admin-search`
- `smoke:admin-russian-layer`
- `smoke:admin-runbook-freeze`

## Critical-path assertions

Source/contracts verify that:

- the exact post text and visibility are shown before authorization;
- `w_member_social` is requested only for the explicit share intent;
- base LinkedIn login remains `openid profile email`;
- one signed launch ticket/state binds Telegram user, share intent, purpose, expiry, and nonce;
- one active user publish is serialized with a PostgreSQL advisory lock and row claim;
- duplicate/stale callbacks cannot automatically create a second provider post;
- provider 4xx becomes confirmed failure; timeout/network/5xx/missing post ID becomes `unknown`;
- provider success followed by local receipt failure is never downgraded to retryable failure;
- stale provider error fields are cleared before a new explicit attempt and after publication;
- `publishing` or `unknown` blocks a new share;
- access/refresh/ID tokens are not stored by migration 029 or the share persistence layer;
- shared posts deep-link to the exact listed Intro Deck profile;
- public/legal surfaces state that nothing is posted automatically.

## Not verified

- Migration `029` on live Neon.
- Live `w_member_social` consent.
- Live `POST /rest/posts` response.
- Whether the current OIDC app-scoped member identifier is accepted as the Posts API author in production.
- Live provider post receipt and LinkedIn feed appearance.
- Duplicate callback behavior against the live provider.
- Deep-link behavior from an actual LinkedIn post.
- LinkedIn Lite approval.

## Residual risks

1. The external provider side effect cannot be rolled back. Any timeout or indeterminate provider response is intentionally classified as `unknown` and blocks automatic retry.
2. LinkedIn API versions are time-bound. `LINKEDIN_SHARE_POSTS_API_VERSION` is configurable and must be reviewed before the configured version is retired.
3. Text-only sharing is deliberate. Media upload would add a multi-stage external state machine and requires a separate HEAVY STEP.
4. Lite upgrade approval is controlled by LinkedIn and is not implied by this implementation.

## Verdict

`SOURCE IMPLEMENTED / SOURCE VERIFIED`

Not `LIVE ACCEPTED` until migration 029, share ENV, deployment, one real post, and duplicate protection evidence are complete.
