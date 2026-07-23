# STEP063A-H1 QA Checklist

## Source and syntax

- [x] Package/source markers updated to `0.63.1` / `STEP063A-H1`.
- [x] `npm run check` passes.
- [x] OpenAI and Groq share one evidence/prompt/validation contract.
- [x] LinkedIn publisher does not import generator adapters.
- [x] No real secrets are present in changed files.

## Browse-only

- [x] Generator `off` requires no OpenAI or Groq key.
- [x] `/news` remains eligible and source search remains available.
- [x] Source candidate keyboard contains original URLs and no draft callback.
- [x] Draft daily allowance is not consumed by browsing.
- [x] Preset Run now fails before creating a run.
- [x] Effective scheduler mode is forced to `off`.

## Template

- [x] No network call or API key is required.
- [x] RU and EN drafts include the exact source URL.
- [x] Evidence claim supporting text is copied from the supplied evidence snapshot.
- [x] Provider/model values are `template` / `introdeck-template-v1`.
- [x] Token usage and estimated provider cost are zero.

## Groq

- [x] Egress hostname is restricted to `api.groq.com`.
- [x] Endpoint is `/openai/v1/chat/completions`.
- [x] Strict JSON schema is requested.
- [x] `store` is not sent.
- [x] Success usage maps prompt/completion/total token counters.
- [x] HTTP 401 is classified as a Groq provider failure.
- [x] Malformed JSON fails closed.
- [x] Oversized response fails closed.
- [x] Stalled response body respects the bounded deadline.

## Database and telemetry

- [x] Migration 034 is additive and keeps existing OpenAI rows valid.
- [x] Draft provider constraint supports `openai`, `groq`, and `template`.
- [x] Telemetry provider constraint supports all source and generator providers.
- [x] Schema compatibility detects migration 034 before Groq/template generation.
- [x] Diagnostics split OpenAI, Groq, and template calls/tokens.
- [ ] Migration 034 applied to production Neon.
- [ ] Production rows verified.

## Regression and runtime

- [x] STEP063A source-quality smoke passes.
- [x] STEP060/061/061A focused AI/news contracts pass.
- [x] STEP059 and LinkedIn verification compatibility contracts pass.
- [ ] Canonical Node 20 full dependency installation verified (`pg`/`grammy` unavailable in this container).
- [x] Full smoke inventory executed against baseline and candidate: 0 new regressions; 19 inherited non-PASS results remain explicitly recorded.
- [ ] Vercel production deployment verified.
- [ ] Live Groq request verified.
- [ ] Telegram and LinkedIn operator acceptance verified.
