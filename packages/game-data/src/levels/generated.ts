import type { BubbleColor, LevelDefinition, ObjectiveType } from "@bubble-kingdom/shared";

const colorTokens: Record<BubbleColor, string> = {
  ruby: "R",
  sapphire: "B",
  emerald: "G",
  sun: "Y",
  amethyst: "P",
  aqua: "C",
};

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

function tokenForColor(color: BubbleColor): string {
  return colorTokens[color];
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

function injectSpecials(rows: string[], objective: ObjectiveType, levelId: number): string[] {
  const split = rows.map((row) => row.split(" "));
  const lane = levelId % 4;

  if (levelId >= 5) {
    split[2]![lane + 1] = "S";
  }
  if (levelId >= 8) {
    split[3]![4 - lane] = "IR";
  }
  if (levelId >= 12) {
    split[4]![lane + 2] = "VR";
  }
  if (levelId >= 18) {
    split[5]![3] = "FC";
  }

  switch (objective) {
    case "collect_crystals":
      split[7]![2] = "CR";
      split[7]![5] = "CB";
      break;
    case "free_sprites":
      split[6]![3] = "PR";
      split[6]![4] = "PG";
      break;
    case "break_blockers":
      split[2]![1] = "S";
      split[2]![6] = "S";
      split[3]![2] = "IR";
      split[3]![5] = "IB";
      break;
    case "clear_fog":
      split[5]![2] = "FR";
      split[5]![5] = "FG";
      split[6]![3] = "FY";
      break;
    case "drop_artifacts":
      split[4]![3] = "AR";
      split[5]![3] = ".";
      split[6]![3] = ".";
      split[7]![3] = ".";
      break;
    case "grow_flowers":
      split[6]![2] = "HR";
      split[6]![5] = "HG";
      break;
    default:
      break;
  }

  return split.map((row) => row.join(" "));
}

function createQueue(palette: BubbleColor[], levelId: number): LevelDefinition["queue"] {
  return Array.from({ length: 24 }, (_, index) => {
    if (index > 0 && index % 9 === 0 && levelId >= 10) {
      return "bomb";
    }
    if (index > 0 && index % 11 === 0 && levelId >= 18) {
      return "line";
    }
    if (index > 0 && index % 13 === 0 && levelId >= 22) {
      return "rainbow";
    }
    return palette[(index + levelId) % palette.length]!;
  });
}

export function generateLevels(): LevelDefinition[] {
  return Array.from({ length: 100 }, (_, index) => {
    const levelId = index + 1;
    const palette = palettes[index % palettes.length]!;
    const objective = objectives[index % objectives.length]!;
    const chapterId =
      levelId <= 50 ? "chapter_blossom_gardens" : "chapter_moonlit_courtyard";
    const layout = injectSpecials(createBaseRows(palette, levelId), objective, levelId);

    return {
      id: levelId,
      chapterId,
      indexInChapter: levelId <= 50 ? levelId : levelId - 50,
      moves: Math.max(14, 24 - Math.floor(levelId / 8)),
      palette,
      objective:
        objective === "clear_all"
          ? { type: objective }
          : { type: objective, target: objective === "break_blockers" ? 4 : 2 + (levelId % 4) },
      layout,
      queue: createQueue(palette, levelId),
      rewards: {
        gold: 50 + levelId * 6,
        petals: 5 + Math.floor(levelId / 4),
        seasonalTokens: levelId >= 20 ? 3 + Math.floor(levelId / 10) : 0,
      },
      difficulty: levelId < 15 ? "easy" : levelId < 50 ? "medium" : "hard",
    };
  });
}

export const levels = generateLevels();
