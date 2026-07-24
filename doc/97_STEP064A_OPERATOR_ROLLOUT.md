# STEP064A — Operator Rollout

## Baseline

Apply only over `IntroDeck_STEP063B_H2_FULL_2026-07-24.zip` with SHA-256 `0465e70c63f5bbcaaf58feb81087d2defc0d467afd3b8e0ba0fa5ad598e6d59d`.

## Deployment

- Migration: none.
- New ENV: none.
- Deploy the STEP064A PATCH or FULL artifact.

## Health acceptance

Expected:

```text
step = STEP064A
docsStep = STEP064A
inviteSharePolicy.publicCardCta = single_open_intro_deck
inviteSharePolicy.publicCardOwnerNavigation = false
inviteSharePolicy.publicCaptionLinkDuplication = false
inviteSharePolicy.attribution = source_specific_telegram_deep_links
inviteSharePolicy.forwardingCard = canonical_photo_card_with_text_fallback
inviteSharePolicy.rewardAccountingChanged = false
inviteSharePolicy.activationRulesChanged = false
```

## Telegram acceptance

1. Open `/invite`.
2. Confirm root actions are Share to a chat, Forwarding card, Copy invite link, Activity, conditional Points, Home.
3. Confirm Refresh and separate root History are absent.
4. Share through inline mode and confirm a photo card with exactly one `Open Intro Deck` button.
5. Request a Forwarding card and confirm the same photo/caption/one-button layout.
6. Open both CTA links and verify `ii_` for inline share and `ic_` for forwarding card.
7. Open Activity and verify totals, source mix, 7-day counts, and recent joined contacts.
8. Set rewards mode `off` and confirm Points is hidden; verify mode-specific labels for earn-only/live/paused when applicable.

## Rollback

Restore exact STEP063B-H2 FULL. No database rollback is required.
