# STEP063B — LinkedIn Audience-Aware Topic Discovery & Personalized Presets

## Status

`SOURCE IMPLEMENTED / FOCUSED QA PASSED / PRODUCTION NOT VERIFIED`

## Objective

Upgrade the STEP063A-H1A topic-only source browser into a LinkedIn-oriented discovery contract. The member selects a professional topic, intended audience, and editorial angle, while the system may use a bounded subset of the member's public Intro Deck profile to improve source relevance. Publishing remains outside this step and continues to require the existing STEP059 explicit approval flow.

## Canonical baseline

- Artifact: `IntroDeck_STEP063A_H1A_FULL_2026-07-24.zip`
- SHA-256: `b7f20e26d94872097ad8165a7d2f4f43aa7a9c3a446766b1d5260573f6baff39`
- Baseline package: `0.63.2`
- Candidate package: `0.63.3`
- Source step: `STEP063B`
- Mode: HEAVY
- Risk score: 12/12

## Product contract

### Topic taxonomy

The source browser exposes a compact professional taxonomy:

- `for_you`
- `ai_technology`
- `startups_product`
- `business_markets`
- `career_leadership`
- `crypto_web3`
- `custom`

Legacy `business_growth` values are migrated to `business_markets`.

### Audience taxonomy

- My professional network
- Founders & executives
- Product & engineering
- Sales & marketing
- Investors & finance
- Recruiters & talent
- Custom audience

### Editorial angle taxonomy

- Expert take
- Practical lessons
- Founder perspective
- Explain simply
- Contrarian opinion
- Industry impact
- Career implications

### For You

`For you` builds a bounded query from:

- member-entered public headline;
- member-entered public industry;
- up to twelve public skill labels;
- selected audience;
- selected editorial angle.

It does not send private contact data, LinkedIn OAuth tokens, email, Telegram handle, company contact settings, raw About text, unpublished fields, or admin-only data to source providers. The provider query is normalized and capped at 100 characters.

## Relevance contract

Source scoring combines:

- topic signal;
- profile affinity;
- audience fit;
- editorial-angle fit;
- authority tier;
- primary-source status;
- freshness;
- trend signal;
- promotional-risk penalties.

For explicit non-`for_you` topics, profile/audience/angle affinity cannot independently admit an unrelated article. A core topic signal remains required.

## Preset contract

A saved preset now persists:

- topic and custom query;
- audience and custom audience;
- editorial angle;
- profile-affinity enablement;
- source language/country/category;
- post language;
- tone;
- schedule settings.

Existing presets remain valid after migration 035 and receive conservative defaults:

- audience: `professional_network`;
- angle: `expert_take`;
- profile affinity: enabled.

## Generator contract

Audience and angle are passed into:

- the deterministic template generator;
- Groq structured generation;
- OpenAI structured generation.

The generated draft must still satisfy the existing evidence URL, numeric-claim, quotation, and source-substring validators. Audience selection is editorial context only; it does not authorize publishing.

## Database migration

`migrations/035_ai_news_audience_aware_discovery.sql` is additive and idempotent.

It adds the audience/angle/profile-affinity columns to preferences and presets, expands topic constraints, adds `audience_query` input sessions, and migrates `business_growth` to `business_markets`.

Migration 035 is required before the STEP063B source surface is enabled. Missing compatibility fails closed with `migration_035_required`.

## Security and privacy invariants

- Only bounded public profile terms may influence external source queries.
- Provider egress, URL allowlists, response limits, and source evidence controls remain unchanged.
- Arbitrary user-provided source URLs are not introduced.
- Audience and angle do not bypass topic relevance thresholds.
- No generator or source adapter can publish to LinkedIn.
- STEP059 remains the only LinkedIn publisher.
- Automatic publishing remains false.
- LinkedIn OAuth token persistence remains none.

## Out of scope

- LinkedIn feed scraping or recommendation API access;
- autonomous posting;
- organization-page publishing;
- behavioural targeting from private LinkedIn activity;
- embedding/vector infrastructure;
- additional source providers;
- automatic audience inference from private contacts or messages.

## Acceptance

1. Apply migration 035.
2. Deploy the exact STEP063B artifact with browse-only ENV.
3. Verify health reports STEP063B and the audience discovery policy.
4. Open `/news` and exercise `For you`, one explicit topic, Audience, and Angle.
5. Save a preset and verify the expanded contract in PostgreSQL.
6. Run one source search and confirm source metadata contains topic/profile/audience/angle scores.
7. Confirm browse-only creates zero drafts and exposes no Draft buttons.
8. Confirm STEP059 explicit approval and `automaticPublishing=false` remain unchanged.
