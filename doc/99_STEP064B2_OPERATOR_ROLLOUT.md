# STEP064B2 — Operator Rollout

## Preconditions

- Deploy only over the exact STEP064B1 baseline.
- No database migration is required.
- No new environment variables are required.
- Keep all current payment, contact, AI/news, and LinkedIn feature flags unchanged.

## Health check

Expected:

- `step = STEP064B2`
- `docsStep = STEP064B2`
- `transactionCopyPolicy.consentButtons = verb_plus_object_plus_consequence`
- `transactionCopyPolicy.paymentCopy = request_delivery_fee_no_approval_guarantee_no_auto_refund`
- `transactionCopyPolicy.linkedinPublishCta = authorize_and_publish_exactly_one_post`
- `transactionCopyPolicy.callbackIdsChanged = false`
- `transactionCopyPolicy.moneyLogicChanged = false`
- `transactionCopyPolicy.consentStateMachinesChanged = false`
- `transactionCopyPolicy.publisherChanged = false`

## Manual Telegram acceptance

### Intro

- Received request buttons: `Accept intro` / `Decline intro`.
- Acceptance copy states that only an existing public LinkedIn URL may be shared.
- Telegram username and private chat remain hidden.

### Telegram contact

- Received request buttons: `Share Telegram contact` / `Decline contact request`.
- Copy states that approval immediately reveals the hidden Telegram username.
- Revealed-contact button says `Open Telegram contact`.

### Private chat

- Received request buttons: `Accept chat request` / `Decline chat request`.
- Safety buttons say `Block requester` / `Report and block`.
- Payment button states the exact Stars amount and `send request` consequence.
- Acceptance opens only an Intro Deck conversation.

### Payments

- Invoice and receipt copy states request-delivery scope.
- Approval/reply is not guaranteed.
- Decline/no reply does not trigger an automatic refund.
- Any received-but-not-finalized payment says `Do not pay again. Contact support.`

### LinkedIn

- Draft button: `Approve draft for LinkedIn`.
- Approval screen states that the post is not yet published.
- Final CTA: `Authorize and publish this post`.
- Profile share uses the same final CTA.
- Cancel action says `Cancel share`.
- Duplicate or uncertain publication states never invite a blind retry.

## Rollback

Restore the exact STEP064B1 FULL artifact. No database rollback is required.
