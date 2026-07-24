# STEP065A1 PATCH README

Apply this PATCH only over the exact STEP064B4D2A FULL baseline:

```text
SHA-256: b7c6a023facdcb99ba6d6665be573b5b8642cabd2549ed1b27e72ede60c808ed
```

Required order:

1. Apply migration 038.
2. Verify tables, token column, constraints, and immutable trigger.
3. Overlay PATCH or deploy FULL.
4. Verify health and live attributed-link flow.

No new ENV is required.
