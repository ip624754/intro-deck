# Apply — STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009

## Required parent

Apply the PATCH only over:

```text
RollDuel_BASELINE_2026-07.18_STEP_SHARED_DUEL_BRANDED_PREVIEW_008_FULL.zip
SHA-256: f574265b034673a02669f7a5709aef76bbfd2c2a9fc3cf0ab8f4a7e5b3db88c4
```

Use the FULL ZIP when replacing the complete repository.

## Database

No migration.

## First deployment

Deploy with:

```env
TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED=0
TELEGRAM_EPHEMERAL_GROUP_ALLOWLIST=@rollduelchat
TELEGRAM_BOT_API_BASE_URL=https://api.telegram.org
```

Verify normal startup, private bot flows and existing EN/RU Open Duels topics.

## Canary activation

1. Confirm `@rollduelbot` remains administrator of `@rollduelchat`.
2. Link `@RollDuelOfficial`, `@rollduelchat` and `@rollduelbot` in Telegram Community settings.
3. Set `TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED=1`.
4. Restart Railway.
5. Capture the command-sync log.
6. Run `/ephemeral_status` as an authorized admin in the forum.
7. Test RU and EN `/play`, `/balance`, `/tournament`, `/help`.
8. Confirm responses are invisible to other members.
9. Verify private DM fallback and absence of public balance output.

Detailed procedure:

`docs/operations/STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009_OPERATOR_RUNBOOK.md`

## Rollback

Set:

```env
TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED=0
```

Restart Railway. Existing topics, community duel feeds, private gameplay and money paths remain unchanged.
