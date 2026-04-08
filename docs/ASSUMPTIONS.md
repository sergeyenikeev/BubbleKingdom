# Assumptions

## Product

- The MVP targets mobile-first web play with desktop support.
- Guest progression is mandatory; explicit Yandex auth is optional and value-driven.
- Early economy should feel generous, while midgame introduces soft monetization pressure through optional rewarded and premium offers.
- Seasonal and leaderboard systems ship as extensible scaffolds, not final liveops balancing.

## Technical

- The project runs without external secrets in local development.
- Yandex SDK may be unavailable locally, so the game must degrade to mock adapters automatically.
- Placeholder audio and visual effects are acceptable for MVP as long as UX remains readable and moderation-safe.
- Remote config defaults live in-repo and can be overridden by backend responses or platform-specific config.

## Delivery

- Git push may succeed only if the local machine already has working GitHub credentials; the codebase should stay valid regardless.
- Some monetization and console setup steps cannot be automated and must be documented separately.
- Promotion assets, store copy tuning, and pricing experiments are expected to continue after MVP.
