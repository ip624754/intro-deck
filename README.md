# STEP063B-H2 ENV Profiles

No new environment variables are introduced.

- `STEP063B_H2_BROWSE_ONLY_PRODUCTION.env` preserves bounded multi-source browsing with generation and scheduling disabled.
- `STEP063B_H2_SAFE_OFF_PRODUCTION.env` disables the AI/news surface and scheduler.
- Migration 036 from STEP063B-H1R1 remains the required database baseline; STEP063B-H2 adds no migration.

Update only changed Vercel Production keys and redeploy.
