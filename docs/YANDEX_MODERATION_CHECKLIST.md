# Yandex Moderation Checklist

This checklist maps major Yandex Games requirements to the current implementation, automated verification, and manual pre-submit checks.

| Requirement | How it is implemented | Automated verification | Manual check before submit |
| --- | --- | --- | --- |
| Game launches in browser with `index.html` at archive root | `apps/game-web/index.html`, `apps/game-web/scripts/pack-yandex.mjs` | `pnpm build:yandex`, `pnpm pack:yandex` | Open the produced zip and confirm `index.html` is at the root |
| Yandex SDK integration exists for Yandex build | `packages/platform-sdk/src/adapters/yandex.ts` | Typecheck/build coverage | Run Yandex sandbox build and confirm SDK boot succeeds |
| Guest mode exists and does not require login | `packages/platform-sdk/src/adapters/mock.ts`, `packages/platform-sdk/src/adapters/yandex.ts`, `packages/game-core/src/runtime/gameSession.ts` | Integration boot tests | Launch without login and verify the game is playable |
| Auth prompt only after explicit user action | `apps/game-web/src/app.ts` auth button, `gameSession.requestAuth()` | Integration flow covers auth-skipped path foundation | In Yandex sandbox, confirm auth starts only after tapping `Yandex ID` |
| Save progression for guest players | `packages/game-core/src/save/*` | `save-service.test.ts`, integration boot/recovery tests | Reload the page and verify progression persists |
| All ads in Yandex build go through Yandex SDK | `packages/platform-sdk/src/adapters/yandex.ts` | Typecheck/build | Trigger rewarded/interstitial in sandbox and verify Yandex callbacks fire |
| All IAP in Yandex build go through Yandex SDK | `packages/platform-sdk/src/adapters/yandex.ts` purchase methods | Integration mock purchase flow | Validate catalog and purchase callbacks in Yandex sandbox |
| Responsive layout and fullscreen-safe mobile UI | `apps/game-web/src/styles.css`, DOM + Phaser split | Smoke tests on browser preview | Test portrait mobile layout and safe-area padding on device/emulator |
| No scroll / swipe-to-refresh interference | `apps/game-web/src/main.ts` `preventBrowserGestures()` | Smoke test boot | Manually verify touch drag does not scroll the page |
| No long-tap context menu | `apps/game-web/src/main.ts` `contextmenu` prevention | Smoke test boot | Long-press gameplay and overlay surfaces on mobile |
| Gameplay pauses when page is hidden | `apps/game-web/src/main.ts` `hookVisibility()`, `gameSession.openScreen()` lifecycle handling | Integration flow foundation | Switch tabs during a level and confirm pause/settings opens with no gameplay progression |
| Mute exists | Settings screen in `apps/game-web/src/app.ts`, save settings in `packages/game-core/src/save/schema.ts` | Integration state tests | Toggle mute in settings and verify state persists |
| Pause exists | Level pause opens settings/pause overlay; resume button returns to level | Smoke flow foundation | Enter a level, tap Pause, then Resume |
| Automatic language detection | Locale adapters in `packages/platform-sdk`, messages in `packages/game-core/src/localization/messages.ts` | Integration localization switch | In Yandex sandbox, confirm auto-detected locale and manual switch both work |
| RU and EN supported | `packages/game-core/src/localization/messages.ts` | Integration localization test | Run both RU and EN in production preview |
| Game is family-friendly | Content direction documented in `docs/GDD.md` and implemented theme-wide | N/A | Review visual/text assets before upload |
| Rewarded ads are optional and player-initiated | `gameSession.continueWithRewarded()`, DOM CTA copy in `app.ts` | Integration fail/continue test | Verify rewarded appears only after tap/click |
| Interstitials only in logical pauses | `gameSession` ad hooks + remote config pacing | Integration foundation | Manually verify no interstitial during active gameplay |
| Sticky banners only in safe screens | `gameSession.openScreenInternal()` banner gating | Integration/shop/map flows | Confirm no sticky banner overlays the bubble playfield |
| File names are ASCII and package budget is within limit | `apps/game-web/scripts/pack-yandex.mjs` | `pnpm pack:yandex` | Inspect package report in `apps/game-web/artifacts/yandex/package-report.json` |
| No interactive AI gameplay features | No AI gameplay feature implemented | N/A | Keep disabled for release branches |

## Manual Submission Runbook

1. Run `pnpm lint`.
2. Run `pnpm typecheck`.
3. Run `pnpm test`.
4. Run `pnpm test:smoke`.
5. Run `pnpm pack:yandex`.
6. Upload the generated zip from `apps/game-web/artifacts/yandex/`.
7. Verify metadata, screenshots, and promo art match actual gameplay.

## Known MVP Notes

- The current MVP ships without gameplay audio assets, so hidden-tab audio conflicts are naturally absent. Re-run sound-specific moderation checks once audio is added.
- The pause flow is implemented as a pause/settings overlay rather than a separate standalone scene.
