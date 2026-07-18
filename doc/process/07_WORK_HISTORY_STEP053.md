# STEP053 — Work History

## Objective

Lock the consent and payment contract for direct-contact and DM requests without replacing the existing Stars receipt or Pro subscription cores.

## Implementation summary

- introduced one canonical contact contract module;
- made paid contact mode authoritative across render, repository, invoice, pre-checkout, and confirmation boundaries;
- added a short-lived checkout authorization recorded before Telegram accepts payment;
- added exact `XTR` currency and amount checks at pre-checkout and request payment confirmation boundaries;
- bounded invoice descriptions to Telegram's 255-character limit;
- added transaction advisory locks for contact pairs, payment charges, and Pro usage;
- standardized lock order as Pro allowance -> contact pair and rechecked stale Pro drafts before delivery;
- added cross-rail decline cooldown and recipient-block enforcement;
- added combined rolling Pro fair-use accounting with paid fallback;
- added contact unlock audit events and policy snapshots;
- changed user copy, invoice copy, pricing copy, purchase receipts, and Terms to describe request delivery honestly;
- added migration `027`, explicit prerequisite/duplicate-charge preflight, and aligned the consolidated fresh-install schema;
- made Pro pre-checkout fail closed and recorded the actual Stars amount in the canonical receipt;
- added STEP053 smoke coverage.

## Explicit non-goals

- no automatic refund execution;
- no escrow or reservation system;
- no replacement of Telegram Stars receipts;
- no second subscription or entitlement core;
- no broad unification of the two contact rails;
- no landing positioning rewrite (reserved for STEP054).

## Truth boundary

### Source-confirmed

- policy gates exist in source;
- charge replay protection exists in source;
- pair and Pro advisory locks exist in source;
- migration and audit schema exist in source;
- invoice and Terms disclosures exist in source;
- amount/currency checks and migration duplicate-charge preflight exist in source;
- syntax and source-level smoke checks can be executed locally.

### Live-confirmed

None in this STEP workspace.

### Not verified

- PostgreSQL execution of migration `027` against staging;
- deployed Telegram pre-checkout and successful-payment ordering;
- live duplicate callback behavior;
- live Pro quota under concurrent requests;
- Telegram refund/support operations;
- Node 20 canonical runtime.
