import type { BoosterId } from "@bubble-kingdom/shared";

import { cloneBoardState } from "../board/board";
import type { BoardState } from "../board/types";
import type { PlayerSave } from "../save/schema";

export const preLevelBoosterIds = [
  "extraMoves",
  "rainbowOrb",
  "bombOrb",
  "precisionAim",
] as const;

export type PreLevelBoosterId = (typeof preLevelBoosterIds)[number];

export const PRE_LEVEL_BOOSTER_LIMIT = 2;
export const PRE_LEVEL_EXTRA_MOVES_BONUS = 3;

export interface PreLevelLoadoutResolution {
  selectedBoosters: PreLevelBoosterId[];
  appliedBoosters: PreLevelBoosterId[];
  board: BoardState;
  save: PlayerSave;
  precisionAimActive: boolean;
}

export function togglePreLevelBoosterSelection(
  selectedBoosters: PreLevelBoosterId[],
  boosterId: PreLevelBoosterId,
  inventory: Partial<Record<BoosterId, number>>,
  limit = PRE_LEVEL_BOOSTER_LIMIT,
): PreLevelBoosterId[] {
  if (selectedBoosters.includes(boosterId)) {
    return selectedBoosters.filter((candidate) => candidate !== boosterId);
  }

  if ((inventory[boosterId] ?? 0) <= 0 || selectedBoosters.length >= limit) {
    return selectedBoosters;
  }

  return [...selectedBoosters, boosterId];
}

export function isPreLevelBoosterSelected(
  selectedBoosters: PreLevelBoosterId[],
  boosterId: PreLevelBoosterId,
): boolean {
  return selectedBoosters.includes(boosterId);
}

export function canSelectPreLevelBooster(
  selectedBoosters: PreLevelBoosterId[],
  boosterId: PreLevelBoosterId,
  inventory: Partial<Record<BoosterId, number>>,
  limit = PRE_LEVEL_BOOSTER_LIMIT,
): boolean {
  return (
    isPreLevelBoosterSelected(selectedBoosters, boosterId) ||
    ((inventory[boosterId] ?? 0) > 0 && selectedBoosters.length < limit)
  );
}

export function applyPreLevelLoadout(
  save: PlayerSave,
  board: BoardState,
  selectedBoosters: PreLevelBoosterId[],
): PreLevelLoadoutResolution {
  const nextBoard = cloneBoardState(board);
  const nextSave: PlayerSave = {
    ...save,
    boosters: {
      ...save.boosters,
    },
  };
  const appliedBoosters: PreLevelBoosterId[] = [];
  let precisionAimActive = false;

  for (const boosterId of selectedBoosters) {
    if ((nextSave.boosters[boosterId] ?? 0) <= 0) {
      continue;
    }

    nextSave.boosters[boosterId] = (nextSave.boosters[boosterId] ?? 0) - 1;
    appliedBoosters.push(boosterId);

    if (boosterId === "extraMoves") {
      nextBoard.movesRemaining += PRE_LEVEL_EXTRA_MOVES_BONUS;
      continue;
    }

    if (boosterId === "rainbowOrb") {
      nextBoard.queue.unshift("rainbow");
      continue;
    }

    if (boosterId === "bombOrb") {
      nextBoard.queue.unshift("bomb");
      continue;
    }

    if (boosterId === "precisionAim") {
      precisionAimActive = true;
    }
  }

  return {
    selectedBoosters,
    appliedBoosters,
    board: nextBoard,
    save: nextSave,
    precisionAimActive,
  };
}
