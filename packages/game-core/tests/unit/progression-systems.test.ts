import { describe, expect, it } from "vitest";

import { defaultRemoteConfig } from "../../../config/src/index";
import { chapters, dailyRewards, liveEvents, questDefinitions } from "../../../game-data/src/index";
import {
  applyQuestProgress,
  canClaimEventMilestone,
  canClaimChapterChest,
  claimEventMilestone,
  claimChapterChest,
  claimDailyReward,
  claimQuestReward,
  createDefaultSave,
  getDailyRewardAvailability,
  getChapterRestorationProgress,
  getEventProgressSummary,
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

  it("unlocks and claims chapter chests when the star target is reached", () => {
    const save = createDefaultSave({
      anonymousId: "anon_progression",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    const chapter = chapters[0]!;

    for (const levelId of chapter.levels.slice(0, 10)) {
      save.progression.starsByLevel[String(levelId)] = 3;
    }

    expect(canClaimChapterChest(save, chapter)).toBe(true);

    const claimed = claimChapterChest(save, chapter);
    expect(claimed.progression.chapterChestsClaimed).toContain(chapter.id);
    expect(canClaimChapterChest(claimed, chapter)).toBe(false);
  });

  it("tracks and claims live event milestones from seasonal tokens", () => {
    const save = createDefaultSave({
      anonymousId: "anon_event",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    const event = liveEvents[0]!;
    const firstMilestone = event.rewardTrack[0]!;
    save.currencies.seasonalTokens = firstMilestone.tokenCost;

    const summary = getEventProgressSummary(save, event);
    expect(summary.claimableMilestones.map((milestone) => milestone.id)).toContain(firstMilestone.id);
    expect(canClaimEventMilestone(save, event, firstMilestone.id)).toBe(true);

    const claimed = claimEventMilestone(save, event, firstMilestone.id);
    expect(claimed.save.events[event.id]?.claimedMilestones).toContain(firstMilestone.id);
    expect(claimed.save.currencies.gold).toBeGreaterThan(save.currencies.gold);
    expect(canClaimEventMilestone(claimed.save, event, firstMilestone.id)).toBe(false);
  });

  it("summarizes chapter restoration progress and next resource shortfall", () => {
    const save = createDefaultSave({
      anonymousId: "anon_restore",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    const chapter = chapters[0]!;
    const firstNode = chapter.restorationNodes[0]!;
    const secondNode = chapter.restorationNodes[1]!;

    save.progression.restoredNodes.push(firstNode.id);
    save.progression.starsByLevel["1"] = secondNode.starCost - 1;
    save.currencies.gold = secondNode.goldCost - 25;

    const progress = getChapterRestorationProgress(save, chapter);

    expect(progress.restoredCount).toBe(1);
    expect(progress.totalCount).toBe(chapter.restorationNodes.length);
    expect(progress.nextNode?.id).toBe(secondNode.id);
    expect(progress.nextNodeAffordable).toBe(false);
    expect(progress.missingStars).toBe(1);
    expect(progress.missingGold).toBe(25);
  });
});
