# STEP063A-H1 PATCH Overlay

## Exact baseline

Apply this overlay only to:

- `IntroDeck_STEP063A_FULL_2026-07-23.zip`
- SHA-256: `70cc1e0b6c572f1acdf0274d71b85915dfabceadf85e067a935e0778ba77adc7`

Do not apply it to STEP061A or an unknown/modified tree.

## Purpose

STEP063A-H1 removes the mandatory OpenAI dependency from the AI/news product surface:

- `AI_NEWS_GENERATOR_MODE=off` keeps multi-source browsing available and hides draft actions;
- `template` creates a deterministic evidence-bound draft without an external LLM;
- `groq` uses the Groq API with real provider telemetry;
- `openai` preserves the existing OpenAI path.

No mode publishes automatically. STEP059 remains the only LinkedIn publisher and still requires exact preview plus explicit one-post authorization.

## Safe application

1. Verify the baseline SHA-256.
2. Overlay the PATCH contents on the exact baseline.
3. Deploy first with `doc/env/STEP063A_H1_BROWSE_ONLY_PRODUCTION.env`.
4. Verify `/api/health` reports `STEP063A-H1`, `generatorMode=off`, `browseOnly=true`, and an effective scheduler mode of `off`.
5. Verify `/news` can search and open original sources without creating draft rows.
6. Apply migration `034_ai_news_generator_provider_neutrality.sql` before enabling `template` or `groq`.
7. Use one bounded acceptance profile from `doc/env/`.

## Rollback

Set:

```env
AI_NEWS_GENERATOR_MODE=off
AI_NEWS_SCHEDULE_MODE=off
```

and redeploy. Migration 034 is additive and should remain installed.

## Truth boundary

Source implementation and focused deterministic QA are complete. Migration 034, Vercel deployment, live Groq calls, production telemetry, Telegram operator acceptance, and LinkedIn publication from a Groq/template draft are not verified by this artifact.
