# STEP060 — AI/News Drafts Approval Foundation

## Status

Source implementation target on top of STEP059.

## Objective

Allow an eligible Intro Deck member to select a fresh news source, generate an evidence-bound LinkedIn draft, review or replace the exact text, and publish it only through the existing STEP059 one-shot LinkedIn authorization and receipt core.

## Product contract

1. No news item or AI draft is ever published automatically.
2. Every generated draft is bound to one normalized source URL and one immutable evidence snapshot.
3. Source content is treated as untrusted data; provider text cannot instruct or reconfigure the AI.
4. The member sees the source, exact post text, visibility, and approval boundary before LinkedIn authorization.
5. The member may replace the entire post text or cancel the draft.
6. A subscription or operator entitlement grants only feature access and bounded allowance; it never grants publication authority.
7. One explicit approval creates at most one canonical STEP059 LinkedIn share intent.
8. Duplicate callbacks, stale drafts, repeated source use, and uncertain provider outcomes cannot create an automatic retry or a second post.
9. Unsupported numerical claims and quotations are rejected before approval.
10. OpenAI request storage is disabled and external-provider secrets are not persisted in draft evidence.
11. STEP059 remains the only LinkedIn publishing engine and provider receipt state machine.
12. Media generation/upload, scheduling, unattended agents, organization posts, and background publishing are excluded.

## User flow

```text
/news
  → choose preset or custom topic
  → choose post language and tone
  → search fresh NewsData.io sources
  → choose one source
  → save source evidence snapshot
  → generate structured OpenAI draft
  → exact preview
      → edit complete text
      → cancel
      → approve
  → STEP059 one-shot LinkedIn OAuth
  → one provider post or a fail-closed/unknown receipt
```

## Access modes

```text
off       feature disabled
operator  Intro Deck operators only
pro       operators plus active Pro members
```

The rollout starts in `operator` mode. Broad Pro exposure requires accepted provider/runtime evidence and explicit operator action.

## Source evidence

The source snapshot contains only bounded fields:

- normalized public source URL;
- source title/name/domain;
- publication timestamp;
- short description;
- bounded content excerpt;
- query snapshot;
- evidence hash and fetch timestamp.

URL normalization removes fragments and common tracking parameters. Credential-bearing URLs, localhost, link-local, and private-network hosts are rejected.

The source snapshot is not treated as a command. Prompt-injection text in an article must remain inert quoted data.

## AI contract

The OpenAI Responses API call uses:

- a configured model;
- `store: false`;
- strict JSON Schema output;
- bounded output tokens;
- no external tools or browsing;
- only the stored source evidence plus a minimized member-profile context.

Structured output:

```json
{
  "post_text": "...",
  "evidence_claims": [
    {
      "claim": "...",
      "supporting_text": "exact source substring"
    }
  ],
  "interpretation_disclosure": "..."
}
```

The generated post must:

- include the exact normalized source URL;
- contain 80–3000 characters at persistence level;
- use no unsupported numeric claims;
- use no unsupported quotation;
- separate source facts from the member perspective;
- avoid invented sources, endorsements, or insider access.

## Editing contract

A member edit replaces the full post text. It is validated again against:

- exact source link;
- source/profile numeric evidence;
- quotation evidence;
- length constraints.

After an edit, AI evidence-claim annotations are cleared because they no longer prove the user-edited wording. The source snapshot remains attached.

## State machines

### News source

```text
provider result
  → normalized source snapshot
  → available until source-selection expiry
```

### Draft

```text
generating
  → draft
      → editing → draft
      → share_ready
      → cancelled
      → expired
  → failed

share_ready
  → published
  → unknown
  → draft        (explicit share cancellation/expiry before provider side effect)
```

`unknown` blocks a new draft/share until evidence-based reconciliation.

### LinkedIn share

STEP060 does not introduce a second publishing state machine. Approval creates a source-bound STEP059 `linkedin_share_intent` and all provider-side effects, claims, receipts, failure/unknown semantics, and duplicate protection remain canonical STEP059 behavior.

## Persistence

Migration `030_ai_news_drafts_approval.sql` adds:

- `ai_news_preferences`;
- `ai_news_sources`;
- `ai_news_drafts`;
- `ai_news_draft_events`;
- `ai_news_input_sessions`;
- source binding columns on `linkedin_share_intents`.

Important constraints:

- one unresolved AI/news draft per user;
- one active/published draft per user/source snapshot;
- one active AI/news LinkedIn share intent per draft;
- bounded source and post fields;
- explicit status constraints;
- no provider key or OAuth-token columns.

## Limits and incentives

Default rolling controls:

- 3 draft attempts per 24 hours;
- 10 news searches per 24 hours;
- 60-second search cooldown;
- source age no more than 48 hours;
- maximum 5 candidate sources per search;
- one unresolved draft per member.

Failed and cancelled generation attempts still consume the draft allowance. This prevents repeated provider-cost abuse through deliberate cancellation or invalid-generation loops.

## Security and abuse invariants

- NewsData and OpenAI configuration is optional and fail-safe.
- Provider configuration errors do not break health, webhook, base OIDC, or STEP059 sharing.
- Source URL credentials and private hosts are rejected.
- Article text is treated as untrusted prompt data.
- The AI receives no API keys or LinkedIn tokens in the input.
- Search claims are atomically rate-limited.
- Draft creation is serialized by user advisory lock.
- Approval uses deterministic lock order: AI/news user lock, then canonical LinkedIn share user lock.
- Draft validation, source-bound share creation, and draft attachment commit atomically.
- Duplicate article use is blocked by normalized source hash and draft constraints.
- An existing `share_ready` or `unknown` draft blocks a second approval.
- External-provider unknown outcomes are never automatically retried.
- Audit event names distinguish profile shares from AI/news shares.

## Operator diagnostics

Operator diagnostics expose only safe configuration state:

- rollout mode;
- valid/invalid configuration;
- NewsData configured/not configured;
- OpenAI model name;
- automatic publishing disabled;
- safe configuration error code.

Provider keys and raw provider payloads are not shown.

## Acceptance criteria

- `/news` is hidden when the feature is disabled or the member is ineligible.
- Help does not advertise AI/news drafting to ineligible members.
- Operator mode allows only configured Intro Deck operators.
- Pro mode allows operators or active Pro members.
- Search cooldown and daily limits are atomic.
- Only fresh normalized public source URLs are selectable.
- Strict-schema AI output is validated before persistence.
- Prompt-injection text from source evidence is treated as data, not instruction.
- Exact preview and full replacement edit work before approval.
- Approval creates exactly one source-bound STEP059 share intent.
- Duplicate approval cannot create a second intent/provider post.
- Unknown share outcomes remain blocked from retry.
- Health remains HTTP 200 on invalid optional provider configuration.
- Public/legal copy states that nothing is posted automatically.
- No new inherited smoke failure is introduced.
