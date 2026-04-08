# Changelog

All notable changes to this project will be documented in this file.

The project follows Semantic Versioning and Conventional Commits.

## [0.1.0-alpha] - 2026-04-08

- Initialized the Bubble Kingdom monorepo foundation and execution plan.
- Added the Phaser web client, platform adapters, deterministic game-core modules, and optional Fastify backend.
- Added save versioning, analytics scaffolding, experiments, Yandex packaging, CI, smoke tests, and moderation-oriented documentation.
- Added rewarded double-win claims, gem-paid continues, piggy bank bonus payout logic, and dynamic shop offer visibility.
- Hardened monetization flows with currency delta analytics, safer continue-state guards, and mock storage isolation for reliable cross-session tests.
- Split the web build into lightweight shell, gameplay, platform, and lazy Phaser engine chunks to reduce initial boot cost.
- Expanded the mock purchase catalog so local monetization flows better mirror live shop pricing and offer coverage.
- Added a commerce contract for product-ID overrides, receipt-validation stubs, and remote-configured leaderboard IDs across the client, SDK adapters, and backend.
- Hardened purchase validation and Vitest workspace resolution so monetization flows remain stable even when package `dist` builds are stale in local test runs.
- Replaced the first 30 procedural levels with a hand-authored onboarding and retention curve, while keeping a validated procedural tail through level 100.
- Added strict content validation for palettes, tokens, objective targets, chapter sequencing, and a dedicated `pnpm validate:content` CI gate.
- Added data-driven fail-offer decisioning, piggy-bank spotlight thresholds, and clearer piggy-bank CTAs across the fail flow, map shell, and shop.
- Hardened Yandex commerce for production by preferring `/sdk.js` in Yandex builds, wiring signed receipts into server validation, and rejecting silent fallback grants when `receiptValidationMode=server`.
