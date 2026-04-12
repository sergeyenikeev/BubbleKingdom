import {
  createId,
  type ChapterDefinition,
  type LiveEventDefinition,
  type QuestDefinition,
  type RewardGrant,
} from "@bubble-kingdom/shared";
import type { RemoteConfig } from "@bubble-kingdom/config";

import type { PlayerSave } from "../save/schema";
import { getEventProgressSummary } from "./events";
import { canClaimChapterChest, canRestoreNode, chapterStarsEarned, totalStars } from "./restoration";

export type SessionGoal =
  | {
      kind: "inbox";
      item: PlayerSave["inbox"][number];
    }
  | {
      kind: "daily_reward";
      nextDay: number;
      streak: number;
    }
  | {
      kind: "chapter_chest";
      chapter: ChapterDefinition;
      starsEarned: number;
      starsRequired: number;
    }
  | {
      kind: "event_reward";
      event: LiveEventDefinition;
      milestone: LiveEventDefinition["rewardTrack"][number];
      tokenBalance: number;
    }
  | {
      kind: "quest";
      quest: QuestDefinition;
      progress: number;
    }
  | {
      kind: "restore";
      node: ChapterDefinition["restorationNodes"][number];
      affordable: boolean;
      missingStars: number;
      missingGold: number;
      missingPetals: number;
    }
  | {
      kind: "level";
      levelId: number;
      chapter: ChapterDefinition | null;
    };

export interface ComebackRewardPlan {
  available: boolean;
  absentDays: number;
  reward?: RewardGrant;
}

export interface SessionSurfaceAlerts {
  pendingInboxCount: number;
  claimableQuestCount: number;
  claimableChapterChestCount: number;
  claimableEventMilestoneCount: number;
  dailyRewardAvailable: boolean;
}

export interface ChapterFollowUpPlan {
  chapterId?: string;
  highlight: {
    tagKey: string;
    titleKey: string;
    bodyKey: string;
  };
  primaryAction: {
    action: "open-screen" | "start-current-level";
    id?: "event" | "map";
    labelKey: string;
  };
}

export interface ChapterUnlockRevealPlan {
  chapter: ChapterDefinition;
  seenKey: string;
}

export interface SessionSpotlightPlan {
  tagKey: string;
  titleKey: string;
  bodyKey: string;
  action: {
    action:
      | "start-current-level"
      | "restore-node"
      | "claim-event-reward"
      | "claim-chapter-chest"
      | "claim-quest";
    id?: string;
    labelKey: string;
  };
}

export function deriveSessionGoal(input: {
  save: PlayerSave;
  chapters: ChapterDefinition[];
  quests: QuestDefinition[];
  dailyRewardAvailable: boolean;
  event?: LiveEventDefinition | null;
  allowEventGoals?: boolean;
}): SessionGoal {
  const pendingInbox = input.save.inbox.find((item) => !item.claimed);
  if (pendingInbox) {
    return {
      kind: "inbox",
      item: pendingInbox,
    };
  }

  if (input.dailyRewardAvailable) {
    return {
      kind: "daily_reward",
      nextDay: Math.min(7, input.save.progression.dailyRewardDay + 1),
      streak: input.save.progression.streak,
    };
  }

  const claimableQuest = input.quests.find((quest) => {
    const progress = input.save.quests[quest.id];
    return Boolean(progress && !progress.claimed && progress.progress >= quest.target);
  });
  const claimableChest = input.chapters.find((chapter) => canClaimChapterChest(input.save, chapter));
  const claimableEventMilestone =
    input.allowEventGoals && input.event
      ? getEventProgressSummary(input.save, input.event).claimableMilestones[0] ?? null
      : null;
  if (claimableChest) {
    return {
      kind: "chapter_chest",
      chapter: claimableChest,
      starsEarned: chapterStarsEarned(input.save, claimableChest),
      starsRequired: claimableChest.chapterChestStarsRequired,
    };
  }

  if (claimableEventMilestone && input.event) {
    return {
      kind: "event_reward",
      event: input.event,
      milestone: claimableEventMilestone,
      tokenBalance: input.save.currencies.seasonalTokens,
    };
  }

  if (claimableQuest) {
    return {
      kind: "quest",
      quest: claimableQuest,
      progress: input.save.quests[claimableQuest.id]?.progress ?? 0,
    };
  }

  const nextNode = findNextRestorationNode(input.save, input.chapters);
  if (nextNode) {
    const missingStars = Math.max(0, nextNode.starCost - totalStars(input.save));
    const missingGold = Math.max(0, nextNode.goldCost - input.save.currencies.gold);
    const missingPetals = Math.max(0, nextNode.petalsCost - input.save.currencies.petals);
    const affordable = canRestoreNode(input.save, nextNode);

    return {
      kind: "restore",
      node: nextNode,
      affordable,
      missingStars,
      missingGold,
      missingPetals,
    };
  }

  return {
    kind: "level",
    levelId: input.save.progression.currentLevelId,
    chapter: findCurrentChapter(input.save, input.chapters),
  };
}

