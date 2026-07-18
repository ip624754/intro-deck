# STEP055 — Guided Activation Spine

## Goal

Turn profile setup into one deterministic Telegram flow:

`connect LinkedIn → complete the next required field → choose skills → preview → publish`

The step must reduce decision load without changing the profile schema, LinkedIn OIDC, contact/payment mechanisms, or directory readiness rules.

## Mode and risk

- Mode: STANDARD
- Risk Score: 9/12
- Critical zones changed: none
- Schema migration: none

## Canonical activation contract

Required activation steps, in order:

1. LinkedIn account connected
2. Display name
3. Headline
4. Industry
5. About
6. At least one skill

Company, city, public LinkedIn URL, hidden Telegram username, and contact mode are optional and do not block publication.

## UX contract

- Home exposes `Continue setup` while requirements remain.
- Profile setup shows progress, the required checklist, and exactly one next action.
- Saved-field and skill screens route toward the current next missing requirement.
- Optional fields and contact settings live on a separate `p:opt` surface.
- Preview is available before readiness, but publication remains locked.
- A ready hidden profile can be published only from Preview via `p:pub`.
- A listed profile can be hidden via `p:vis`.
- Legacy/stale `p:vis` callbacks cannot publish a hidden profile.
- Field prompts use edit-in-place when Telegram permits.

## Engineering contract

- Reuse `profileRepo`, profile edit sessions, and `setProfileVisibility`.
- Keep one activation resolver in `src/lib/profile/contract.js`.
- Do not introduce a second profile state machine.
- Use explicit desired visibility instead of a runtime toggle.
- Keep current readiness invariant: LinkedIn + four required fields + at least one skill.

## Abuse and stale-state review

- `p:next` resolves from the current database snapshot, not callback age.
- `p:pub` rechecks readiness at the storage boundary.
- `p:vis` writes only `hidden` and cannot become a stale publish path.
- Repeated publish/hide callbacks return an idempotent unchanged result.
- Existing listed profiles are not automatically hidden or republished.

## Acceptance criteria

- Canonical activation order and next action are deterministic.
- Main setup surface separates required and optional fields.
- Incomplete preview has no publish callback.
- Ready hidden preview has `p:pub` and no hide callback.
- Listed preview has hide and no publish callback.
- Saved-field flow exposes the next action.
- Existing positioning, profile, storage, contact, and STEP053A contracts remain green.
- Full smoke failure set does not expand.
- APPLY overlay reproduces the FULL target tree exactly.

## Truth boundary

Source and local Node 20 QA can prove the implementation and contracts. Live Telegram edit-in-place behavior, deployment marker, and end-to-end member activation require operator verification after deployment.
