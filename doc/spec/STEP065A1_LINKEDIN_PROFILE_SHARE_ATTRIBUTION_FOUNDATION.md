# STEP065A1 — LinkedIn Profile Share Attribution Foundation

## Goal
Create a privacy-bounded, Telegram-native evidence chain from one published LinkedIn profile-share post to profile opens, request initiation, request submission, and recipient approval.

## Canonical baseline
- Source step: `STEP064B4D2A`
- Package: `0.65.1`
- FULL SHA-256: `b7c6a023facdcb99ba6d6665be573b5b8642cabd2549ed1b27e72ede60c808ed`

## Data contract
Migration `038_linkedin_profile_share_attribution_foundation.sql` adds:

- `linkedin_share_intents.attribution_token`
- `linkedin_share_intents.attribution_revoked_at`
- `linkedin_share_attribution_sessions`
- `linkedin_share_attribution_events`
- immutable UPDATE/DELETE trigger for the event ledger

The public token is an opaque 128-bit base64url value. It is not a Telegram user ID, internal row ID, LinkedIn Post ID, OAuth token, or share-intent authorization token.

## Deep-link contract
New profile-share posts use:

```text
https://t.me/introdeckbot?start=ls_<opaque-token>
```

A token resolves only when all of these are true:

- exact token match;
- source kind is `profile_share`;
- share status is `published`;
- attribution is not revoked;
- target profile is `active` and `listed`.

Legacy `profile_<id>` links remain supported and unattributed.

## Event contract
The immutable ledger supports:

- `profile_opened`
- `contact_request_started`
- `private_chat_request_started`
- `request_submitted`
- `request_approved`

`telegram_update_id` and stable entity keys prevent webhook replay from inflating the same event. Total opens are the number of `profile_opened` rows. Unique opens are `count(distinct visitor_user_id)`.

## Attribution session
Opening a valid share link creates or refreshes a 30-day session for that Telegram visitor and that exact target profile. A subsequent product event is attributed only when the action target matches the session profile.

Opening another attributed profile replaces the prior session. Expired, revoked, hidden, or wrong-target sessions are ignored.

## Privacy boundary
The foundation does not use:

- browser cookies;
- tracking pixels;
- browser fingerprinting;
- LinkedIn scraping;
- external visitor data;
- public visitor identity disclosure.

Internal user references exist only to support unique counting and event linkage. STEP065A1 exposes no owner-facing visitor list and no dashboard.

## Failure boundary
Attribution evidence is best-effort relative to the product action:

- a valid published token may still open the profile if ledger/session persistence fails;
- attribution failure does not repeat or block request/payment/approval side effects;
- invalid tokens never resolve a different profile;
- request and payment logic are unchanged.

## Rollback boundary
Before the first STEP065A1 post is published, exact rollback to STEP064B4D2A is safe and migration 038 may remain.

After an `ls_` link has been published, an exact code rollback would stop that new link format from resolving. Use a compatibility rollback/hotfix that preserves `ls_` resolution while disabling only attribution writes if necessary.

## Out of scope
- owner/admin dashboard;
- A/B templates;
- dynamic personalized images;
- external attribution;
- changes to payment, OAuth, publisher, reward, or AI/news logic.
