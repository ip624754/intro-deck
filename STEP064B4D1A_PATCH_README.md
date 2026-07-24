# STEP064B4D1A PATCH README

Apply this PATCH only over the exact STEP064B4D1 FULL baseline:

`c82516e0d3885c72eee6b3600996d0af43b277ff5f77da023ff1594dd8dec8b6`

No migration and no ENV update are required.

After overlay:

```bash
npm run check
npm run smoke:profile-share-compact
npm run smoke:profile-share-editorial
npm run smoke:linkedin-share
```

Expected release markers:

- step: `STEP064B4D1A`
- package: `0.64.9`
