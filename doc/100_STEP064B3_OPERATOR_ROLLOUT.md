# STEP064B3 Operator Rollout

## Baseline requirement

Apply the STEP064B3 PATCH only over the exact STEP064B2 FULL baseline:

```text
SHA-256: 2f76c704053a951f6256011915727bd2032528bc55d7599bfb21469838875ca2
```

## Database and ENV

- Migration: none.
- New ENV: none.
- Existing production values remain unchanged.

## Deployment verification

Open `/api/health` and verify:

```text
step = STEP064B3
docsStep = STEP064B3
adminCopyPolicy.uiLanguage = ru
adminCopyPolicy.rawCodes = english_code_separate_from_label
adminCopyPolicy.mixedLanguageButtons = false
adminCopyPolicy.callbackIdsChanged = false
adminCopyPolicy.adminMutationsChanged = false
```

## Telegram operator acceptance

Check these surfaces:

1. Admin root.
2. Operations and user segments.
3. User card and public-card preview.
4. Intros and delivery records.
5. Communications: notice, broadcast, templates, outbox.
6. Monetization.
7. System, health, runbook, freeze, verification, rehearsal.
8. Invite/reward operator views.
9. Audit and search.

Acceptance criteria:

- button labels are Russian;
- immutable states are shown separately in backticks;
- no mixed-language CTA such as `Use template`, `View public card`, or `Live verification`;
- callback behavior remains unchanged;
- bulk actions still require separate send confirmation;
- raw exceptions are absent from normal operator messages.

## Rollback

Redeploy the exact STEP064B2 FULL artifact. No database rollback is required.
