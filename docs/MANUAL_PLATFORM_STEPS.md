# Manual Platform Steps

These tasks cannot be fully automated from the repository and must be completed in platform consoles or business tooling.

## Yandex Games

### Account and legal

1. Create or verify the Yandex Games developer account.
2. Confirm payout details, tax data, and organization ownership.
3. Verify access to monetization and IAP tooling in the console.

### Game card setup

1. Create the game draft.
2. Use consistent naming:
   - Title: Bubble Kingdom
   - Tagline/theme: pop bubbles and restore the kingdom
3. Fill descriptions in RU and EN.
4. Mark supported devices after manual device validation.

### Monetization setup

1. Enable monetization in the console.
2. Create IAP products that match the in-game offer catalog.
3. Bind console product IDs to the SKUs used in `packages/game-data/src/shop/catalog.ts`.
4. Enable leaderboards if used in production.

### Promo assets

1. Upload icon, cover, screenshots, and trailer if available.
2. Ensure promo art reflects real gameplay and kingdom restoration.
3. Avoid misleading “fake” premium rewards or impossible scenes.

### Submission checklist

1. Upload the Yandex zip artifact.
2. Validate launch in sandbox.
3. Verify rewarded, interstitial, and purchase flows.
4. Submit for moderation.

## VK Games Preparation

1. Register the app in VK dev tooling.
2. Provision payment, storage, and leaderboard capabilities.
3. Map `VkPlatformAdapterStub` methods to the real SDK.
4. Add VK-specific build metadata and console assets.

## Backend Operations

1. Choose deployment target for `services/backend`.
2. Set production database path / connection string.
3. Add retention/logging policy for event ingestion.
4. Wire `VITE_BACKEND_URL` in the client build pipeline.

## Analytics / BI

1. Decide the production event sink or warehouse.
2. Add downstream dashboarding for retention, monetization, and level balance.
3. Validate schema versioning and event integrity after launch.

## Release Management

1. Tag releases using Semantic Versioning.
2. Maintain `CHANGELOG.md`.
3. Upload artifacts from CI or local release packaging.
4. Review first 72 hours of rating, ad behavior, ARPDAU, and crash/error signals.
