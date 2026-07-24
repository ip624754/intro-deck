# STEP064B4B PATCH

Apply only over the exact STEP064B4A FULL baseline:

```text
9171532cb405ca1238e286a64b7a73bf43d97296d1873cce24f10477fae90975
```

This patch contains only added/modified B4B files. It has no migration and no ENV changes.

After overlay:

```bash
npm run check
npm run smoke:member-language-rendering
```

Then follow `doc/102_STEP064B4B_OPERATOR_ROLLOUT.md`.
