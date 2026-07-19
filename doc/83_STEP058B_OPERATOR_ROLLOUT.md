# STEP058B — Operator Rollout

## 1. Apply source

Apply the STEP058B overlay on top of STEP058A.

No SQL migration is required.

## 2. Development configuration

Keep the current production test configuration:

```env
LINKEDIN_VERIFIED_MODE=development
LINKEDIN_VERIFIED_SCOPES=r_profile_basicinfo r_verify
LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED=0
LINKEDIN_VERIFIED_PUBLIC_BADGE_MAX_AGE_DAYS=30
```

Legacy `r_verify` remains accepted by the source for an existing LinkedIn app configuration, but `r_verify_details` is the Development/Lite scope.

## 3. Deploy verification

Open:

```text
https://intro-deck.vercel.app/api/health?full=1
```

Expected minimum:

```json
{
  "step": "STEP058B",
  "docsStep": "STEP058B",
  "linkedInVerification": {
    "mode": "development",
    "publicBadgesEnabled": false,
    "publicBadgePolicy": "lite_plus_explicit_flag_plus_fresh_lite_snapshot"
  }
}
```

## 4. Repeat Development sync

From an eligible operator account:

```text
/profile
→ Refresh LinkedIn verification
→ consent
→ return to Intro Deck
```

The callback now reports the failed API name and safe HTTP/code diagnosis when synchronization is unavailable.

## 5. Development acceptance

Accept STEP058B Development surfaces when:

- owner panel shows the exact snapshot/gate state;
- profile preview does not expose a public badge;
- directory card does not expose a public badge;
- admin user card shows read-only trust diagnostics;
- no professional claim is labeled verified;
- a failed sync gives actionable private diagnostics.

## 6. Lite upgrade gate

Do not set Lite mode or enable public badges until LinkedIn approves the Lite tier.

After approval:

1. Set `LINKEDIN_VERIFIED_MODE=lite`.
2. Keep `LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED=0` for the first Lite OAuth/snapshot test.
3. Refresh verification with a normal member.
4. Confirm `source_tier=lite` and a fresh category snapshot.
5. Set `LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED=1`.
6. Redeploy.
7. Verify exact badge wording on a listed directory card.

## Rollback

Set:

```env
LINKEDIN_VERIFIED_PUBLIC_BADGES_ENABLED=0
```

This disables public badges without deleting snapshots or affecting the base LinkedIn connection.
