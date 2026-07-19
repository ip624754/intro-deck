# STEP-TELEGRAM-COMMUNITY-AND-EPHEMERAL-GROUP-UX-009 — Operator Runbook

Date: 2026-07-20  
Mode: STANDARD with HEAVY privacy/state verification  
Rollout default: OFF

## 1. Purpose

Use the existing `@rollduelchat` forum as the canonical Roll Duel social hub without creating duplicate groups or topics. Telegram Community linking is an operator-side Telegram setting; the repository adds private-in-group ephemeral command UX and safe DM fallback.

Canonical community members:

- Official updates channel: `@RollDuelOfficial`
- Player forum: `@rollduelchat`
- Product bot: `@rollduelbot`

## 2. Existing topic canon

Do not create replacement topics. Keep the current forum structure and IDs:

| Topic | URL | Product role |
|---|---|---|
| Start Here / Rules | `https://t.me/rollduelchat/1` | Entry, rules, verification |
| Open Duels — English | `https://t.me/rollduelchat/35` | English public duel feed |
| Открытые дуэли — Русский | `https://t.me/rollduelchat/37` | Russian public duel feed |
| English Chat | `https://t.me/rollduelchat/39` | English player conversation |
| Русский чат | `https://t.me/rollduelchat/41` | Russian player conversation |
| Wins & Highlights | `https://t.me/rollduelchat/43` | Results and social proof |
| Support & Bugs | `https://t.me/rollduelchat/45` | Support and incident reports |
| Ideas & Feedback | `https://t.me/rollduelchat/47` | Product feedback |

The existing `COMMUNITY_*_URL` environment contract remains authoritative.

## 3. Telegram Community operator setup

This cannot be completed by repository code or Bot API calls.

In the current Telegram client:

1. Open the owner/admin controls for `Roll Duel Players` (`@rollduelchat`).
2. Open the new **Community** / **Linked Chats** management surface. Labels may vary by client version.
3. Create or select the Roll Duel Community.
4. Add:
   - `@RollDuelOfficial`
   - `@rollduelchat`
   - `@rollduelbot`
5. Keep the channel, player forum and bot visible to all community members.
6. Restrict who may add additional chats to owners/admins.
7. Do not add internal support, finance or operator chats as visible community members.
8. Confirm that the community appears as one expandable item and that all three visible members open correctly.

Community linking is navigation only. It does not replace Roll Duel authentication, database state, referrals, matchmaking, ledger or permissions.

## 4. Bot permissions in `@rollduelchat`

Required:

- Bot is a group administrator.
- Bot can send messages.
- Bot can delete messages for best-effort cleanup of manually typed visible commands.
- Bot retains access to existing forum topics.

Not required by this STEP:

- Permission to mutate game balances.
- Permission to create or delete forum topics.
- Anonymous administrator mode.

## 5. Railway environment

Deploy first with the feature disabled:

```env
TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED=0
TELEGRAM_EPHEMERAL_GROUP_ALLOWLIST=@rollduelchat
TELEGRAM_BOT_API_BASE_URL=https://api.telegram.org
```

The allowlist accepts comma-separated public usernames or numeric group IDs. It fails closed when empty.

After startup and basic regression checks, enable the canary:

```env
TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED=1
```

Restart the Railway service so the bot installs chat-scoped ephemeral commands.

## 6. Installed group commands

Only the allowlisted Roll Duel forum receives:

- `/play` — private play/navigation card
- `/balance` — private balance snapshot
- `/tournament` — private open-tournament summary
- `/help` — private topic navigation

The commands are registered with `is_ephemeral=true`. Global group commands remain empty. Private-chat commands are unchanged.

## 7. Live acceptance procedure

### Gate A — startup

Expected log evidence:

```text
Ephemeral group commands sync: targets=1 updated=3 errors=0
```

The three updates are default, English and Russian command sets for the same allowlisted chat.

### Gate B — admin probe

Inside any topic in `@rollduelchat`, an authorized Roll Duel admin runs:

```text
/ephemeral_status
```

Expected private card:

- feature flag ON;
- current chat allowed YES;
- bot admin YES;
- current chat ID and topic ID;
- Community linked, or an explicit Bot API visibility note;
- allowlist contains `@rollduelchat`.

The status card itself must not be visible to other members.

### Gate C — RU and EN commands

From one Russian and one English test user, run in forum topics:

```text
/play
/balance
/tournament
/help
```

Verify:

- command and response are invisible to other members;
- response appears in the same topic for the invoking user;
- `/balance` never appears publicly;
- links open the canonical existing topics;
- buttons that require gameplay or money open the private bot chat;
- RU and EN are resolved independently per user.

### Gate D — fallback

Temporarily block or simulate rejection of the raw ephemeral request in a controlled test.

Expected:

- no public group reply;
- private DM fallback is attempted;
- if the user has never started the bot and DM is unavailable, the command fails privately and does not expose data;
- game, balance and tournament state remain unchanged.

### Gate E — non-allowlisted group

Add the bot to no additional group for this test unless needed. If tested in a disposable group, the commands must not activate when the chat is absent from the allowlist.

## 8. Privacy and truth contract

- Ephemeral delivery is presentation-only.
- The database remains canonical truth.
- Delivery is not guaranteed, especially for offline users.
- Failure never falls back to a public group message.
- Balance and account state are shown only through ephemeral delivery or private DM.
- Commands do not join a duel, reserve funds, pay a tournament entry or mutate money.
- All money actions continue in the established private bot flow with existing confirmations and guards.

## 9. Rollback

No database migration is introduced.

Immediate rollback:

```env
TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED=0
```

Restart Railway. The bot clears global group commands and stops syncing the allowlisted ephemeral command set. Existing community topics, duel feeds and private bot flows continue unchanged.

## 10. Acceptance boundary

`LIVE ACCEPTED` requires:

- Community members linked and visible as intended;
- bot admin status confirmed;
- `/ephemeral_status` private success;
- RU and EN `/play`, `/balance`, `/tournament`, `/help` private success;
- no public balance leak;
- DM fallback verified;
- no regression in existing forum duel feeds and private bot flows.
