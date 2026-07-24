# STEP064B4D2 — Branded LinkedIn Image Publication & Home Profile CTA Polish

## Goal
Attach a language-matched Intro Deck branded image to ordinary LinkedIn profile-share posts while preserving the existing exact-once publisher and providing a safe text-only fallback before the post creation request.

## Baseline
- Source: STEP064B4D1A
- Package: 0.64.9
- FULL SHA-256: `587229626b5e0fbe43a5c64485063ca109438d53d8247f85be9e0fe57d607ca5`

## Mode and risk
- CogniForge mode: HEAVY
- Risk score: 12/12

## Included
- English and Russian versioned PNG assets, 1200×630.
- LinkedIn Images API `initializeUpload` call.
- Authorized binary PUT upload.
- Posts API `content.media` attachment with localized alt text.
- Signed `postLanguage` selects the asset.
- Image path is restricted to `source_kind=profile_share`.
- AI/news LinkedIn publishing remains text-only and unchanged.
- Image preparation failure before the Posts API call falls back to text-only publication.
- Any unknown Posts API outcome remains fail-closed and blocks automatic retry.
- Vercel callback function includes media assets and uses a 60-second max duration.
- Home button copy changes from Edit profile to Profile without changing `p:menu`.

## Provider contract
Official LinkedIn references:
- Images API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
- Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api

The flow uses only existing `w_member_social` authority for member-owned image upload and post creation.

## Failure boundaries
1. Asset load / initialize / binary upload failure:
   - no Posts API request has happened;
   - text-only fallback is allowed;
   - an orphaned LinkedIn image asset may remain after an ambiguous upload, but no duplicate post is created.
2. Posts API timeout / 5xx / ambiguous success:
   - existing `unknown` outcome is retained;
   - automatic retry is blocked.
3. Provider post ID returned but local persistence fails:
   - existing receipt-persistence protection remains unchanged;
   - automatic retry is blocked.

## Out of scope
- Dynamic per-member card rendering.
- New OAuth scopes.
- Database migration.
- New ENV variables.
- AI/news image publication.
- Multi-image posts.
- Post scheduling or automatic publishing.
