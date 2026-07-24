# STEP064B4A PATCH

Apply only over the exact STEP064B3 FULL baseline.

Baseline SHA-256:

```text
92ab03586a7f216a79c7ae2bb80abd0cf194bdbb1b60ad520c9bee1cc28a1b60
```

## Required order

1. Apply `migrations/037_interface_language_boundary.sql` to the production database.
2. Verify both columns and both check constraints.
3. Apply the PATCH or deploy the FULL candidate.
4. Verify `/api/health` reports `STEP064B4A` and the language policy markers.
5. Run `doc/101_STEP064B4A_OPERATOR_ROLLOUT.md`.

No new ENV is required.

Do not apply this PATCH over STEP064B4A FULL or any baseline whose SHA-256 differs from the value above.
