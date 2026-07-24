# STEP064B4D2 Operator Rollout

## Apply
- PATCH: only over exact STEP064B4D1A FULL.
- FULL: may be deployed directly.

## Database and ENV
- No migration.
- No ENV changes.

## Deployment note
`vercel.json` includes both branded PNG assets in the LinkedIn OAuth callback bundle and sets `maxDuration=60`.

## Health gate
Confirm:
- `step = STEP064B4D2`
- `docsStep = STEP064B4D2`
- `runtime.node = 20.x`
- `memberCopyPolishPolicy.homeProfileButton = profile_without_edit_verb`
- `profileShareEditorialPolicy.imageAttachmentIncluded = true`
- `profileShareMediaPolicy.enabled = true`
- `profileShareMediaPolicy.assetStrategy = versioned_language_specific_png`
- `profileShareMediaPolicy.textOnlyFallback = before_post_request_only`
- `profileShareMediaPolicy.unknownOutcomePolicy = block_automatic_retry`
- `profileShareMediaPolicy.idempotencyChanged = false`
- `profileShareMediaPolicy.aiNewsPublisherChanged = false`

## Live acceptance
1. Open Home in RU and EN; verify `👤 Профиль` / `👤 Profile`.
2. Select EN post language and publish one ordinary profile share.
3. Verify the English branded image, compact text and profile link.
4. Select RU post language and publish one ordinary profile share.
5. Verify the Russian branded image, compact text and profile link.
6. Re-open one completed callback; no duplicate post may be created.
7. Review Vercel logs. A media failure may produce a bounded warning and text-only fallback; it must not trigger a second post attempt.

## Rollback triggers
- image missing on published post;
- invalid image URN;
- callback timeout regression;
- second post on replay;
- AI/news publisher behavior change;
- image failure prevents text-only post;
- assets absent from Vercel bundle.
