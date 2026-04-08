import { chapters } from "./content/chapters";
import { dailyRewards } from "./content/dailyRewards";
import { questDefinitions } from "./content/quests";
import { validateChapters, validateLevelData } from "./content/validation";
import { levels } from "./levels/generated";
import { shopCatalog } from "./shop/catalog";

export * from "./content/chapters";
export * from "./content/dailyRewards";
export * from "./content/quests";
export * from "./content/validation";
export * from "./levels/generated";
export * from "./shop/catalog";
export * from "./shop/commerce";

export const contentVersion = "2026.04.08-mvp";

export const contentValidationErrors = [
  ...validateLevelData(levels),
  ...validateChapters(chapters, levels),
];

if (contentValidationErrors.length > 0) {
  throw new Error(`Game content validation failed:\n${contentValidationErrors.join("\n")}`);
}

export const liveContent = {
  chapters,
  dailyRewards,
  quests: questDefinitions,
  levels,
  shopCatalog,
};
