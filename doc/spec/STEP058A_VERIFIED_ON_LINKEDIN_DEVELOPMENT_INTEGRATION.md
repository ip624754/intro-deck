# STEP058A — Verified on LinkedIn Development Integration

**Mode:** HEAVY  
**Risk Score:** 12/12  
**Baseline:** STEP057  
**Package target:** 0.55.0

## Objective

Integrate LinkedIn's Development-tier `/identityMe` and `/verificationReport` APIs into the existing OIDC connection flow for internal operator testing, while keeping normal member OIDC behavior unchanged and public badges disabled.

## Invariants

1. Existing OIDC identity connection remains canonical.
2. Verification scopes are requested only for eligible Development testers or all members after an explicit Lite mode switch.
3. LinkedIn remains authoritative for OAuth and Development app-admin eligibility.
4. `IDENTITY` and `WORKPLACE` are separate category facts.
5. No category verifies member-entered role, title, seniority, skills, experience, expertise, or biography.
6. A failed verification API call must not break the base LinkedIn connection.
7. A failed refresh must not overwrite an existing snapshot.
8. Verification URL is transient and never persisted.
9. OAuth access, refresh, and ID token values are never retained.
10. No public badge, ranking, filter, entitlement, payment, or contact advantage is introduced in STEP058A.

## Runtime configuration

```env
LINKEDIN_VERIFIED_MODE=off
LINKEDIN_VERIFIED_SCOPES=r_profile_basicinfo r_verify
LINKEDIN_VERIFIED_IDENTITY_API_VERSION=202510.03
LINKEDIN_VERIFIED_REPORT_API_VERSION=202510
LINKEDIN_VERIFIED_API_TIMEOUT_MS=8000
```

Modes:

- `off` — existing OIDC only.
- `development` — verification requested only for configured Intro Deck operator Telegram IDs; LinkedIn additionally requires the linked account to be an app administrator.
- `lite` — verification scopes may be requested for all members after LinkedIn approval. Public badges still remain disabled until STEP058B gates are satisfied.

## API flow

1. `/api/oauth/start/linkedin` resolves base OIDC scopes.
2. It resolves verification eligibility from mode and operator allowlist.
3. The private Telegram refresh button creates a short-lived signed launch ticket bound to the Telegram user and `verification_refresh` purpose.
4. The OAuth start route verifies that ticket before adding `r_profile_basicinfo` and `r_verify`.
5. Signed OAuth state binds purpose, verification request, and expected mode.
6. Callback exchanges the authorization code and completes existing OIDC validation.
7. If verification was requested, callback calls:
   - `GET https://api.linkedin.com/rest/identityMe`
   - `GET https://api.linkedin.com/rest/verificationReport?verificationCriteria=IDENTITY&verificationCriteria=WORKPLACE`
8. App-scoped member IDs from both responses must match.
9. Category-only snapshot is normalized and persisted after OIDC identity persistence.
10. Any verification URL is shown only in the immediate callback/Telegram result.
11. Member can manually refresh through a new profile button.

## Data model

Migration: `migrations/028_linkedin_verified_development.sql`

Table: `linkedin_verification_snapshots`

Stored:

- `linkedin_account_id`
- `api_member_id`
- `verification_categories`
- `identity_verified`
- `workplace_verified`
- `verification_state`
- `verification_url_offered`
- `source_tier`
- `identity_api_version`
- `report_api_version`
- provider refresh timestamp
- local sync timestamps

Neutral state values:

- `identity_and_workplace_verified`
- `category_verified`
- `verification_available`
- `no_category_or_url`

These values avoid inferring why a missing category or URL is absent.

## Token retention correction

Migration 028 removes historical `access_token`, `refresh_token`, and `id_token` keys from `linkedin_accounts.raw_oidc_claims_json.token`.

New persistence stores only non-secret token metadata:

- token type
- expiry durations
- returned scope string
- boolean presence flags

## UX

Private Profile setup surface for eligible testers:

- Development/Lite label
- Identity category status
- Workplace category status
- snapshot date
- exact member-provided claims disclaimer
- public badges disabled disclaimer
- `Refresh LinkedIn verification` action

Public directory cards remain unchanged.

## Audit trail

Admin audit events:

- `linkedin_verification_snapshot_synced`
- `linkedin_verification_sync_unavailable`
- `linkedin_verification_migration_required`

No provider token, verification URL, or raw provider payload is included in audit detail.

## Acceptance criteria

- configuration validation fails closed for missing required scopes or invalid API version;
- non-operator Development user receives the unchanged base OIDC scopes;
- privileged verification refresh requires a valid short-lived launch ticket bound to the Telegram user and purpose;
- eligible operator receives base + verification scopes;
- state mode mismatch blocks verification sync but preserves normal OIDC;
- API member IDs must match;
- category snapshot persists after migration 028;
- failure does not erase prior snapshot;
- historical raw OAuth token values are scrubbed;
- private tester surface renders correct categories;
- public directory card renders no STEP058A verification badge;
- existing STEP053–057 contracts have no new failures.

## Operator rollout

1. Apply migration 028.
2. Confirm LinkedIn app administrators are also configured Intro Deck operator Telegram IDs.
3. Add the verification scopes to the LinkedIn app/Auth configuration if required by the developer portal.
4. Set `LINKEDIN_VERIFIED_MODE=development` in Vercel.
5. Keep `LINKEDIN_VERIFIED_SCOPES=r_profile_basicinfo r_verify`.
6. Redeploy.
7. Open Profile → Refresh LinkedIn verification using an app-admin LinkedIn account.
8. Confirm private status and audit evidence.
9. Keep public badges disabled.

## Not in scope

- public badges;
- Lite application submission;
- background token refresh;
- scheduled verification refresh;
- role/company/title verification;
- ranking/filtering based on verification;
- Share on LinkedIn;
- Member Data Portability.