export function planComebackReward(input: {
  save: PlayerSave;
  previousSessionAt: string | null;
  nowIso: string;
  remoteConfig: RemoteConfig;
}): ComebackRewardPlan {
  if (!input.previousSessionAt) {
    return {
      available: false,
      absentDays: 0,
    };
  }

  if (input.save.inbox.some((item) => !item.claimed && item.source === "comeback")) {
    return {
      available: false,
      absentDays: 0,
    };
  }

  const absentDays = differenceInCalendarDays(input.previousSessionAt, input.nowIso);
  if (absentDays < 2) {
    return {
      available: false,
      absentDays,
    };
  }

  const lastComebackGap = input.save.progression.lastComebackAt
    ? differenceInCalendarDays(input.save.progression.lastComebackAt, input.nowIso)
    : Number.POSITIVE_INFINITY;
  if (lastComebackGap < 1) {
    return {
      available: false,
      absentDays,
    };
  }

  const bonusGems =
    input.remoteConfig.liveops.comebackRewardGems + Math.min(20, Math.max(0, absentDays - 2) * 5);

  return {
    available: true,
    absentDays,
    reward: {
      source: "comeback",
      gold: 180 + absentDays * 60,
      gems: bonusGems,
      petals: absentDays >= 5 ? 12 : 0,
      boosters:
        absentDays >= 4
          ? {
              precisionAim: 1,
              rainbowOrb: 1,
            }
          : {
              precisionAim: 1,
            },
      labelKey: "reward.comeback",
    },
  };
}

export function enqueueComebackReward(
  save: PlayerSave,
  plan: ComebackRewardPlan,
  nowIso: string,
): PlayerSave {
  if (!plan.available || !plan.reward) {
    return save;
  }

  return {
    ...save,
    progression: {
      ...save.progression,
      lastComebackAt: nowIso,
    },
    inbox: [
      {
        id: createId("inbox"),
        claimed: false,
        createdAt: nowIso,
        source: "comeback",
        gold: plan.reward.gold,
        petals: plan.reward.petals,
        gems: plan.reward.gems,
        seasonalTokens: plan.reward.seasonalTokens,
        boosters: plan.reward.boosters,
        stars: plan.reward.stars,
        labelKey: plan.reward.labelKey,
      },
      ...save.inbox,
    ],
  };
}

export function summarizeSessionSurfaceAlerts(input: {
  save: PlayerSave;
  chapters: ChapterDefinition[];
  quests: QuestDefinition[];
  dailyRewardAvailable: boolean;
  event?: LiveEventDefinition | null;
}): SessionSurfaceAlerts {
  const claimableQuestCount = input.quests.filter((quest) => {
    const progress = input.save.quests[quest.id];
    return Boolean(progress && !progress.claimed && progress.progress >= quest.target);
  }).length;

  return {
    pendingInboxCount: input.save.inbox.filter((item) => !item.claimed).length,
    claimableQuestCount,
    claimableChapterChestCount: input.chapters.filter((chapter) =>
      canClaimChapterChest(input.save, chapter),
    ).length,
    claimableEventMilestoneCount: input.event
      ? getEventProgressSummary(input.save, input.event).claimableMilestones.length
      : 0,
    dailyRewardAvailable: input.dailyRewardAvailable,
  };
}

export function planChapterFollowUp(input: {
  save: PlayerSave;
  chapters: ChapterDefinition[];
  chapterId: string;
  event?: LiveEventDefinition | null;
}): ChapterFollowUpPlan | null {
  const chapterIndex = input.chapters.findIndex((chapter) => chapter.id === input.chapterId);
  if (chapterIndex === -1) {
    return null;
  }

  const nextChapter = input.chapters[chapterIndex + 1] ?? null;
  if (nextChapter && input.save.progression.currentLevelId >= nextChapter.unlockLevel) {
    return {
      chapterId: nextChapter.id,
      highlight: {
        tagKey: "reward.reveal.zoneUnlockedTag",
        titleKey: nextChapter.titleKey,
        bodyKey: nextChapter.descriptionKey,
      },
      primaryAction: {
        action: "start-current-level",
        labelKey: "reward.reveal.exploreZone",
      },
    };
  }

  if (input.event) {
    return {
      highlight: {
        tagKey: "reward.reveal.eventSpotlightTag",
        titleKey: input.event.titleKey,
        bodyKey: input.event.subtitleKey,
      },
      primaryAction: {
        action: "open-screen",
        id: "event",
        labelKey: "event.viewTrack",
      },
    };
  }

  return null;
}

