# STEP064B1 PATCH

Apply this overlay only to the exact STEP064A baseline:

- Baseline: `IntroDeck_STEP064A_FULL_2026-07-24.zip`
- SHA-256: `4ce8b99159022dd8209ced89c3719cd894dbec478687b09b09ee08b7c81d7d0b`

No migration or ENV change is required.

After deployment, verify `/api/health`, then manually inspect the primary member surfaces listed in `doc/98_STEP064B1_OPERATOR_ROLLOUT.md`.
