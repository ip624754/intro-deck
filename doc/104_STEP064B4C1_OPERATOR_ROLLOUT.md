# STEP064B4C1 Operator Rollout

## Preconditions

- Deploy only over the exact STEP064B4C source baseline or deploy the STEP064B4C1 FULL artifact.
- Do not run a migration.
- Do not change ENV.

## Health gate

Confirm `/api/health` reports:

```text
ok = true
step = STEP064B4C1
docsStep = STEP064B4C1
runtime.node = 20.x
memberCopyPolishPolicy.languageSettingsLabels = localized_full_words
memberCopyPolishPolicy.profileSystemLabels = localized_without_translating_user_content
memberCopyPolishPolicy.linkedinReceiptIdentifierLabel = localized_label_plus_immutable_raw_id
memberCopyPolishPolicy.callbackIdsChanged = false
memberCopyPolishPolicy.businessLogicChanged = false
```

## Telegram acceptance

With Russian interface and English post language:

1. Open Language settings.
2. Confirm no `UI:` or `Post:` labels remain in Russian mode.
3. Confirm all four language callbacks still work.
4. Open Profile preview.
5. Confirm `Имя пользователя Telegram: не указан` when no username is stored.
6. Confirm the contact-mode value is Russian.
7. Confirm user-authored English profile text remains unchanged.
8. Publish or inspect one LinkedIn share receipt.
9. Confirm `ID публикации` is Russian and the `urn:li:share:...` value is unchanged.

## Rollback

Deploy exact STEP064B4C FULL. No DB rollback is required.

## Acceptance command

```text
PRODUCTION_ACCEPT_STEP064B4C1
```
