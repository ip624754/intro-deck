# STEP064B4C — Transaction, Notification & OAuth Language Boundary

## Objective

Complete the explicit EN/RU language boundary established by STEP064B4A and STEP064B4B for transaction-adjacent Telegram copy, recipient notifications and retries, LinkedIn OAuth HTML/Telegram receipts, and ordinary profile sharing.

The implementation changes presentation and signed language evidence only. It does not redesign money flows, authorization, consent transitions, provider calls, publishing authority, rewards, or AI/news preset language mechanics.

## Mode and risk

- CogniForge mode: HEAVY
- Risk score: 12/12
- Migration: none
- New ENV: none
- Exact baseline: STEP064B4B FULL SHA-256 `8839d3fd224c9bf52761f0869a05889306ad5b72b8a6e3d8abe157969111fec7`

## Canonical language sources

### Interface language

`users.interface_language` controls:

- transaction CTA labels and disclosures;
- Telegram Stars invoice title/description and payment receipts;
- contact-unlock and private-chat decision surfaces;
- recipient notifications;
- notification retry rendering;
- LinkedIn OAuth HTML pages;
- LinkedIn OAuth Telegram receipts;
- LinkedIn connection transfer confirmation and previous-owner notice.

### Default post language

`users.default_post_language` controls only ordinary profile-share post text.

It does not override:

- AI/news draft `post_language`;
- existing AI/news preset `post_language`;
- user-authored text;
- provider/source content.

## Signed OAuth snapshot

The trusted launch path records both normalized language values in HMAC-signed payloads:

- signed LinkedIn launch ticket;
- signed OAuth state;
- signed transfer token.

For share and verification flows, language is accepted only from a valid signed launch ticket. Unsigned query parameters cannot change the OAuth rendering language or the post language. Normal connection flow reads stored preferences before constructing signed OAuth state.

The callback uses the signed state snapshot for deterministic HTML pages and Telegram receipts. This prevents preference changes, stale browser tabs, or query tampering from changing the language midway through an authorization operation.

## Retry-safe recipient language

Notification attempts persist `interfaceLanguage` inside existing JSON evidence:

- notification receipt `payload_json`;
- scheduled AI/news run `detail_json`.

A retry renders from the stored attempt/run snapshot rather than silently switching language after the recipient changes preferences. No new table or migration is required.

## Ordinary profile share

The profile-share preview and final LinkedIn text are generated from the independent `default_post_language` snapshot. The existing explicit approval, one-shot authorization, claim/idempotency, provider call, and no-token-persistence contracts remain unchanged.

## Transaction invariants

Unchanged:

- Telegram Stars currency remains `XTR`;
- payment payloads remain unchanged;
- configured amounts remain unchanged;
- pre-checkout authorization rules remain unchanged;
- contact/DM/Pro state transitions remain unchanged;
- decline does not imply automatic refund;
- callback IDs remain unchanged;
- LinkedIn scopes and API versions remain unchanged;
- OAuth access tokens remain non-persistent;
- repeated OAuth callbacks cannot intentionally create a second post;
- automatic publishing remains disabled.

## Presentation rules

- Immutable state/reason/event codes remain English codes when surfaced as bounded diagnostics.
- User-provided names, messages, profile fields, URLs, source titles, and draft content are not translated.
- The external public invite card remains canonical English and is outside this STEP.
- Admin surfaces retain the separate STEP064B3 Russian operator boundary.

## Health contract

STEP064B4C exposes:

- `interfaceLanguagePolicy.transactionAndOAuthRendering = stored_interface_language_plus_signed_oauth_snapshot`
- `postLanguagePolicy.ordinaryProfileShareIntegration = users_default_post_language`
- `transactionCopyPolicy.interfaceLanguageSource = stored_user_preference`
- `transactionCopyPolicy.notificationRecipientLanguage = recipient_preference_with_retry_snapshot`
- `oauthLanguagePolicy.stateSnapshotSigned = true`
- `oauthLanguagePolicy.transferSnapshotSigned = true`
- `oauthLanguagePolicy.oauthScopesChanged = false`
- `oauthLanguagePolicy.replayAndIdempotencyChanged = false`

## Out of scope

- external public invite-card localization;
- admin-web localization;
- new languages beyond EN/RU;
- machine translation of member content;
- payment or refund redesign;
- OAuth scope changes;
- LinkedIn publisher redesign;
- automatic publishing;
- AI/news provider or ranking changes;
- schema migration or ENV changes.
