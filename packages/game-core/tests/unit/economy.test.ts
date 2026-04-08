import { describe, expect, it } from "vitest";

import {
  applyRewardGrant,
  applyShopOffer,
  calculateExtraMovesGemCost,
  calculatePiggyBankBonusGems,
} from "../../src/index";
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

  it("turns no ads purchase into a permanent entitlement", () => {
    const save = createDefaultSave({
      anonymousId: "anon_test",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });

    const updated = applyShopOffer(save, {
      id: "no_ads",
      sku: "no_ads",
      titleKey: "shop.noads.title",
      descriptionKey: "shop.noads.description",
      type: "no_ads",
      price: { platformPriceId: "no_ads" },
      rewards: {
        source: "purchase",
        gems: 40,
      },
      yandexProductId: "no_ads",
    });

    expect(updated.economy.noAdsPurchased).toBe(true);
    expect(updated.economy.adLightPurchased).toBe(true);
    expect(updated.economy.firstPurchaseAt).not.toBeNull();
  });

  it("converts piggy bank progress into bonus gems and resets the bank", () => {
    const save = createDefaultSave({
      anonymousId: "anon_test",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    save.economy.piggyBankGold = 120;

    expect(calculatePiggyBankBonusGems(save)).toBe(30);

    const updated = applyShopOffer(save, {
      id: "piggy_bank",
      sku: "piggy_bank",
      titleKey: "shop.piggy.title",
      descriptionKey: "shop.piggy.description",
      type: "piggy_bank",
      price: { platformPriceId: "piggy_bank" },
      rewards: {
        source: "purchase",
        gems: 250,
      },
      yandexProductId: "piggy_bank",
    });

    expect(updated.currencies.gems).toBe(save.currencies.gems + 280);
    expect(updated.economy.piggyBankGold).toBe(0);
  });
});
