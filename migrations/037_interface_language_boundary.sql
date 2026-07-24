-- STEP064B4A: persistent interface language and default LinkedIn post language.
-- Additive and idempotent. Existing users remain on the legacy English experience.

BEGIN;

DO $$
BEGIN
  IF to_regclass('users') IS NULL THEN
    RAISE EXCEPTION 'STEP064B4A migration 037 requires the users table';
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS interface_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS default_post_language text NOT NULL DEFAULT 'en';

UPDATE users
SET interface_language = 'en'
WHERE interface_language NOT IN ('en', 'ru') OR interface_language IS NULL;

UPDATE users
SET default_post_language = 'en'
WHERE default_post_language NOT IN ('en', 'ru') OR default_post_language IS NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_interface_language_check,
  DROP CONSTRAINT IF EXISTS users_default_post_language_check;

ALTER TABLE users
  ADD CONSTRAINT users_interface_language_check
    CHECK (interface_language IN ('en', 'ru')),
  ADD CONSTRAINT users_default_post_language_check
    CHECK (default_post_language IN ('en', 'ru'));

COMMENT ON COLUMN users.interface_language IS
  'Persistent Telegram member interface language. Seeded once from Telegram locale for new users; changed only by explicit member action.';
COMMENT ON COLUMN users.default_post_language IS
  'Persistent default language for ordinary LinkedIn profile-share posts. Independent from interface_language and AI/news preset post_language.';

COMMIT;
