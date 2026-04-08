# Analytics Foundation

## Event Schema

- Schema owner: `packages/analytics`.
- Event envelope includes session metadata from `packages/shared`.
- Transport targets:
  - console sink for local/debug
  - optional backend sink through `/events`
  - platform analytics bridge hook for future platform-native reporting

## Event Context

Each event should carry the shared session envelope where available:

- `session_id`
- `anonymous_id`
- `user_id`
- `app_version`
- `build_target`
- `platform_target`
- `timestamp`
- experiment assignments when relevant

## Minimum Event Catalog

### App and platform

- `app_start`
- `session_start`
- `session_end`
- `sdk_init_started`
- `sdk_init_success`
- `sdk_init_failed`
- `auth_prompt_shown`
- `auth_success`
- `auth_skipped`

### Save and migration

- `save_load`
- `save_write`
- `save_migration`

### Gameplay

- `level_start`
- `level_restart`
- `level_complete`
- `level_fail`
- `level_objective_progress`
- `booster_used`

### Ads

- `extra_moves_offer_shown`
- `rewarded_offer_shown`
- `rewarded_started`
- `rewarded_finished`
- `rewarded_reward_granted`
- `rewarded_failed`
- `interstitial_requested`
- `interstitial_shown`
- `interstitial_closed`
- `interstitial_failed`

### Commerce

- `shop_open`
- `iap_offer_view`
- `iap_start`
- `iap_success`
- `iap_failed`
- `iap_cancel`
- `currency_earned`
- `currency_spent`

### Meta progression

- `meta_restore_started`
- `meta_restore_completed`
- `quest_claimed`
- `daily_reward_claimed`
- `leaderboard_open`
- `leaderboard_submit`

### Configuration and experimentation

- `feature_flag_assignment`
- `ab_variant_assigned`

### Stability and performance

- `error_recoverable`
- `error_fatal`
- `fps_warning`
- `memory_warning`
- `load_time_warning`

## Derived Product Questions

### Retention

- D1 / D3 / D7 retention by install cohort.
- Comeback reward effectiveness.
- Retention difference by experiment variant.

### Session quality

- Average session duration.
- Levels completed per session.
- Time to first fail.
- Time to first restoration spend.

### Gameplay balance

- Fail rate by level.
- Booster usage by level.
- Objective-specific frustration hotspots.

### Monetization

- First rewarded funnel.
- Rewarded opt-in rate.
- Interstitial exposure vs. rating/retention impact.
- First purchase funnel.
- ARPDAU / ARPPU / payer conversion.
- Piggy bank fill and break-open conversion.

## Recommended Event Payloads

### `level_start`

- `level_id`
- `chapter_id`
- `objective_type`
- `moves_available`
- `boosters_equipped`

### `level_complete`

- `level_id`
- `stars`
- `score`
- `moves_left`
- `duration_seconds`
- `reward_gold`
- `reward_petals`
- `reward_tokens`

### `level_fail`

- `level_id`
- `moves_used`
- `objective_progress`
- `continue_offer_available`

### `rewarded_reward_granted`

- `placement`
- `reward_type`
- `reward_amount`
- `level_id` when applicable

### `iap_success`

- `offer_id`
- `sku`
- `gross_price_label`
- `currency_code`
- `first_purchase`

## Backend Contract

- `POST /events`
  - accepts batched or single event payloads
  - should be safe to drop or retry
  - should not block gameplay on failure

## Experiment Tracking

Variant assignment should happen once per remote config refresh or session boot and be emitted before downstream behavioral analysis.

Recommended dimensions:

- `interstitial_pacing_variant`
- `lives_variant`
- `starter_pack_variant`
- `tutorial_variant`
- `daily_reward_variant`
- `difficulty_curve_variant`

## Reporting Cadence

### Launch-week dashboard

- Crash / boot error rate
- Session starts
- D1 proxy signals
- Level 1-10 fail rates
- Rewarded start and completion rate
- First purchase conversion

### Weekly operating review

- ARPDAU
- ARPPU
- D7 retention trend
- Content progression drop-off
- Ad pacing impact by cohort
