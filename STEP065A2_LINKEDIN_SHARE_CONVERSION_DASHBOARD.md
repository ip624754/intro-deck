# STEP065A2 — LinkedIn Share Conversion Dashboard

## Goal
Expose read-only owner and admin conversion metrics derived exclusively from migration 038 immutable attribution events.

## Owner surface
Accessible from profile preview through `li:perf`.

Metrics:
- published profile-share posts
- total profile opens
- unique profile opens
- unique request starts
- unique request submissions
- unique approvals
- unique open → request conversion
- unique request → approval conversion
- 7-day window
- recent posts and owner-bound per-post drilldown

## Admin surface
Accessible from Admin → Operations → LinkedIn publications.

Shows global totals and recent attributed posts without visitor identity.

## Privacy boundary
Not rendered or returned to surfaces:
- visitor Telegram IDs
- internal visitor user IDs
- visitor names or usernames
- visitor lists

## Safety
- read-only
- no migration 039
- no new ENV
- no mutation callbacks
- analytics failures do not block product actions
- per-post drilldown requires owner Telegram identity plus exact share public token
