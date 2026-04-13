# Project Execution Plan

## Current State

- GitHub repository was created but was empty at the start of execution.
- No prior game code, assets, CI, or docs existed locally.
- Platform requirements were reviewed against official Yandex Games documentation before scaffolding.
- The working product spec was expanded on `2026-04-08` with explicit first-session, comeback, user-story, and regression-case requirements; the implementation plan now treats that spec as the main player-flow reference.
- The current shell now also treats live-event visibility, restoration celebration, restoration-next-step guidance, chapter-reward follow-up routing, chapter-unlock reveal beats, post-reveal map spotlights, post-claim follow-up CTA planning, spotlight self-healing on map return, single-focus map hero arbitration, spotlight-aware digest de-duplication, spotlight-aware side-panel CTA suppression, spotlight-aware level/restore preview suppression, spotlight-aware event summary suppression, overlay-level recommendation highlighting, overlay-level quest/event/inbox/restoration focus CTAs, restoration affordability gating, daily-reward-to-restore routing, quest-claim-to-follow-up routing, honest post-claim daily-reward presentation, win/fail/reward-reveal focus-card CTA arbitration, transparent `Ad Light` vs `No Ads` shop messaging, a persistent shop ad-status card, a surfaced `No Ads` upgrade state after `Ad Light`, a post-purchase `Play next level` beat for `No Ads`, dedicated purchase-reveal beats for `Starter Pack`, `Welcome Offer`, `Booster Pack`, `Renovation Pack`, `Gem Pack M/L`, and `Season Pass`, fail-screen gem-pack rescue routing that keeps emergency purchases inside the recovery loop, transparent fail-rescue coverage math on the purchase card itself, a runtime fail-recovery hint that promotes gem continue after in-fail rescue purchases, a dedicated `Recovery ready` focus state once that rescue purchase lands, explicit `ready now / after continue` gem totals in that focus card, an explicit optional rewarded-fallback note under that paid recovery state, a visually demoted secondary-action row beneath that state, a separately demoted `Retry / Map` exit row under that state, and deterministic debug-assisted regression coverage for end-of-level states, fail-monetization variants, ad-suppression rules, and shop-to-level conversion flows as first-class UX requirements, so event/chapter/inbox pressure stays visible without extra digging and major beats hand the player to the next clear action.
- The current shell now also keeps fail-recovery momentum when the player leaves to the map after an in-fail gem rescue purchase: the fail state is cleared, but a dedicated recovery spotlight survives on the map and routes back into the current level.
- That recovery spotlight is now treated as a first-class monetization beat in the map shell, with accent styling and a primary CTA so it does not read like generic navigation.

## Product Assumptions

- Phaser 3 + TypeScript + Vite is the fastest path to a shippable Yandex-ready HTML5 bubble shooter with future portability.
- MVP should prioritize a polished first session, durable save system, and hybrid monetization hooks over full art production.
- Placeholder visuals and generated content are acceptable as long as the gameplay loop is functional and clearly documented for later replacement.
- Local development must not depend on the Yandex runtime or backend availability.

## Architecture Plan

1. Build a pnpm monorepo with explicit separation between gameplay, platform integrations, data, analytics, and backend services.
2. Keep bubble-shooter rules in `packages/game-core` as deterministic, testable TypeScript modules independent of Phaser.
3. Use `packages/platform-sdk` for platform interfaces and adapters so Yandex-specific logic stays isolated.
4. Treat `apps/game-web` as a thin shell that renders scenes, overlays DOM UI, and delegates rules to `game-core`.
5. Provide an optional Fastify backend for remote config, experiments, liveops, content registry, and event ingestion.
6. Drive levels, chapters, quests, shop catalog, and events through data packages and validation helpers.
7. Add observability, unit tests, integration tests, smoke coverage, CI, packaging, and moderation documentation from the start.

## Milestones

### M1. Foundation

- Root tooling, monorepo workspaces, linting, formatting, type checking.
- Shared logger, analytics schema, configuration system, platform abstractions.
- Project docs, ADRs, changelog, and execution plan.

### M2. Vertical Slice

- Game boot and shell state.
- Main map scene and one fully playable bubble level.
- Save load/write with schema versioning and migrations.
- Structured debug logging and deterministic board resolution.
- Unit and integration tests for the slice.

### M3. MVP Expansion

- 80-120 data-driven levels and chapter map progression.
- Restoration hub, quests, daily rewards, inbox, shop, leaderboards, and event skeleton.
- Rewarded/interstitial/banner abstractions and purchase catalog.
- Yandex adapter and build profiles for local, Yandex, VK-ready, and test targets.
- First-session guidance, comeback rewards, current-goal UX, gated event-goal surfacing, pre-level briefing with starter boosters, live-event reward track UX, restoration and reward reveal beats, restoration-next-step guidance, chapter-reward follow-up routing into next-zone or event beats, one-time chapter-unlock reveals on map entry, persistent map spotlights after dismissed reveal beats, post-claim spotlight routing that skips stale daily prompts, quest-claim follow-up routing, map-spotlight self-healing on return to the map shell, single-focus map hero CTA arbitration, spotlight-aware digest de-duplication, spotlight-aware side-panel CTA suppression, spotlight-aware level/restore preview suppression, spotlight-aware event summary suppression, overlay-level recommended-target highlighting, overlay-level quest/event/inbox/restoration focus CTAs, win/fail/reward-reveal focus-card CTA arbitration, restoration affordability gating, daily-reward-to-restore routing, state-aware daily-reward modal copy for claimable vs already-collected states, explicit `Ad Light` vs `No Ads` shop comparison UX with upgrade signaling, a persistent ad-status explainer inside the shop shell, fail-screen gem-pack rescue routing that preserves the recovery overlay after purchase, a dedicated `Recovery ready` focus state once that purchase re-enables gem continue, explicit gem balance totals for that recovery moment, a clearly labeled optional rewarded fallback under that state, a visually secondary CTA row for those fallback actions, a `ghost` rewarded fallback button inside that row, map-surface alert badges/chips, localization regression checks, and traceability from product spec to tests.

### M4. Ship Readiness

- Packaging scripts and size checks.
- GitHub Actions CI for lint, typecheck, test, build, and artifacts.
- Moderation checklist, manual platform steps, porting notes, and release cadence.
- Backlog ranked by revenue impact, retention impact, and effort.

## Success Criteria

- `pnpm dev`, `pnpm test`, `pnpm build:yandex`, and `pnpm pack:yandex` work locally.
- One runnable commercial-quality gameplay loop exists end-to-end.
- Yandex-specific concerns stay behind platform interfaces.
- Save, monetization, analytics, experiments, and liveops foundations are present and documented.
