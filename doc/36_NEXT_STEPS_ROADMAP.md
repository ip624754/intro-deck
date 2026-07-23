# 36_NEXT_STEPS_ROADMAP

## Current corridor after STEP063B-H1

STEP063B-H1 is source-implemented and QA passed. The next action is bounded Telegram runtime acceptance.

Required sequence:

1. Deploy the exact STEP063B-H1 artifact with the existing browse-only ENV.
2. Verify `/api/health` exposes the persistent search UX policy and `automaticPublishing=false`.
3. Run one successful search and confirm the same visible progress message becomes the result list.
4. Repeatedly press the progress callback and confirm no duplicate provider execution starts.
5. Safely reproduce one provider-total failure when possible and confirm a persistent failure card plus exact allowance restoration.
6. Confirm browse-only creates zero draft rows.
7. Roll back to exact STEP063B FULL on message-targeting, allowance, duplicate-callback, latency, or UX regression.

Do not expand provider scope or publishing behavior before this runtime acceptance is closed.

---

## Current corridor after STEP063B

STEP063B is source-implemented and focused-QA passed. The next action is bounded migration/deployment acceptance, not expansion of providers or autonomous publishing.

Required sequence:

1. Apply migration 035 and verify the expanded preference/preset constraints.
2. Deploy the exact STEP063B artifact in browse-only mode.
3. Verify `/api/health` reports the audience discovery policy and `automaticPublishing=false`.
4. Exercise `For you`, one explicit topic, Audience, and Angle.
5. Save/reload one personalized preset and inspect the PostgreSQL row.
6. Run one source search and inspect topic/profile/audience/angle score metadata.
7. Confirm the browse-only test window creates zero draft rows.
8. Roll back to the exact H1A FULL artifact on migration, privacy, relevance, persistence, latency, or UX regression.

Do not add private LinkedIn activity ingestion, feed scraping, autonomous publication, or another source provider before STEP063B production evidence is closed.

---

## Current corridor after STEP063A-H1A

STEP063A-H1A is source-implemented and focused-QA passed. The next action is bounded production acceptance, not another provider or generator expansion.

Required sequence:

1. Deploy the exact H1A artifact with the existing browse-only ENV.
2. Verify `/api/health` reports `STEP063A-H1A` and the source-quality policy.
3. Run one Crypto search and confirm unrelated/promotional fallback candidates do not fill the list.
4. Inspect RSS error codes and HN/GitHub no-result diagnostics in provider telemetry.
5. Confirm browse-only creates zero draft rows.
6. Confirm rolling search allowance/reset and final-search keyboard behavior.
7. Roll back to the exact H1 FULL artifact on relevance, latency, telemetry, or UX regression.

Do not add arXiv, RSSHub, scraping, or autonomous publication before H1A production evidence is closed.

---

## Current corridor after STEP063A-H1

STEP063A-H1 is source-implemented and focused-QA passed. Production acceptance is still required.

Required sequence:

1. Deploy `AI_NEWS_GENERATOR_MODE=off` and verify browse-only search/open with zero new draft rows.
2. Apply migration 034 and verify both generator-provider constraints.
3. Run one `template` draft as the zero-external-provider acceptance path.
4. Optionally run one bounded Groq draft with a server-side key and inspect provider telemetry.
5. Edit and explicitly authorize exactly one LinkedIn post only after the draft path passes.
6. Return to browse-only on any provider, schema, quality, latency, or audit regression.

Do not add another generator or autonomous publication before H1 production evidence is closed.

---

## Historical roadmap
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
