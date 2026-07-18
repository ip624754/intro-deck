# STEP056 — Core Contact Rail Simplification

## Objective
Expose one canonical user-facing `Request contact` rail while preserving the existing intro, contact-unlock, DM, payment, entitlement, cooldown, block, replay, and audit cores.

## User contract
- Every listed non-self profile has one `🤝 Request contact` entry.
- Intro-only mode exposes one free intro request.
- Paid-contact mode exposes two explicit outcomes behind that entry: private chat or Telegram contact.
- Prices or active Pro coverage are shown before entering the existing backend flow.
- Approval is always required. Paid delivery does not guarantee approval, reveal, or reply.
- One Contact inbox routes to Requests and Private chats.

## Compatibility
Legacy `dir:intro`, `dir:dm`, and `dir:unlock` callbacks remain active for historical Telegram messages. No schema or migration is introduced.
