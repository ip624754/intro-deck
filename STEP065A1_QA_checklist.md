# STEP065A1 QA Checklist

- [x] Exact STEP064B4D2A baseline used.
- [x] Migration 038 is additive and idempotent.
- [x] Attribution token is opaque 128-bit base64url.
- [x] Telegram start payload stays below 64 characters.
- [x] Only published profile-share intents resolve.
- [x] Hidden/revoked/wrong tokens fail closed.
- [x] Valid profile resolution is separated from best-effort evidence persistence.
- [x] Legacy `profile_<id>` links remain supported.
- [x] Sessions are target-profile-bound and expire after 30 days.
- [x] Event ledger is immutable and event-key-idempotent.
- [x] Intro, Telegram-contact, and private-chat paths are instrumented.
- [x] Approval evidence is linked by bounded entity type/id.
- [x] Attribution failures do not control payment/request side effects.
- [x] No external tracking or visitor identity UI was added.
- [x] Full regression comparison has zero baseline PASS regressions.
- [ ] Migration applied in production.
- [ ] Production core loop accepted.
