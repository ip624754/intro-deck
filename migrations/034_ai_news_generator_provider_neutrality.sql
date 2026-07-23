-- STEP063A-H1: provider-neutral AI/news draft generation.
-- Additive and idempotent. Existing OpenAI rows remain valid.

DO $$
BEGIN
  IF to_regclass('ai_news_drafts') IS NULL
     OR to_regclass('ai_news_provider_usage_events') IS NULL THEN
    RAISE EXCEPTION 'STEP063A-H1 migration 034 requires migrations 030 and 032';
  END IF;
END $$;

ALTER TABLE ai_news_drafts
  DROP CONSTRAINT IF EXISTS ai_news_drafts_model_provider_check;

ALTER TABLE ai_news_drafts
  ADD CONSTRAINT ai_news_drafts_model_provider_check
    CHECK (model_provider IS NULL OR model_provider IN ('openai', 'groq', 'template'));

ALTER TABLE ai_news_provider_usage_events
  DROP CONSTRAINT IF EXISTS ai_news_provider_usage_events_provider_check;

ALTER TABLE ai_news_provider_usage_events
  ADD CONSTRAINT ai_news_provider_usage_events_provider_check
    CHECK (provider IN (
      'newsdata', 'rss', 'hacker_news', 'github_releases',
      'openai', 'groq', 'template'
    ));
