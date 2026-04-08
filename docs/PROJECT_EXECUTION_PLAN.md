# Project Execution Plan

## Current State

- GitHub repository was created but was empty at the start of execution.
- No prior game code, assets, CI, or docs existed locally.
- Platform requirements were reviewed against official Yandex Games documentation before scaffolding.

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
