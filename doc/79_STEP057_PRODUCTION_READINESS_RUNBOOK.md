# STEP057 — Production Readiness Runbook

This runbook is intentionally narrow. The automated phase is read-only and never creates fixtures or changes production rows.

## 1. Deploy the exact STEP057 artifact

After deployment, confirm:

```text
https://intro-deck.vercel.app/api/health?full=1
```

The response must report `STEP057` and the exact Vercel artifact SHA.

## 2. Run the automated read-only preflight

From the repository root on Node 20:

```bash
export STEP057_TARGET=production
export STEP057_BASE_URL=https://intro-deck.vercel.app
export STEP057_ARTIFACT_SHA=<exact deployed SHA>
export STEP057_TELEGRAM_BOT_USERNAME=introdeckbot
npm run step057:preflight
```

The runner reads the existing `DATABASE_URL` and `TELEGRAM_BOT_TOKEN` from the operator environment. It records no secret values.

Checks include:

- health/artifact binding;
- runtime flags;
- Telegram identity, webhook URL, pending updates, and recent webhook errors;
- PostgreSQL read-only connection;
- migration `027` tables/indexes;
- impossible contact/payment/DM states;
- listed-profile supply;
- failed/retry/exhausted notification indicators;
- current price, Pro allowance, and cooldown configuration.

Do not use `--allow-node-mismatch` for a release verdict. That flag is diagnostic only and produces warning evidence.

## 3. Create the manual evidence template

```bash
npm run step057:evidence:init -- runtime_evidence/step057/manual-evidence.json
```

Fill the operator, execution time, production URL, exact artifact SHA, automated evidence path/SHA, and scenario evidence references.

## 4. Manual core-loop pass

Required:

1. `/start` opens Home.
2. `Continue setup` opens exactly one next required step.
3. Preview, publish, and hide behave explicitly.
4. Directory opens a listed profile.
5. Intro-only profile exposes only the free intro request.
6. Paid-contact profile exposes Private chat and Telegram contact with exact price/Pro copy.
7. Contact inbox opens Requests and Private chats.
8. Operator diagnostics opens without a critical runtime error.

Optional but recommended before paid acquisition:

- Stars invoice/pre-checkout;
- one successful Stars payment;
- duplicate callback/payment replay evidence.

## 5. Generate the verdict

```bash
npm run step057:evidence:verify -- runtime_evidence/step057/manual-evidence.json
```

Verdicts:

- `GO`: automated preflight PASS and every required/optional scenario PASS.
- `GO_WITH_RISKS`: required core loop passes, but automated warnings or optional payment/replay evidence remain.
- `NO_GO`: automated FAIL/BLOCKED, any scenario FAIL/BLOCKED, or any required scenario not passed.

The report is written beside the manual evidence as `STEP057_PRODUCTION_READINESS_REPORT.md`.

## Truth boundary

A report applies only to the recorded production URL and artifact SHA. It does not make untested payment or concurrency behavior true.
