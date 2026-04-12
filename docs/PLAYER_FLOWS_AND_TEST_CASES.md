# Player Flows And Test Cases

This document captures the current working gameplay spec adopted on `2026-04-08` for Bubble Kingdom. It complements `docs/GDD.md` with player-facing flows, user stories, and regression coverage anchors.

## Product Flow

### First session

1. Boot the game and initialize the platform SDK.
2. Auto-detect RU or EN and create a guest profile.
3. Offer the daily reward if available.
4. Show the map with a visible current-goal card and tutorial guidance.
5. Send the player into an easy first level with clear aim and match guidance.
6. After victory, show rewards, open the next level, and point to restoration.

### Returning session

1. Restore the save without requiring login.
2. If the player was absent for `2+` days, queue a comeback reward in inbox.
3. Surface the next clear action: claim reward, claim daily, restore a node, or play the next level.
4. Keep rewarded and purchase prompts optional and transparent.

### Core loop

1. Claim reward / quest / comeback reward.
2. Play a level.
3. Win or fail with clear result messaging.
4. Spend stars and currencies on restoration or boosters.
5. Move to the next level, quest, event, or restoration beat.

## User Stories

- `US-001` First entry: guest mode starts the game without mandatory login.
- `US-002` Clear tutorial: first shots teach aiming and match-3 rules.
- `US-003` Visible progress after win: rewards and restoration progress are obvious.
- `US-004` Voluntary rewarded ads: rewarded is always user-initiated.
- `US-005` Understandable fail state: fail screen explains the remaining objective and recovery options.
- `US-006` Restore kingdom objects: rewards can be spent on visible restoration beats.
- `US-007` Daily motivation: daily rewards and streaks make return sessions valuable.
- `US-008` Clear shop: offers are readable and their value is obvious.
- `US-009` Save safety: progression autosaves after meaningful actions.
- `US-010` Gradual difficulty: mechanics are introduced in a controlled early curve.
- `US-011` Returning after a break: comeback reward and current-goal guidance reduce re-entry friction.
- `US-012` Level objective clarity: objective is visible before and during play.
- `US-013` Booster use: boosters are available through clear and legible UI.
- `US-014` Play without paying: monetization accelerates progress but does not block it.
- `US-015` Event participation: map and event screen expose event currency and progress.
- `US-016` Mobile clarity: UI remains readable with large targets on phone-sized screens.
- `US-017` Pause and resume: gameplay pauses safely on manual pause or focus loss.
- `US-018` Honest login value: login is optional and explains the benefit.
- `US-019` Ad transparency: rewarded and interstitial flows are clearly communicated.
- `US-020` Next-step clarity: after each reward beat, the next action is visible without hunting.

## Test Matrix

The IDs below mirror the working QA vocabulary used for release gates.

### Smoke and first-session flow

- `TC-001` First launch boots on a clean profile.
- `TC-002` No mandatory login blocks play.
- `TC-003` Tutorial basic shot works.
- `TC-004` Tutorial match-3 resolution works.
- `TC-005` Tutorial ends in an easy win and opens restoration.

### Gameplay mechanics

- `TC-006` Wall bounce follows the aim line.
- `TC-007` Disconnected clusters drop correctly.
- `TC-008` Win triggers when the objective is completed.
- `TC-009` Fail triggers when moves run out.
- `TC-010` Objective progress updates during play.

### Specials and blockers

- `TC-011` Rainbow bubble matches as wild.
- `TC-012` Bomb bubble clears its blast radius.
- `TC-013` Ice blocker takes staged damage.
- `TC-014` Chained bubble requires chain removal first.
- `TC-015` Fog hides and reveals the board correctly.

### Boosters and recovery

- `TC-016` Pre-level booster selection is applied.
- `TC-017` In-level booster usage updates board state and inventory.
- `TC-018` Rewarded continue resumes a failed run.
- `TC-019` Gem continue spends hard currency and resumes a failed run.

### Meta progression

- `TC-020` Map opens after tutorial.
- `TC-021` Restoration consumes resources and updates visuals.
- `TC-022` Next level unlocks after completion.
- `TC-023` Chapter chest grants once and cannot be duplicated.

### Quests, daily rewards, and events

- `TC-024` Daily reward is claimable once per new day.
- `TC-025` Daily reward cannot be claimed twice on the same day.
- `TC-026` Daily quest completes on target progress.
- `TC-027` Quest claim grants rewards and logs the event.
- `TC-028` Event progress and seasonal tokens update correctly.

### Monetization

- `TC-029` Interstitial appears only at safe transition points.
- `TC-030` Declining a rewarded offer does not block progression.
- `TC-031` Rewarded reward grants only after successful completion.
- `TC-032` Successful IAP applies rewards exactly once.
- `TC-033` Failed or canceled IAP does not grant rewards.
- `TC-034` No-ads or ad-light purchases suppress interstitial pressure without disabling voluntary rewarded.

### Save, resume, and recovery

- `TC-035` Win state autosaves.
- `TC-036` Restoration autosaves.
- `TC-037` Purchases persist across relaunch.
- `TC-038` Focus loss pauses gameplay safely.
- `TC-039` Corrupted saves fall back safely and log recovery.

### Localization and responsiveness

- `TC-040` Auto-language selection follows platform locale.
- `TC-041` Manual language switching updates key screens safely.
- `TC-042` Mobile viewport keeps core UI readable.
- `TC-043` Gameplay does not trigger page scroll.

### Logging and observability

- `TC-044` Boot and session start events are logged with session context.
- `TC-045` Rewarded lifecycle logging is complete on success.
- `TC-046` Rewarded failure logging fires on SDK failure or cancel.
- `TC-047` IAP success logging carries product context.
- `TC-048` Save migration logging fires when schema upgrades happen.

### Platform compliance

- `TC-049` Fullscreen ads pause gameplay and audio.
- `TC-050` Rewarded never starts without a player action.
- `TC-051` Game remains playable without login.
- `TC-052` Packaged build keeps `index.html` at archive root with ASCII-safe paths.

## Release Regression Gate

Run this minimum suite before each release:

1. `TC-001` first launch
2. `TC-005` tutorial win
3. `TC-008` level win
4. `TC-009` fail and retry
5. `TC-018` rewarded continue
6. `TC-032` starter pack purchase
7. `TC-021` restoration
8. `TC-024` daily reward
9. `TC-035` save/load
10. `TC-038` pause/resume
11. `TC-041` RU/EN switch
12. `TC-042` mobile viewport
13. `TC-029` safe interstitial
14. `TC-051` guest flow
15. `TC-052` build/package validation

## Current Automation Mapping

- Unit tests cover core rules, save/load metadata, fail-offer decisioning, and session-guidance helpers.
- Integration tests cover first-time boot, rewarded/gem recovery, purchases, leaderboards, corrupted save recovery, and comeback reward claiming.
- Smoke tests cover boot, opening a playable level, HUD rendering, and shop persistence.
- Manual QA still owns ad pause behavior on real Yandex SDK, mobile readability sweeps, and console-linked purchase validation.
