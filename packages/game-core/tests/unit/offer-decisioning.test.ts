import { describe, expect, it } from "vitest";

import { defaultRemoteConfig } from "../../../config/src/index";
import {
  decideFailOffer,
  getPiggyBankPresentation,
} from "../../src/economy/offerDecisioning";
import { createDefaultSave } from "../../src/save/schema";

function createSave() {
  return createDefaultSave({
    anonymousId: "anon_test",
    language: "en",
    nowIso: "2026-04-08T00:00:00.000Z",
    remoteConfig: defaultRemoteConfig,
  });
}

describe("offer decisioning", () => {
  it("defaults to rewarded continues in the early game", () => {
    const save = createSave();

    const decision = decideFailOffer({
      save,
      remoteConfig: defaultRemoteConfig,
      shopOffers: [{ id: "piggy_bank", type: "piggy_bank" }],
      continueOffersUsed: 0,
    });

    expect(decision.primaryAction).toBe("rewarded_continue");
    expect(decision.headlineKey).toBe("fail.offer.rewarded.title");
  });

  it("can prioritize gem continues for later players with the gems variant", () => {
    const save = createSave();
    save.progression.currentLevelId = 24;
    save.currencies.gems = 60;
    save.economy.rewardedViews = 4;
    save.experiments.fail_offer_variant = "gems_primary";

    const decision = decideFailOffer({
      save,
      remoteConfig: defaultRemoteConfig,
      shopOffers: [{ id: "piggy_bank", type: "piggy_bank" }],
      continueOffersUsed: 1,
    });

    expect(decision.primaryAction).toBe("gems_continue");
    expect(decision.gemCost).toBeGreaterThan(0);
  });

  it("can spotlight piggy bank offers when gems are low and the bank is nearly full", () => {
    const save = createSave();
    save.progression.currentLevelId = 18;
    save.currencies.gems = 3;
    save.economy.piggyBankGold = Math.ceil(
      defaultRemoteConfig.economy.piggyBankCap * defaultRemoteConfig.economy.piggyBankSpotlightRatio,
    );
    save.experiments.fail_offer_variant = "piggy_primary";

    const decision = decideFailOffer({
      save,
      remoteConfig: defaultRemoteConfig,
      shopOffers: [{ id: "piggy_bank", type: "piggy_bank" }],
      continueOffersUsed: 0,
    });

    expect(decision.primaryAction).toBe("piggy_bank");
    expect(decision.piggyBank?.isSpotlighted).toBe(true);
  });

  it("returns piggy bank presentation with fill percentage and bonus gems", () => {
    const save = createSave();
    save.economy.piggyBankGold = 150;

    const presentation = getPiggyBankPresentation(save, defaultRemoteConfig, [
      { id: "piggy_bank", type: "piggy_bank" },
    ]);

    expect(presentation?.fillPercent).toBe(50);
    expect(presentation?.bonusGems).toBeGreaterThan(0);
  });
});
