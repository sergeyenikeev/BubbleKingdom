import type { ChapterDefinition, RestorationNodeDefinition } from "@bubble-kingdom/shared";

import { spendCurrency } from "../economy/economy";
import type { PlayerSave } from "../save/schema";

export interface ChapterRestorationProgress {
  restoredCount: number;
  totalCount: number;
  completionPercent: number;
  isComplete: boolean;
  nextNode: RestorationNodeDefinition | null;
  nextNodeAffordable: boolean;
  missingStars: number;
  missingGold: number;
  missingPetals: number;
}

export function canRestoreNode(save: PlayerSave, node: RestorationNodeDefinition): boolean {
  return (
    !save.progression.restoredNodes.includes(node.id) &&
    totalStars(save) >= node.starCost &&
    save.currencies.gold >= node.goldCost &&
    save.currencies.petals >= node.petalsCost
  );
}

export function restoreNode(save: PlayerSave, node: RestorationNodeDefinition): PlayerSave {
  if (!canRestoreNode(save, node)) {
    throw new Error(`Requirements not met for node ${node.id}`);
  }

  let updated = spendCurrency(save, "gold", node.goldCost);
  updated = spendCurrency(updated, "petals", node.petalsCost);

  return {
    ...updated,
    progression: {
      ...updated.progression,
      restoredNodes: [...updated.progression.restoredNodes, node.id],
    },
  };
}

export function isChapterComplete(save: PlayerSave, chapter: ChapterDefinition): boolean {
  return chapter.restorationNodes.every((node) => save.progression.restoredNodes.includes(node.id));
}

export function chapterStarsEarned(save: PlayerSave, chapter: ChapterDefinition): number {
  return chapter.levels.reduce(
    (sum, levelId) => sum + (save.progression.starsByLevel[String(levelId)] ?? 0),
    0,
  );
}

export function canClaimChapterChest(save: PlayerSave, chapter: ChapterDefinition): boolean {
  return (
    !save.progression.chapterChestsClaimed.includes(chapter.id) &&
    chapterStarsEarned(save, chapter) >= chapter.chapterChestStarsRequired
  );
}

export function claimChapterChest(save: PlayerSave, chapter: ChapterDefinition): PlayerSave {
  if (!canClaimChapterChest(save, chapter)) {
    throw new Error(`Chapter chest requirements not met for ${chapter.id}`);
  }

  return {
    ...save,
    progression: {
      ...save.progression,
      chapterChestsClaimed: [...save.progression.chapterChestsClaimed, chapter.id],
    },
  };
}

export function getChapterRestorationProgress(
  save: PlayerSave,
  chapter: ChapterDefinition,
): ChapterRestorationProgress {
  const restoredCount = chapter.restorationNodes.filter((node) =>
    save.progression.restoredNodes.includes(node.id),
  ).length;
  const totalCount = chapter.restorationNodes.length;
  const nextNode =
    chapter.restorationNodes.find((node) => !save.progression.restoredNodes.includes(node.id)) ??
    null;

  return {
    restoredCount,
    totalCount,
    completionPercent: totalCount > 0 ? Math.round((restoredCount / totalCount) * 100) : 100,
    isComplete: nextNode === null,
    nextNode,
    nextNodeAffordable: nextNode ? canRestoreNode(save, nextNode) : false,
    missingStars: nextNode ? Math.max(0, nextNode.starCost - totalStars(save)) : 0,
    missingGold: nextNode ? Math.max(0, nextNode.goldCost - save.currencies.gold) : 0,
    missingPetals: nextNode ? Math.max(0, nextNode.petalsCost - save.currencies.petals) : 0,
  };
}

export function totalStars(save: PlayerSave): number {
  return Object.values(save.progression.starsByLevel).reduce((sum, value) => sum + value, 0);
}
