# Testing Strategy

## Goals

- Keep gameplay rules deterministic and regression-safe.
- Validate boot, save, monetization, and localization flows in integration.
- Maintain a simple browser smoke suite for release confidence.
- Track product acceptance against the shared player-flow matrix in `docs/PLAYER_FLOWS_AND_TEST_CASES.md`.

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
- pre-level starter-booster selection and loadout application
- fail-offer decisioning and piggy bank presentation thresholds
- fail-rescue gem-pack planning, including smallest-cover selection and overshoot fallback
- session-goal derivation, comeback reward planning, and map-surface alert summaries
- post-claim spotlight planning that can suppress stale daily-reward prompts in favor of restore / level follow-up beats
- gated event-reward goal surfacing for the post-tutorial map loop
- chapter-restoration progress summaries and next-target shortfall calculation
- chapter-chest follow-up planning for next-zone vs event routing after major reward beats
- one-time chapter-unlock reveal planning and seen-flag gating for newly opened zones
- map spotlight persistence after dismissing reveal modals for zone/event follow-up beats
- save schema / migration / service round-trips
- feature flag assignment
- mock platform purchase behavior
- localization dictionary parity and critical RU copy regression checks
- Yandex SDK URL and signed-receipt helper logic

Primary files:

- `packages/game-core/tests/unit/board.test.ts`
- `packages/game-data/tests/unit/content-validation.test.ts`
- `packages/game-core/tests/unit/economy.test.ts`
- `packages/game-core/tests/unit/session-guidance.test.ts`
- `packages/game-core/tests/unit/save-and-flags.test.ts`
- `packages/game-core/tests/unit/save-service.test.ts`
- `packages/platform-sdk/tests/unit/mock-adapter.test.ts`

## Integration Coverage

Current integration suite validates:

- first-time boot flow
- daily reward claim
- level completion and reward grant
- pre-level briefing open -> select starter boosters -> confirm start
- fail + rewarded continue
- fail + gem continue
- fail + gem-pack rescue purchase that keeps the player on the fail screen and re-enables gem continue
- fail + gem-pack rescue purchase that promotes gem continue even for rewarded-primary profiles
- shop open + purchase
- localization switch
- locale auto-detect on first boot and manual override persistence
- leaderboard submission
- comeback reward queue + inbox claim
- post-claim follow-up spotlight routing for daily rewards, quest claims, comeback inbox claims, and event milestone claims
- live-event milestone claim and persistence
- chapter chest / live-event reward reveal presentation and dismissal
- chapter-chest follow-up highlights for event or next-zone CTAs
- chapter-unlock reveal presentation on map boot for newly opened zones
- map spotlight persistence after dismissing reveal modals, plus spotlight consumption and self-healing when the player returns to map without active guidance
- restoration reveal presentation, CTA wiring, and dismissal
- deterministic `Ad Light` vs `No Ads` ad-suppression behavior under forced interstitial-pacing variants
- corrupted save recovery

Primary file:

- `packages/game-core/tests/integration/game-session.test.ts`

## Smoke Coverage

Playwright smoke covers:

