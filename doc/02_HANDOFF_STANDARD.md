# STEP064B4A current handoff

- Source step: `STEP064B4A`; package `0.64.4`.
- Exact baseline: STEP064B3 FULL SHA-256 `92ab03586a7f216a79c7ae2bb80abd0cf194bdbb1b60ad520c9bee1cc28a1b60`.
- Migration 037 adds independent persistent `interface_language` and `default_post_language` to `users`; no new ENV.
- Existing users default to English; new users seed once from Telegram locale.
- `/language` plus Home/Profile/Help provide the initial EN/RU vertical slice.
- Existing AI/news `post_language`, callback IDs, payment/reward logic, OAuth state machines, admin mutations, and LinkedIn publisher are unchanged.
- QA: 100/105 candidate PASS vs 99/104 baseline PASS; zero baseline PASS regressions; five inherited NON_PASS.
- Production migration/deployment acceptance is pending.

---

# 02_HANDOFF_STANDARD

Use this whenever work moves to a new chat or new execution context.

## Required handoff sections

### 1. Executive summary
- Project
- Current baseline / STEP
- Current mode
- Current focus
- One next recommended step
- What must not break

### 2. Truth block
- Source-confirmed
- Live-confirmed
- Inference
- Blocked / unconfirmed
- Do not claim

### 3. Stabilized zones
Only list zones that are genuinely stable.

### 4. Live verification still needed
List flows that still require manual/runtime confirmation.

### 5. Mini-smoke
Include a short smoke set appropriate to the current baseline.

## Rules

- Start with the short executive block, not a giant narrative
- Use one next step, not a roadmap explosion
- Keep the handoff grounded in actual repo state
- Never phrase placeholders as completed production capability
- If strategy changed, update `00_CURRENT_STATE.md` before emitting handoff

## Current-project handoff minimum

For this project, a usable handoff should always mention:
- LinkedIn auth is official OIDC only
- public browse truth = `listed + active`
- intro requests persist, but accept/reply/chat are not done yet
- the current next narrow step, not a speculative roadmap


---

## Current corridor after STEP064B3

STEP064B3 is source-implemented and QA-passed. The next action is production operator acceptance, not another broad copy rewrite.

1. Deploy the exact STEP064B3 artifact over STEP064B2.
2. Verify `/api/health` exposes `adminCopyPolicy` and `step=STEP064B3`.
3. Walk through Admin root, Operations, Communications, Monetization, System, Invite/Rewards, Search, Audit, and Outbox.
4. Confirm Russian labels and separate raw English codes.
5. Confirm callback behavior and mutations are unchanged.
6. Roll back to exact STEP064B2 on navigation, consent, mutation, or diagnostic regression.

Do not add interface-language switching until this acceptance is closed.
