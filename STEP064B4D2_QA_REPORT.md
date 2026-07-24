# STEP064B4D2 QA Report

## Status
SOURCE IMPLEMENTED
FOCUSED QA PASSED
FULL REGRESSION COMPARISON PASSED
ZERO BASELINE PASS REGRESSIONS
PRODUCTION NOT DEPLOYED

## Source checks
- `npm run check` — PASS
- `npm run smoke:profile-share-media` — PASS
- `npm run smoke:profile-share-compact` — PASS
- `npm run smoke:profile-share-editorial` — PASS
- `npm run smoke:linkedin-share` — PASS
- `npm run smoke:transaction-language-boundary` — PASS
- `npm run smoke:member-language-rendering` — PASS
- `npm run smoke:member-copy-polish` — PASS
- `npm run smoke:member-copy` — PASS

## Regression inventory
- STEP064B4D1A baseline: 103 PASS / 7 NON_PASS / 110
- STEP064B4D2 candidate: 104 PASS / 7 NON_PASS / 111
- Baseline PASS regressions: 0
- New `smoke:profile-share-media`: PASS

## Inherited/environmental NON_PASS
- smoke:ai-news-productization
- smoke:broadcast-idempotency
- smoke:code-split
- smoke:profile-session-schema
- smoke:schema-compat
- smoke:step053a-pack
- smoke:step061-profile-preview-hotfix

## Verified contracts
- RU/EN assets are valid PNG and exceed 100 KB.
- Images API initialize request uses member owner URN and current API version.
- Binary upload uses PUT and bearer authorization.
- Posts API request includes `content.media.id` and localized alt text.
- Media preparation failure falls back to text-only before post creation.
- Profile media path is isolated from AI/news.
- Signed OAuth post language reaches publisher.
- Home Profile button retains callback `p:menu`.

## Not verified
- Live LinkedIn Images API call.
- Live image-processing/rendering latency.
- Production Vercel bundle inclusion.
- Real image post and replay acceptance.
