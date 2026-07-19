# STEP058B — Verified Badges and Trust Surfaces

## Status

SOURCE IMPLEMENTED. Public badge activation remains blocked until LinkedIn Lite approval, an explicit operator feature flag, and a fresh Lite snapshot.

## Product goal

Expose precise LinkedIn trust signals without turning category-level verification into a generic “verified professional” claim.

## Canonical trust model

Intro Deck distinguishes four independent facts:

1. LinkedIn account connected.
2. LinkedIn identity category verified.
3. LinkedIn workplace category verified.
4. Member-provided professional card claims.

Identity or workplace verification never verifies member-entered role, title, company text, seniority, skills, experience, biography, or expertise.

## Public badge policy

A public badge is eligible only when every condition is true:

- `LINKEDIN_VERIFIED_MODE=lite`;
- `LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED=1`;
- migration 028 snapshot storage is available;
- a successful snapshot exists;
- the snapshot age is within `LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS`;
- at least one category is verified;
- the stored snapshot source tier is `lite`.

Development snapshots never qualify for public display, even when the feature flag is set.

## Exact public wording

Allowed:

- `Identity verified on LinkedIn`
- `Workplace verified on LinkedIn`

Forbidden:

- `Verified professional`
- `Verified role`
- `Verified company` when referring to a member-entered company field
- `Background checked`
- `KYC verified`
- trust scores derived solely from the verification category

## Trust surfaces

### Owner profile panel

Shows:

- Development or Lite mode;
- snapshot status;
- identity category;
- workplace category;
- last synchronization date;
- exact public badge eligibility reason;
- member-provided claims disclaimer.

### Owner profile preview

Shows either:

- public badge preview when eligible; or
- private badge preview with the exact blocking gate.

### Public directory card

Shows category badges only when the public policy resolver returns eligible. No badge placeholder or negative trust mark is shown publicly when blocked.

### Admin user card

Shows read-only category status, snapshot state, and public eligibility reason.

### Health endpoint

Reports:

- selected verification scope;
- requested and effective public badge states;
- max snapshot age;
- policy identifier.

## Failure semantics

- Failed refresh does not erase a previous successful snapshot.
- Missing snapshot does not imply unverified identity; it means Intro Deck has no accepted snapshot.
- Stale snapshot is not public-badge eligible.
- A snapshot timestamp more than five minutes ahead of the current clock is not public-badge eligible.
- Development snapshot is not public-badge eligible.
- Category-empty snapshot is not public-badge eligible.
- Verification errors remain private and are not rendered as public negative badges.

## Sync diagnostics

Operator-safe messages distinguish:

- HTTP 400 / request or version mismatch;
- HTTP 403 / scope or Development app-admin boundary;
- HTTP 404 / member unavailable;
- HTTP 426 / deprecated API version;
- HTTP 429 / rate limit;
- timeout;
- provider 5xx;
- member ID mismatch.

No OAuth token, raw provider payload, or verification URL is exposed in Telegram diagnostics or evidence.

## Non-goals

STEP058B does not:

- obtain LinkedIn Lite approval;
- enable public badges in Development;
- verify professional claims;
- add ranking or filtering advantages;
- change OIDC, payment, contact, DM, invite, or entitlement state machines;
- add a database migration.
