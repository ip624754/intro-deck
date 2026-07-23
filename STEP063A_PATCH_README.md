# STEP063A PATCH Overlay

## Exact baseline

Apply this overlay only to:

- `IntroDeck_STEP061A_FULL_2026-07-20.zip`
- SHA-256: `658d8fa38fd4340d4fd0bc82c3b7fca796a5a929b80930ffb1c0d9a07250c04e`

Do not apply it to an unknown, modified, or later tree.

## Safe application

1. Verify the baseline SHA-256.
2. Extract the baseline.
3. Overlay the `intro-deck-main/` directory from the PATCH ZIP onto the baseline root.
4. Deploy first with `doc/env/STEP063A_SAFE_OFF_PRODUCTION.env` (`newsdata_only`).
5. Apply migration `migrations/033_ai_news_multi_source_quality_foundation.sql`.
6. Verify the five new source-quality columns.
7. Apply `doc/env/STEP063A_MULTI_SOURCE_OPERATOR_ACCEPTANCE.env`.
8. Run the operator acceptance in `doc/90_STEP063A_OPERATOR_ROLLOUT.md`.

## Rollback

Return to `AI_NEWS_SOURCE_MODE=newsdata_only` and `AI_NEWS_ENABLED_PROVIDERS=newsdata`, then redeploy. Migration 033 is additive and should remain installed.

## Truth boundary

Source implementation and focused QA are complete. Production deployment, migration application, live provider telemetry, and operator end-to-end acceptance are not verified by this artifact.
