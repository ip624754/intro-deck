# LinkedIn Trust and Distribution Roadmap

**Project:** Intro Deck  
**Baseline:** STEP057  
**Roadmap start:** STEP058A  
**Date:** 2026-07-19

## Product objective

Turn LinkedIn from a basic account-connection bootstrap into two explicit product capabilities:

1. **Trust:** LinkedIn category-level identity and workplace verification signals.
2. **Distribution:** member-approved sharing of an Intro Deck profile or invite to LinkedIn.

The roadmap must not turn LinkedIn into an authority for member-entered role, title, seniority, skills, experience, or expertise. Those fields remain member-provided unless a future LinkedIn tier returns a separately documented field and Intro Deck labels it precisely.

## Mechanism boundary

### LinkedIn-connected identity

Existing OIDC connection proves only that a Telegram user completed a LinkedIn authorization flow for an app-scoped LinkedIn identity. It may import basic identity fields.

### Verified on LinkedIn

Development and Lite tiers return category-level verification signals:

- `IDENTITY`
- `WORKPLACE`

A workplace category confirms a LinkedIn workplace association, not the member-entered role or seniority. It does not confirm the member-entered title, seniority, responsibilities, expertise, or the rest of the Intro Deck card.

### Share on LinkedIn

Publishing must always be initiated and approved by the member. Intro Deck may prepare a draft, preview, and structured share, but it must not silently post, auto-post after profile changes, or reuse consent for unrelated content.

### Member Data Portability

Member Data Portability is an optional regional enrichment rail. It is not the global onboarding foundation because only eligible members in the European Economic Area can consent to the third-party portability permission.

## STEP058A — Verified on LinkedIn Development Integration

### Product purpose

Prove the LinkedIn verification mechanism with developer-app administrators before any public trust badge or acquisition claim is enabled.

### User scope

- `LINKEDIN_VERIFIED_MODE=development`
- Verification scopes are requested only from the private Profile refresh action for configured Intro Deck operator Telegram accounts. The action carries a short-lived signed launch ticket.
- The LinkedIn account must also be an administrator of the LinkedIn developer app; LinkedIn remains the authoritative access gate.
- Normal members continue through the existing base OIDC flow without verification scopes.

### Product surface

Private profile-management surface only:

- Identity category: confirmed / not present
- Workplace category: confirmed / not present
- Last synchronized date
- Refresh LinkedIn verification action
- Explicit Development-testing label
- Explicit statement that public badges are disabled

No public directory badges, ranking effects, filtering, eligibility decisions, or monetization benefits are introduced.

### Data contract

Persist only:

- app-scoped Verified API member ID
- category list
- identity/workplace booleans
- neutral state derived from categories and verification URL availability
- source tier
- exact `/identityMe` and `/verificationReport` API versions
- the `/identityMe` refresh timestamp used for evidence ordering
- local synchronization timestamp

Do not persist:

- LinkedIn access token
- refresh token
- ID token
- single-use verification URL
- government ID data
- verified legal name
- verification method or raw evidence
- duplicate basic-profile name, email, picture, or profile URL fields in the verification snapshot
- provider error payloads containing personal data

### Failure behavior

- Base LinkedIn connection remains usable when the verification API is unavailable.
- Missing migration blocks snapshot persistence but does not break OIDC.
- Existing verification snapshot is not overwritten by an unavailable or failed refresh.
- No badge is rendered from stale, missing, partial, or inferred data.
- Development access remains private and cannot be treated as production verification coverage.

### Acceptance evidence

- OAuth request contains `r_profile_basicinfo` and `r_verify` only for eligible development testers.
- `/identityMe` and `/verificationReport` return the same app-scoped member ID.
- Category snapshot is persisted after migration 028.
- Verification URL is shown only transiently and never stored.
- Private Telegram trust panel reflects the stored snapshot.
- Public directory card contains no verification badge.
- Reconnect refresh does not overwrite the member-entered professional card.

## STEP058B — Verified Badges and Trust Surfaces

### Product purpose

Build production-grade trust presentation without enabling it until Lite access is approved.

### Planned surfaces

- compact `Identity verified on LinkedIn` badge
- compact `Workplace verified on LinkedIn` badge
- profile-detail explanation drawer
- profile owner trust-status screen
- admin diagnostics and verification coverage metrics
- stale/missing snapshot states
- help, privacy, terms, landing, and BotFather wording alignment

### Activation gates

Public badges must remain off unless all are true:

1. LinkedIn app is approved for Lite or higher.
2. Runtime mode is `lite` or an explicitly supported higher tier.
3. Snapshot age is inside the approved freshness window.
4. Snapshot came from the current LinkedIn app and API contract.
5. The public copy states exactly what the category confirms.
6. No role, title, expertise, or employment-screening inference is made.

### Planned policy

