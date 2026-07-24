# STEP064B4A Operator Rollout

## Truth boundary before rollout

Source implementation and local focused QA are complete. Migration, deployment, live database behavior, and Telegram production acceptance are not yet verified.

## Prerequisites

- Exact STEP064B3 baseline or exact STEP064B4A FULL candidate.
- Production database backup/recovery access.
- Vercel production deployment access.
- One existing member account.
- One fresh Telegram account with Russian locale, or a controlled test account not already present in `users`.

## 1. Apply migration 037

Run the exact file:

```text
migrations/037_interface_language_boundary.sql
```

Expected: transaction completes without error.

## 2. Verify schema

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = current_schema()
  and table_name = 'users'
  and column_name in ('interface_language', 'default_post_language')
order by column_name;
```

Expected for both rows:

- `data_type = text`;
- `is_nullable = NO`;
- default contains `'en'`.

```sql
select c.conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = current_schema()
  and t.relname = 'users'
  and c.conname in (
    'users_interface_language_check',
    'users_default_post_language_check'
  )
order by c.conname;
```

Expected: both constraints exist and allow only `en` and `ru`.

## 3. Existing-user compatibility

```sql
select
  count(*) as total_users,
  count(*) filter (where interface_language = 'en') as interface_en,
  count(*) filter (where default_post_language = 'en') as post_en,
  count(*) filter (where interface_language not in ('en', 'ru')) as invalid_interface,
  count(*) filter (where default_post_language not in ('en', 'ru')) as invalid_post
from users;
```

Expected immediately after migration:

- invalid counts are zero;
- pre-existing users have deterministic English defaults unless modified after deployment.

## 4. Deploy

Deploy the exact STEP064B4A artifact. No ENV changes are required.

## 5. Verify health

Open `/api/health` and verify:

```text
ok = true
step = STEP064B4A
docsStep = STEP064B4A
runtime.node = 20.x
interfaceLanguagePolicy.supportedLanguages = [en, ru]
interfaceLanguagePolicy.schemaRequirement = migration_037
interfaceLanguagePolicy.telegramLocaleInference = first_seen_only
postLanguagePolicy.independentFromInterfaceLanguage = true
postLanguagePolicy.aiNewsPresetOverridePreserved = true
postLanguagePolicy.ordinaryProfileShareIntegration = deferred_to_step064b4c
```

## 6. Existing-member acceptance

Using an existing account:

1. Open `/language`.
2. Confirm the current interface and publication language are shown.
3. Select Russian interface and English publication language.
4. Navigate Home -> Profile -> Preview -> Help -> Language.
5. Confirm the initial B4A slice is Russian.
6. Return to Language and confirm publication language remains English.
7. Select English interface and Russian publication language.
8. Confirm Home/Profile/Help return to English while publication language remains Russian.

Direct database evidence:

```sql
select telegram_user_id, interface_language, default_post_language
from users
where telegram_user_id = <TEST_TELEGRAM_USER_ID>;
```

## 7. New-user seed acceptance

Using a Telegram account with Russian locale that is not yet in `users`:

1. Start the bot once.
2. Open `/language`.
3. Confirm both initial values are Russian.
4. Reopen the bot and confirm the values persist.
5. Explicitly change only publication language to English.
6. Confirm interface remains Russian.

This test must use a genuinely new `users` row. Changing Telegram locale on an existing row must not reseed preferences.

## 8. Regression guard

Verify:

- Admin remains Russian with bounded English raw codes.
- Existing AI/news saved preset language is unchanged.
- LinkedIn profile-share text is still the legacy English rendering in B4A; default post language integration is intentionally deferred to B4C.
- Payments, consent, OAuth, notification, rewards, and publisher behavior are unchanged.

## Acceptance token

After all checks pass, record:

```text
PRODUCTION_ACCEPT_STEP064B4A
```

Attach health JSON, schema query output, and the four preference combinations.

## Rollback

On runtime regression:

1. deploy exact STEP064B3;
2. keep migration 037 in place;
3. do not drop the additive columns during incident response;
4. confirm `/api/health` returns STEP064B3;
5. record the failed combination and relevant logs without secrets.