export function planChapterUnlockReveal(input: {
  save: PlayerSave;
  chapters: ChapterDefinition[];
}): ChapterUnlockRevealPlan | null {
  for (const chapter of input.chapters) {
    if (chapter.unlockLevel <= 1) {
      continue;
    }

    const seenKey = getChapterUnlockSeenKey(chapter.id);
    if (
      input.save.progression.currentLevelId >= chapter.unlockLevel &&
      !input.save.tutorial.seenSteps.includes(seenKey)
    ) {
      return {
        chapter,
        seenKey,
      };
    }
  }

  return null;
}

export function getChapterUnlockSeenKey(chapterId: string): string {
  return `chapter_unlock:${chapterId}`;
}

export function planSessionGoalSpotlight(input: {
  save: PlayerSave;
  chapters: ChapterDefinition[];
  quests: QuestDefinition[];
  dailyRewardAvailable: boolean;
  event?: LiveEventDefinition | null;
  allowEventGoals?: boolean;
  ignoreDailyReward?: boolean;
}): SessionSpotlightPlan | null {
  const goal = deriveSessionGoal({
    ...input,
    dailyRewardAvailable: input.ignoreDailyReward ? false : input.dailyRewardAvailable,
  });

  if (goal.kind === "chapter_chest") {
    return {
      tagKey: "chapterChest.title",
      titleKey: goal.chapter.chapterChest.labelKey ?? "reward.chapterChest",
      bodyKey: "chapterChest.ready",
      action: {
        action: "claim-chapter-chest",
        id: goal.chapter.id,
        labelKey: "chapterChest.claim",
      },
    };
  }

  if (goal.kind === "event_reward") {
    return {
      tagKey: "screen.event",
      titleKey: goal.milestone.titleKey,
      bodyKey: "event.rewardReady",
      action: {
        action: "claim-event-reward",
        id: goal.milestone.id,
        labelKey: "event.claim",
      },
    };
  }

  if (goal.kind === "quest") {
    return {
      tagKey: "screen.quests",
      titleKey: goal.quest.titleKey,
      bodyKey: goal.quest.descriptionKey,
      action: {
        action: "claim-quest",
        id: goal.quest.id,
        labelKey: "quest.claim",
      },
    };
  }

  if (goal.kind === "restore" && goal.affordable) {
    return {
      tagKey: "screen.restore",
      titleKey: goal.node.titleKey,
      bodyKey: "goal.restoreReady.body",
      action: {
        action: "restore-node",
        id: goal.node.id,
        labelKey: "map.restore",
      },
    };
  }

  const fallbackChapter =
    goal.kind === "level" ? goal.chapter : findCurrentChapter(input.save, input.chapters);

  if (fallbackChapter) {
    return {
      tagKey: "ui.currentLevel",
      titleKey: fallbackChapter.titleKey,
      bodyKey: fallbackChapter.descriptionKey,
      action: {
        action: "start-current-level",
        labelKey: "map.play",
      },
    };
  }

  return null;
}

function findCurrentChapter(
  save: PlayerSave,
  chapters: ChapterDefinition[],
): ChapterDefinition | null {
  return (
    chapters.find((chapter) => chapter.levels.includes(save.progression.currentLevelId)) ??
    chapters.find((chapter) => save.progression.currentLevelId >= chapter.unlockLevel) ??
    chapters[0] ??
    null
  );
}

function findNextRestorationNode(
  save: PlayerSave,
  chapters: ChapterDefinition[],
): ChapterDefinition["restorationNodes"][number] | null {
  const currentChapter = findCurrentChapter(save, chapters);
  const orderedChapters = currentChapter
    ? [currentChapter, ...chapters.filter((chapter) => chapter.id !== currentChapter.id)]
    : chapters;

  for (const chapter of orderedChapters) {
    const nextNode = chapter.restorationNodes.find(
      (node) => !save.progression.restoredNodes.includes(node.id),
    );
    if (nextNode) {
      return nextNode;
    }
  }

  return null;
}

function differenceInCalendarDays(previousIso: string, currentIso: string): number {
  const previous = startOfUtcDay(previousIso);
  const current = startOfUtcDay(currentIso);
  return Math.max(0, Math.round((current - previous) / 86_400_000));
}

function startOfUtcDay(value: string): number {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
