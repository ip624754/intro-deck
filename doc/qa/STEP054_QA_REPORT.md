# STEP054 QA Report

## Scope

Positioning and discovery truth alignment across active landing, Telegram, legal, README, state, handoff, and BotFather-facing copy. No schema, payment, entitlement, callback, or contact-state changes.

## Baseline

- Uploaded baseline: `intro-deck-main 2026.07.18.zip`
- Baseline ZIP SHA-256: `5194c54cdc84d17d6bfc5ea84d54dbe97229a868ce69a5e3122134756f4f663d`
- Baseline source step: `STEP053A`
- Baseline package: `0.50.1`
- Operator-confirmed deployed artifact before STEP054: `b67371385030bef8ef528fb13eb7ffcc86933b7f`

## Environment

- Node.js: `20.20.2`
- npm: `10.9.2`

## Verified

- `npm ci --ignore-scripts --no-audit --no-fund`: PASS
- `npm run check`: PASS
- `npm run smoke:positioning-truth`: PASS
- landing contract: PASS
- landing polish contract: PASS
- public legal contract: PASS
- product surface contract: PASS
- Help compatibility: PASS
- command/router/directory/invite/OG contracts: PASS
- STEP053A acceptance-pack compatibility contract: PASS after removing the obsolete hard-coded current-step pin while retaining release-marker/health/artifact assertions
- `npm audit --audit-level=high`: PASS, 0 vulnerabilities
- active surface forbidden-claim scan: PASS
- `git diff --check`: PASS

## Full Node 20 smoke inventory

| Snapshot | PASS | FAIL | Total |
|---|---:|---:|---:|
| STEP053A baseline | 68 | 13 | 81 |
| STEP054 | 69 | 13 | 82 |

Comparison:

- new failing contracts: `0`
- resolved inherited contracts: `0`
- new passing contract: `smoke:positioning-truth`
- inherited failure-set unchanged

Inherited failures:

1. `smoke:env`
2. `smoke:code-split`
3. `smoke:profile-session-schema`
4. `smoke:admin-allowlist`
5. `smoke:admin-users`
6. `smoke:admin-user-card`
7. `smoke:admin-intros`
8. `smoke:broadcast-idempotency`
9. `smoke:admin-polish`
10. `smoke:admin-productivity`
11. `smoke:admin-search`
12. `smoke:admin-russian-layer`
13. `smoke:admin-runbook-freeze`

## Truth boundary

### Source-confirmed

- Active copy uses `LinkedIn-connected account`, not professional verification claims.
- Professional card fields are described as member-provided.
- Listed profile cards are described as visible to bot users.
- Private contact details and continuation remain approval-based.
- Current intro request is described as a direct request to the profile owner, not a third-party introduction.
- BotFather copy is provided as an operator artifact.

### Live-confirmed before STEP054

- Production health reported STEP053A with `ok=true`, `docsStep=STEP053A`, and artifact `b67371385030bef8ef528fb13eb7ffcc86933b7f`.

### Not verified

- STEP054 deployment to Vercel.
- Live `/api/health?full=1` reporting `STEP054`.
- Live landing/legal cache refresh.
- Live Telegram home/Help/directory/profile/invite copy.
- BotFather profile text application.
- Complete Stars/replay/cooldown/Pro/concurrency scenarios inherited from STEP053A.
