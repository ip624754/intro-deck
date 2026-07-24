# STEP064B4C QA Checklist

## Source and contracts

- [x] Package/source markers updated to STEP064B4C / 0.64.6.
- [x] Syntax/source check passed.
- [x] Focused transaction/notification/OAuth language smoke passed.
- [x] Existing B4A language-foundation smoke passed.
- [x] Existing B4B member-rendering smoke passed.
- [x] Critical transaction-copy smoke passed.
- [x] Contact-unlock payment contract passed.
- [x] Private-chat payment and relay contracts passed.
- [x] OAuth route/import contract passed.
- [x] LinkedIn callback diagnostics passed.
- [x] LinkedIn relink/identity-transfer contracts passed.
- [x] LinkedIn share explicit-approval contract passed.
- [x] Notification receipt/retry contracts passed.
- [x] AI/news productization contract passed.
- [x] Admin-language contract passed.

## Security and state integrity

- [x] Language snapshot is HMAC-signed in launch/state/transfer payloads.
- [x] Tampered signed payload is rejected by focused smoke.
- [x] Unsigned query language is not trusted for share/verification.
- [x] Existing callback IDs remain unchanged.
- [x] Payment payload/currency/amount logic is unchanged.
- [x] OAuth scopes and API versions are unchanged.
- [x] OAuth access-token persistence remains none.
- [x] Publisher claim/replay/idempotency logic is unchanged.
- [x] AI/news preset/draft language contract is preserved.
- [x] User-provided content is not translated.
- [x] No migration 038 or new ENV was added.

## Regression inventory

- [x] Exact STEP064B4B baseline inventory executed.
- [x] STEP064B4C candidate inventory executed.
- [x] Baseline: 101 PASS / 5 NON_PASS / 106.
- [x] Candidate: 102 PASS / 5 NON_PASS / 107.
- [x] Baseline PASS regressions: 0.
- [x] New STEP064B4C smoke: PASS.
- [x] Five inherited NON_PASS remain explicitly documented.

## Artifact QA

- [x] PATCH ZIP built and integrity-checked.
- [x] FULL ZIP built and integrity-checked.
- [x] Unsafe ZIP paths = 0.
- [x] FULL extraction source/focused QA passed.
- [x] PATCH overlay source/focused QA passed.
- [x] PATCH overlay and FULL are hash-identical.

## Production — not yet verified

- [ ] `/api/health` reports STEP064B4C and Node 20.x.
- [ ] EN/RU contact, DM, and Pro payment matrix completed.
- [ ] Recipient-language notifications completed.
- [ ] Retry-language snapshot completed.
- [ ] Four-way interface/post profile-share matrix completed.
- [ ] OAuth connect/cancel/error/success/transfer matrix completed.
- [ ] Replayed callback creates no duplicate LinkedIn post.
- [ ] Production acceptance recorded.
