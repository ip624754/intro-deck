# STEP053 — Contact Contract and Payment Honesty Lock

## Status

Source implemented. Live status not confirmed — manual verification required.

## Mode and risk

- Mode: HEAVY
- Risk Score: 12/12
- Critical zones: Telegram Stars, contact consent, callbacks, idempotency, replay protection, Pro entitlements, schema migration

## Goal

Make the member contact policy authoritative and make every paid surface describe the real economic outcome:

- `intro_request` means intro-only;
- `paid_unlock_requires_approval` is the only mode that permits new paid direct-contact and DM permission requests;
- a Stars fee purchases delivery of a permission request, not guaranteed contact, approval, or reply;
- a decline or no reply does not by itself trigger an automatic refund in the current money core;
- Pro provides a bounded fair-use allowance, not unlimited outreach.

## Canonical contract

### Contact modes

| Mode | Free intro | Paid direct contact | Paid DM request |
|---|---:|---:|---:|
| `intro_request` | allowed | blocked | blocked |
| `paid_unlock_requires_approval` | not shown | allowed | allowed |

The policy is enforced at:

1. directory rendering;
2. request creation;
3. first-message persistence for DM;
4. invoice creation;
5. invoice eligibility after pair cooldown/block recheck;
6. Telegram pre-checkout authorization with exact `XTR` amount validation;
7. successful-payment confirmation with the same amount/currency snapshot;
8. Pro coverage transition after a fresh pair-policy recheck.

### Request-delivery fee

Policy identifier:

`request_delivery_fee_non_refundable_v1`

The fee contract shown before payment states:

- payment delivers the permission request;
- recipient approval is required;
- approval or reply is not guaranteed;
- the recipient may decline;
- decline or no reply alone does not trigger an automatic refund.

No new refund engine was invented in this STEP. Existing schema state `refunded` remains unused until a separate canonical refund mechanism is designed and runtime-proven.

### Pro fair use

Default policy:

- 10 combined direct-contact + DM request deliveries;
- rolling 24-hour window;
- recipient approval remains mandatory;
- quota exhaustion falls back to the existing per-request Stars rail;
- env range is bounded to 1–100 requests per rolling 24 hours.

### Recipient protection

- a recipient decline starts one shared cooldown across both paid contact rails;
- default cooldown: 30 days;
- a recipient block on the DM rail blocks a new direct-contact request from the same requester;
- active, mutually approved DM threads remain usable if the profile later changes contact mode;
- a profile mode change blocks new requests but does not remove the recipient's ability to approve an already delivered request.

## Critical state invariants

1. A new paid request cannot be created for an intro-only profile.
2. A stale callback cannot bypass current profile policy before checkout.
3. A successful payment is accepted only after a recent pre-checkout authorization.
4. One Telegram payment charge cannot confirm two different products or requests.
5. Pair-level creation is serialized with a PostgreSQL transaction advisory lock.
6. Pro usage is serialized per user before the delivery transition.
7. A delivered request has an audit event identifying paid or Pro coverage.
8. A recipient decision remains idempotent.
9. Checkout retry lock is never shorter than the successful-payment authorization TTL.
10. Pro allowance lock is acquired before pair lock to keep cross-flow lock order deterministic.
11. A stale Pro draft cannot bypass a later decline or block.
12. A decline cannot be bypassed by switching from DM to direct contact or vice versa.
13. Missing STEP053 schema fails closed instead of silently restoring the old behavior.

## Schema

Migration:

`migrations/027_contact_contract_payment_honesty.sql`

Adds:

- `contact_unlock_requests.pro_covered`;
- `contact_unlock_requests.checkout_authorized_at`;
- `member_dm_threads.contact_policy_snapshot`;
- `member_dm_threads.pro_covered`;
- `member_dm_threads.checkout_authorized_at`;
- payment charge uniqueness indexes;
- an explicit prerequisite and duplicate-charge migration preflight;
- Pro usage indexes;
- `contact_unlock_events` audit table.

Migration dependencies:

- STEP050J compatibility decision remains valid;
- `019_contact_unlock_requests.sql` is required for the direct-contact rail;
- `020_member_dm_relay.sql` is required for the DM rail;
- `021_pricing_receipts_ops.sql` is required for canonical purchase receipts;
- `027_contact_contract_payment_honesty.sql` is required before STEP053 contact flows are enabled.

## Environment

```env
PRO_OUTREACH_DAILY_LIMIT=10
CONTACT_REQUEST_RETRY_COOLDOWN_DAYS=30
PAYMENT_CHECKOUT_AUTH_TTL_MINUTES=30
PAYMENT_CHECKOUT_RETRY_LOCK_SECONDS=1800
```

Allowed ranges:

- `PRO_OUTREACH_DAILY_LIMIT`: 1–100
- `CONTACT_REQUEST_RETRY_COOLDOWN_DAYS`: 1–365
- `PAYMENT_CHECKOUT_AUTH_TTL_MINUTES`: 5–1440
- `PAYMENT_CHECKOUT_RETRY_LOCK_SECONDS`: 300–86400 and never shorter than `PAYMENT_CHECKOUT_AUTH_TTL_MINUTES`

## Rollout gate

Do not deploy the code before migration `027` is applied. Migration `027` intentionally aborts when prerequisite tables are missing or when ambiguous duplicate charge IDs require operator review.

Required manual proof after deployment:

1. intro-only card has no paid contact or DM buttons;
2. direct-contact and DM pre-checkout fail after the target switches to intro-only;
3. paid request reaches `paid_pending_approval` / `pending_recipient` once;
4. wrong currency or amount is rejected before checkout authorization;
5. duplicate successful-payment delivery does not create a second receipt or request message;
6. reusing a charge for another entity is rejected;
7. two near-simultaneous pre-checkout callbacks cannot both obtain authorization;
8. Pro request increments the combined allowance once;
9. the 11th default Pro request offers paid fallback;
10. a stale Pro DM draft is blocked after a cross-rail decline;
11. decline blocks both rails for the configured cooldown;
12. block prevents a new direct-contact request;
13. Terms and bot pricing surfaces show the same fee and fair-use contract.

## Explicit trade-offs

- Pre-checkout authorization is serialized per contact pair and protected by a retry lock that is at least as long as the authorization TTL. This favors double-charge prevention over immediate retry after an interrupted checkout.
- The default lock/authorization window is 30 minutes. A user whose checkout is interrupted may need to reopen the request after that window.
- A Stars charge already authorized before a later profile-mode change is completed against the stored policy snapshot; this avoids charging the user and then silently discarding the paid request.
- Automatic refunds are not simulated. Refund/dispute execution remains a separate critical STEP because Telegram/provider behavior must be runtime-proven.
