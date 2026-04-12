import { z } from "zod";

import type { LanguageCode } from "@bubble-kingdom/shared";
import type { RemoteConfig } from "@bubble-kingdom/config";

export const SAVE_SCHEMA_VERSION = 4;

export const playerSaveSchema = z.object({
  schemaVersion: z.number(),
  profile: z.object({
    anonymousId: z.string(),
    userId: z.string().optional(),
    createdAt: z.string(),
    lastSessionAt: z.string(),
    installDay: z.string(),
  }),
  settings: z.object({
    language: z.enum(["ru", "en"]),
    soundEnabled: z.boolean(),
    musicEnabled: z.boolean(),
    vibrationEnabled: z.boolean(),
    muted: z.boolean(),
  }),
  currencies: z.object({
    gold: z.number(),
    petals: z.number(),
    gems: z.number(),
    seasonalTokens: z.number(),
  }),
  boosters: z.record(
    z.enum(["extraMoves", "rainbowOrb", "bombOrb", "precisionAim", "undoShot"]),
    z.number(),
  ),
  progression: z.object({
    currentLevelId: z.number(),
    completedLevels: z.array(z.number()),
    starsByLevel: z.record(z.string(), z.number()),
    restoredNodes: z.array(z.string()),
    chapterChestsClaimed: z.array(z.string()),
    lives: z.number(),
    streak: z.number(),
    lastDailyRewardAt: z.string().nullable(),
    dailyRewardDay: z.number(),
    lastComebackAt: z.string().nullable(),
  }),
  quests: z.record(
    z.string(),
    z.object({
      progress: z.number(),
      claimed: z.boolean(),
      cadence: z.enum(["daily", "weekly"]),
      lastUpdatedAt: z.string(),
    }),
  ),
  events: z.record(
    z.string(),
    z.object({
      claimedMilestones: z.array(z.string()),
      lastViewedAt: z.string().nullable(),
    }),
  ),
  inbox: z.array(
    z.object({
      id: z.string(),
      claimed: z.boolean(),
      createdAt: z.string(),
      source: z.enum([
        "level_complete",
        "daily_reward",
        "quest",
        "chapter_chest",
        "event",
        "purchase",
        "comeback",
      ]),
      gold: z.number().optional(),
      petals: z.number().optional(),
      gems: z.number().optional(),
      seasonalTokens: z.number().optional(),
      boosters: z.record(z.string(), z.number()).optional(),
      stars: z.number().optional(),
      labelKey: z.string().optional(),
    }),
  ),
  economy: z.object({
    noAdsPurchased: z.boolean(),
    adLightPurchased: z.boolean(),
    piggyBankGold: z.number(),
    firstPurchaseAt: z.string().nullable(),
    rewardedViews: z.number(),
  }),
  experiments: z.record(z.string(), z.string()),
  tutorial: z.object({
    completed: z.boolean(),
    currentStep: z.string().nullable(),
    seenSteps: z.array(z.string()),
  }),
});

export type PlayerSave = z.infer<typeof playerSaveSchema>;

export function createDefaultSave(input: {
  anonymousId: string;
  userId?: string;
  language: LanguageCode;
  nowIso: string;
  remoteConfig: RemoteConfig;
}): PlayerSave {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    profile: {
      anonymousId: input.anonymousId,
      userId: input.userId,
      createdAt: input.nowIso,
      lastSessionAt: input.nowIso,
      installDay: input.nowIso.slice(0, 10),
    },
    settings: {
      language: input.language,
      soundEnabled: true,
      musicEnabled: true,
      vibrationEnabled: true,
      muted: false,
    },
    currencies: {
      ...input.remoteConfig.economy.startingCurrencies,
    },
    boosters: {
      extraMoves: 2,
      rainbowOrb: 1,
      bombOrb: 1,
      precisionAim: 2,
      undoShot: 1,
    },
    progression: {
      currentLevelId: 1,
      completedLevels: [],
      starsByLevel: {},
      restoredNodes: [],
      chapterChestsClaimed: [],
      lives: input.remoteConfig.economy.generousLivesEnabled ? 7 : 5,
      streak: 1,
      lastDailyRewardAt: null,
      dailyRewardDay: 0,
      lastComebackAt: null,
    },
    quests: {},
    events: {},
    inbox: [],
    economy: {
      noAdsPurchased: false,
      adLightPurchased: false,
      piggyBankGold: 0,
      firstPurchaseAt: null,
      rewardedViews: 0,
    },
    experiments: {},
    tutorial: {
      completed: false,
      currentStep: "aim",
      seenSteps: [],
    },
  };
}
