# STEP063B-H1R1 — Migration 035 Ordering & Search Claim Recovery

## Goal
Prevent partial migration 035 states and guarantee exact allowance recovery after any unexpected failure that occurs after a committed search claim.

## Invariants
- Legacy constraints are dropped before legacy values are rewritten.
- Migration 035 executes atomically.
- Migration 036 repairs the known partial state and is idempotent.
- Audience readiness requires columns and exact constraints, not columns alone.
- Any post-claim internal failure attempts an exact `last_search_started_at` match before decrementing allowance.
- A newer claim is never modified.
- Diagnostics identify the failing phase without exposing secrets.
- STEP059 publishing remains unchanged.
