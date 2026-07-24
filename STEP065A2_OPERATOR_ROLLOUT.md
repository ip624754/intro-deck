# STEP065A2 Operator Rollout

## Prerequisite
- migration 038 is applied and immutable trigger is enabled
- STEP065A1 `ls_` links are resolving

## Deploy
Deploy STEP065A2 FULL or apply PATCH only to the exact STEP065A1 baseline.

No migration and no ENV changes are required.

## Health checks
Confirm:
- `step = STEP065A2`
- `docsStep = STEP065A2`
- `linkedInShareAttributionPolicy.dashboardIncluded = true`
- `linkedInShareConversionDashboardPolicy.enabled = true`
- `visitorIdentityVisibleToOwner = false`
- `visitorIdentityVisibleToAdmin = false`
- `analyticsFailureBlocksProductAction = false`

## Owner acceptance
1. Open Profile preview.
2. Open LinkedIn performance.
3. Verify totals and 7-day metrics.
4. Open one post drilldown.
5. Confirm no visitor identity or internal ID is shown.

## Admin acceptance
1. Open Admin → Operations.
2. Open LinkedIn publications.
3. Compare totals with SQL ledger aggregates.
4. Confirm dashboard is read-only.
