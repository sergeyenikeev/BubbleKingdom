import type { ChapterDefinition, LevelDefinition, ObjectiveType } from "@bubble-kingdom/shared";

import { collectLayoutColors, countLayoutKinds, parseLayoutToken } from "../levels/helpers";

const objectiveSources: Record<Exclude<ObjectiveType, "clear_all">, Array<string>> = {
  collect_crystals: ["crystal"],
  free_sprites: ["pet"],
  break_blockers: ["stone", "ice", "vine"],
  clear_fog: ["fog"],
  grow_flowers: ["flower"],
  drop_artifacts: ["artifact"],
};

export function validateLevelData(levels: LevelDefinition[]): string[] {
  const errors: string[] = [];
  const seen = new Set<number>();

  for (const level of levels) {
    if (seen.has(level.id)) {
      errors.push(`Duplicate level id ${level.id}`);
    }
    seen.add(level.id);

    if (level.layout.length < 6) {
      errors.push(`Level ${level.id} has too few rows.`);
    }

    const rowWidths = level.layout.map((row) => row.split(" ").length);
    const expectedWidth = rowWidths[0] ?? 0;
    if (expectedWidth <= 0) {
      errors.push(`Level ${level.id} has an empty layout.`);
    }
    if (!rowWidths.every((width) => width === expectedWidth)) {
      errors.push(`Level ${level.id} has inconsistent row widths.`);
    }
    if (expectedWidth !== 8) {
      errors.push(`Level ${level.id} must use 8 columns, got ${expectedWidth}.`);
    }

    if (level.moves < 8) {
      errors.push(`Level ${level.id} moves too low.`);
    }
    if (level.moves > 22) {
      errors.push(`Level ${level.id} moves too high.`);
    }

    if (level.palette.length < 2) {
      errors.push(`Level ${level.id} palette too small.`);
    }
    if (level.queue.length < 12) {
      errors.push(`Level ${level.id} queue too short.`);
    }

    for (const row of level.layout) {
      for (const token of row.split(" ")) {
        try {
          parseLayoutToken(token);
        } catch (error) {
          errors.push(
            `Level ${level.id} has invalid token ${token}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    const layoutColors = collectLayoutColors(level.layout);
    for (const color of layoutColors) {
      if (!level.palette.includes(color)) {
        errors.push(`Level ${level.id} uses layout color ${color} outside its palette.`);
      }
    }

    for (const item of level.queue) {
      if (item !== "rainbow" && item !== "bomb" && item !== "line" && !level.palette.includes(item)) {
        errors.push(`Level ${level.id} queue uses color ${item} outside its palette.`);
      }
    }

    if (level.objective.type === "clear_all") {
      continue;
    }

    if (!level.objective.target || level.objective.target <= 0) {
      errors.push(`Level ${level.id} objective ${level.objective.type} needs a positive target.`);
      continue;
    }

    const counts = countLayoutKinds(level.layout);
    const available = objectiveSources[level.objective.type].reduce(
      (total, kind) => total + (counts[kind as keyof typeof counts] ?? 0),
      0,
    );
    if (available < level.objective.target) {
      errors.push(
        `Level ${level.id} objective ${level.objective.type} target ${level.objective.target} exceeds available board content ${available}.`,
      );
    }
  }

  return errors;
}

export function validateChapters(
  chapters: ChapterDefinition[],
  levels: LevelDefinition[],
): string[] {
  const errors: string[] = [];
  const levelsById = new Map(levels.map((level) => [level.id, level]));

  for (const chapter of chapters) {
    const seenIndexes = new Set<number>();

    for (const levelId of chapter.levels) {
      const level = levelsById.get(levelId);
      if (!level) {
        errors.push(`Chapter ${chapter.id} references missing level ${levelId}`);
        continue;
      }

      if (level.chapterId !== chapter.id) {
        errors.push(`Level ${level.id} chapter mismatch: ${level.chapterId} !== ${chapter.id}`);
      }

      if (seenIndexes.has(level.indexInChapter)) {
        errors.push(`Chapter ${chapter.id} has duplicate index ${level.indexInChapter}`);
      }
      seenIndexes.add(level.indexInChapter);
    }

    chapter.levels.forEach((levelId, index) => {
      const level = levelsById.get(levelId);
      const expectedIndex = index + 1;
      if (level && level.indexInChapter !== expectedIndex) {
        errors.push(
          `Level ${level.id} expected chapter index ${expectedIndex} but got ${level.indexInChapter}.`,
        );
      }
    });
  }

  return errors;
}
