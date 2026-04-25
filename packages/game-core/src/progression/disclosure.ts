import type { RemoteConfig } from "@bubble-kingdom/config";
import type { VisualThemeDefinition } from "@bubble-kingdom/shared";

import type { PlayerSave } from "../save/schema";

export type MenuStateId =
  | "menu_state_0"
  | "menu_state_1"
  | "menu_state_2"
  | "menu_state_3"
  | "menu_state_4";

export type StoreStateId =
  | "store_state_0"
  | "store_state_1"
  | "store_state_2"
  | "store_state_3";

export type ProgressiveFeatureId =
  | "dailyRewards"
  | "shop"
  | "restoration"
  | "quests"
  | "event"
  | "leaderboards"
  | "inbox"
  | "seasonalTokens";

const fallbackProgressiveDisclosure: RemoteConfig["progressiveDisclosure"] = {
  enabled: true,
  menuUnlocks: {
    questsCompletedLevels: 3,
    eventsCompletedLevels: 5,
    leaderboardsCompletedLevels: 5,
    advancedLevel: 15,
    advancedSessions: 7,
  },
  store: {
    initialBuyableThemeId: "theme_crystal_fountain",
    maxVisibleThemeCardsByState: {
      store_state_0: 2,
      store_state_1: 2,
      store_state_2: 3,
      store_state_3: 4,
    },
    maxVisibleOffersByState: {
      store_state_0: 0,
      store_state_1: 1,
      store_state_2: 3,
      store_state_3: 12,
    },
  },
};

export function getMenuState(save: PlayerSave, remoteConfig: RemoteConfig): MenuStateId {
  const disclosureConfig = getProgressiveDisclosureConfig(remoteConfig);
  if (!disclosureConfig.enabled) {
    return "menu_state_4";
  }

  const completedLevels = save.progression.completedLevels.length;
  const hasStartedLevel = save.engagement.hasStartedLevel || completedLevels > 0;
  const hasCompletedFirstSession = hasFirstSessionResult(save);
  const hasBasicCycle =
    save.tutorial.completed || completedLevels >= disclosureConfig.menuUnlocks.questsCompletedLevels;
  const isEngaged =
    completedLevels >= disclosureConfig.menuUnlocks.eventsCompletedLevels ||
    save.engagement.sessionCount >= 3;
  const isAdvanced =
    save.progression.currentLevelId >= disclosureConfig.menuUnlocks.advancedLevel ||
    save.engagement.sessionCount >= disclosureConfig.menuUnlocks.advancedSessions ||
    save.economy.firstPurchaseAt !== null;

  if (!hasStartedLevel) {
    return "menu_state_0";
  }
  if (!hasCompletedFirstSession) {
    return "menu_state_1";
  }
  if (!hasBasicCycle) {
    return "menu_state_2";
  }
  if (!isEngaged && !isAdvanced) {
    return "menu_state_3";
  }
  return "menu_state_4";
}

export function getStoreState(save: PlayerSave, remoteConfig: RemoteConfig): StoreStateId {
  const disclosureConfig = getProgressiveDisclosureConfig(remoteConfig);
  if (!disclosureConfig.enabled) {
    return "store_state_3";
  }

  const completedLevels = save.progression.completedLevels.length;
  const hasBasicCycle =
    save.tutorial.completed || completedLevels >= disclosureConfig.menuUnlocks.questsCompletedLevels;
  const isEngaged =
    completedLevels >= disclosureConfig.menuUnlocks.eventsCompletedLevels ||
    save.engagement.sessionCount >= 3;

  if (!hasFirstSessionResult(save)) {
    return "store_state_0";
  }
  if (!hasBasicCycle) {
    return "store_state_1";
  }
  if (!isEngaged) {
    return "store_state_2";
  }
  return "store_state_3";
}

export function hasFirstSessionResult(save: PlayerSave): boolean {
  return (
    save.progression.completedLevels.length > 0 ||
    save.engagement.firstLevelCompletedAt !== null ||
    save.engagement.firstLevelFailedAt !== null
  );
}

