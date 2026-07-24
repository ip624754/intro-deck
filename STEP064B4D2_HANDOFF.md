# STEP064B4D2 Handoff

## Current source
- Step: STEP064B4D2
- Package: 0.65.0
- Baseline: STEP064B4D1A
- Baseline FULL SHA-256: `587229626b5e0fbe43a5c64485063ca109438d53d8247f85be9e0fe57d607ca5`

## Implemented
- Versioned EN/RU Intro Deck branded PNG assets.
- LinkedIn Images API initialize + PUT upload.
- Single-image Posts API attachment for ordinary profile shares.
- Signed post language drives asset selection and alt text.
- Safe text-only fallback before the Posts API request.
- Existing unknown-outcome/idempotency protections retained.
- Vercel callback includes media assets and maxDuration 60.
- Home CTA renamed to `Profile` / `Профиль` with unchanged callback.

## Migration / ENV
- Migration: none
- New ENV: none

## Rollback
Deploy exact STEP064B4D1A FULL. Database rollback is not required. Previously uploaded unused image assets may remain at LinkedIn but cannot create a post by themselves.

## Production acceptance
1. Deploy exact D2 artifact.
2. Verify health policy markers.
3. Confirm Home button copy.
4. Publish one EN ordinary profile share and confirm image + text.
5. Publish one RU ordinary profile share and confirm RU image + text.
6. Re-open the callback and confirm no duplicate post.
7. Inspect logs for `mediaAttached=true` or explicit text-only fallback reason.
