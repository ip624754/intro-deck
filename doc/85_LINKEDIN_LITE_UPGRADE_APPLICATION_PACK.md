# LinkedIn Verified on LinkedIn — Lite Upgrade Application Pack

## Purpose

This pack prepares the operator action to request an upgrade from the Verified on LinkedIn Development tier to Lite for Intro Deck.

The application is a LinkedIn approval request, not a claim that Lite access has already been granted.

## Product use case

Intro Deck is a Telegram-native professional directory and permission-based contact product. Members connect a LinkedIn account, create a member-provided professional card, browse listed profiles, and request contact through recipient-controlled flows.

Verified on LinkedIn is used only as a trust-enhancement layer:

- `IDENTITY` may be displayed as **Identity verified on LinkedIn**.
- `WORKPLACE` may be displayed as **Workplace verified on LinkedIn**.
- Role, title, seniority, company text, skills, experience, bio, expertise, and other member-entered claims remain member-provided.
- Verification is not used for hiring decisions, background checks, KYC, credit, insurance, housing, eligibility, or automated risk scoring.
- Public badges are fail-closed and require Lite mode, an explicit operator flag, a fresh Lite snapshot, and an exact category returned by LinkedIn.

## Development integration evidence

Source and runtime evidence available before submission:

- Production application: `https://intro-deck.vercel.app`
- Telegram bot: `https://t.me/introdeckbot`
- Privacy: `https://intro-deck.vercel.app/privacy/`
- Terms: `https://intro-deck.vercel.app/terms/`
- Live source marker: `STEP058B1`
- Live artifact SHA observed during Development testing: `a5638bc0908aaf89848678ac1cdf8289698f906b`
- OAuth start and callback completed successfully.
- `/identityMe` and `/verificationReport` produced a category snapshot.
- The tested member currently returned no completed `IDENTITY` or `WORKPLACE` category and received a LinkedIn verification completion URL.
- The absence of a completed category is treated as no badge, not as a failure or negative risk signal.
- Development mode keeps all badge surfaces private.
- Raw verification evidence, verification URL, access token, refresh token, and ID token are not retained.

Regional/member availability prevented the operator from completing a LinkedIn verification category. This must be disclosed honestly if the application asks for a completed-category demo. The integration itself has been exercised through OAuth, both APIs, category parsing, snapshot persistence, completion-URL handling, and fail-closed rendering.

## Suggested application answers

### Application / integration name

`Intro Deck — permission-based professional discovery in Telegram`

### Business use case

`Professional community and networking trust enhancement. Intro Deck lets members create listed professional cards and request contact by permission. Verified on LinkedIn category signals are used only to help members understand whether LinkedIn has confirmed identity or a workplace association.`

### How verification data is used

`The application stores only category-level IDENTITY and WORKPLACE booleans, source tier, API version, and synchronization timestamps. Exact badges are displayed separately from member-provided role, company, skills, experience, bio, and expertise. Missing or stale categories do not produce a badge.`

### What decisions depend on verification

`No high-impact or eligibility decision depends on the signal. Verification does not grant access, change ranking, bypass contact approval, change price, or determine employment, credit, housing, insurance, KYC, or risk outcomes.`

### Member consent

`The verification OAuth intent is separate from base LinkedIn sign-in. The member explicitly opens the verification action and authorizes the requested scopes.`

### Data minimization and retention

`Only category-level results and operational timestamps are retained. Intro Deck does not retain verification documents, legal-name evidence, verification methods, raw provider payloads, completion URLs, or OAuth access/refresh/ID tokens.`

### Public display controls

`Development snapshots never render publicly. Lite badges remain disabled until the operator explicitly enables the feature and the snapshot is fresh, Lite-sourced, and contains an exact LinkedIn category.`

### Abuse and safety controls

`Verification is additive to, not a substitute for, Intro Deck anti-abuse controls. Members can approve, decline, block, or report contact requests. Verification does not override these controls.`

## Operator submission steps

1. Open LinkedIn Developer Portal.
2. Open the Intro Deck application.
3. Open **Products**.
4. Find **Verified on LinkedIn**.
5. Select **Request upgrade** for Lite.
6. Accept the applicable terms.
7. Use a business email that can be verified.
8. Complete the use-case form using the answers in this pack.
9. Attach or link the live product, Privacy Policy, Terms, and a short screen recording of:
   - Profile → Refresh LinkedIn verification;
   - LinkedIn consent;
   - return to Telegram;
   - private category panel;
   - public badges remaining absent in Development.
10. State clearly that category completion is unavailable for the tested account/region, while endpoint integration and zero-category handling are working.
11. Save the submission date and LinkedIn case/reference ID in the project handoff.

## Submission evidence checklist

- [ ] Product URL opens.
- [ ] Telegram bot opens.
- [ ] Privacy and Terms open.
- [ ] Development OAuth completes.
- [ ] `/identityMe` response is accepted.
- [ ] `/verificationReport` response is accepted.
- [ ] Category snapshot is stored.
- [ ] Zero-category state displays no public badge.
- [ ] Public badge feature flag is off.
- [ ] Data-retention explanation is accurate.
- [ ] No restricted-use claim appears in the application.
- [ ] Submission/reference ID recorded.

## Truth boundary

- Development integration: operator-confirmed working through category snapshot and completion URL.
- Completed LinkedIn category: not available for the tested operator account.
- Lite approval: not confirmed until LinkedIn approves the request.
- Public badge rollout: blocked until Lite approval and a fresh Lite category snapshot.

## Official references

- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/verified-on-linkedin/overview
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/verified-on-linkedin/guides/upgrade-to-lite-tier
