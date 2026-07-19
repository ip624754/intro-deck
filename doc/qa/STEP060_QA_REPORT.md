# STEP060 QA Report — AI/News Drafts Approval Foundation

## Scope

STEP060 adds an operator-first evidence-bound AI/news drafting flow above the existing STEP059 LinkedIn publishing core. It does not add automatic posting, scheduling, media upload, organization posting, background OAuth tokens, or unattended subscription publishing.

## Baseline

- Parent source step: `STEP059`
- Parent package: `0.57.0`
- Parent full smoke: `76/89 PASS`, `13 FAIL`
- Target source step: `STEP060`
- Target package: `0.58.0`

## Canonical local environment

- Node.js: `20.20.2`
- npm: `10.9.2`

## Verified checks

| Check | Result |
|---|---|
| `npm ci --ignore-scripts` | PASS — 25 packages installed, 0 vulnerabilities reported during install |
| `npm run check` | PASS |
| `npm run smoke:ai-news-drafts` | PASS |
| STEP059 LinkedIn share compatibility | PASS |
| STEP058B1 verification compatibility | PASS |
| STEP058B trust-surface compatibility | PASS |
| STEP058A verification compatibility | PASS |
| Router / command / Help compatibility | PASS |
| Schema / storage compatibility | PASS |
| Operator diagnostics compatibility | PASS |
| Privacy / Terms contract | PASS |
| Landing contract | PASS |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |

## Full smoke inventory

| Snapshot | PASS | FAIL | Total |
|---|---:|---:|---:|
| STEP059 baseline | 76 | 13 | 89 |
| STEP060 | 77 | 13 | 90 |

- New passing contract: `smoke:ai-news-drafts`
- New failing contracts: `0`
- Resolved inherited failures: `0`
- Inherited failure set unchanged: `true`

Inherited failures:

- `smoke:env`
- `smoke:code-split`
- `smoke:profile-session-schema`
- `smoke:admin-allowlist`
- `smoke:admin-users`
- `smoke:admin-user-card`
- `smoke:admin-intros`
- `smoke:broadcast-idempotency`
- `smoke:admin-polish`
- `smoke:admin-productivity`
- `smoke:admin-search`
- `smoke:admin-russian-layer`
- `smoke:admin-runbook-freeze`

## Critical-path assertions

Source/contracts verify that:

- optional NewsData/OpenAI configuration fails safe and does not break health, webhook, base LinkedIn OIDC, or STEP059 sharing;
- feature eligibility is mode-gated and starts operator-only;
- search rate limits and cooldown are atomically claimed before external provider use;
- failed/cancelled generation attempts still consume the configured draft allowance;
- source URL normalization removes tracking fragments and rejects credentials/private-network hosts;
- source article fields are sanitized and treated as untrusted prompt data;
- OpenAI uses the Responses API with `store=false` and strict JSON Schema output;
- AI input contains minimized source/profile context and no provider/LinkedIn secrets;
- exact source URL, numeric claims, quotations, and evidence substrings are validated;
- member-edited text is revalidated and AI evidence-claim annotations are cleared;
- one unresolved draft and one active/published draft per user/source are enforced;
- deterministic advisory-lock order protects approval against duplicate concurrent share intents;
- approval creates a source-bound canonical STEP059 share intent in the same transaction;
- published/failed/unknown/cancelled/expired STEP059 outcomes update the AI/news draft without a second publisher;
- audit events distinguish AI/news shares from profile shares;
- provider-unknown outcomes remain non-retryable;
- Help and Home do not advertise AI/news drafting when the member is not eligible;
- operator diagnostics expose only safe provider configuration state;
- no automatic/background publishing path exists.

## Not verified

- Migration `030` on live Neon.
- Live NewsData.io query and quota behavior.
- Live OpenAI Responses API structured output.
- Actual quality and source-faithfulness of generated drafts across languages/topics.
- Live user edit and approval path in Telegram.
- One real AI/news LinkedIn post through STEP059.
- Live duplicate approval/callback behavior.
- Live provider timeout/unknown reconciliation.
- Pro-mode rollout and real allowance enforcement.

## Residual risks

1. News provider metadata and excerpts may be incomplete or inaccurate. Intro Deck preserves source evidence but does not independently verify the publisher's reporting.
2. Strict evidence validation reduces hallucination risk but cannot prove every semantic interpretation. The member remains responsible for the final approved post.
3. External API models/versions and commercial limits can change. Provider configuration remains explicit and fail-safe.
4. A provider-side LinkedIn outcome can be irreversible. The canonical STEP059 `unknown` state intentionally blocks automatic retry.
5. Text-only rollout is deliberate. Media generation/upload would add another multi-stage external state machine and requires a separate HEAVY STEP.

## Verdict

`SOURCE IMPLEMENTED / SOURCE VERIFIED`

Not `LIVE ACCEPTED` until migration 030, provider ENV, STEP060 deployment, and one operator source → draft → edit → explicit approval → exactly-one-post flow are verified.
