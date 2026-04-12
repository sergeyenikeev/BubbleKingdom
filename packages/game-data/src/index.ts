import { chapters } from "./content/chapters";
import { dailyRewards } from "./content/dailyRewards";
import { liveEvents } from "./content/events";
import { questDefinitions } from "./content/quests";
import { validateChapters, validateEvents, validateLevelData } from "./content/validation";
import { levels } from "./levels/generated";
import { shopCatalog } from "./shop/catalog";

export * from "./content/chapters";
export * from "./content/dailyRewards";
export * from "./content/events";
export * from "./content/quests";
export * from "./content/validation";
export * from "./levels/curated";
export * from "./levels/generated";
export * from "./levels/helpers";
export * from "./shop/catalog";
export * from "./shop/commerce";

export const contentVersion = "2026.04.09-mvp.2";

export const contentValidationErrors = [
  ...validateLevelData(levels),
  ...validateChapters(chapters, levels),
  ...validateEvents(liveEvents),
];

if (contentValidationErrors.length > 0) {
  throw new Error(`Game content validation failed:\n${contentValidationErrors.join("\n")}`);
}

export const liveContent = {
  chapters,
  dailyRewards,
  events: liveEvents,
  quests: questDefinitions,
  levels,
  shopCatalog,
};
