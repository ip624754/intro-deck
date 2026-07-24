# STEP065A2 QA Report

## Status
SOURCE IMPLEMENTED
FOCUSED QA PASSED
FULL REGRESSION COMPARISON PASSED
ZERO BASELINE PASS REGRESSIONS
NO MIGRATION
NO NEW ENV
PRODUCTION NOT DEPLOYED

## Focused checks
- npm run check
- npm run smoke:linkedin-share-conversion
- npm run smoke:linkedin-share-attribution
- npm run smoke:linkedin-share
- npm run smoke:profile-share-media
- npm run smoke:profile-share-cta-polish
- npm run smoke:member-copy
- npm run smoke:admin-language

## Full inventory
- baseline: 106 PASS / 7 NON_PASS / 113
- candidate: 107 PASS / 7 NON_PASS / 114
- baseline PASS regressions: 0

## Inherited NON_PASS
- smoke:code-split
- smoke:profile-session-schema
- smoke:broadcast-idempotency
- smoke:schema-compat
- smoke:step053a-pack
- smoke:ai-news-productization
- smoke:step061-profile-preview-hotfix
