# STEP060 — Operator Rollout

## Preconditions

- STEP059 is live and the canonical Share on LinkedIn flow is configured.
- Migration 029 is already applied.
- A Neon restore point or branch backup exists before migration 030.
- NewsData.io and OpenAI API keys are available as server-side secrets.
- Initial rollout will be operator-only.

## 1. Apply migration 030

In Neon SQL Editor, confirm the production branch/database and run:

```text
migrations/030_ai_news_drafts_approval.sql
```

The migration is additive and idempotent. It extends the existing LinkedIn share intent only with source binding; it does not replace the STEP059 publishing core.

## 2. Configure Vercel

Start with:

```env
AI_NEWS_DRAFT_MODE=operator
NEWSDATA_API_KEY=<secret>
NEWSDATA_BASE_URL=https://newsdata.io/api/1/
NEWSDATA_API_TIMEOUT_MS=8000
OPENAI_API_KEY=<secret>
OPENAI_BASE_URL=https://api.openai.com
OPENAI_DRAFT_MODEL=gpt-5.6-luna
OPENAI_API_TIMEOUT_MS=30000
AI_NEWS_DAILY_LIMIT=3
AI_NEWS_SEARCH_DAILY_LIMIT=10
AI_NEWS_SEARCH_COOLDOWN_SECONDS=60
AI_NEWS_MAX_SOURCE_AGE_HOURS=48
AI_NEWS_MAX_ARTICLES=5
AI_NEWS_SOURCE_SELECTION_TTL_SECONDS=1800
AI_NEWS_DRAFT_TTL_SECONDS=3600
```

Keep the existing STEP059 configuration unchanged. Do not place either provider key in client-side variables, Telegram messages, screenshots, logs, or evidence artifacts.

## 3. Deploy

Redeploy after ENV changes. Check:

```text
https://intro-deck.vercel.app/api/health?full=1
```

Expected minimum:

```json
{
  "ok": true,
  "step": "STEP060",
  "docsStep": "STEP060",
  "flags": {
    "aiNewsDraftConfigured": true,
    "linkedInShareConfigured": true
  },
  "aiNewsDraft": {
    "enabled": true,
    "mode": "operator",
    "configurationValid": true,
    "newsProvider": "newsdata",
    "newsProviderConfigured": true,
    "aiProvider": "openai",
    "aiProviderConfigured": true,
    "explicitApprovalRequired": true,
    "automaticPublishing": false,
    "sourceEvidenceRequired": true,
    "tokenPersistence": "none"
  }
}
```

## 4. Operator-only live test

Use an Intro Deck operator with:

- connected LinkedIn account;
- active/listed profile;
- STEP059 LinkedIn share eligibility.

Flow:

```text
/news
→ choose AI & Tech, Business, Crypto, or Custom topic
→ choose language/tone
→ Find fresh news
→ select one source
→ generate draft
→ inspect source URL and exact post text
→ edit complete text once
→ approve
→ authorize one LinkedIn post
```

Verify:

- `/news` is visible to the operator but not to a non-operator while mode is `operator`;
- candidate sources are current and contain public source URLs;
- the selected source and evidence snapshot are persisted before generation;
- the generated post includes the exact source URL;
- unsupported numbers/quotes are rejected;
- the user edit is revalidated;
- approval creates one STEP059 share intent;
- LinkedIn authorization creates at most one post;
- Telegram receives a canonical provider receipt;
- a repeated callback does not create a second post;
- no provider key or OAuth token appears in logs/database/evidence.

## 5. Negative-path checks

- Remove one provider key in a temporary Preview deployment: health must remain 200 and AI/news must be fail-safe disabled.
- Attempt a second immediate search: cooldown must block it before a second provider call.
- Attempt the same source again: duplicate-source protection must block a second active/published draft.
- Cancel a draft and confirm no LinkedIn share intent/post exists.
- Leave a share outcome `unknown`: no automatic retry or new draft may proceed until reconciliation.

Do not intentionally create an ambiguous provider outcome in production merely to test it. Use source-level evidence or a controlled Preview/provider stub for that path.

## 6. Rollout decision

Keep:

```env
AI_NEWS_DRAFT_MODE=operator
```

until all operator evidence is accepted.

Only then consider:

```env
AI_NEWS_DRAFT_MODE=pro
```

Pro mode controls eligibility/allowance only. It does not authorize publishing.

## 7. Immediate rollback

```env
AI_NEWS_DRAFT_MODE=off
```

Redeploy. This hides `/news` and the CTA without deleting source evidence, drafts, share receipts, or audit history.

Do not drop migration 030 during normal rollback.

## Truth boundary

- Source QA proves contracts, not provider availability or content quality.
- Health proves configuration, not successful NewsData/OpenAI/LinkedIn calls.
- Live acceptance requires one complete operator flow with exactly one LinkedIn post and duplicate protection evidence.
