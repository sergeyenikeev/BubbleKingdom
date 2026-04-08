import type { ChapterDefinition, RestorationNodeDefinition } from "@bubble-kingdom/shared";

import { spendCurrency } from "../economy/economy";
import type { PlayerSave } from "../save/schema";

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

export function totalStars(save: PlayerSave): number {
  return Object.values(save.progression.starsByLevel).reduce((sum, value) => sum + value, 0);
}
