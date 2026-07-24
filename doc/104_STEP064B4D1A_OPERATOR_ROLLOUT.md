# STEP064B4D1A Operator Rollout

## Deployment

Deploy the FULL candidate or apply the PATCH only over exact STEP064B4D1.

No migration or ENV changes are required.

## Health gate

Confirm:

- `step = STEP064B4D1A`
- `docsStep = STEP064B4D1A`
- `runtime.node = 20.x`
- `profileShareEditorialPolicy.ordinaryProfileTemplate = compact_permission_focus_cta`
- `profileShareEditorialPolicy.aboveFoldTarget = two_paragraph_compact`
- `profileShareEditorialPolicy.identityDuplicationInsidePost = false`
- `profileShareEditorialPolicy.focusLabelLimit = 3`
- `profileShareEditorialPolicy.emojiPolicy = none_arrow_only`
- `profileShareEditorialPolicy.publisherChanged = false`

## Live product gate

1. Open profile preview.
2. Start ordinary LinkedIn profile share.
3. Confirm preview contains two compact paragraphs.
4. Confirm name/headline are not repeated in the body.
5. Publish one post.
6. Inspect desktop/mobile feed presentation.
7. Re-open the same callback and confirm no duplicate publication.

## Acceptance token

`PRODUCTION_ACCEPT_STEP064B4D1A`
