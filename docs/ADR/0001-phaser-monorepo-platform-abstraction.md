# ADR 0001: Phaser Monorepo with Platform Abstraction

## Status

Accepted

## Context

Bubble Kingdom needs a fast path to a shippable HTML5 bubble shooter for Yandex Games, while preserving portability to VK Games and other web platforms. Gameplay logic must stay testable and independent from platform SDK details.

## Decision

- Use a pnpm monorepo to keep the client, backend, shared packages, and docs versioned together.
- Use Phaser 3 for rendering, timing, and input orchestration.
- Keep game rules, progression, and economy logic in pure TypeScript packages outside Phaser scenes.
- Encapsulate Yandex-specific behavior behind platform interfaces and dedicated adapters.
- Provide a mock adapter for local development and a VK-ready stub for future ports.

## Consequences

### Positive

- Gameplay logic becomes deterministic and unit-testable.
- Yandex integration can evolve without contaminating gameplay modules.
- The repo can support future liveops tooling and backend services without restructuring.
- Local development remains productive without external SDK availability.

### Tradeoffs

- More up-front scaffolding than a single-app prototype.
- Additional adapter code is required for every platform feature.
- UI needs deliberate orchestration across Phaser scenes and DOM overlays.
