import { describe, expect, it } from "vitest";

import {
  createBoardState,
  performShot,
  predictShotTrace,
  validateBoard,
} from "../../src/index";
import type { LevelDefinition } from "../../../shared/src/index";

const simpleLevel: LevelDefinition = {
  id: 999,
  chapterId: "test",
  indexInChapter: 1,
  moves: 12,
  palette: ["ruby", "sapphire", "emerald"],
  objective: { type: "clear_all" },
  layout: [
    ". . . . . . . .",
    ". . . R R . . .",
    ". . . . . . . .",
    ". . . . . . . .",
    ". . . . . . . .",
    ". . . . . . . .",
  ],
  queue: ["ruby", "sapphire", "emerald"],
  rewards: {
    gold: 50,
    petals: 5,
    seasonalTokens: 0,
  },
  difficulty: "easy",
};

describe("bubble board", () => {
  it("builds a valid board from layout tokens", () => {
    const board = createBoardState(simpleLevel);

    expect(board.rows).toBe(6);
    expect(board.cols).toBe(8);
    expect(validateBoard(board)).toEqual([]);
  });

  it("predicts a bounced shot path", () => {
    const board = createBoardState(simpleLevel);
    const trace = predictShotTrace(board, -2.2);

    expect(trace.path.length).toBeGreaterThan(1);
    expect(trace.bounces).toBeGreaterThanOrEqual(1);
  });

  it("resolves a matching shot and wins clear-all objective", () => {
    const board = createBoardState(simpleLevel);
    const summary = performShot(board, simpleLevel, -1.57);

    expect(summary.popped.length).toBeGreaterThanOrEqual(3);
    expect(summary.winAchieved).toBe(true);
    expect(board.status).toBe("won");
  });
});
