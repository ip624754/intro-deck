# STEP054 — Positioning and Discovery Truth Alignment

## Status

SOURCE IMPLEMENTED / SOURCE VERIFIED. Deployment and BotFather profile update require operator application.

## Product contract

### Product category

Intro Deck is a Telegram-native professional directory with active, listed member cards and approval-based contact paths.

### Discovery visibility

- Active, listed profile cards are visible to bot users.
- Private Telegram handles and other private contact details are not public by default.
- Contact and private continuation depend on the contact mode and recipient decision.

### LinkedIn boundary

- LinkedIn sign-in connects an account identity and may supply basic identity fields.
- Member-entered headline, company, role, skills, experience, and about fields are not verified by LinkedIn or Intro Deck unless explicitly stated.
- Product copy must not use `LinkedIn-verified`, `verified professional`, or equivalent claims for the current mechanism.

### Intro boundary

- An Intro Deck intro request is sent directly to the profile owner.
- It is not a third-party warm introduction because no mutual introducer participates in the current mechanism.
- Paid contact actions purchase delivery of a permission request, not approval, contact details, or a reply.

## Scope

- public landing metadata and copy;
- Telegram home, Help, profile, directory, and invite copy;
- Privacy and Terms wording;
- current README/state/handoff claims;
- exact BotFather profile copy;
- regression contract preventing stronger claims from returning.

## Non-goals

- no contact/payment state-machine changes;
- no database migration;
- no LinkedIn OIDC changes;
- no visual redesign;
- no automatic BotFather mutation from deployment startup.

## Acceptance criteria

1. Active surfaces describe a LinkedIn-connected account, not LinkedIn-verified professional claims.
2. Active surfaces state that professional profile fields are member-provided.
3. Directory visibility is explicit: listed cards are browsable by bot users; private contact details remain controlled.
4. `Warm intro` wording is removed from active surfaces.
5. Direct intro requests are described as requests sent to the profile owner.
6. Landing, Telegram, Privacy, Terms, README, current state, and BotFather copy share one contract.
7. `smoke:positioning-truth` passes and inherited smoke failures do not expand.
