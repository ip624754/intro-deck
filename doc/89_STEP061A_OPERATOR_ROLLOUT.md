# STEP061A — Operator rollout

## 1. Apply source

Apply the STEP061A overlay over STEP061H1.

## 2. Apply migration

Run the complete file:

```text
migrations/032_ai_news_live_acceptance_telemetry.sql
```

Prerequisites: migrations 030 and 031.

## 3. Production ENV

Keep the first rollout fail-closed:

```env
AI_NEWS_ROLLOUT_STAGE=operator_acceptance
```

Optional cost-estimation values:

```env
NEWSDATA_REQUEST_COST_USD=0
OPENAI_INPUT_COST_USD_PER_1M=0
OPENAI_OUTPUT_COST_USD_PER_1M=0
```

Zero means "not configured". Do not guess current provider prices.

## 4. Deploy and verify health

Expected minimum:

```json
{
  "ok": true,
  "step": "STEP061A",
  "docsStep": "STEP061A",
  "aiNewsDraft": {
    "rolloutStage": "operator_acceptance",
    "providerTelemetryRequired": true,
    "automaticPublishing": false,
    "liveAcceptancePolicy": "artifact_bound_preflight_plus_manual_core_loop_evidence"
  }
}
```

## 5. Run read-only production preflight

Run from the repository root. Node 20 is canonical; on a workstation with another Node version use `--allow-node-mismatch`. The final verifier still requires the artifact-bound deployed runtime or local preflight to report Node 20:

```powershell
$env:STEP061A_TARGET="production"
$env:STEP061A_BASE_URL="https://intro-deck.vercel.app"
$env:STEP061A_ARTIFACT_SHA="<exact health artifactSha>"
$env:STEP061A_TELEGRAM_USER_ID="<operator Telegram user id>"
$env:DATABASE_URL="<production Neon URL>"
$env:TELEGRAM_BOT_TOKEN="<production bot token>"

npm.cmd run step061a:preflight -- --allow-node-mismatch
```

The preflight uses a read-only PostgreSQL transaction and performs no NewsData, OpenAI, Telegram-send, or LinkedIn-publish calls. Health exposes the deployed Node runtime so a Node 24 workstation can produce warning-level local evidence when the bound production artifact runs Node 20.

## 6. Run the real operator loop

```text
/profile → complete → preview → publish
/news → source search → select source → generate → edit → approve
LinkedIn OAuth → exactly one post → Telegram receipt
Saved presets → Run now
Authenticated cron → one Telegram draft only
```

Repeat the old approval/callback once. It must not create a second LinkedIn post.

## 7. Create and verify evidence

```powershell
npm.cmd run step061a:evidence:init -- runtime_evidence/step061a/manual-evidence.json
```

Fill the manifest with evidence references, preflight path, and SHA-256. Then:

```powershell
npm.cmd run step061a:evidence:verify -- runtime_evidence/step061a/manual-evidence.json
```

## 8. Rollout decision

- `GO`: an operator may explicitly change `AI_NEWS_ROLLOUT_STAGE=limited_pro` and redeploy.
- `GO_WITH_RISKS`: keep operator acceptance unless the residual risks are explicitly accepted.
- `NO_GO`: keep operator acceptance and fix the failed required path.
- Never move directly to `live` without limited-Pro evidence and unit-economics review.

## Rollback

```env
AI_NEWS_DRAFT_MODE=off
AI_NEWS_SCHEDULE_MODE=off
AI_NEWS_ROLLOUT_STAGE=operator_acceptance
```

Redeploy. Existing source, draft, preset, provider-usage, and LinkedIn receipt rows remain available for audit.
