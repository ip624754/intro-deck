# STEP064B4B QA Checklist

## Source and focused QA

- [x] `npm run check`
- [x] `npm run smoke:member-language-rendering`
- [x] B4A language foundation smoke
- [x] member/transaction/admin copy smokes
- [x] directory/filter/intro/contact/DM/invite focused smokes
- [x] AI/news audience and progress smokes

## Regression inventory

- [x] Exact B4A baseline inventory executed
- [x] B4B candidate inventory executed
- [x] Baseline PASS regressions = 0
- [x] Five inherited NON_PASS retained honestly
- [x] New B4B smoke PASS

## Contract checks

- [x] Persisted language loaded once per Telegram update
- [x] English fallback preserved
- [x] Callback IDs unchanged
- [x] URLs unchanged
- [x] switch-inline payloads unchanged
- [x] Member-provided content not translated
- [x] Admin localization boundary independent
- [x] Payments/OAuth/publisher unchanged
- [x] Public invite card declared deferred

## Production

- [ ] Deploy exact B4B artifact
- [ ] Verify STEP064B4B health markers on Node 20
- [ ] English member walkthrough
- [ ] Russian member walkthrough
- [ ] Callback/state side-effect regression pass
- [ ] Record `PRODUCTION_ACCEPT_STEP064B4B`
