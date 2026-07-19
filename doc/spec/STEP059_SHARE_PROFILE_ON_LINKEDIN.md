# STEP059 — Share Profile on LinkedIn

## Status

Source implementation target on top of STEP058B1.

## Objective

Allow a member to publish one reviewed Intro Deck profile-share post to their own LinkedIn account through an explicit, one-shot OAuth authorization.

## Product contract

1. Only an active, listed profile can be shared.
2. The exact post and visibility are shown in Telegram before authorization.
3. The member must explicitly select **Approve and publish on LinkedIn**.
4. Intro Deck never publishes automatically or in the background.
5. The share OAuth intent requests `w_member_social` separately from base OIDC sign-in.
6. The OAuth access token is used only for the current provider call and is never stored.
7. One claimed intent can create at most one provider post.
8. Concurrent callbacks cannot create duplicate posts.
9. A timeout, network failure, provider 5xx, missing provider post ID, stale publish claim, or local receipt failure after provider success becomes `unknown`; automatic retry is blocked.
10. A provider-confirmed 4xx failure may be retried through a new explicit authorization.
11. A previous `publishing` or `unknown` intent blocks a new draft until reconciled.
12. The post links directly to the shared member profile through a Telegram deep link.

## Scope

### Included

- text-only profile share;
- current LinkedIn Posts API (`POST /rest/posts`);
- `w_member_social` one-shot OAuth intent;
- Telegram draft preview and cancel action;
- publication receipt and event history;
- exact provider post/request identifiers;
- idempotent claim/finalize state machine;
- production-safe optional configuration;
- direct Telegram deep link to the shared profile;
- Privacy, Terms, Help, health, rollout, and Lite-application documentation.

### Excluded

- automatic posting;
- scheduled posting;
- AI-generated copy;
- background refresh tokens;
- media/image/video upload;
- organization/page posting;
- analytics ingestion;
- post deletion or editing;
- broad LinkedIn content-management tooling.

## State machine

```text
draft
  → authorization_started
  → publishing
      → published
      → failed       (provider-confirmed non-publication)
      → unknown      (duplicate-risk outcome)

draft / authorization_started / failed
  → cancelled

draft / authorization_started
  → expired
```

`publishing` stale claims become `unknown`, never retryable `failed`.

## Persistence

Migration `029_linkedin_share_profile.sql` adds:

- `linkedin_share_intents`;
- `linkedin_share_events`;
- unique provider-post receipt;
- one unresolved share per user;
- expiry and user-history indexes;
- state constraints for publishing claims and published receipts.

No OAuth token column exists.

## Security and abuse invariants

- signed launch ticket binds Telegram user, purpose, share intent, issue time, expiry, and nonce;
- signed OAuth state repeats the binding;
- callback LinkedIn `sub` must equal the stored app-scoped member ID;
- profile must still be active and listed at callback time;
- row lock serializes intent claim;
- user advisory lock serializes draft creation;
- `unknown` blocks new shares;
- provider success is never downgraded to retryable failure because of local receipt/audit errors;
- audit failure cannot roll back a durable published receipt;
- access token and raw provider response are not persisted.

## LinkedIn API contract

- Endpoint: `POST https://api.linkedin.com/rest/posts`
- Required scope: `w_member_social`
- Required headers:
  - `Authorization: Bearer ...`
  - `Linkedin-Version: YYYYMM`
  - `X-Restli-Protocol-Version: 2.0.0`
- Author: `urn:li:person:{app-scoped-member-id}`
- Success: HTTP 201 plus `x-restli-id`.

## Acceptance criteria

- Share CTA appears only for active/listed profiles when feature mode is live.
- `/share` opens the same canonical preview.
- Exact post text is visible before OAuth.
- Cancel prevents callback publication.
- Identity mismatch blocks publication.
- Duplicate callback does not create a second provider call.
- Provider 201 + post ID persists one published receipt.
- Provider 4xx persists `failed`.
- timeout/network/5xx/missing post ID persists `unknown`.
- provider success + local receipt failure remains non-retryable.
- direct profile deep link opens the listed profile card.
- health remains 200 when optional share configuration is invalid.
- no new inherited smoke failures.
