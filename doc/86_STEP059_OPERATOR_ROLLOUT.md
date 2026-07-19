# STEP059 — Operator Rollout

## Preconditions

- STEP058B1 is live.
- Share on LinkedIn product is added to the LinkedIn developer application.
- `w_member_social` is available to the application.
- The repository tree is STEP059.
- A Neon restore point or branch backup exists before migration 029.

## 1. Apply migration 029

In Neon SQL Editor, verify the production branch/database and run:

```text
migrations/029_linkedin_share_profile.sql
```

The migration is additive and idempotent.

## 2. Configure Vercel

```env
LINKEDIN_SHARE_MODE=live
LINKEDIN_SHARE_SCOPES=w_member_social
LINKEDIN_SHARE_POSTS_API_VERSION=202606
LINKEDIN_SHARE_API_TIMEOUT_MS=8000
LINKEDIN_SHARE_INTENT_TTL_SECONDS=900
LINKEDIN_SHARE_CLAIM_TIMEOUT_SECONDS=300
LINKEDIN_SHARE_VISIBILITY=PUBLIC
```

Keep base OIDC separate:

```env
LINKEDIN_SCOPES=openid profile email
```

Do not add `w_member_social` to the base login variable. It must be requested only by the explicit share intent.

## 3. Deploy

Redeploy after changing ENV. Check:

```text
https://intro-deck.vercel.app/api/health?full=1
```

Expected minimum:

```json
{
  "ok": true,
  "step": "STEP059",
  "docsStep": "STEP059",
  "flags": {
    "linkedInShareConfigured": true
  },
  "linkedInShare": {
    "enabled": true,
    "mode": "live",
    "configurationValid": true,
    "scope": "w_member_social",
    "explicitApprovalRequired": true,
    "tokenPersistence": "none",
    "automaticPublishing": false
  }
}
```

## 4. Live test

Use a member account with a connected LinkedIn account and an active/listed Intro Deck profile.

```text
/profile
→ Preview
→ Share profile on LinkedIn
→ review exact text
→ Approve and publish on LinkedIn
→ LinkedIn consent
→ return receipt
```

Verify:

- one LinkedIn post appears;
- the post opens `@introdeckbot` with `start=profile_<id>`;
- the deep link opens the correct listed profile;
- Telegram shows the provider post ID receipt;
- a repeated callback does not create a duplicate;
- no token appears in logs or database rows.

## 5. Rollback

Immediate product rollback:

```env
LINKEDIN_SHARE_MODE=off
```

Redeploy. This removes the CTA and `/share` availability without deleting receipts.

Do not drop migration 029 during normal rollback. Historical receipts and unknown states are required for duplicate protection.

## Unknown-outcome handling

If the user sees an uncertain outcome:

1. Do not retry automatically.
2. Check the member's LinkedIn feed.
3. Locate the intent in `linkedin_share_intents`.
4. Preserve provider request/post identifiers.
5. Reconcile only after evidence confirms whether the post exists.

A new share remains blocked while the latest intent is `publishing` or `unknown`.

## Truth boundary

- Source checks do not prove a live LinkedIn post.
- Health proves configuration/deployment, not publication.
- Live acceptance requires one real post and duplicate-callback evidence.
