import { describe, expect, it } from "vitest";

import { chapters } from "../../src/content/chapters";
import { validateChapters, validateLevelData } from "../../src/content/validation";
import { curatedLevels } from "../../src/levels/curated";
import { levels } from "../../src/levels/generated";
import type { LevelDefinition } from "../../../shared/src/index";

describe("game data validation", () => {
  it("ships with a hand-authored early curve followed by a procedural tail", () => {
    expect(curatedLevels).toHaveLength(30);
    expect(levels[0]?.id).toBe(1);
    expect(levels[29]?.id).toBe(30);
    expect(levels[30]?.id).toBe(31);
    expect(levels).toHaveLength(100);
  });

  it("validates the shipped level and chapter content without errors", () => {
    expect(validateLevelData(levels)).toEqual([]);
    expect(validateChapters(chapters, levels)).toEqual([]);
  });

  it("flags levels with objective targets that exceed board content", () => {
    const invalid: LevelDefinition = {
      ...curatedLevels[3]!,
      id: 9001,
      objective: { type: "collect_crystals", target: 5 },
    };

    expect(validateLevelData([invalid])).toContain(
      "Level 9001 objective collect_crystals target 5 exceeds available board content 2.",
    );
  });

  it("flags levels that use queue colors outside their palette", () => {
    const invalid: LevelDefinition = {
      ...curatedLevels[0]!,
      id: 9002,
      queue: ["emerald", ...curatedLevels[0]!.queue.slice(1)],
    };

    expect(validateLevelData([invalid])).toContain(
      "Level 9002 queue uses color emerald outside its palette.",
    );
  });
});
