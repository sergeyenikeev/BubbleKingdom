import { z } from "zod";

import type { SessionInfo } from "@bubble-kingdom/shared";

export const analyticsEventNames = [
  "app_start",
  "session_start",
  "session_end",
  "sdk_init_started",
  "sdk_init_success",
  "sdk_init_failed",
  "auth_prompt_shown",
  "auth_success",
  "auth_skipped",
  "save_load",
  "save_write",
  "save_migration",
  "level_start",
  "level_restart",
  "level_complete",
  "level_fail",
  "level_objective_progress",
  "booster_used",
  "extra_moves_offer_shown",
  "rewarded_offer_shown",
  "rewarded_started",
  "rewarded_finished",
  "rewarded_reward_granted",
  "rewarded_failed",
  "interstitial_requested",
  "interstitial_shown",
  "interstitial_closed",
  "interstitial_failed",
  "shop_open",
  "menu_state_assigned",
  "menu_item_impression",
  "menu_item_click",
  "feature_unlock_shown",
  "feature_unlock_click",
  "store_state_assigned",
  "store_theme_impression",
  "theme_purchase_start",
  "theme_purchase_success",
  "theme_purchase_failed",
  "theme_selected",
  "shop_offer_impression",
  "shop_offer_hidden_by_gate",
  "hidden_screen_deeplink_redirect",
  "iap_offer_view",
  "iap_start",
  "iap_success",
  "iap_failed",
  "iap_cancel",
  "currency_earned",
  "currency_spent",
  "meta_restore_started",
  "meta_restore_completed",
  "quest_claimed",
  "daily_reward_claimed",
  "leaderboard_open",
  "leaderboard_submit",
  "feature_flag_assignment",
  "ab_variant_assigned",
  "error_recoverable",
  "error_fatal",
  "fps_warning",
  "memory_warning",
  "load_time_warning",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export const analyticsEventSchema = z.object({
  name: z.enum(analyticsEventNames),
  timestamp: z.string(),
  session: z.object({
    sessionId: z.string(),
    anonymousId: z.string(),
    userId: z.string().optional(),
    appVersion: z.string(),
    buildTarget: z.enum(["local", "yandex", "vk", "test"]),
    platformTarget: z.enum(["web-mock", "yandex", "vk"]),
  }),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export interface AnalyticsSink {
  track(event: AnalyticsEvent): void | Promise<void>;
}

export class MemoryAnalyticsSink implements AnalyticsSink {
  private readonly events: AnalyticsEvent[] = [];

  track(event: AnalyticsEvent): void {
    this.events.push(event);
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
}

export class ConsoleAnalyticsSink implements AnalyticsSink {
  track(event: AnalyticsEvent): void {
    console.log(JSON.stringify({ analytics: event }));
  }
}

export interface AnalyticsTracker {
  track(name: AnalyticsEventName, payload?: Record<string, unknown>): Promise<void>;
}

export function createAnalyticsTracker(
  session: SessionInfo,
  sinks: AnalyticsSink[],
): AnalyticsTracker {
  return {
    async track(name, payload = {}) {
      const event: AnalyticsEvent = analyticsEventSchema.parse({
        name,
        timestamp: new Date().toISOString(),
        session,
        payload,
      });

      await Promise.all(sinks.map((sink) => Promise.resolve(sink.track(event))));
    },
  };
}
