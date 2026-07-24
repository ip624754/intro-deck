# STEP064B4A QA Checklist

## Source and syntax

- [x] Candidate is based on exact STEP064B3 FULL SHA-256.
- [x] `npm run check` passes.
- [x] New language modules are included in syntax checks.
- [x] Existing callback IDs remain unchanged.
- [x] No publisher, payment, entitlement, reward, or AI/news state-machine change.

## Persistence contract

- [x] Migration 037 is additive and transactional.
- [x] Both user language columns default to `en`.
- [x] Both columns are constrained to `en | ru`.
- [x] Existing users preserve English behavior.
- [x] New-user Telegram locale seed is first-insert-only.
- [x] Missing schema blocks preference writes and falls back to English reads.
- [ ] Migration applied to production Neon.
- [ ] Production columns and constraints queried directly.

## Language independence

- [x] Interface update targets only `interface_language`.
- [x] Post-language update targets only `default_post_language`.
- [x] Existing AI/news preset `post_language` remains unchanged.
- [x] Language settings expose four independent EN/RU callbacks.

## Initial localized slice

- [x] Home EN/RU source contract.
- [x] Profile root EN/RU source contract.
- [x] Profile preview EN/RU source contract.
- [x] Help EN/RU source contract.
- [x] Language settings EN/RU source contract.
- [ ] Live Telegram visual acceptance.

## Regression inventory

- [x] Baseline: 99/104 PASS.
- [x] Candidate: 100/105 PASS.
- [x] Baseline PASS regressions: 0.
- [x] Five inherited NON_PASS documented.
- [ ] Dependency-backed Node 20 suite.

## Production

- [ ] Apply migration 037.
- [ ] Deploy exact STEP064B4A artifact.
- [ ] `/api/health`: `step=STEP064B4A` and `docsStep=STEP064B4A`.
- [ ] Verify `interfaceLanguagePolicy` and `postLanguagePolicy`.
- [ ] Verify existing user defaults EN.
- [ ] Verify new Russian-locale user seeds RU/RU.
- [ ] Verify RU interface + EN post preference persists independently.
- [ ] Verify EN interface + RU post preference persists independently.
- [ ] Rollback drill or documented readiness.
