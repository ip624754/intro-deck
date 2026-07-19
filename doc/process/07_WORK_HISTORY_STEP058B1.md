# Work History — STEP058B1

- Confirmed live STEP058B `/verificationReport` HTTP 400 after correct Development scope `r_verify`.
- Confirmed a separate production incident where malformed optional verification ENV crashed `/api/health`.
- Added non-fatal optional verification configuration parsing.
- Added HTTP 400-only no-criteria compatibility retry for `/verificationReport`.
- Added safe request ID and request-strategy diagnostics.
- Preserved fail-closed trust and public-badge gates.
- Removed concurrent queries on one PostgreSQL client in the OAuth invite-activation path.
- Added a dedicated STEP058B1 smoke contract.
- Kept migration, payment, contact, DM, entitlement, and badge activation surfaces unchanged.
