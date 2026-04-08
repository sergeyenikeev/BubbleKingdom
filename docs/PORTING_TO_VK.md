# Porting To VK

## Current Readiness

The project is intentionally structured so that core gameplay, save logic, economy, and UI flow do not depend on Yandex APIs.

Current portability anchors:

- `packages/game-core`: pure rules and progression.
- `packages/game-data`: platform-agnostic content.
- `packages/platform-sdk`: adapter seam.
- `apps/game-web`: build-target aware bootstrap.

## VK Port Plan

### Step 1: Adapter implementation

Replace the TODO shell in `packages/platform-sdk/src/adapters/vk.ts` with real implementations for:

- auth
- ads
- purchases
- storage / cloud save
- leaderboards
- locale
- analytics bridge
- remote config / flags if VK exposes them

### Step 2: Build profile

- Keep `pnpm build:vk`.
- Add VK app metadata, SDK script loading, and console-specific environment variables.

### Step 3: Commerce mapping

- Map shop offers in `packages/game-data/src/shop/catalog.ts` to VK product IDs.
- Preserve SKU semantics so liveops and analytics remain comparable across platforms.

### Step 4: Save compatibility

- Keep the same save schema version.
- Only change platform identity and cloud-save transport, not local progression structure.

### Step 5: Analytics parity

- Preserve event names from `packages/analytics`.
- Add platform dimension in dashboards to compare Yandex and VK performance.

## Watchouts

- Ad pacing expectations may differ by platform.
- Purchase receipt validation will likely need a VK-specific backend abstraction.
- Language defaults and auth prompts may require different UX copy.
- Safe-area and fullscreen behavior should be revalidated on VK embedded webviews.

## Recommended VK Checklist

1. Implement the adapter.
2. Validate login opt-in behavior.
3. Validate purchase callbacks and catalog sync.
4. Re-run smoke and integration tests under VK build target.
5. Review banner placement safety in VK shell/webview.
