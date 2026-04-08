# Monetization Strategy

## Principles

1. Revenue should come from acceleration and convenience, not frustration walls.
2. Ads must be predictable, pause-safe, and rating-safe.
3. Purchases should solve real player tension: fail recovery, restoration pacing, and premium progression.
4. Every monetization lever should be remotely tunable.

## Hybrid Monetization Model

- Interstitial ads
- Rewarded video
- Sticky banners in non-gameplay screens only
- IAP via Yandex SDK in Yandex build

## Ad Placement

### Interstitial

- Triggered only in logical breaks such as some win/fail exits.
- Controlled by `remoteConfig.ads.interstitialEvery`.
- Disabled by no-ads purchase.
- Should never appear mid-shot or during active pointer interaction.

### Rewarded

- Continue after fail.
- Extra moves.
- Double-reward style multipliers for post-level value.
- Booster refill or event token refill.

Rewarded entry points must always:

- be player-initiated,
- state the reward before watching,
- grant a bonus rather than gating mandatory continuation.

### Sticky banners

- Allowed on map/shop/quest/inbox/event/settings surfaces.
- Hidden during gameplay, win, and fail result surfaces.

## IAP Catalog

### MVP offers

- Starter Pack
- Welcome Offer
- Gem Packs S/M/L
- Booster Pack
- Renovation Pack
- Piggy Bank
- No Ads / Ad Light
- Season Pass

### Purchase intent by lifecycle

- First session: Starter Pack, Welcome Offer.
- First pain spike: Booster Pack, Gem Pack S, rewarded continue.
- Meta-engaged players: Renovation Pack, Piggy Bank, Gem Pack M/L.
- High-intent / repeat users: No Ads, Season Pass, future chapter bundles.

## Economy Tension Map

### Gold

- Common spend for restoration and utility.
- Drives everyday sink behavior.

### Petals

- Slower meta pacing currency.
- Used to keep restoration meaningful even when gold inflates.

### Gems

- Premium fail recovery and convenience currency.
- Best monetization driver when paired with fair rewarded alternatives.

### Seasonal Tokens

- Event-specific loop extension.
- Supports future pass and leaderboard engagement.

## Revenue Hooks by Funnel Stage

### First 10 minutes

- Daily reward creates immediate value.
- Booster inventory creates desire to use and refill.
- Welcome offer can be shown after first level or first restoration beat.

### First fail

- Rewarded continue first.
- Gem extra-moves second.
- Booster reminder third.

### First chapter progression

- Restoration costs become visible.
- Starter and renovation offers gain context.

### Re-engagement

- Comeback reward.
- Piggy bank readiness.
- Event token urgency.

## Ethical Guardrails

- No fake urgency timers without real configuration.
- No forced rewarded ads.
- No non-SDK payments on Yandex.
- No third-party ad SDKs in Yandex build.
- No hard wall that blocks basic progression unless the player pays.

## A/B Testing Targets

- Interstitial pace.
- Starter pack price or payload.
- Piggy bank cap.
- Daily reward generosity.
- Extra-moves gem price.
- Tutorial length vs. monetization prompt timing.
- Banner enablement on map surfaces.

## Remote Config Controls

Key monetization knobs already modeled in config:

- `ads.interstitialEvery`
- `ads.allowBannerOnMap`
- `ads.continueRewardMoves`
- `ads.rewardDoubleRewardMultiplier`
- `economy.generousLivesEnabled`
- `economy.starterPackGemBonus`
- `economy.piggyBankCap`
- `economy.extraMovesGemCost`

## Rating Protection Rules

- Interstitials should be paced conservatively until retention stabilizes.
- Rewarded offers should appear after failure or on voluntary bonus hooks, not before basic completion.
- No-ads purchase should feel meaningful.
- UX copy must stay honest and plain-language.
