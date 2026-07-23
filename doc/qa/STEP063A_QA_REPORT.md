# STEP063A — QA Report

## Scope

Multi-source ingestion, provider safety, deduplication, source-quality metadata, Telegram candidate UX, and operator diagnostics on top of STEP061A.

## Canonical baseline

- Artifact: `IntroDeck_STEP061A_FULL_2026-07-20.zip`
- SHA-256: `658d8fa38fd4340d4fd0bc82c3b7fca796a5a929b80930ffb1c0d9a07250c04e`
- ZIP integrity: PASS
- Target package: `0.63.0`
- Target source step: `STEP063A`

## Verified in this workspace

- `npm run check`: PASS on Node.js `22.16.0`.
- `npm run smoke:ai-news-multi-source`: PASS on Node.js `22.16.0`.
- Focused smoke covers:
  - URL canonicalization and tracking removal;
  - provider hostname allowlist rejection;
  - total header+body deadlines, stalled-body timeout, and oversized-body rejection;
  - bounded RSS parsing and article-host rejection;
  - cross-provider canonical URL deduplication;
  - primary/direct source preference;
  - NewsData fallback when the direct/free pool is short;
  - NewsData skip when the direct/free pool fills the candidate limit;
  - one-provider failure isolation;
  - bounded Hacker News matching without substring false positives (`AI` does not match `chair`);
  - free-source-only configuration without a NewsData key;
  - migration 033 provider/quality contract;
  - STEP059 publishing-store import isolation.
- Related regression contracts passed:
  - STEP060 AI/news drafts approval;
  - STEP061 presets/subscription productization;
  - STEP061A live-acceptance contract;
  - STEP058A/058B/058B1 LinkedIn verification compatibility;
  - STEP059 explicit share-profile approval.
- Source review confirms no changes to `src/lib/storage/linkedinShareStore.js` or the STEP059 provider path.
- Package and lockfile versions are synchronized at `0.63.0`.
- Changed-file secret scan found no newly introduced secret value; the only matches are inherited example/synthetic placeholders already present in STEP061A.

## Failed or environment-blocked checks

- Initial focused smoke assertion: FAILED because a thematic paraphrase was incorrectly treated as an expected high-confidence duplicate. The test was corrected to distinguish thematic similarity from a true duplicate; production threshold remained conservative. Final focused smoke: PASS.
- `npm ci --ignore-scripts`: BLOCKED/TIMED OUT in the provided container before dependencies were installed. The container runs Node 22 while the repository requires Node 20.x.
- `node scripts/smoke_step061_profile_preview_hotfix.js`: BLOCKED because `grammy` is unavailable after the dependency installation block; no application assertion executed.

## Not verified

- Canonical Node 20 execution.
- Full dependency-backed smoke inventory in this container.
- Migration 033 on PostgreSQL/Neon.
- Live RSS, Hacker News, GitHub, or NewsData provider calls from the deployed runtime.
- Production provider telemetry rows.
- Vercel deployment and `/api/health` for STEP063A.
- Telegram browser/operator acceptance for the new source candidate card.
- Real source → evidence → draft → edit → explicit LinkedIn approval loop after enabling multi-source.

## Safety review

- Provider fetch URLs are fixed or registry-derived and require exact allowlisted HTTPS hostnames.
- HTTP redirects are rejected instead of followed.
- Response size and total header+body deadline budgets are bounded per provider.
- RSS and GitHub registry breadth is bounded by ENV maxima.
- HN story scan count and batch concurrency are bounded.
- NewsData fallback is avoided when free/direct providers already fill the pool.
- Multi-source mode is blocked before migration 033.
- `newsdata_only` remains the default rollback-safe mode.
- No automatic publishing or OAuth-token persistence was added.

## Verdict

`SOURCE IMPLEMENTED / FOCUSED SOURCE QA PASSED / PRODUCTION NOT VERIFIED`.

Production acceptance requires migration 033, Node 20 build/deploy evidence, operator-only multi-source rollout, provider telemetry, and one manual end-to-end draft/publish verification.