export function isFeatureUnlocked(input: {
  feature: ProgressiveFeatureId;
  save: PlayerSave;
  remoteConfig: RemoteConfig;
  eventAvailable?: boolean;
}): boolean {
  const disclosureConfig = getProgressiveDisclosureConfig(input.remoteConfig);
  if (!disclosureConfig.enabled) {
    return true;
  }

  const completedLevels = input.save.progression.completedLevels.length;
  const menuState = getMenuState(input.save, input.remoteConfig);

  switch (input.feature) {
    case "dailyRewards":
      return hasFirstSessionResult(input.save);
    case "shop":
      return hasFirstSessionResult(input.save);
    case "restoration":
      return completedLevels > 0 || totalStarsFromSave(input.save) > 0 || input.save.progression.restoredNodes.length > 0;
    case "quests":
      return (
        input.save.tutorial.completed ||
        completedLevels >= disclosureConfig.menuUnlocks.questsCompletedLevels
      );
    case "event":
      return Boolean(input.eventAvailable) && (
        completedLevels >= disclosureConfig.menuUnlocks.eventsCompletedLevels ||
        input.save.currencies.seasonalTokens > 0 ||
        menuState === "menu_state_4"
      );
    case "leaderboards":
      return (
        input.remoteConfig.liveops.weeklyLeaderboardEnabled &&
        completedLevels >= disclosureConfig.menuUnlocks.leaderboardsCompletedLevels
      );
    case "inbox":
      return input.save.inbox.some((item) => !item.claimed);
    case "seasonalTokens":
      return input.save.currencies.seasonalTokens > 0 || menuState === "menu_state_4";
  }
}

export function canOpenScreenWithDisclosure(input: {
  screenId: string;
  save: PlayerSave;
  remoteConfig: RemoteConfig;
  eventAvailable?: boolean;
}): boolean {
  switch (input.screenId) {
    case "boot":
    case "map":
    case "level":
    case "preLevel":
    case "win":
    case "fail":
    case "settings":
      return true;
    case "shop":
      return true;
    case "dailyRewards":
      return isFeatureUnlocked({ ...input, feature: "dailyRewards" });
    case "quests":
      return isFeatureUnlocked({ ...input, feature: "quests" });
    case "event":
      return isFeatureUnlocked({ ...input, feature: "event" });
    case "restoration":
      return isFeatureUnlocked({ ...input, feature: "restoration" });
    case "leaderboards":
      return isFeatureUnlocked({ ...input, feature: "leaderboards" });
    case "inbox":
      return isFeatureUnlocked({ ...input, feature: "inbox" });
    default:
      return false;
  }
}

export function isThemeUnlockedForPurchase(
  theme: VisualThemeDefinition,
  save: PlayerSave,
  remoteConfig: RemoteConfig,
): boolean {
  switch (theme.unlock.type) {
    case "always":
      return true;
    case "completed_levels":
      return save.progression.completedLevels.length >= theme.unlock.count;
    case "current_level":
      return save.progression.currentLevelId >= theme.unlock.levelId;
    case "seasonal_tokens":
      return (
        save.currencies.seasonalTokens >= theme.unlock.amount ||
        isFeatureUnlocked({
          feature: "event",
          save,
          remoteConfig,
          eventAvailable: true,
        })
      );
  }
}

export function getVisibleThemeIds(input: {
  themes: VisualThemeDefinition[];
  save: PlayerSave;
  remoteConfig: RemoteConfig;
}): string[] {
  const storeState = getStoreState(input.save, input.remoteConfig);
  const disclosureConfig = getProgressiveDisclosureConfig(input.remoteConfig);
  const maxVisible =
    disclosureConfig.store.maxVisibleThemeCardsByState[storeState];
  const ids: string[] = [];
  const add = (themeId: string | null | undefined) => {
    if (themeId && !ids.includes(themeId) && input.themes.some((theme) => theme.id === themeId)) {
      ids.push(themeId);
    }
  };

  add(input.save.cosmetics.activeThemeId);

  const initialBuyableId = disclosureConfig.store.initialBuyableThemeId;
  add(initialBuyableId);

  if (storeState !== "store_state_0" && storeState !== "store_state_1") {
    for (const theme of input.themes) {
      if (ids.length >= maxVisible) {
        break;
      }
      if (isThemeUnlockedForPurchase(theme, input.save, input.remoteConfig)) {
        add(theme.id);
      }
    }
  }

  if (storeState === "store_state_3") {
    for (const theme of input.themes) {
      if (ids.length >= maxVisible) {
        break;
      }
      add(theme.id);
    }
  }

  return ids.slice(0, maxVisible);
}

function totalStarsFromSave(save: PlayerSave): number {
  return Object.values(save.progression.starsByLevel).reduce((total, stars) => total + stars, 0);
}

export function getProgressiveDisclosureConfig(remoteConfig: RemoteConfig) {
  return remoteConfig.progressiveDisclosure ?? fallbackProgressiveDisclosure;
}
