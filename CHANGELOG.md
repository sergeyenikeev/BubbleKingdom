# Changelog

All notable changes to this project will be documented in this file.

The project follows Semantic Versioning and Conventional Commits.

## Unreleased

- toned down the fail-screen `retry / map` footer when `Recovery ready` is active, so purchased gem recovery remains the single clear next step
- added regression coverage that `failRecoveryHint` is cleared on both `Retry` and `Map` exit after in-fail gem rescue purchases
- turning back to the map from an in-fail gem rescue now keeps a dedicated recovery spotlight alive, so the purchase still hands the player toward the next run instead of dropping them cold on the map
- upgraded that recovery spotlight into an accent state with a primary CTA, so paid rescue momentum stays visually stronger than ordinary map guidance
- changed `start-current-level` spotlights to survive the pre-level preview and clear only on actual level start, so guidance is not “spent” just by peeking at the briefing
- added regression coverage for shop follow-up spotlights surviving `prelevel -> back -> map`, so purchase momentum remains intact even when players inspect the briefing before committing

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
- Added session-guidance helpers, comeback reward inbox flow, tutorial-step progression wiring, current-goal cards, and inbox claim UX for clearer first-session and return-session direction.
- Added save-load metadata for `save_load` / `save_migration` analytics, plus documentation that maps the working user stories and `TC-001` to `TC-052` QA matrix into repo docs.
- Added a pre-level briefing flow with objective/reward preview, selectable starter boosters, precision-aim visual assist markers, and new unit/integration/smoke coverage for the level-start decision moment.
- Hardened localization regression coverage with RU/EN dictionary parity checks, locale auto-detect persistence tests, and a smoke path for visible settings copy updates.
- Added an explicit Settings CTA on the map shell so language and pause-style controls are reachable from the main progression screen as required by the MVP flow.
- Added a live-event reward track with persisted milestone claims, event-screen UX, seasonal-token rewards, and content validation for data-driven event progression.
- Added map-surface guidance for comeback/inbox/chapter/event pressure via current-goal cards, alert chips, nav badges, and a localized active-event summary on the main shell.
- Extended regression coverage for event progression and map UX with session-surface unit tests, integration around event reward claiming, and smoke assertions for the event summary before entering the full event modal.
- Added reward-reveal modals for chapter chests and live-event milestone claims so major meta rewards land as explicit emotional beats instead of silent balance changes.
- Removed the temporary relative `liveEvents` source import in runtime and restored package-based content resolution after confirming source-first integration stability.
- Added restoration-complete reveal beats so rebuilding a kingdom object now lands as a first-class progression moment instead of only a silent state change.
- Promoted claimable live-event rewards into the map's current-goal system once the player is out of the earliest tutorial steps, improving event participation without derailing the first two wins.
- Added chapter-restoration progress helpers plus next-step CTAs inside restoration reveals, so post-restore celebrations now point the player toward the next landmark or back into gameplay.
- Added restoration-screen progress summaries and a browser smoke path for `restore -> reveal -> next restoration`, tightening regression coverage around the kingdom meta loop.
- Added chapter-chest follow-up planning so major chapter rewards now spotlight either the newly unlocked zone or the live event, with a direct CTA instead of dropping the player back to the map cold.
- Added smoke coverage for `chapter chest -> reveal -> event`, tightening regression protection around large meta beats and post-reward routing.
- Added a one-time chapter-unlock reveal on map entry so opening chapter 2 now lands as an explicit meta beat with a direct CTA into the newly available level flow.
- Added regression coverage for `new chapter -> reveal -> start next chapter`, protecting the post-unlock route across unit, integration, and browser smoke suites.
- Added persistent map follow-up spotlights after dismissing major reveal modals, so newly unlocked zones and featured events still surface a clear next CTA on the map instead of disappearing cold.
- Polished fail-recovery UX so in-fail gem rescue purchases now surface a dedicated `Recovery ready` gem-continue state with explicit `ready now / after continue` gem totals, while the rescue helper card uses cleaned-up coverage copy instead of legacy fallback strings.
- Clarified fail-screen ethics after rescue purchases by explicitly labeling the rewarded branch as an optional free fallback beneath the purchased gem-continue CTA.
- Visually demoted secondary fail actions under `Recovery ready` with a separated, softer CTA row so the bought gem-continue path stays primary without hiding the free fallback.
- Demoted the rewarded fallback even further under `Recovery ready` by rendering it as a `ghost` CTA, keeping the purchased gem-continue action unmistakably primary.
- Added a dedicated `Ad Light` offer to the monetization catalog, keeping `No Ads` as a visible upgrade path and validating banner/interstitial suppression behavior separately in integration and smoke.
- Improved shop transparency for ad purchases with per-offer ad-surface breakdowns, upgrade messaging on `No Ads` after `Ad Light`, and stronger deterministic regression coverage around ad-pacing experiment assignments.
- Added a persistent shop ad-status card that explains the player's current ad mode, keeps rewarded help explicitly optional, and surfaces a direct `No Ads` upgrade CTA after `Ad Light` is purchased.
- Promoted `No Ads` to a visually highlighted upgrade card after `Ad Light`, reordered the shop to surface that upgrade earlier, and added smoke coverage for the completed `No Ads active` state.
- Completed the `No Ads` purchase beat with a single `Play next level` CTA on the ad-status card, so permanent ad removal drops straight back into the gameplay loop instead of a dead-end shop state.
- Added a dedicated post-purchase reward reveal for `Starter Pack` and `Welcome Offer`, surfacing the bundle value immediately and handing the player into the next level with a single focused CTA.
- Added differentiated post-purchase beats for `Booster Pack` and `Renovation Pack`, sending power bundles back into gameplay and upgrade bundles into the restoration flow instead of leaving them as quiet balance changes.
- Added product-aware post-purchase beats for `Gem Pack M/L` and `Season Pass`, steering gem bundles into safer next-level play and the season bundle straight into the live event track.
- Added a fail-screen gem-pack rescue card and kept gem-pack purchases inside the fail recovery flow, so buying emergency gems no longer kicks players into a generic shop reveal before they can continue.
- Added a pure fail-rescue gem-pack planner plus transparent fail-card coverage copy, so the player can now see the gem shortfall, the selected pack payout, and the post-continue remainder before buying.
- Added a runtime fail-recovery hint that promotes `continue with gems` right after an in-fail gem purchase, preventing rewarded-first variants from fighting the player's just-purchased rescue path.
- Added integration and browser smoke coverage for `dismiss reveal -> map spotlight -> follow-up action`, protecting the softer post-reveal guidance path.
- Added contextual pre-level follow-up cards so purchase, recovery, and chapter-start spotlights now carry their “why now” message into the briefing instead of dropping that momentum at the modal boundary.
- Tightened `start-current-level` follow-up continuity for gem-pack safety and chapter-start beats by verifying they survive `prelevel -> back -> map` and only clear when the player really commits to gameplay.
- Added `screenSpotlight` continuity for `event` and `restoration`, so open-screen follow-ups from season-pass and renovation beats now keep their “why now” context inside the destination overlay instead of disappearing on entry.
- Reduced overlay CTA competition when a `screenSpotlight` is present: destination overlays now demote their actionable focus card into a companion state instead of presenting two equally strong “next step” blocks at once.
- Added return-trip continuity for `screenSpotlight`: if the player checks `event` or `restoration` and backs out without acting, that follow-up now restores itself to the map hero instead of silently disappearing.
- Hardened local Playwright smoke runs by moving them onto a dedicated preview port and disabling arbitrary server reuse, so browser regression tests always exercise Bubble Kingdom instead of any unrelated preview already running on the machine.
- Added post-claim spotlight planning for daily, comeback, and event reward flows so the map/reveal surface can ignore stale daily prompts and route players toward the next meaningful restore or play beat.
- Simplified the map hero when a spotlight is active by suppressing the competing current-goal card and default primary Play CTA, leaving one clearer next-step action after major beats.
- Deduplicated map action-digest chips against active spotlights, so chapter chest, event, and quest follow-up beats no longer echo the same prompt twice in the hero shell.
- Taught chapter-chest and event side panels to yield to active spotlights by replacing duplicate CTA buttons with a softer “featured above” helper state.
- Extended spotlight yielding to current-level preview and highlighted restoration targets, so level-play and restore-node spotlights now stay singular across the whole side rail.
- Added a dedicated daily-reward-to-restoration path: when the first upgrade is already affordable, claiming the daily reward now keeps restoration as the single promoted next step across the hero and restore rail.
- Extended spotlight yielding to the current-level preview and event summary for any active spotlight, so play/event CTAs no longer compete with restore- or reward-driven next-step beats.
- Added quest-claim follow-up spotlight planning plus map-spotlight self-healing on map entry, so quest rewards and return-to-map flows always recover a single best next-step CTA instead of dropping to an empty shell.
- Extended guided UX into overlay screens by highlighting the recommended quest, inbox reward, event milestone, or restoration target after the player opens that screen, instead of losing the next-step context.
- Hardened restoration CTAs on both the map rail and restoration screen so unaffordable upgrades now show shortfall context and disabled buttons instead of inviting invalid actions.
- Reworked the daily-rewards modal into a state-aware screen that distinguishes claimable vs already-collected rewards, highlights today or tomorrow appropriately, and removes the misleading second-claim CTA after collection.
- Added overlay focus cards for quests and event rewards so claimable targets surface one clear CTA at the top of the modal, while the highlighted list card yields its duplicate button and post-claim follow-up can send the player cleanly back to the map.
- Extended the same overlay-focus pattern to inbox rewards and restoration targets, so comeback claims and recommended upgrades now surface one top CTA while the highlighted list card yields duplicate actions.
- Stabilized Playwright smoke execution for Phaser/WebGL by reducing worker concurrency, eliminating the flaky GPU/contention timeouts that appeared once the smoke suite grew.
- Reworked win, fail, and reward-reveal overlays so the recommended next action now lives in a dedicated focus card instead of competing inline buttons, keeping monetization and follow-up beats clear without duplicating CTAs.
- Extended smoke coverage to assert the reward-reveal focus-card pattern for chapter-chest and chapter-unlock follow-up flows.
- Added a `?debug=1` browser debug harness for deterministic smoke driving of win/fail states, then extended smoke coverage to assert the new single-focus CTA layout on both end-of-level overlays.
- Extended the debug-driven fail smoke suite to cover `gems_primary` and `piggy_primary` monetization branches, including the piggy-bank purchase pivot back into gem-based recovery on the same fail screen.
