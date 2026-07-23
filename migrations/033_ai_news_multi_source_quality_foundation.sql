-- STEP063A: Multi-source AI/news ingestion and source-quality foundation.
-- Additive and idempotent. Existing NewsData-only rows remain valid.

DO $$
BEGIN
  IF to_regclass('ai_news_sources') IS NULL
     OR to_regclass('ai_news_provider_usage_events') IS NULL THEN
    RAISE EXCEPTION 'STEP063A migration 033 requires migrations 030 and 032';
  END IF;
END $$;

ALTER TABLE ai_news_sources
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'news_report',
  ADD COLUMN IF NOT EXISTS source_authority_score integer NOT NULL DEFAULT 65,
  ADD COLUMN IF NOT EXISTS source_is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trend_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_metadata_json jsonb;

ALTER TABLE ai_news_sources
  DROP CONSTRAINT IF EXISTS ai_news_sources_provider_check,
  DROP CONSTRAINT IF EXISTS ai_news_sources_source_kind_check,
  DROP CONSTRAINT IF EXISTS ai_news_sources_source_authority_score_check,
  DROP CONSTRAINT IF EXISTS ai_news_sources_trend_score_check;

ALTER TABLE ai_news_sources
  ADD CONSTRAINT ai_news_sources_provider_check
    CHECK (provider IN ('newsdata', 'rss', 'hacker_news', 'github_releases')),
  ADD CONSTRAINT ai_news_sources_source_kind_check
    CHECK (source_kind IN ('official_blog', 'official_release', 'news_report', 'community_signal')),
  ADD CONSTRAINT ai_news_sources_source_authority_score_check
    CHECK (source_authority_score BETWEEN 0 AND 100),
  ADD CONSTRAINT ai_news_sources_trend_score_check
    CHECK (trend_score BETWEEN 0 AND 1000000);

ALTER TABLE ai_news_provider_usage_events
  DROP CONSTRAINT IF EXISTS ai_news_provider_usage_events_provider_check,
  DROP CONSTRAINT IF EXISTS ai_news_provider_usage_events_operation_check;

ALTER TABLE ai_news_provider_usage_events
  ADD CONSTRAINT ai_news_provider_usage_events_provider_check
    CHECK (provider IN ('newsdata', 'rss', 'hacker_news', 'github_releases', 'openai')),
  ADD CONSTRAINT ai_news_provider_usage_events_operation_check
    CHECK (operation IN ('search_latest', 'discover_sources', 'generate_draft'));

CREATE INDEX IF NOT EXISTS idx_ai_news_sources_provider_quality
  ON ai_news_sources(provider, source_is_primary DESC, source_authority_score DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_news_sources_user_quality
  ON ai_news_sources(user_id, source_is_primary DESC, source_authority_score DESC, published_at DESC);
