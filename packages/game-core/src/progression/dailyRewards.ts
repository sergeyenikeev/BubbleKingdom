import type { DailyRewardStep } from "@bubble-kingdom/shared";

import { applyRewardGrant } from "../economy/economy";
import type { PlayerSave } from "../save/schema";

export function getDailyRewardAvailability(
  save: PlayerSave,
  serverNow: number,
): {
  available: boolean;
  nextDay: number;
  streak: number;
} {
  const today = new Date(serverNow).toISOString().slice(0, 10);
  const lastClaimDay = save.progression.lastDailyRewardAt?.slice(0, 10);

  if (lastClaimDay === today) {
    return {
      available: false,
      nextDay: save.progression.dailyRewardDay,
      streak: save.progression.streak,
    };
  }

  const nextDay = ((save.progression.dailyRewardDay % 7) || 0) + 1;
  return {
    available: true,
    nextDay,
    streak: save.progression.streak,
  };
}

export function claimDailyReward(
  save: PlayerSave,
  serverNow: number,
  rewards: DailyRewardStep[],
): { save: PlayerSave; reward: DailyRewardStep } {
  const availability = getDailyRewardAvailability(save, serverNow);
  if (!availability.available) {
    throw new Error("Daily reward is not available yet.");
  }

  const reward = rewards.find((step) => step.day === availability.nextDay) ?? rewards[0]!;
  const updated = applyRewardGrant(save, reward.rewards);
  return {
    reward,
    save: {
      ...updated,
      progression: {
        ...updated.progression,
        dailyRewardDay: reward.day,
        lastDailyRewardAt: new Date(serverNow).toISOString(),
        streak: updated.progression.streak + 1,
      },
    },
  };
}
