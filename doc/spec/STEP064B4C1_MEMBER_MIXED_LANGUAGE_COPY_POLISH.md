# STEP064B4C1 — Member Mixed-Language Copy Polish

## Objective

Remove the bounded mixed-language labels observed during STEP064B4C production acceptance without changing callbacks, persistence, payment/OAuth state, publisher behavior, or user-authored content.

## Scope

1. Russian language-settings buttons use full Russian labels:
   - `Интерфейс: Английский`
   - `Интерфейс: Русский`
   - `Публикации: Английский`
   - `Публикации: Русский`
2. Russian profile preview localizes system-owned labels and values:
   - `Имя пользователя Telegram: не указан`
   - `Режим контакта: Только запросы через Intro Deck`
3. Russian LinkedIn receipts/pages render `ID публикации` while preserving the immutable raw provider identifier.

## Invariants

- Existing callback data is unchanged.
- `users.interface_language` and `users.default_post_language` semantics are unchanged.
- User-authored names, headline, About, skills, messages, drafts, and URLs are not translated.
- LinkedIn URNs are not modified.
- Payment amounts/payloads, OAuth scopes/state, publisher authority/idempotency, and automatic-publishing policy are unchanged.
- No migration and no new ENV.

## Rollback

Deploy the exact STEP064B4C FULL artifact. Migration 037 and stored language preferences remain compatible.
