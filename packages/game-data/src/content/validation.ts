import type { ChapterDefinition, LevelDefinition } from "@bubble-kingdom/shared";

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

    if (level.moves < 8) {
      errors.push(`Level ${level.id} moves too low.`);
    }
  }

  return errors;
}

export function validateChapters(
  chapters: ChapterDefinition[],
  levels: LevelDefinition[],
): string[] {
  const errors: string[] = [];
  const levelIds = new Set(levels.map((level) => level.id));

  for (const chapter of chapters) {
    for (const levelId of chapter.levels) {
      if (!levelIds.has(levelId)) {
        errors.push(`Chapter ${chapter.id} references missing level ${levelId}`);
      }
    }
  }

  return errors;
}
