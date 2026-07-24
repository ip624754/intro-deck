# STEP064B1 — Operator Rollout

## Preconditions

- Deploy only over the exact STEP064A baseline.
- No database migration is required.
- No new environment variables are required.
- Keep the current browse-only/operator-acceptance AI/news profile unchanged.

## Health check

Expected:

- `step = STEP064B1`
- `docsStep = STEP064B1`
- `memberCopyPolicy.memberDiagnostics = user_safe_copy_only`
- `memberCopyPolicy.rawRuntimeStatesVisible = false`
- `memberCopyPolicy.callbackIdsChanged = false`
- `memberCopyPolicy.businessLogicChanged = false`

## Manual member acceptance

Open and inspect:

1. `/menu`
2. Profile
3. Profile preview
4. Directory list and one profile
5. Requests & chats
6. Story finder
7. Invite people
8. Pro
9. Help

Confirm:

- canonical titles and button labels are consistent;
- no member screen exposes migration numbers, raw database errors, rollout stages, provider diagnostics, or raw relevance scores;
- Home shows one concise next action;
- Directory distinguishes profiles from cards and contact options;
- Story finder keeps source and no-auto-publish truth without operator telemetry;
- LinkedIn share and OAuth failures use user-safe text;
- callback behavior, payments, invite attribution, and publishing remain unchanged.

## Rollback

Restore the exact STEP064A FULL artifact. No database rollback is required.
