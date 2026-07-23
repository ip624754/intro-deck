# 36_NEXT_STEPS_ROADMAP

## Current corridor after STEP063A

STEP063A is source-implemented but not production-accepted. The next move is operational acceptance, not another provider expansion.

Required sequence:

1. Run canonical Node 20 install/check/focused and inherited AI/news regression smokes.
2. Apply migration 033 and verify all five source-quality columns plus provider constraints.
3. Deploy with `AI_NEWS_SOURCE_MODE=newsdata_only`; verify STEP063A health.
4. Switch to operator-only `multi_source` using the bounded ENV profile.
5. Verify provider mix, duplicate removal, isolated failure telemetry, and NewsData fallback behavior.
6. Complete one source → draft → edit → explicit approval → exactly-one LinkedIn receipt loop.
7. Return to `newsdata_only` on any schema, latency, provider-quality, or UX regression.

Do not add arXiv, RSSHub, arbitrary feeds, scraping, or autonomous publication before this acceptance is closed.

---

## Current corridor after STEP043.2

The project now has:
- user-facing member flow
- operator/admin control plane
- communications controls
- analytics drilldowns
- safe bulk-action prep
- launch/operator runbook
- freeze policy
- explicit live-verification / rehearsal guidance

## STEP043.2 — completed in source

Result:
- System hub now exposes read-only `Live verification` and `Репетиция запуска` guidance
- docs canon contains the verification playbook, rehearsal checklist, and go/no-go template
- scope remains intentionally frozen until a manual verification pass is executed

## Next move

**Execute the manual STEP043.2 pass on the deployed baseline**

Required manual outputs:
- `/api/health` and `/api/health?full=1` readout
- Telegram founder/operator shell verification
- LinkedIn connect/callback verification
- direct message / notice / broadcast rehearsal result
- honest go / no-go note

## Do not do next

Do not open new feature scope before the manual verification readout exists.
Premium gating, advanced ranking, or broader admin expansion stay blocked until that pass is written down.
