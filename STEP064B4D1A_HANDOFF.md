# STEP064B4D1A Handoff

## Status

- Source implementation: complete
- Focused QA: passed
- Full smoke comparison: passed with zero baseline PASS regressions
- Migration: none
- New ENV: none
- Production deployment: not verified

## Canonical baseline

- Step: `STEP064B4D1`
- Package: `0.64.8`
- FULL SHA-256: `c82516e0d3885c72eee6b3600996d0af43b277ff5f77da023ff1594dd8dec8b6`

## Candidate

- Step: `STEP064B4D1A`
- Package: `0.64.9`

## Implemented

- Ordinary LinkedIn profile-share body reduced to two compact paragraphs.
- Fixed permission-oriented Intro Deck positioning is kept in the first paragraph.
- Second paragraph contains a bounded member focus line and the public profile CTA.
- Member name, headline, company, and About are not repeated inside the post body.
- At most three skill labels are rendered; industry/fallback text is used when skills are absent.
- Decorative emoji are excluded; the CTA uses only `→`.
- Telegram preview remains exact to the text passed to the existing publisher.

## Unchanged

- callback IDs
- OAuth scopes/state
- LinkedIn publisher transport
- exact-once/idempotency logic
- payment logic
- AI/news content and language contracts
- migrations and ENV

## Production acceptance

After deployment confirm `/api/health`, Telegram preview, one live LinkedIn publication, and replay protection. Then record:

`PRODUCTION_ACCEPT_STEP064B4D1A`
