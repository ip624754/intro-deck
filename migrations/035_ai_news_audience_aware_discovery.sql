-- STEP063B: LinkedIn audience-aware topic discovery and personalized presets.
-- Additive and idempotent. It changes discovery/editorial context only; publishing remains explicit.

DO $$
BEGIN
  IF to_regclass('ai_news_preferences') IS NULL
     OR to_regclass('ai_news_presets') IS NULL
     OR to_regclass('ai_news_input_sessions') IS NULL THEN
    RAISE EXCEPTION 'STEP063B migration 035 requires migrations 030 and 031';
  END IF;
END $$;

ALTER TABLE ai_news_preferences
  ADD COLUMN IF NOT EXISTS audience_key text NOT NULL DEFAULT 'professional_network',
  ADD COLUMN IF NOT EXISTS custom_audience text,
  ADD COLUMN IF NOT EXISTS angle_key text NOT NULL DEFAULT 'expert_take',
  ADD COLUMN IF NOT EXISTS profile_affinity_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE ai_news_presets
  ADD COLUMN IF NOT EXISTS audience_key text NOT NULL DEFAULT 'professional_network',
  ADD COLUMN IF NOT EXISTS custom_audience text,
  ADD COLUMN IF NOT EXISTS angle_key text NOT NULL DEFAULT 'expert_take',
  ADD COLUMN IF NOT EXISTS profile_affinity_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE ai_news_preferences ALTER COLUMN preset_key SET DEFAULT 'for_you';
ALTER TABLE ai_news_presets ALTER COLUMN preset_key SET DEFAULT 'for_you';

UPDATE ai_news_preferences SET preset_key='business_markets' WHERE preset_key='business_growth';
UPDATE ai_news_presets SET preset_key='business_markets' WHERE preset_key='business_growth';

ALTER TABLE ai_news_preferences
  DROP CONSTRAINT IF EXISTS ai_news_preferences_preset_key_check,
  DROP CONSTRAINT IF EXISTS ai_news_preferences_audience_key_check,
  DROP CONSTRAINT IF EXISTS ai_news_preferences_custom_audience_check,
  DROP CONSTRAINT IF EXISTS ai_news_preferences_angle_key_check;

ALTER TABLE ai_news_preferences
  ADD CONSTRAINT ai_news_preferences_preset_key_check
    CHECK (preset_key IN ('for_you','ai_technology','startups_product','business_markets','career_leadership','crypto_web3','custom')),
  ADD CONSTRAINT ai_news_preferences_audience_key_check
    CHECK (audience_key IN ('professional_network','founders_executives','product_engineering','sales_marketing','investors_finance','recruiters_talent','custom')),
  ADD CONSTRAINT ai_news_preferences_custom_audience_check
    CHECK ((audience_key='custom' AND custom_audience IS NOT NULL AND char_length(custom_audience) BETWEEN 2 AND 120)
      OR (audience_key<>'custom' AND custom_audience IS NULL)),
  ADD CONSTRAINT ai_news_preferences_angle_key_check
    CHECK (angle_key IN ('expert_take','practical_lessons','founder_perspective','explain_simply','contrarian_opinion','industry_impact','career_implications'));

ALTER TABLE ai_news_presets
  DROP CONSTRAINT IF EXISTS ai_news_presets_preset_key_check,
  DROP CONSTRAINT IF EXISTS ai_news_presets_audience_key_check,
  DROP CONSTRAINT IF EXISTS ai_news_presets_custom_audience_check,
  DROP CONSTRAINT IF EXISTS ai_news_presets_angle_key_check;

ALTER TABLE ai_news_presets
  ADD CONSTRAINT ai_news_presets_preset_key_check
    CHECK (preset_key IN ('for_you','ai_technology','startups_product','business_markets','career_leadership','crypto_web3','custom')),
  ADD CONSTRAINT ai_news_presets_audience_key_check
    CHECK (audience_key IN ('professional_network','founders_executives','product_engineering','sales_marketing','investors_finance','recruiters_talent','custom')),
  ADD CONSTRAINT ai_news_presets_custom_audience_check
    CHECK ((audience_key='custom' AND custom_audience IS NOT NULL AND char_length(custom_audience) BETWEEN 2 AND 120)
      OR (audience_key<>'custom' AND custom_audience IS NULL)),
  ADD CONSTRAINT ai_news_presets_angle_key_check
    CHECK (angle_key IN ('expert_take','practical_lessons','founder_perspective','explain_simply','contrarian_opinion','industry_impact','career_implications'));

ALTER TABLE ai_news_input_sessions
  DROP CONSTRAINT IF EXISTS ai_news_input_sessions_input_kind_check;

ALTER TABLE ai_news_input_sessions
  ADD CONSTRAINT ai_news_input_sessions_input_kind_check
    CHECK (input_kind IN ('topic_query','audience_query','edit_draft'));

ALTER TABLE ai_news_input_sessions
  DROP CONSTRAINT IF EXISTS ai_news_input_sessions_input_kind_draft_id_check;

ALTER TABLE ai_news_input_sessions
  ADD CONSTRAINT ai_news_input_sessions_input_kind_draft_id_check
    CHECK (((input_kind IN ('topic_query','audience_query')) AND draft_id IS NULL)
      OR (input_kind='edit_draft' AND draft_id IS NOT NULL));
