import { describe, expect, it } from "vitest";

import { defaultRemoteConfig } from "../../../config/src/index";
import type { LevelDefinition } from "../../../shared/src/index";
import {
  PRE_LEVEL_EXTRA_MOVES_BONUS,
  PRE_LEVEL_BOOSTER_LIMIT,
  applyPreLevelLoadout,
  canSelectPreLevelBooster,
  createBoardState,
  createDefaultSave,
  togglePreLevelBoosterSelection,
} from "../../src/index";

const starterLevel: LevelDefinition = {
  id: 7001,
  chapterId: "test",
  indexInChapter: 1,
  moves: 10,
  palette: ["ruby", "sapphire", "emerald"],
  objective: { type: "clear_all" },
  layout: [
    ". . . R R . . .",
    ". . . B B . . .",
    ". . . . . . . .",
    ". . . . . . . .",
    ". . . . . . . .",
    ". . . . . . . .",
  ],
  queue: ["ruby", "sapphire", "emerald"],
  rewards: {
    gold: 80,
    petals: 10,
    seasonalTokens: 0,
  },
  difficulty: "easy",
};

describe("pre-level loadout", () => {
  it("enforces the selection limit and inventory availability", () => {
    const inventory = {
      extraMoves: 1,
      rainbowOrb: 1,
      bombOrb: 0,
      precisionAim: 2,
      undoShot: 1,
    };

    let selected = togglePreLevelBoosterSelection([], "extraMoves", inventory);
    selected = togglePreLevelBoosterSelection(selected, "rainbowOrb", inventory);
    const unchanged = togglePreLevelBoosterSelection(selected, "precisionAim", inventory);

    expect(selected).toHaveLength(PRE_LEVEL_BOOSTER_LIMIT);
    expect(unchanged).toEqual(selected);
    expect(canSelectPreLevelBooster(selected, "bombOrb", inventory)).toBe(false);
    expect(canSelectPreLevelBooster(selected, "extraMoves", inventory)).toBe(true);
  });

  it("applies selected starter boosters to board state and inventory", () => {
    const save = createDefaultSave({
      anonymousId: "anon-pre-level",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    const board = createBoardState(starterLevel);

    const resolution = applyPreLevelLoadout(save, board, [
      "extraMoves",
      "rainbowOrb",
      "precisionAim",
    ]);

    expect(resolution.appliedBoosters).toEqual([
      "extraMoves",
      "rainbowOrb",
      "precisionAim",
    ]);
    expect(resolution.board.movesRemaining).toBe(
      starterLevel.moves + PRE_LEVEL_EXTRA_MOVES_BONUS,
    );
    expect(resolution.board.queue[0]).toBe("rainbow");
    expect(resolution.precisionAimActive).toBe(true);
    expect(resolution.save.boosters.extraMoves).toBe((save.boosters.extraMoves ?? 0) - 1);
    expect(resolution.save.boosters.rainbowOrb).toBe((save.boosters.rainbowOrb ?? 0) - 1);
    expect(resolution.save.boosters.precisionAim).toBe((save.boosters.precisionAim ?? 0) - 1);
  });
});
