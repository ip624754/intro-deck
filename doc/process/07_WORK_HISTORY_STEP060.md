# STEP060 Work History

## Scope

Implemented an operator-first AI/news drafting foundation with source evidence, strict AI output, member review/edit, explicit approval, and canonical STEP059 LinkedIn publication.

## Key decisions

- STEP059 remains the only LinkedIn publishing engine;
- NewsData.io is a bounded source-discovery adapter, not a truth authority beyond the saved article evidence;
- OpenAI receives minimized evidence/profile context and uses `store=false` plus strict JSON Schema output;
- article content is treated as untrusted prompt data;
- the source URL and evidence snapshot are immutable for a draft;
- member edits replace the full post text and are revalidated;
- AI claim annotations are cleared after member editing;
- access starts in operator mode;
- draft/search limits cover failed/cancelled attempts to prevent provider-cost abuse;
- duplicate article, duplicate approval, stale callback, and unknown provider outcomes fail closed;
- no media, scheduling, autonomous posting, organization posts, or background OAuth tokens are included.

## Files

See `IntroDeck_STEP060_CHANGED_FILES.txt` in the release artifact.

## Migration

`migrations/030_ai_news_drafts_approval.sql`

## Runtime rollout

See `doc/87_STEP060_OPERATOR_ROLLOUT.md`.
