import { describe, expect, it } from "vitest";

import { defaultRemoteConfig } from "../../../config/src/index";
import { dailyRewards, questDefinitions } from "../../../game-data/src/index";
import {
  applyQuestProgress,
  claimDailyReward,
  claimQuestReward,
  createDefaultSave,
  getDailyRewardAvailability,
  initializeQuestProgress,
} from "../../src/index";

describe("progression systems", () => {
  it("advances the daily reward track and blocks duplicate same-day claims", () => {
    const save = createDefaultSave({
      anonymousId: "anon_progression",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });

    const initialAvailability = getDailyRewardAvailability(
      save,
      Date.parse("2026-04-08T10:00:00.000Z"),
    );
    expect(initialAvailability.available).toBe(true);
    expect(initialAvailability.nextDay).toBe(1);

    const claimed = claimDailyReward(
      save,
      Date.parse("2026-04-08T10:00:00.000Z"),
      dailyRewards,
    );

    expect(claimed.reward.day).toBe(1);
    expect(claimed.save.progression.dailyRewardDay).toBe(1);

    const repeatedAvailability = getDailyRewardAvailability(
      claimed.save,
      Date.parse("2026-04-08T18:00:00.000Z"),
    );
    expect(repeatedAvailability.available).toBe(false);
  });

  it("initializes quest state, progresses metrics, and claims rewards", () => {
    const save = initializeQuestProgress(
      createDefaultSave({
        anonymousId: "anon_progression",
        language: "en",
        nowIso: "2026-04-08T00:00:00.000Z",
        remoteConfig: defaultRemoteConfig,
      }),
      questDefinitions,
      "2026-04-08T00:00:00.000Z",
    );

    const progressed = applyQuestProgress(
      save,
      questDefinitions,
      {
        rewarded_watch: 1,
      },
      "2026-04-08T01:00:00.000Z",
    );

    expect(progressed.quests.daily_rewarded_1?.progress).toBe(1);

    const claimed = claimQuestReward(progressed, questDefinitions, "daily_rewarded_1");
    expect(claimed.quest.id).toBe("daily_rewarded_1");
    expect(claimed.save.quests.daily_rewarded_1?.claimed).toBe(true);
    expect(claimed.save.currencies.gems).toBe(save.currencies.gems + 8);
  });
});
