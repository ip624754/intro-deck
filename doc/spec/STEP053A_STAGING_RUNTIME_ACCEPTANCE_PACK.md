# STEP053A — Staging Runtime Acceptance Pack

## Objective

Turn STEP053 from source-only evidence into a reproducible staging acceptance gate without claiming that unattended scripts can prove a real Telegram Stars purchase.

## Mode

HEAVY. The pack touches payment evidence, PostgreSQL migrations, advisory locks, callback concurrency, charge replay, and rollout claims.

## Acceptance architecture

### Phase 1 — Read-only preflight

`npm run step053a:preflight`

The preflight fails closed unless:

- Node.js is 20.x;
- `STEP053A_TARGET=staging`;
- `STEP053A_ARTIFACT_SHA` is a valid 40- or 64-character SHA and matches deployed health;
- PostgreSQL is reachable and writable;
- migrations through `027` are observable from schema evidence;
- required indexes and columns exist;
- charge history contains no ambiguous cross-entity ownership;
- impossible payment states are absent;
- transaction advisory locks work;
- Telegram `getMe` and webhook information are healthy;
- deployed `/api/health?full=1` responds successfully.

It prints the database fingerprint required by the mutating phase. Passwords and tokens are never written to evidence.

### Phase 2 — Isolated PostgreSQL runtime scenarios

`npm run step053a:database`

Mutation is blocked unless all three values are exact:

```env
STEP053A_TARGET=staging
STEP053A_MUTATION_ACK=ALLOW_STEP053A_STAGING_FIXTURES
STEP053A_DATABASE_ACK=<fingerprint from preflight>
```

The runner creates isolated fixture users, executes canonical repository transitions, then deletes all fixtures in `finally`.

Automated scenarios:

1. intro-only rejects both paid rails;
2. wrong Stars currency and amount are rejected;
3. concurrent pre-checkout callbacks serialize to one authorization;
4. paid contact transition and canonical receipt occur once;
5. duplicate decline is idempotent;
6. decline cooldown closes the other paid rail;
7. DM block closes direct contact;
8. entity-level unique constraints and canonical receipts preserve charge ownership;
9. combined Pro contact/DM allowance stops at the configured limit under concurrent limit/N+1 delivery;
10. contact, DM, and receipt audit evidence exists;
11. all fixtures are removed.

### Phase 3 — Telegram / operator-assisted evidence

A real Stars purchase, duplicate Telegram update delivery, and the exact visible UX require Telegram clients and cannot be honestly replaced by source mocks.

```bash
npm run step053a:evidence:init -- runtime_evidence/step053a/manual-evidence.json
npm run step053a:evidence:verify -- runtime_evidence/step053a/manual-evidence.json
```

The verifier requires all 13 runtime scenarios to be `PASS`, proof references for each scenario, Node 20, hashes of both automated evidence files, matching database fingerprints, the same artifact SHA in all evidence phases, and an explicit operator `GO` verdict.

## Safety invariants

- No production target mode exists.
- Mutating tests require an exact database fingerprint ACK.
- Fixtures use a unique run marker, exact-prefix matching (not SQL `LIKE` wildcards), and cascade cleanup.
- Cleanup failure makes the run fail.
- Evidence is target- and artifact-specific; preflight, database runtime, deployed health, and the manual manifest must share the same artifact SHA.
- Missing Telegram proof is `BLOCKED`, never silently converted to `PASS`.
- Refund/dispute operations remain outside this STEP.

## Non-goals

- no production deployment;
- no migration execution automation;
- no real Stars charge automation;
- no refund engine;
- no replacement of canonical contact, DM, receipt, or subscription services;
- no broad product or admin redesign.
