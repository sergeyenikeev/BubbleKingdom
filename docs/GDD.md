# Bubble Kingdom GDD

## Product Positioning

- Genre: hybrid bubble-shooter with kingdom restoration meta.
- Platforms: Yandex Games first, VK Games next, other web portals after adapter work.
- Audience: broad casual audience on mobile web, skewing toward players who like merge/decor/meta loops but want faster session starts.
- Core promise: tactile bubble-shooter fun plus visible kingdom recovery every session.

## Product Pillars

1. Fast joy in the first 10 seconds: immediate map visibility, reward beat, and one-tap path into a level.
2. Visible progress every session: stars, currencies, restoration nodes, quests, inbox, and event hooks all move forward together.
3. Monetization without hard paywalls: ads and purchases accelerate progress, continue attempts, and cosmetic/meta completion.
4. Safe moderation profile: family-friendly theme, guest mode, Yandex-only monetization in Yandex build, transparent rewarded UX.

## Core Fantasy

The kingdom sky is clogged with cursed bubbles. Each cleared level frees magic and lets the player rebuild gardens, fountains, gates, towers, and greenhouse spaces. The emotional reward should feel cumulative, not one-off: every victory slightly beautifies the kingdom and unlocks the next visible goal.

## Session Design

### Short session: 2-5 minutes

1. Boot into map or daily reward.
2. Claim a reward or quest.
3. Play 1 level.
4. Spend stars on one restoration beat or open the next target.

### Long session: 10-15+ minutes

1. Claim daily reward and review quests.
2. Play 3-5 levels.
3. Use boosters or rewarded continue on a fail.
4. Restore one or more kingdom nodes.
5. Visit shop/event/leaderboard.

## First-Session Plan

1. Boot with guest mode and auto-detected language.
2. Show daily reward to create instant value.
3. Expose a strong primary CTA into the current level.
4. Start with generous starting currencies and a few boosters.
5. Show restoration node costs early so stars already have meaning.
6. Offer Yandex ID only as an optional upgrade path for cross-device safety.

## Core Loop

1. Enter game.
2. Claim daily reward / check quests / see live event hook.
3. Start bubble level.
4. Clear objective with core bubbles and specials.
5. Receive stars, gold, petals, event tokens, and inbox rewards.
6. Spend on kingdom restoration or boosters.
7. Unlock new areas, shop offers, and chapter beats.
8. Return next day for streaks, events, and comeback incentives.

## Level Gameplay

### Board fundamentals

- Staggered hex-like bubble grid.
- Aiming preview and shot prediction.
- Wall bounce.
- Match-3+ resolution.
- Disconnected cluster drops.
- Deterministic board logic in `packages/game-core`.

### MVP objectives

- Clear all bubbles.
- Collect crystals.
- Free sprites.
- Break blockers.
- Clear fog.
- Grow flowers.
- Drop artifacts.

### MVP specials and blockers

- Rainbow bubble.
- Bomb bubble.
- Line blast bubble.
- Stone blocker.
- Ice blocker.
- Vine / chained bubble.
- Fog tile.

### Booster design

- Extra Moves: fail recovery and premium convenience.
- Rainbow Orb: smooths skill spikes and increases completion rate.
- Bomb Orb: helps on blocker-heavy boards.
- Precision Aim: player-friendly skill assist.
- Undo Shot: premium-feeling friction reducer in mobile web.

## Meta Progression

### Chapters

- Chapter 1: Blossom Gardens.
- Chapter 2: Moonlit Courtyard.

### Restoration zones

- Royal Gardens
- Crystal Fountain
- Castle Gates
- Moon Tower
- Emerald Greenhouse
- Sun Treasury

Each restoration node consumes stars plus soft/meta currency. Unlock beats should be frequent in early game, then become more spaced and higher-value in midgame.

## Economy

### Currencies

- Gold: soft currency for restoration, boosters, and some offer hooks.
- Petals: meta currency for restoration pacing and chapter beats.
- Gems: hard currency for premium convenience, extra moves, and shop value.
- Seasonal Tokens: event currency for weekly/seasonal ladders.

### Early game economy goals

- Be generous in the first chapter.
- Seed enough boosters to create variety before monetization pressure appears.
- Keep first fail recoverable via rewarded continue or low-cost gem spend.

### Midgame economy goals

- Increase fail frequency slightly through blockers and move pressure.
- Surface welcome offer, piggy bank progress, and booster bundle value.
- Use quests and restoration costs to create multi-currency demand.

### Late-game direction

- Drive play through events, seasonal ladders, chapter bundles, collections, and cosmetic prestige.

## Monetization Design

### Rewarded video

- Continue after fail.
- Extra moves.
- Double reward.
- Bonus chest.
- Booster refill.
- Event token refill.

Rewarded is always optional and clearly labeled with the reward.

### Interstitials

- Logical pauses only.
- Data-driven pacing through remote config.
- Avoid after every level.
- Suppressed for no-ads purchase.

### IAP

- Starter Pack
- Welcome Offer
- Gem Packs S/M/L
- Booster Pack
- Renovation Pack
- Piggy Bank
- No Ads / Ad Light
- Season Pass

## Retention Systems

- Daily reward with streak logic.
- Daily and weekly quests.
- Weekly blossom event hook.
- Inbox / rewards center.
- Leaderboard hook for weekly stars.
- Optional comeback reward path via liveops config.

## Content Plan

### MVP

- 100 generated levels in the initial data pack.
- 2 restoration chapters.
- 5+ blocker/special types.
- Basic shop.
- Daily rewards.
- Quest loop.
- Weekly leaderboard/event skeleton.

### Post-MVP

- Hand-authored level packs with difficulty curves by chapter.
- Seasonal pass.
- More blockers and chapter-specific mechanics.
- Decoration collections and cosmetic branches.
- Personalized comeback offers and liveops calendar.

## KPI Hypotheses

- D1 retention: improve through generous first-session rewards, clear map progression, and optional rewarded continues.
- Session length: extend through restoration spends and quest overlap.
- ARPDAU: improve through early value offers, piggy bank, and fail recovery monetization without punishing the core loop.
- Rating: protect through clean UX, moderate ad pacing, readable UI, and fair guest progression.
