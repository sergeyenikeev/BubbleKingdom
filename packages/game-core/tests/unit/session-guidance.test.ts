import { describe, expect, it } from "vitest";

import { chapters, liveEvents, questDefinitions } from "../../../game-data/src/index";
import { defaultRemoteConfig } from "../../../config/src/index";
import {
  createDefaultSave,
  deriveSessionGoal,
  enqueueComebackReward,
  getChapterUnlockSeenKey,
  initializeQuestProgress,
  planChapterFollowUp,
  planChapterUnlockReveal,
  planComebackReward,
  planSessionGoalSpotlight,
  summarizeSessionSurfaceAlerts,
} from "../../src/index";

describe("session guidance", () => {
  const baseSave = () =>
    initializeQuestProgress(
      createDefaultSave({
        anonymousId: "anon-session-guidance",
        language: "en",
        nowIso: "2026-04-08T00:00:00.000Z",
        remoteConfig: defaultRemoteConfig,
      }),
      questDefinitions,
      "2026-04-08T00:00:00.000Z",
    );

  it("prioritizes pending inbox rewards over other goals", () => {
    const save = baseSave();
    save.inbox.push({
      id: "reward_1",
      claimed: false,
      createdAt: "2026-04-08T00:00:00.000Z",
      source: "comeback",
      gems: 30,
      labelKey: "reward.comeback",
    });

    const goal = deriveSessionGoal({
      save,
      chapters,
      quests: questDefinitions,
      dailyRewardAvailable: true,
    });

    expect(goal.kind).toBe("inbox");
    if (goal.kind === "inbox") {
      expect(goal.item.id).toBe("reward_1");
    }
  });

  it("guides the player toward affordable restoration beats", () => {
    const save = baseSave();
    save.progression.starsByLevel = {
      "1": 3,
      "2": 3,
    };
    save.currencies.gold = 500;
    save.currencies.petals = 30;

    const goal = deriveSessionGoal({
      save,
      chapters,
      quests: questDefinitions,
      dailyRewardAvailable: false,
    });

    expect(goal.kind).toBe("restore");
    if (goal.kind === "restore") {
      expect(goal.affordable).toBe(true);
      expect(goal.node.id).toContain("gardens");
    }
  });

  it("surfaces claimable chapter chests as the current goal", () => {
    const save = baseSave();
    const chapter = chapters[0]!;
    for (const levelId of chapter.levels.slice(0, 10)) {
      save.progression.starsByLevel[String(levelId)] = 3;
    }

    const goal = deriveSessionGoal({
      save,
      chapters,
      quests: questDefinitions,
      dailyRewardAvailable: false,
    });

    expect(goal.kind).toBe("chapter_chest");
    if (goal.kind === "chapter_chest") {
      expect(goal.chapter.id).toBe(chapter.id);
      expect(goal.starsRequired).toBe(chapter.chapterChestStarsRequired);
    }
  });

  it("surfaces claimable event rewards once event goals are allowed", () => {
    const save = baseSave();
    const event = liveEvents[0]!;
    const milestone = event.rewardTrack[0]!;
    save.currencies.seasonalTokens = milestone.tokenCost;

    const goal = deriveSessionGoal({
      save,
      chapters,
      quests: questDefinitions,
      dailyRewardAvailable: false,
      event,
      allowEventGoals: true,
    });

    expect(goal.kind).toBe("event_reward");
    if (goal.kind === "event_reward") {
      expect(goal.event.id).toBe(event.id);
      expect(goal.milestone.id).toBe(milestone.id);
      expect(goal.tokenBalance).toBe(milestone.tokenCost);
    }
  });

  it("creates comeback rewards after multi-day absence without duplicates", () => {
    const save = baseSave();
    const plan = planComebackReward({
      save,
      previousSessionAt: "2026-04-03T10:00:00.000Z",
      nowIso: "2026-04-08T08:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });

    expect(plan.available).toBe(true);
    expect(plan.absentDays).toBe(5);

    const updated = enqueueComebackReward(save, plan, "2026-04-08T08:00:00.000Z");
    expect(updated.inbox[0]?.source).toBe("comeback");
    expect(updated.inbox[0]?.claimed).toBe(false);
    expect(updated.progression.lastComebackAt).toBe("2026-04-08T08:00:00.000Z");

    const secondPlan = planComebackReward({
      save: updated,
      previousSessionAt: "2026-04-03T10:00:00.000Z",
      nowIso: "2026-04-08T12:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    expect(secondPlan.available).toBe(false);
  });

  it("plans a next-zone follow-up when the next chapter is already unlocked", () => {
    const save = baseSave();
    save.progression.currentLevelId = 51;

    const plan = planChapterFollowUp({
      save,
      chapters,
      chapterId: chapters[0]!.id,
      event: liveEvents[0]!,
    });

    expect(plan?.highlight.titleKey).toBe(chapters[1]!.titleKey);
    expect(plan?.primaryAction).toEqual({
      action: "start-current-level",
      labelKey: "reward.reveal.exploreZone",
    });
  });

  it("falls back to the active event when the next chapter is not unlocked yet", () => {
    const save = baseSave();
    const event = liveEvents[0]!;

    const plan = planChapterFollowUp({
      save,
      chapters,
      chapterId: chapters[0]!.id,
      event,
    });

    expect(plan?.highlight.titleKey).toBe(event.titleKey);
    expect(plan?.primaryAction).toEqual({
      action: "open-screen",
      id: "event",
      labelKey: "event.viewTrack",
    });
  });

  it("plans a one-time chapter unlock reveal when a newly opened chapter has not been seen yet", () => {
    const save = baseSave();
    save.progression.currentLevelId = 51;

    const plan = planChapterUnlockReveal({
      save,
      chapters,
    });

    expect(plan?.chapter.id).toBe(chapters[1]!.id);
    expect(plan?.seenKey).toBe(getChapterUnlockSeenKey(chapters[1]!.id));
  });

  it("skips the chapter unlock reveal after the beat has already been seen", () => {
    const save = baseSave();
    save.progression.currentLevelId = 51;
    save.tutorial.seenSteps.push(getChapterUnlockSeenKey(chapters[1]!.id));

    const plan = planChapterUnlockReveal({
      save,
      chapters,
    });

    expect(plan).toBeNull();
  });

  it("plans a post-claim spotlight toward an affordable restoration beat", () => {
    const save = baseSave();
    save.progression.starsByLevel["1"] = 3;
    save.progression.starsByLevel["2"] = 3;
    save.currencies.gold = 220;

    const spotlight = planSessionGoalSpotlight({
      save,
      chapters,
      quests: questDefinitions,
      dailyRewardAvailable: false,
      event: liveEvents[0]!,
      allowEventGoals: true,
    });

    expect(spotlight).toEqual({
      tagKey: "screen.restore",
      titleKey: chapters[0]!.restorationNodes[0]!.titleKey,
      bodyKey: "goal.restoreReady.body",
      action: {
        action: "restore-node",
        id: chapters[0]!.restorationNodes[0]!.id,
        labelKey: "map.restore",
      },
    });
  });

  it("can ignore an available daily reward when choosing a post-claim spotlight", () => {
    const save = baseSave();
    save.progression.starsByLevel["1"] = 3;
    save.progression.starsByLevel["2"] = 3;
    save.currencies.gold = 220;

    const spotlight = planSessionGoalSpotlight({
      save,
      chapters,
      quests: questDefinitions,
      dailyRewardAvailable: true,
      event: liveEvents[0]!,
      allowEventGoals: true,
      ignoreDailyReward: true,
    });

    expect(spotlight).toEqual({
      tagKey: "screen.restore",
      titleKey: chapters[0]!.restorationNodes[0]!.titleKey,
      bodyKey: "goal.restoreReady.body",
      action: {
        action: "restore-node",
        id: chapters[0]!.restorationNodes[0]!.id,
        labelKey: "map.restore",
      },
    });
  });

  it("plans a post-claim spotlight toward the next level when no stronger beat is ready", () => {
    const save = baseSave();

    const spotlight = planSessionGoalSpotlight({
      save,
      chapters,
      quests: questDefinitions,
      dailyRewardAvailable: false,
      event: liveEvents[0]!,
      allowEventGoals: false,
    });

    expect(spotlight).toEqual({
      tagKey: "ui.currentLevel",
      titleKey: chapters[0]!.titleKey,
      bodyKey: chapters[0]!.descriptionKey,
      action: {
        action: "start-current-level",
        labelKey: "map.play",
      },
    });
  });

  it("summarizes claimable alerts for the map shell", () => {
    const save = baseSave();
    const chapter = chapters[0]!;
    const event = liveEvents[0]!;
    const quest = questDefinitions[0]!;

    save.inbox.push({
      id: "reward_2",
      claimed: false,
      createdAt: "2026-04-08T00:00:00.000Z",
      source: "comeback",
      gold: 120,
      labelKey: "reward.comeback",
    });
    save.quests[quest.id]!.progress = quest.target;
    save.currencies.seasonalTokens = event.rewardTrack[0]!.tokenCost;

    for (const levelId of chapter.levels.slice(0, 10)) {
      save.progression.starsByLevel[String(levelId)] = 3;
    }

    const alerts = summarizeSessionSurfaceAlerts({
      save,
      chapters,
      quests: questDefinitions,
      dailyRewardAvailable: true,
      event,
    });

    expect(alerts.pendingInboxCount).toBe(1);
    expect(alerts.claimableQuestCount).toBe(1);
    expect(alerts.claimableChapterChestCount).toBe(1);
    expect(alerts.claimableEventMilestoneCount).toBe(1);
    expect(alerts.dailyRewardAvailable).toBe(true);
  });
});
