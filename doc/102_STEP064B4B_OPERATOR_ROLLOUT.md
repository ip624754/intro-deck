# STEP064B4B Operator Rollout

## Truth boundary before rollout

Source implementation and local source/focused/regression QA are complete. STEP064B4B is not deployed or production-accepted. Migration 037 was reported as applied by the operator; direct SQL constraint evidence was not independently collected in this step.

## Prerequisites

- Production currently reports `STEP064B4A` and Node `20.x`.
- Migration 037 is present and language preference changes work in production.
- One existing member account with `interface_language=en`.
- One existing member account with `interface_language=ru`, or one account that can switch safely.
- Vercel deployment and rollback access.

## 1. Deploy

Deploy the exact STEP064B4B candidate. No database migration and no ENV changes are required.

## 2. Verify health

Open `/api/health` and verify:

```text
ok = true
step = STEP064B4B
docsStep = STEP064B4B
runtime.node = 20.x
interfaceLanguagePolicy.renderingBoundary = stored_interface_language_per_telegram_update
interfaceLanguagePolicy.userProvidedContentTranslation = false
interfaceLanguagePolicy.transactionAndOAuthRendering = deferred_to_step064b4c
interfaceLanguagePolicy.publicInviteCardLanguage = canonical_english_deferred
postLanguagePolicy.independentFromInterfaceLanguage = true
```

Also verify the localized member surface list includes profile, directory, requests, private chat, contact unlock, invite, Pro, Story Finder, Help, and language settings.

## 3. English compatibility pass

With `interface_language=en`, verify:

1. Home and Profile remain English.
2. Directory list/card/filter labels remain English.
3. Requests and private-chat surfaces remain English.
4. Pro, Invite, and Story Finder remain English.
5. Existing callback actions still execute normally.

## 4. Russian member rendering pass

Set `interface_language=ru` and verify:

1. Profile editor prompts and navigation are Russian.
2. Directory headings, filters, contact labels, and navigation are Russian.
3. Requests, contact inbox/detail, private-chat inbox/thread states, and safe errors are Russian.
4. Pro/fair-use labels are Russian.
5. Invite owner menu, activity, history, points, and redeem labels are Russian.
6. Story Finder settings, audience, angle, progress, safe failures, and saved-search controls are Russian.
7. Member names, company, headline, About text, messages, URLs, and draft/source content remain unchanged.

## 5. Callback and state regression pass

Verify representative callbacks:

```text
p:ed:dn
dir:list:0
dir:flt
contact:inbox
intro:inbox
dm:inbox
invite:activity
invite:points
news:home
news:audience
news:angle
plans:root
home:root
```

No callback should become stale solely because the interface language changed.

## 6. Deferred-boundary confirmation

Confirm these surfaces are still intentionally English in B4B:

- payment invoices and critical payment confirmations;
- LinkedIn OAuth pages and publication authorization;
- ordinary profile-share publication text;
- external public invite card.

Do not treat this as a B4B failure. These contracts are the explicit STEP064B4C scope.

## 7. Acceptance evidence

Capture:

- production health JSON;
- one English navigation walkthrough;
- one Russian navigation walkthrough;
- one callback contract sample before and after language switch;
- confirmation that no duplicate payment, contact, DM, invite reward, or LinkedIn side effect occurred.

Record:

```text
PRODUCTION_ACCEPT_STEP064B4B
```

## Rollback

1. Deploy exact STEP064B4A FULL.
2. Keep migration 037 and existing language values in place.
3. Confirm `/api/health` returns STEP064B4A.
4. Record the failing surface/callback and sanitized production logs.
