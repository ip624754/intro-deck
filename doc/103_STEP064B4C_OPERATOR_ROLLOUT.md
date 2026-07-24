# STEP064B4C Operator Rollout

## Preconditions

- Deploy only over the exact STEP064B4B source baseline or deploy the STEP064B4C FULL artifact.
- Migration 037 must already be present from STEP064B4A.
- No new migration is required.
- No ENV change is required.
- Preserve all current LinkedIn, Telegram Stars, webhook, cron, and AI/news ENV values.

## Deployment health gate

Open `/api/health` and require:

```text
ok = true
step = STEP064B4C
docsStep = STEP064B4C
runtime.node = 20.x
interfaceLanguagePolicy.transactionAndOAuthRendering = stored_interface_language_plus_signed_oauth_snapshot
postLanguagePolicy.ordinaryProfileShareIntegration = users_default_post_language
transactionCopyPolicy.interfaceLanguageSource = stored_user_preference
transactionCopyPolicy.notificationRecipientLanguage = recipient_preference_with_retry_snapshot
oauthLanguagePolicy.stateSnapshotSigned = true
oauthLanguagePolicy.transferSnapshotSigned = true
oauthLanguagePolicy.oauthScopesChanged = false
oauthLanguagePolicy.replayAndIdempotencyChanged = false
linkedInShare.automaticPublishing = false
linkedInShare.tokenPersistence = none
```

## Telegram transaction matrix

Test one English-interface account and one Russian-interface account:

1. Open a paid Telegram-contact request.
2. Confirm invoice title, description, delivery disclaimer, and success receipt use the selected interface language.
3. Confirm invoice payload, currency `XTR`, and amount are unchanged.
4. Open a paid private-chat request and repeat the same checks.
5. Open Pro purchase and confirm the invoice/receipt language without changing entitlement or amount.
6. Decline a paid request and confirm the copy does not promise an automatic refund.
7. Reopen stale/processed callbacks and confirm no second payment or state mutation is requested.

## Recipient and retry matrix

1. Send a contact request to an English recipient and a Russian recipient.
2. Confirm each recipient sees their own stored interface language.
3. Repeat for private-chat request, decision, and new-message notifications.
4. Create an intro notification attempt, then change the recipient preference before retry.
5. Confirm retry uses the original persisted language snapshot.
6. Run one scheduled AI/news draft notification, change preference, and retry if safely reproducible.
7. Confirm the retry language remains bound to the run snapshot and nothing is automatically published.

## LinkedIn profile-share matrix

Exercise all four combinations:

| Interface | Default post | Expected |
|---|---|---|
| EN | EN | English Telegram/OAuth UI, English profile post |
| EN | RU | English Telegram/OAuth UI, Russian profile post |
| RU | EN | Russian Telegram/OAuth UI, English profile post |
| RU | RU | Russian Telegram/OAuth UI, Russian profile post |

For each applicable case:

1. Open the profile-share preview.
2. Confirm the preview post language follows `default_post_language`.
3. Confirm authorization pages and Telegram receipts follow `interface_language`.
4. Publish one explicitly approved post.
5. Repeat the same callback or reload the callback URL.
6. Confirm no second LinkedIn post is created.
7. Confirm the OAuth access token is not persisted.

## LinkedIn connection and transfer

1. Connect LinkedIn with an EN account and a RU account.
2. Confirm start, cancellation, error, success, and Telegram receipt copy follow the signed interface snapshot.
3. Exercise a controlled relink/transfer confirmation when safe.
4. Confirm the new owner sees the signed operation language.
5. Confirm the previous owner receives notification in the previous owner’s own stored language.
6. Confirm one LinkedIn identity remains bound to only one Telegram account.

## AI/news compatibility

- Existing drafts and presets retain their own `post_language`.
- Changing default profile-post language does not rewrite saved presets or drafts.
- Scheduled effects remain Telegram-draft-only.
- Automatic publication remains disabled.

## Acceptance command

After evidence is collected, record:

```text
PRODUCTION_ACCEPT_STEP064B4C
```

## Rollback

1. Deploy the exact STEP064B4B FULL artifact.
2. Do not roll back migration 037.
3. Do not delete language preferences.
4. Confirm `/api/health` returns STEP064B4B.
5. Recheck one contact request, one private-chat request, and one LinkedIn profile-share authorization.

Rollback is required on payment payload/amount drift, recipient-language leakage, unsigned language influence, OAuth state/replay regression, duplicate publication, token persistence, or mixed-language critical receipts.
