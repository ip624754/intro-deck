# Work history — STEP061A

- Accepted STEP061H1 FULL as the source baseline.
- Added migration 032 provider telemetry and OpenAI usage columns.
- Added operator-configured cost estimation with zero/default unknown pricing.
- Added fail-closed rollout stages.
- Instrumented NewsData and OpenAI success/failure/no-result paths.
- Added read-only artifact-bound production preflight.
- Added manual evidence template/verifier and deterministic GO / GO_WITH_RISKS / NO_GO verdict.
- Added provider/draft/publish/cost counters to operator diagnostics.
- Added STEP061A dedicated smoke and preserved prior STEP060/061/H1 contracts.
- Replaced the inherited Roll Duel `.env.example` with the current Intro Deck environment contract and resolved `smoke:env`.
- Hardened preflight evidence by removing draft/share public tokens, correcting the preset-run index check, adding migration prerequisites, and binding canonical Node evidence to the deployed runtime when the workstation is non-Node20.
