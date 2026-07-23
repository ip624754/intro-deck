# STEP063A QA checklist

## Verified

- [x] Baseline SHA-256 verified.
- [x] Baseline ZIP integrity verified.
- [x] `npm run check` passed on Node 22.16.0.
- [x] `npm run smoke:ai-news-multi-source` passed on Node 22.16.0.
- [x] Provider egress is HTTPS + exact-host allowlisted.
- [x] Provider response sizes, total header+body deadlines, and fan-out are bounded.
- [x] Canonical URL duplicate and direct-source preference contracts passed.
- [x] One-provider failure isolation contract passed.
- [x] Stalled/oversized provider bodies fail closed.
- [x] HN query matching avoids substring false positives.
- [x] NewsData fallback/skip contracts passed.
- [x] Multi-source requires migration 033.
- [x] STEP059 publishing store has no multi-source imports.
- [x] STEP060/061/061A and focused STEP058/059 compatibility contracts passed.
- [x] Changed-file secret scan found no newly introduced secret value.
- [x] Safe-off ENV profile included.

## Not verified

- [ ] Node 20 canonical QA.
- [ ] `npm ci` / full dependency-backed regression inventory.
- [ ] Migration 033 on Neon/PostgreSQL.
- [ ] Vercel build/deploy.
- [ ] Live provider requests and telemetry.
- [ ] Telegram operator acceptance.
- [ ] End-to-end explicit LinkedIn publication after multi-source selection.
