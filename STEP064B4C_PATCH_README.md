# STEP064B4C PATCH README

Apply this PATCH only over the exact STEP064B4B FULL baseline:

```text
8839d3fd224c9bf52761f0869a05889306ad5b72b8a6e3d8abe157969111fec7
```

## Scope

- transaction copy localization;
- recipient notification and retry-language snapshots;
- signed OAuth language snapshots and localized HTML/receipts;
- ordinary profile-share post language integration;
- health/release/QA/documentation updates.

## No changes

- no migration;
- no ENV;
- no callback-ID changes;
- no payment amount/payload changes;
- no OAuth scope changes;
- no publisher/idempotency redesign;
- no AI/news preset-language changes.

## Apply

Overlay all PATCH files at repository root, preserving paths, then run:

```bash
npm run check
npm run smoke:transaction-language-boundary
npm run smoke:language-boundary
npm run smoke:member-language-rendering
npm run smoke:transaction-copy
npm run smoke:linkedin-share
npm run smoke:notification-retry
```

Deploy only after the source checks pass. Follow `doc/103_STEP064B4C_OPERATOR_ROLLOUT.md` for production acceptance.
