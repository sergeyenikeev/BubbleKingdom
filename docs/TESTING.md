# Testing Strategy

## Goals

- Keep gameplay rules deterministic and regression-safe.
- Validate boot, save, monetization, and localization flows in integration.
- Maintain a simple browser smoke suite for release confidence.

## Command Surface

- `pnpm test`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:smoke`
- `pnpm typecheck`
- `pnpm validate:content`
- `pnpm build`

## Unit Test Coverage

Current unit suites cover:

- board generation and resolution basics
- content validation and curated early-level progression
- score and economy helpers
- fail-offer decisioning and piggy bank presentation thresholds
- save schema / migration / service round-trips
- feature flag assignment
- mock platform purchase behavior
- Yandex SDK URL and signed-receipt helper logic

Primary files:

- `packages/game-core/tests/unit/board.test.ts`
- `packages/game-data/tests/unit/content-validation.test.ts`
- `packages/game-core/tests/unit/economy.test.ts`
- `packages/game-core/tests/unit/save-and-flags.test.ts`
- `packages/game-core/tests/unit/save-service.test.ts`
- `packages/platform-sdk/tests/unit/mock-adapter.test.ts`

## Integration Coverage

Current integration suite validates:

- first-time boot flow
- daily reward claim
- level completion and reward grant
- fail + rewarded continue
- fail + gem continue
- shop open + purchase
- localization switch
- leaderboard submission
- corrupted save recovery

Primary file:

- `packages/game-core/tests/integration/game-session.test.ts`

## Smoke Coverage

Playwright smoke covers:

- app shell loads in production preview
- first playable level opens
- game canvas and HUD render together
- shop purchase persists to save storage

Primary file:

- `apps/game-web/tests/smoke/app.smoke.spec.ts`

## CI Gate

The GitHub Actions workflow runs:

1. install
2. Prisma client generation
3. lint
4. typecheck
5. content validation
6. unit tests
7. integration tests
8. build
9. smoke tests
10. Yandex packaging

## Manual QA Checklist

Before platform submission, manually verify:

- mobile portrait and landscape readability
- no page scroll or context menu during play
- rewarded and interstitial pause behavior
- Yandex login prompt behavior only after explicit click
- shop catalog contents and purchase callbacks in Yandex sandbox
- archive upload and `index.html` root placement

## Recommended Next Test Additions

- more objective-specific board resolution tests
- no-ads purchase and banner suppression test
- restoration economy edge-case tests
- screenshot diff checks for core screens
- device emulation sweeps for narrow mobile viewports
