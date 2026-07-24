# STEP064A HANDOFF

- Current source step: `STEP064A`; package `0.64.0`.
- Exact baseline: STEP063B-H2 FULL SHA-256 `0465e70c63f5bbcaaf58feb81087d2defc0d467afd3b8e0ba0fa5ad598e6d59d`.
- Public invite card is single-CTA and preserves source-specific Telegram attribution.
- Inline and forwarding flows use one canonical photo-card renderer with text fallback.
- Invite root is simplified to Share, Forwarding card, Copy link, Activity, conditional Points, and Home.
- Activity combines performance summary and recent joined contacts; full history remains available inside Activity.
- Migration: none. New ENV: none.
- Reward accounting, activation rules, LinkedIn OAuth, and publishing are unchanged.
- Source QA passed; production Telegram and attribution evidence are not verified.
