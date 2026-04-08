import { describe, expect, it } from "vitest";

import {
  assignExperimentVariants,
  migrateSave,
  translate,
} from "../../src/index";
import { defaultRemoteConfig } from "../../../config/src/index";

describe("save migrations and feature flags", () => {
  it("migrates legacy saves to current schema", () => {
    const migrated = migrateSave({
      schemaVersion: 1,
      profile: {
        anonymousId: "anon",
        createdAt: "2026-04-01T00:00:00.000Z",
        lastSessionAt: "2026-04-01T00:00:00.000Z",
        installDay: "2026-04-01",
      },
      settings: {
        language: "en",
        soundEnabled: true,
        musicEnabled: true,
        vibrationEnabled: true,
        muted: false,
      },
      currencies: {
        gold: 100,
        petals: 10,
        gems: 5,
        seasonalTokens: 0,
      },
      boosters: {},
      progression: {
        currentLevelId: 1,
        completedLevels: [],
        starsByLevel: {},
        restoredNodes: [],
        chapterChestsClaimed: [],
        lives: 5,
        streak: 1,
        lastDailyRewardAt: null,
        dailyRewardDay: 0,
        lastComebackAt: null,
      },
      quests: {},
      inbox: [],
    });

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.economy.noAdsPurchased).toBe(false);
    expect(migrated.tutorial.currentStep).toBe("aim");
  });

  it("assigns experiment variants deterministically", () => {
    const first = assignExperimentVariants("anon-42", defaultRemoteConfig);
    const second = assignExperimentVariants("anon-42", defaultRemoteConfig);

    expect(first).toEqual(second);
    expect(first.interstitial_pacing).toBeDefined();
  });

  it("falls back to english localization keys when needed", () => {
    expect(translate("ru", "ui.title")).toBe("Bubble Kingdom");
    expect(translate("en", "missing.key")).toBe("missing.key");
  });
});
