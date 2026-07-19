# Runtime Proof Template — STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009

Date: 2026-07-20  
Mode: STANDARD + HEAVY privacy/state QA  
Risk score: 10/12

## Scope under proof

- Existing `@rollduelchat` forum remains canonical.
- Community links channel + forum + bot.
- Group commands `/play`, `/balance`, `/tournament`, `/help` are ephemeral.
- Raw Bot API failure falls back only to private DM.
- No money or gameplay mutation is performed by the group command layer.

## Source invariants

- `TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED` defaults to OFF.
- Empty allowlist fails closed.
- Global group command menu remains empty.
- Ephemeral commands are scoped to allowlisted chats and carry `is_ephemeral=true`.
- `sendMessage` includes `receiver_user_id` and preserves `message_thread_id`.
- No code path falls back to a public group response.
- Private bot deep links remain the action surface for gameplay, balance controls and tournaments.

## Adversarial checks

- Manually typed visible command is deleted best-effort.
- Bot without delete rights still delivers privately and does not fail gameplay.
- Raw Bot API reject/timeout does not expose text publicly.
- DM fallback failure does not expose text publicly.
- Non-allowlisted chat cannot activate the feature.
- RU and EN users receive independent locale output.
- User input and group usernames are not used to construct arbitrary Bot API endpoints.
- Bot token is never logged.

## Live evidence checklist

- [ ] Railway startup successful.
- [ ] Ephemeral command sync log captured.
- [ ] Bot is admin in `@rollduelchat`.
- [ ] Community linking visible in Telegram client.
- [ ] `/ephemeral_status` visible only to invoking admin.
- [ ] RU `/play` visible only to invoking user.
- [ ] EN `/play` visible only to invoking user.
- [ ] RU `/balance` visible only to invoking user.
- [ ] EN `/balance` visible only to invoking user.
- [ ] `/tournament` returns current read-only registration summary.
- [ ] `/help` routes to existing topic IDs.
- [ ] Raw API failure produces DM fallback only.
- [ ] Existing EN/RU Open Duels topic feed remains healthy.
- [ ] Private deposit/duel/withdrawal flows remain unchanged.

## Truth boundary

Repository tests can verify payloads, allowlist behavior, routing, locale and fallback isolation. They cannot prove Telegram client delivery, Community UI configuration, offline behavior or production bot rights. Those remain operator/live evidence.
