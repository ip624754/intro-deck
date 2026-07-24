# STEP064B2 — Critical Transaction Copy & CTA Semantics

## Goal

Make every consent, payment, contact disclosure, and LinkedIn publication action state its exact consequence before the member acts.

## Mode and risk

- CogniForge mode: HEAVY
- Risk score: 12/12
- Baseline: STEP064B1 FULL
- Migration: none
- New ENV: none

## Invariants

- Callback identifiers do not change.
- Intro, Telegram-contact, private-chat, payment, and LinkedIn state machines do not change.
- Payment remains a request-delivery fee, not payment for approval or response.
- Decline or no reply does not trigger an automatic refund after a delivered request.
- Accepting an intro may share only the public LinkedIn URL already provided by the member.
- Sharing Telegram contact immediately reveals the hidden Telegram username to that requester.
- Accepting a private-chat request opens an Intro Deck conversation and does not reveal Telegram contact.
- Draft approval does not publish. LinkedIn authorization remains a separate step.
- One LinkedIn authorization can create at most one post.

## Canonical CTA contract

- `Accept intro`
- `Decline intro`
- `Share Telegram contact`
- `Decline contact request`
- `Accept chat request`
- `Decline chat request`
- `Block requester`
- `Report and block`
- `Approve draft for LinkedIn`
- `Cancel draft`
- `Authorize and publish this post`
- `Cancel share`

## Stale and replay behavior

Expired or repeated actions state the latest known outcome and tell the member not to repeat a side effect. Payment-finalization failures explicitly say not to pay again and to contact support.

## Out of scope

- callback changes;
- payment calculations;
- refund policy changes;
- new confirmations or state transitions;
- migrations;
- admin-language work;
- interface localization;
- LinkedIn publisher changes.
