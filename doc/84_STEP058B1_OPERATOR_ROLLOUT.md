# STEP058B1 Operator Rollout

## Required Vercel environment

```env
LINKEDIN_VERIFIED_MODE=development
LINKEDIN_VERIFIED_SCOPES=r_profile_basicinfo r_verify
LINKEDIN_VERIFIED_IDENTITY_API_VERSION=202510.03
LINKEDIN_VERIFIED_REPORT_API_VERSION=202510
LINKEDIN_VERIFIED_API_TIMEOUT_MS=8000
LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED=0
LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS=30
```

Keep base OIDC separate:

```env
LINKEDIN_SCOPES=openid profile email
```

## Apply

1. Apply the STEP058B1 overlay over STEP058B.
2. Run:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run smoke:linkedin-verification-compat
```

3. Deploy to Vercel.
4. No SQL migration is required.

## Health acceptance

`/api/health?full=1` must report:

- `step=STEP058B1`;
- `docsStep=STEP058B1`;
- `linkedInVerification.configurationValid=true`;
- `verificationScope=r_verify`;
- `publicBadgesEnabled=false`.

## Live verification test

In `@introdeckbot`:

1. Open Profile.
2. Select Refresh LinkedIn verification.
3. Complete LinkedIn consent.
4. Return to Telegram.

Expected outcomes:

- Primary request succeeds; or
- HTTP 400 primary request is retried once without criteria and succeeds; or
- both attempts fail and Telegram shows endpoint, compatibility retry status, and a safe LinkedIn request ID when available.

No failed path may create a public badge.
