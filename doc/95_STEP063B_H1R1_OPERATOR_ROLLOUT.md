# STEP063B-H1R1 — Operator Rollout

1. Apply the PATCH only to the exact STEP063B-H1 baseline.
2. Apply `migrations/036_ai_news_audience_contract_repair.sql` in Neon. It is idempotent and safe on the manually repaired production schema.
3. Redeploy with the existing browse-only ENV.
4. Confirm `/api/health` reports `STEP063B-H1R1`, migration 036, exact-claim recovery, and phase-tagged diagnostics.
5. Run one normal search. Confirm results and `new_drafts=0`.
6. Failure-path acceptance remains NOT VERIFIED until a controlled post-claim failure proves allowance restoration.

Rollback: deploy the exact STEP063B-H1 FULL artifact. Migration 036 may remain because it only restores the intended 035 contract.
