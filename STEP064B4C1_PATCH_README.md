# STEP064B4C1 PATCH README

Apply this patch only over the exact STEP064B4C FULL baseline:

```text
SHA-256: e2323189f64cb8d876835a19cdd834bc20fe18aec93823def123adf4214cf2fa
```

No migration and no ENV change are required.

After overlay:

```bash
npm run check
npm run smoke:member-copy-polish
npm run smoke:language-boundary
npm run smoke:member-language-rendering
npm run smoke:transaction-language-boundary
```

Then deploy and follow `doc/104_STEP064B4C1_OPERATOR_ROLLOUT.md`.
