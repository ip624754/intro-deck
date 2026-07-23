# STEP063B PATCH

Apply this overlay only to the exact baseline:

- `IntroDeck_STEP063A_H1A_FULL_2026-07-24.zip`
- SHA-256 `b7f20e26d94872097ad8165a7d2f4f43aa7a9c3a446766b1d5260573f6baff39`

Then apply `migrations/035_ai_news_audience_aware_discovery.sql` before enabling the STEP063B Telegram source surface.

No new ENV variables are required. Use `doc/93_STEP063B_OPERATOR_ROLLOUT.md`.
