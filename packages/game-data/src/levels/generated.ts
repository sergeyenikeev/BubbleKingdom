import type { BubbleColor, LevelDefinition, ObjectiveType } from "@bubble-kingdom/shared";

import { curatedLevels } from "./curated";
import { createQueuePattern, tokenForColor } from "./helpers";

const palettes: BubbleColor[][] = [
  ["ruby", "sapphire", "emerald", "sun"],
  ["ruby", "emerald", "sun", "amethyst"],
  ["sapphire", "emerald", "sun", "aqua"],
  ["ruby", "sapphire", "amethyst", "aqua"],
  ["ruby", "emerald", "amethyst", "aqua"],
];

const objectives: ObjectiveType[] = [
  "clear_all",
  "collect_crystals",
  "free_sprites",
  "break_blockers",
  "clear_fog",
  "drop_artifacts",
  "grow_flowers",
];

function colorToken(palette: BubbleColor[], index: number, prefix = ""): string {
  return `${prefix}${tokenForColor(palette[index % palette.length] ?? palette[0] ?? "ruby")}`;
}

function createBaseRows(palette: BubbleColor[], seed: number): string[] {
  const rows: string[] = [];
  for (let row = 0; row < 10; row += 1) {
    const cells = Array.from({ length: 8 }, (_, col) => {
      const color = palette[(row + col + seed) % palette.length] ?? palette[0]!;
      return tokenForColor(color);
    });
    rows.push(cells.join(" "));
  }
  return rows;
}

function injectSpecials(
  rows: string[],
  objective: ObjectiveType,
  levelId: number,
  palette: BubbleColor[],
): string[] {
  const split = rows.map((row) => row.split(" "));
  const lane = levelId % 4;

  if (levelId >= 32) {
    split[2]![lane + 1] = "S";
  }
  if (levelId >= 38) {
    split[3]![4 - lane] = colorToken(palette, 0, "I");
  }
  if (levelId >= 44) {
    split[4]![lane + 2] = colorToken(palette, 1, "V");
  }
  if (levelId >= 52) {
    split[5]![3] = colorToken(palette, 2, "F");
  }

  switch (objective) {
    case "collect_crystals":
      split[7]![2] = colorToken(palette, 0, "C");
      split[7]![5] = colorToken(palette, 1, "C");
      break;
    case "free_sprites":
      split[6]![3] = colorToken(palette, 0, "P");
      split[6]![4] = colorToken(palette, 1, "P");
      break;
    case "break_blockers":
      split[2]![1] = "S";
      split[2]![6] = "S";
      split[3]![2] = colorToken(palette, 0, "I");
      split[3]![5] = colorToken(palette, 1, "I");
      break;
    case "clear_fog":
      split[5]![2] = colorToken(palette, 0, "F");
      split[5]![5] = colorToken(palette, 1, "F");
      split[6]![3] = colorToken(palette, 2, "F");
      break;
    case "drop_artifacts":
      split[4]![3] = colorToken(palette, 0, "A");
      split[5]![3] = ".";
      split[6]![3] = ".";
      split[7]![3] = ".";
      break;
    case "grow_flowers":
      split[6]![2] = colorToken(palette, 0, "H");
      split[6]![5] = colorToken(palette, 1, "H");
      break;
    default:
      break;
  }

  return split.map((row) => row.join(" "));
}

export function generateProceduralLevels(startId = 31, count = 70): LevelDefinition[] {
  return Array.from({ length: count }, (_, index) => {
    const levelId = startId + index;
    const palette = palettes[index % palettes.length]!;
    const objective = objectives[index % objectives.length]!;
    const chapterId =
      levelId <= 50 ? "chapter_blossom_gardens" : "chapter_moonlit_courtyard";
    const layout = injectSpecials(createBaseRows(palette, levelId), objective, levelId, palette);
    const objectiveTargetMap: Partial<Record<ObjectiveType, number>> = {
      collect_crystals: 2,
      free_sprites: 2,
      break_blockers: 4,
      clear_fog: 3,
      drop_artifacts: 1,
      grow_flowers: 2,
    };
    const queueOptions: Parameters<typeof createQueuePattern>[2] = {};
    const specials: NonNullable<Parameters<typeof createQueuePattern>[2]>["specials"] = [];
    if (levelId >= 40) {
      specials.push({ index: 8, value: "bomb" });
    }
    if (levelId >= 56) {
      specials.push({ index: 12, value: "line" });
    }
    if (levelId >= 72) {
      specials.push({ index: 16, value: "rainbow" });
    }
    if (specials.length > 0) {
      queueOptions.specials = specials;
    }

    return {
      id: levelId,
      chapterId,
      indexInChapter: levelId <= 50 ? levelId : levelId - 50,
      moves: Math.max(12, 22 - Math.floor((levelId - startId) / 9)),
      palette,
      objective:
        objective === "clear_all"
          ? { type: objective }
          : { type: objective, target: objectiveTargetMap[objective] ?? 2 },
      layout,
      queue: createQueuePattern(palette, levelId, queueOptions),
      rewards: {
        gold: 55 + levelId * 6,
        petals: 8 + Math.floor(levelId / 4),
        seasonalTokens: levelId >= 45 ? 3 + Math.floor(levelId / 10) : 0,
      },
      difficulty: levelId < 45 ? "medium" : "hard",
    };
  });
}

export const levels = [...curatedLevels, ...generateProceduralLevels()];
