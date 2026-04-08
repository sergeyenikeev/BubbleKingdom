import { describe, expect, it } from "vitest";

import { calculateExtraMovesGemCost, applyRewardGrant } from "../../src/index";
import { defaultRemoteConfig } from "../../../config/src/index";

import { createDefaultSave } from "../../src/save/schema";

describe("economy", () => {
  it("applies rewards to currencies and boosters", () => {
    const save = createDefaultSave({
      anonymousId: "anon_test",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });

    const updated = applyRewardGrant(save, {
      source: "quest",
      gold: 120,
      gems: 10,
      boosters: {
        bombOrb: 2,
      },
    });

    expect(updated.currencies.gold).toBe(save.currencies.gold + 120);
    expect(updated.currencies.gems).toBe(save.currencies.gems + 10);
    expect(updated.boosters.bombOrb).toBe((save.boosters.bombOrb ?? 0) + 2);
  });

  it("scales extra move price by fail count", () => {
    expect(calculateExtraMovesGemCost(0, defaultRemoteConfig)).toBe(12);
    expect(calculateExtraMovesGemCost(3, defaultRemoteConfig)).toBe(18);
  });
});
