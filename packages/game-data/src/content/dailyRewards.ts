import type { DailyRewardStep } from "@bubble-kingdom/shared";

export const dailyRewards: DailyRewardStep[] = [
  {
    day: 1,
    rewards: {
      source: "daily_reward",
      gold: 200,
      seasonalTokens: 5,
      boosters: {
        precisionAim: 1,
      },
      labelKey: "daily.day1",
    },
  },
  {
    day: 2,
    rewards: {
      source: "daily_reward",
      gold: 250,
      petals: 12,
      labelKey: "daily.day2",
    },
  },
  {
    day: 3,
    rewards: {
      source: "daily_reward",
      gems: 10,
      boosters: {
        bombOrb: 1,
      },
      labelKey: "daily.day3",
    },
  },
  {
    day: 4,
    rewards: {
      source: "daily_reward",
      gold: 300,
      petals: 18,
      labelKey: "daily.day4",
    },
  },
  {
    day: 5,
    rewards: {
      source: "daily_reward",
      boosters: {
        rainbowOrb: 1,
        precisionAim: 1,
      },
      labelKey: "daily.day5",
    },
  },
  {
    day: 6,
    rewards: {
      source: "daily_reward",
      gems: 15,
      seasonalTokens: 20,
      labelKey: "daily.day6",
    },
  },
  {
    day: 7,
    rewards: {
      source: "daily_reward",
      gold: 500,
      petals: 25,
      gems: 20,
      boosters: {
        bombOrb: 2,
        rainbowOrb: 1,
      },
      labelKey: "daily.day7",
    },
  },
];
