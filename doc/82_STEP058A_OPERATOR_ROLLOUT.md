# STEP058A Operator Rollout — Verified on LinkedIn Development

**Mode:** HEAVY / development-only trust integration  
**Public badges:** OFF  
**Target:** LinkedIn developer-app administrators who are also configured Intro Deck operators

## 1. Pre-deploy checks

1. Confirm the repository reports `STEP058A` and package `0.55.0`.
2. In LinkedIn Developer Portal → Auth, confirm the app exposes:
   - `r_profile_basicinfo`
   - `r_verify`
3. Keep the existing production redirect URI registered exactly:
   - `https://intro-deck.vercel.app/api/oauth/callback/linkedin`
4. Do not enable public verification copy or badges.

## 2. Database migration

Apply exactly once to the current Neon production branch:

```text
migrations/028_linkedin_verified_development.sql
```

The migration:

- creates category-only verification snapshot storage;
- adds uniqueness/index evidence;
- removes historical raw OAuth access/refresh/ID token values from the stored LinkedIn token payload when present;
- does not store verification URLs, government-ID data, legal names, verification methods, or raw evidence.

Expected result: transaction completes without error.

## 3. Vercel environment

Add or update:

```env
LINKEDIN_VERIFIED_MODE=development
LINKEDIN_VERIFIED_SCOPES=r_profile_basicinfo r_verify
LINKEDIN_VERIFIED_IDENTITY_API_VERSION=202510.03
LINKEDIN_VERIFIED_REPORT_API_VERSION=202510
LINKEDIN_VERIFIED_API_TIMEOUT_MS=8000
```

Keep existing base OIDC scopes unchanged:

```env
LINKEDIN_SCOPES=openid profile email
```

`email` may remain absent if the app does not use it; do not add permissions only for convenience.

Redeploy after environment changes.

## 4. Runtime confirmation

Open:

```text
https://intro-deck.vercel.app/api/health?full=1
```

Required minimum:

```json
{
  "ok": true,
  "step": "STEP058A",
  "docsStep": "STEP058A",
  "flags": {
    "linkedInVerificationConfigured": true
  },
  "linkedInVerification": {
    "enabled": true,
    "mode": "development",
    "categoryOnly": true,
    "identityApiVersion": "202510.03",
    "reportApiVersion": "202510",
    "publicBadgesEnabled": false
  }
}
```

## 5. Development test

Use a Telegram account that is:

1. present in Intro Deck operator configuration; and
2. associated with a LinkedIn account that is an administrator of the LinkedIn developer app.

Telegram path:

```text
/profile
→ Refresh LinkedIn verification
→ authorize LinkedIn scopes
→ return to Intro Deck
```

Verify:

- normal LinkedIn connection still succeeds if verification synchronization is unavailable;
- the callback reports Identity and Workplace independently;
- a LinkedIn verification completion URL appears only when LinkedIn returns one;
- the URL is not persisted;
- Profile shows a private Development-testing panel;
- directory cards show no verification badge;
- member-entered role, company, skills, bio, and experience remain unchanged.

## 6. Evidence to retain

Store redacted evidence only:

- health JSON;
- OAuth consent screenshot with scopes, no secret/token;
- Telegram private verification panel;
- database row showing categories/booleans/timestamps, no personal token or verification URL;
- public directory card with no badge;
- audit event for successful or unavailable synchronization.

Never store or share access tokens, refresh tokens, ID tokens, Client Secret, verification URL, or raw provider payloads.

## 7. Stop conditions

Set `LINKEDIN_VERIFIED_MODE=off` and redeploy if any of these occur:

- OAuth flow blocks normal LinkedIn connection;
- a non-operator can launch Development verification;
- public directory badges appear;
- API member IDs mismatch;
- raw tokens or verification URLs are persisted;
- verification categories are represented as proof of title, role, seniority, expertise, or employment eligibility.

## 8. Exit criteria for STEP058B

Proceed to STEP058B only after:

- Development API call succeeds for an app administrator;
- category snapshot persists after migration 028;
- private UI and audit evidence are confirmed;
- failure behavior is verified;
- public badges remain off;
- Lite application evidence is ready.