- Verification affects trust presentation only.
- It does not boost paid placement or bypass contact consent.
- It does not replace report/block mechanisms.
- It does not create a hiring, KYC, credit, insurance, or risk-scoring decision.
- Stale snapshots lose the badge until refreshed.

### Lite application evidence pack

STEP058B should produce:

- working Development OAuth video/screenshots
- successful category retrieval evidence
- privacy and data-retention explanation
- badge mockups compliant with LinkedIn branding
- exact user journey and use case
- production redirect URI list
- support and deletion process
- documented restricted-use compliance

## Operator action — Request Development to Lite upgrade

Submit only after STEP058A Development evidence and STEP058B gated surfaces are ready.

Operator checklist:

- app company/page association is correct
- production HTTPS redirect URI is registered
- requested scopes are `r_profile_basicinfo` and `r_verify`
- privacy policy describes category-only storage
- deletion and disconnect path is documented
- public badges are feature-gated off during review
- use case is professional community trust enhancement, not employment screening
- application evidence shows real Development API responses from app administrators

After approval:

- deploy the reviewed artifact
- set `LINKEDIN_VERIFIED_MODE=lite`
- enable public badges only through the STEP058B production gate
- run a small cohort verification rollout before broad acquisition

## STEP059 — Share Profile on LinkedIn

### Product purpose

Create an explicit, member-approved growth loop from LinkedIn into the Intro Deck Telegram directory.

### Canonical flow

1. Member publishes an Intro Deck profile.
2. Intro Deck offers `Share profile on LinkedIn`.
3. Member reviews an editable post draft.
4. Member confirms the exact text, link, media, and visibility.
5. Intro Deck publishes once and stores the provider post ID and audit result.
6. Member receives a success/failure receipt.

### API direction

- permission: `w_member_social`
- perform a current API SPIKE before implementation
- prefer LinkedIn's current Posts API contract over legacy `ugcPosts` examples when the current official API supports the required member post
- start with text + URL; add image upload only after the text/link rail is reliable

### Safety and consent

- no background or scheduled publishing in STEP059
- no auto-post after profile edits
- no pre-checked consent
- no publishing from an operator account on behalf of another member
- one idempotency key per confirmed share
- duplicate callback/retry must not create duplicate posts
- errors and rate limits must be visible to the member
- revoke/disconnect must prevent new publishing immediately

### Growth metrics

- share CTA view rate
- draft-open rate
- confirm rate
- provider success rate
- click-through to Telegram deep link
- invited user activation rate
- report/hide rate

## Later — AI/news drafts with user-approved LinkedIn publishing

### Product concept

Use a member's explicit presets, professional card, and selected news sources to prepare relevant LinkedIn drafts.

### Non-negotiable model

`Source retrieval → evidence extraction → member-context draft → preview/edit → explicit approval → publish`

No autonomous publishing.

### Required controls

- user-selected topics, language, tone, and frequency
- source link and factual evidence attached to each draft
- clear distinction between source facts and generated analysis
- duplicate-topic suppression
- freshness and source-quality thresholds
- human preview and edit step
- explicit publish button per post
- rate-limit and budget controls
- full publication audit trail
- deletion/revocation path
- no fabricated quotes, statistics, credentials, or personal experience

### Monetization direction

Possible subscription entitlement:

- limited drafts per month
- saved presets
- personalized profile context
- multilingual drafts
- source-quality controls
- optional image brief generation
- publishing analytics

Publishing permission must never be bundled as silent consent to auto-post.

## Optional later rail — Member Data Portability

Use only as an opt-in enrichment feature for eligible EEA members.

Potential value:

- member-authorized snapshot import
- reduced manual profile entry
- optional account-history or content-based personalization

Constraints:

- product access and company-page verification are required
- permission is `r_dma_portability_3rd_party`
- EEA consent eligibility makes it unsuitable for the global activation spine
- imported data requires a separate retention/deletion contract
- do not mix portability data into Verified on LinkedIn badges

## Roadmap order

```text
STEP058A  Verified on LinkedIn Development integration
STEP058B  Gated badges, trust surfaces, and Lite application evidence
OPERATOR  Request Development → Lite upgrade
STEP058B-R1  Enable Lite cohort after approval
STEP059   Explicit Share profile on LinkedIn
LATER     AI/news drafts with per-post user approval
OPTIONAL  EEA Member Data Portability enrichment
```

## Official references

- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/verified-on-linkedin/overview
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/verified-on-linkedin/api-reference/authentication
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/verified-on-linkedin/api-reference/identity-me
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/verified-on-linkedin/api-reference/verification-report
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/verified-on-linkedin/guides/verification-url
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
- https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-3rd-party/


## STEP058B — Verified badges and trust surfaces

Implemented as a fail-closed presentation layer. Public badges remain blocked until Lite approval, explicit enablement, and a fresh Lite snapshot. Development snapshots are private testing evidence only.
