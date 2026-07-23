# STEP063A-H1A PATCH

Apply this overlay only to the exact baseline:

```text
IntroDeck_STEP063A_H1_FULL_2026-07-23.zip
SHA-256: 5afac6b06efa4c999f37ad616c301e7a6bb7e5627c7a799918fc084a2d402959
```

## Scope

- topic-specific provider queries;
- source relevance and promotional gates;
- domain authority tiers;
- RSS/HN/GitHub bounded diagnostics;
- search allowance/reset browse UX;
- release/docs/QA updates.

## Not changed

- database schema;
- provider credentials;
- generator dispatch;
- LinkedIn publishing core;
- subscription/payment state machines.

## Deploy

Keep the existing browse-only production ENV. No migration is required. Redeploy and follow `doc/92_STEP063A_H1A_OPERATOR_ROLLOUT.md`.
