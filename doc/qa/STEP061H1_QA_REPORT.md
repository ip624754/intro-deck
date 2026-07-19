# STEP061H1 QA Report

## Scope

Production hotfix for the profile preview callback crash introduced in STEP061.

## Root cause

`buildProfilePreviewSurface` referenced `aiNewsPresetDiagnostics`, a local variable that existed only inside `buildOperatorDiagnosticsSurface`. JavaScript syntax validation passed because the identifier was syntactically valid, but the live callback failed at runtime with `ReferenceError`.

## Fix

- Removed operator-only AI/news diagnostics arguments from the profile-preview renderer call.
- Passed `aiNewsPresetSummary` to the operator diagnostics renderer, where the value belongs.
- Added a runtime smoke that invokes the actual `buildProfilePreviewSurface` builder with persistence unavailable.
- Replaced whole-error webhook logging with a bounded redacted summary so grammY context cannot expose the bot token again.

## Canonical QA environment

- Node.js: 20.20.2
- npm: 10.9.2
- Package: 0.59.1
- Source step: STEP061H1

## Results

- `npm ci --ignore-scripts`: PASS
- `npm run check`: PASS
- `npm run smoke:step061-profile-preview-hotfix`: PASS
- `npm run smoke:ai-news-productization`: PASS
- `npm run smoke:guided-activation`: PASS
- Full smoke inventory: 79/92 PASS, 13 inherited FAIL
- New failing contracts versus STEP061: 0
- `npm audit --audit-level=high`: PASS, 0 vulnerabilities
- `git diff --check`: PASS

## Inherited failures

The same 13 inherited failures remain:

- smoke:env
- smoke:code-split
- smoke:profile-session-schema
- smoke:admin-allowlist
- smoke:admin-users
- smoke:admin-user-card
- smoke:admin-intros
- smoke:broadcast-idempotency
- smoke:admin-polish
- smoke:admin-productivity
- smoke:admin-search
- smoke:admin-russian-layer
- smoke:admin-runbook-freeze

## Truth boundary

### Verified

- The production error is reproducible on the STEP061 source tree.
- The patched runtime builder returns a valid profile-preview surface.
- Webhook error summaries exclude `ctx`, API objects, and token fields and redact Telegram-token patterns from message/stack text.
- Operator diagnostics receives the preset aggregate summary.
- No migration or business-state transition changed.
- No Telegram-token-like credential is present in the repository tree.

### Not verified

- Vercel deployment of STEP061H1.
- Live `p:prev` after deployment.
- Telegram token rotation and webhook recovery.
