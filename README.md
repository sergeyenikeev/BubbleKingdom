# Bubble Kingdom

Bubble Kingdom is a revenue-first HTML5 bubble shooter built for Yandex Games with a platform abstraction layer for future VK Games and other web platform ports.

## Highlights

- Phaser 3 gameplay with pure TypeScript `game-core` rules.
- Hybrid monetization architecture: interstitials, rewarded ads, sticky banners, and IAP abstractions.
- Meta progression with kingdom restoration, quests, daily rewards, and event hooks.
- Optional Fastify backend for remote config, experiments, liveops schedules, and analytics ingestion.
- Yandex-ready packaging, observability, tests, and moderation documentation.

## Current MVP Foundation

- Playable vertical slice with map, one-tap level start, win/fail states, daily reward, quests, shop, restoration, leaderboards, inbox, and settings/pause overlay.
- Hand-authored early-game level curve for levels `1-30`, followed by a procedural tail to `100` total levels.
- Deterministic board, economy, save, and progression systems in `packages/game-core`.
- Mock, Yandex, and VK-stub platform adapters.
- Optional Fastify backend for remote config, experiments, liveops, and analytics ingestion.

## Commands

- `pnpm dev`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:smoke`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm validate:content`
- `pnpm build`
- `pnpm build:yandex`
- `pnpm build:vk`
- `pnpm pack:yandex`

## Quick Start

1. `corepack pnpm install`
2. `corepack pnpm prisma:generate`
3. `corepack pnpm dev`

For a release-ready Yandex artifact:

1. `corepack pnpm validate:content`
2. `corepack pnpm test`
3. `corepack pnpm test:smoke`
4. `corepack pnpm pack:yandex`

## Repository Layout

- `apps/game-web`: Phaser web client and Yandex/VK build targets.
- `services/backend`: Fastify + Prisma backend for remote config, analytics ingestion, and liveops.
- `packages/game-core`: Deterministic rules, progression, save system, and runtime orchestration.
- `packages/game-data`: Levels, quests, shops, chapters, and live content definitions.
- `packages/platform-sdk`: Platform interfaces and adapters for Yandex, web mock, and VK stubs.
- `packages/analytics`: Event schema, trackers, and reporting helpers.
- `packages/shared`: Cross-cutting utilities, types, and structured logging.
- `packages/config`: Build targets, feature flags, and remote config defaults.

## Documentation

Primary docs live under [docs](./docs):

- `docs/GDD.md`
- `docs/TECH_ARCHITECTURE.md`
- `docs/MONETIZATION.md`
- `docs/ANALYTICS.md`
- `docs/TESTING.md`
- `docs/YANDEX_MODERATION_CHECKLIST.md`
- `docs/MANUAL_PLATFORM_STEPS.md`
- `docs/PORTING_TO_VK.md`
- `docs/POST_MVP_BACKLOG.md`
