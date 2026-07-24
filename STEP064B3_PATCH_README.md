# STEP064B3 PATCH

Apply only over `IntroDeck_STEP064B2_FULL_2026-07-24.zip`.

Exact baseline SHA-256:

```text
2f76c704053a951f6256011915727bd2032528bc55d7599bfb21469838875ca2
```

No migration or ENV change is required. Deploy, verify `/api/health` reports `STEP064B3`, then run the operator checklist in `doc/100_STEP064B3_OPERATOR_ROLLOUT.md`.
