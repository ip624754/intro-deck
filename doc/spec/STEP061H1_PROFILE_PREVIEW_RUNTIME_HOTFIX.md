# STEP061H1 — Profile Preview Runtime Hotfix

## Goal

Restore the live profile preview callback after STEP061 introduced an undefined operator-diagnostics variable into `buildProfilePreviewSurface`.

## Invariants

- Profile preview must not load or reference operator-only preset diagnostics.
- Operator diagnostics may show the aggregate preset summary.
- No database, scheduler, AI/news, subscription, LinkedIn, contact, payment, or publication state transition changes.
- `p:prev` must return a renderable surface when persistence is unavailable.
- Webhook exception logs must never serialize the grammY context or Telegram API token.

## Security note

A production Telegram bot token appeared in copied logs during incident reporting. The source patch does not contain the token. The operator must rotate the token, replace the Vercel secret, redeploy, and verify the webhook.