- app shell loads in production preview
- first playable level opens
- daily-reward follow-up spotlight becomes the single hero CTA without a competing current-goal card or default Play button
- chapter-chest and event follow-up spotlights suppress duplicate digest chips for the same beat
- chapter-chest and event side panels also suppress duplicate CTA buttons while the matching spotlight is active
- current-level preview and spotlighted restoration targets also yield their duplicate CTA buttons to the active map spotlight
- daily reward -> restore spotlight is covered in both integration and smoke, including suppression of duplicate restore CTAs in the side rail
- reopening the daily-rewards screen after claiming now shows a tomorrow teaser instead of a second claim CTA, covered by smoke
- any active spotlight now suppresses duplicate play/event CTAs in the current-level preview and event summary, covered by smoke assertions
- quest claim -> restore spotlight routing is covered in both integration and smoke, keeping post-quest map guidance singular
- quest, inbox, and restoration overlays now keep the recommended target visually highlighted after the player opens those screens, covered in browser smoke
- quest and event overlays now promote a single top focus CTA for the recommended claimable target, with the highlighted list card yielding its duplicate button, covered in browser smoke
- inbox and restoration overlays now do the same, so comeback claims and recommended upgrades surface one top CTA while the highlighted card yields its duplicate action
- reward-reveal overlays now promote their follow-up action into the same top focus-card pattern, and smoke asserts that the primary CTA no longer reappears in the footer row
- win and fail overlays are now covered directly in smoke via a `?debug=1` harness that deterministically forces end-of-level states without relying on brittle manual aiming
- fail monetization branches are now covered directly in smoke for `rewarded_primary`, `gems_primary`, and `piggy_primary`, including the `piggy -> purchase -> gem continue` pivot on one screen
- shop smoke now verifies `Ad Light` disappears after purchase, `No Ads` remains as the explicit upgrade path, and ad-offer comparison copy stays visible
- the shop ad-status card is covered in smoke for `standard -> Ad Light active`, including the direct `Upgrade to No Ads` CTA
- direct `No Ads` purchase is also covered in smoke, asserting the final ad-free status card and the absence of both permanent ad offers afterward
- the status-card-led `Ad Light -> No Ads` upgrade flow is also covered in smoke, with the duplicated `No Ads` purchase button removed from the offer grid in favor of a single featured CTA
- the completed `No Ads` state is covered through its direct `Play next level` CTA as well, proving the player can leave the shop cleanly and re-enter the gameplay loop after the permanent purchase
- `Starter Pack` is covered in smoke as a full `purchase -> reward reveal -> Play next level -> pre-level` flow, and integration tests now assert the same next-level reward reveal contract for both `Starter Pack` and `Welcome Offer`
- `Booster Pack` is now covered through a `purchase -> reward reveal -> Play next level` smoke path, while `Renovation Pack` is covered through `purchase -> reward reveal -> restoration screen`, with matching integration contracts for both flows
- `Gem Pack L` is covered in smoke as a `purchase -> fail-safety reward reveal -> Play next level` path, and `Gem Pack M` is asserted in integration with the same reveal contract; `Season Pass` is covered through `purchase -> reward reveal -> event screen` in smoke plus integration
- pre-level modal appears before gameplay and confirms into the level
- game canvas and HUD render together
- shop purchase persists to save storage
- settings-driven RU/EN switch updates visible UI copy
- map-shell event summary is visible before the full event modal opens
- full event reward track renders inside the event modal
- restoration reveal routes the player into the next restoration target flow
- chapter-chest reveal routes the player into the featured event flow
- chapter-unlock reveal routes the player into the new chapter's level-briefing flow
- chapter-chest and chapter-unlock reveal modals both assert the new focus-card CTA layout before taking their follow-up action
- win overlay asserts that rewarded double-claim appears exactly once in the focus card, and fail overlay asserts that the recommended recovery action is promoted there while alternative actions stay secondary
- gems-primary fail flow asserts that gem continue is featured exactly once while rewarded remains secondary, and piggy-primary fail flow asserts the piggy CTA is featured first, then hands off to gem continue after purchase
- in-fail gem rescue purchases are also covered for a dedicated `Recovery ready` focus state with `ready now / after continue` gem totals, so rewarded-primary players visibly pivot into the purchased gem-continue path without falling back to generic fail copy
- the same rescue state now also asserts an explicit optional-fallback note for rewarded continue, protecting monetization transparency on the fail screen
- browser smoke also asserts that this fallback lives in a visually demoted secondary-action row, preserving single-focus CTA hierarchy after rescue purchases
- smoke now also asserts the rewarded fallback button itself renders as `ghost` under that row, so the hierarchy is enforced at the control level and not only by layout
- smoke now also verifies that the `Retry / Map` footer becomes a demoted exit row during `Recovery ready`, instead of competing with the purchased continue CTA
- smoke verifies that choosing `Retry` after a rescue purchase removes the `Recovery ready` headline on the next fail, and integration covers the same `failRecoveryHint` reset contract for both retry and map exit
- exiting to the map after a rescue purchase is now covered as its own flow: the fail state must clear, but the map must immediately surface a recovery spotlight that routes the player back into the next level
- the same map spotlight is now asserted as an accent treatment with a primary CTA, so the paid-recovery route remains visually dominant after returning to the kingdom shell
- dismissed chapter-chest reveals still leave an event spotlight on the map until the player opens that event

Primary file:

- `apps/game-web/tests/smoke/app.smoke.spec.ts`

## Smoke Reliability

- The Playwright config intentionally limits smoke worker concurrency for local and CI runs because Phaser/WebGL scenes became unstable under high parallelism once the suite expanded.
- Current target is release confidence over raw speed: a slower but deterministic smoke pass is preferred to flaky parallel GPU contention.

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

See `docs/PLAYER_FLOWS_AND_TEST_CASES.md` for the full `TC-001` to `TC-052` release vocabulary and the minimum regression gate.

## Recommended Next Test Additions

- more objective-specific board resolution tests
- deeper UI assertions for pre-level booster disable/selection states
- no-ads purchase and banner suppression test
- restoration economy edge-case tests
- chapter chest and map-badge visual assertions under multiple pending states
- screenshot diff checks for core screens
- device emulation sweeps for narrow mobile viewports
