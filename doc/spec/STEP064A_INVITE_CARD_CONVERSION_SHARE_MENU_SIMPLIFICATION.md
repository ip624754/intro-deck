# STEP064A — Invite Card Conversion & Share Menu Simplification

## Objective

Reduce the public invite experience to one attributed action and simplify the inviter-owned menu without changing referral accounting, activation rules, rewards settlement, or LinkedIn flows.

## Public card contract

- One CTA only: `Open Intro Deck`.
- CTA remains a personal Telegram deep link.
- Inline share uses `ii_` attribution.
- Forwarding card uses `ic_` attribution.
- Raw copy uses `il_` attribution.
- Caption contains value and permission boundaries only; it does not duplicate the CTA with a text link.
- Public card never exposes owner-only callbacks such as Activity, Points, Invite people, or Home.

Canonical caption:

```text
Discover professionals and connect by permission in Telegram.

Browse listed profiles, view LinkedIn-connected identity, and request private contact only after approval.
```

## Canonical media-card renderer

Inline share and forwarding delivery use the same caption, image source, and one-CTA keyboard. Only the attributed deep-link source differs. Forwarding delivery prefers the configured Telegram photo file ID or public JPEG URL and falls back to the same text/card contract if photo delivery fails.

## Inviter menu contract

Root actions:

- Share to a chat
- Forwarding card
- Copy invite link
- Activity
- Points entry only when rewards mode is not `off`
- Home

`Performance` and recent invite context are combined in `Activity`; full paginated history remains reachable from Activity. `Refresh` is removed.

## Rewards-mode labels

- `off`: hidden
- `earn_only`: `Points preview`
- `live`: `Points`
- `paused`: `Points paused`

## Explicit non-goals

- No website-first redirect.
- No referral schema change.
- No reward-accounting change.
- No activation-rule change.
- No migration.
- No LinkedIn OAuth or publishing change.
- No invite image redesign in this STEP.
