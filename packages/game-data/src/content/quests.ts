import type { QuestDefinition } from "@bubble-kingdom/shared";

export const questDefinitions: QuestDefinition[] = [
  {
    id: "daily_complete_3",
    cadence: "daily",
    titleKey: "quest.daily.complete3.title",
    descriptionKey: "quest.daily.complete3.description",
    target: 3,
    metric: "levels_complete",
    rewards: {
      source: "quest",
      gold: 180,
      petals: 8,
    },
  },
  {
    id: "daily_rewarded_1",
    cadence: "daily",
    titleKey: "quest.daily.rewarded.title",
    descriptionKey: "quest.daily.rewarded.description",
    target: 1,
    metric: "rewarded_watch",
    rewards: {
      source: "quest",
      gems: 8,
      gold: 120,
    },
  },
  {
    id: "daily_stars_6",
    cadence: "daily",
    titleKey: "quest.daily.stars.title",
    descriptionKey: "quest.daily.stars.description",
    target: 6,
    metric: "stars_earned",
    rewards: {
      source: "quest",
      petals: 10,
      boosters: {
        precisionAim: 1,
      },
    },
  },
  {
    id: "weekly_restore_4",
    cadence: "weekly",
    titleKey: "quest.weekly.restore.title",
    descriptionKey: "quest.weekly.restore.description",
    target: 4,
    metric: "restoration_completed",
    rewards: {
      source: "quest",
      gold: 500,
      gems: 18,
      seasonalTokens: 25,
    },
  },
  {
    id: "weekly_complete_15",
    cadence: "weekly",
    titleKey: "quest.weekly.complete15.title",
    descriptionKey: "quest.weekly.complete15.description",
    target: 15,
    metric: "levels_complete",
    rewards: {
      source: "quest",
      gold: 750,
      petals: 35,
      boosters: {
        bombOrb: 2,
      },
    },
  },
];
