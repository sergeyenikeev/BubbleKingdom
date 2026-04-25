import { describe, expect, it } from "vitest";

import { defaultRemoteConfig } from "../../../config/src/index";
import { visualThemes } from "../../../game-data/src/index";
import {
  createDefaultSave,
  getMenuState,
  getStoreState,
  getVisibleThemeIds,
  isFeatureUnlocked,
} from "../../src/index";

describe("progressive disclosure", () => {
  const nowIso = "2026-04-08T00:00:00.000Z";

  function createSave() {
    return createDefaultSave({
      anonymousId: "anon-disclosure",
      language: "en",
      nowIso,
      remoteConfig: defaultRemoteConfig,
    });
  }

  it("keeps a fresh player in the simplest menu and store states", () => {
    const save = createSave();

    expect(getMenuState(save, defaultRemoteConfig)).toBe("menu_state_0");
    expect(getStoreState(save, defaultRemoteConfig)).toBe("store_state_0");
    expect(
      getVisibleThemeIds({
        themes: visualThemes,
        save,
        remoteConfig: defaultRemoteConfig,
      }),
    ).toEqual(["theme_blossom_gardens", "theme_crystal_fountain"]);
    expect(
      isFeatureUnlocked({
        feature: "leaderboards",
        save,
        remoteConfig: defaultRemoteConfig,
      }),
    ).toBe(false);
  });

  it("opens store offers gradually after the first session result", () => {
    const save = createSave();
    save.engagement.hasStartedLevel = true;
    save.engagement.firstLevelCompletedAt = nowIso;
    save.progression.completedLevels = [1];
    save.progression.currentLevelId = 2;

    expect(getMenuState(save, defaultRemoteConfig)).toBe("menu_state_2");
    expect(getStoreState(save, defaultRemoteConfig)).toBe("store_state_1");
    expect(
      isFeatureUnlocked({
        feature: "shop",
        save,
        remoteConfig: defaultRemoteConfig,
      }),
    ).toBe(true);
  });

  it("unlocks quests and more themes after the basic loop is learned", () => {
    const save = createSave();
    save.engagement.hasStartedLevel = true;
    save.engagement.firstLevelCompletedAt = nowIso;
    save.progression.completedLevels = [1, 2, 3];
    save.progression.currentLevelId = 4;

    expect(getMenuState(save, defaultRemoteConfig)).toBe("menu_state_3");
    expect(getStoreState(save, defaultRemoteConfig)).toBe("store_state_2");
    expect(
      isFeatureUnlocked({
        feature: "quests",
        save,
        remoteConfig: defaultRemoteConfig,
      }),
    ).toBe(true);
    expect(
      getVisibleThemeIds({
        themes: visualThemes,
        save,
        remoteConfig: defaultRemoteConfig,
      }),
    ).toEqual(["theme_blossom_gardens", "theme_crystal_fountain", "theme_castle_gates"]);
  });

  it("unlocks events and leaderboards for engaged players", () => {
    const save = createSave();
    save.engagement.hasStartedLevel = true;
    save.engagement.firstLevelCompletedAt = nowIso;
    save.progression.completedLevels = [1, 2, 3, 4, 5];
    save.progression.currentLevelId = 6;

    expect(getMenuState(save, defaultRemoteConfig)).toBe("menu_state_4");
    expect(
      isFeatureUnlocked({
        feature: "event",
        save,
        remoteConfig: defaultRemoteConfig,
        eventAvailable: true,
      }),
    ).toBe(true);
    expect(
      isFeatureUnlocked({
        feature: "leaderboards",
        save,
        remoteConfig: defaultRemoteConfig,
      }),
    ).toBe(true);
  });
});
