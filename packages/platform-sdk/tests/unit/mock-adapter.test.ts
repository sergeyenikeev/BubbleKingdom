import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPlatformAdapter } from "../../src/index";

describe("mock platform adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { language: "en-US" });
  });

  it("stores values in memory outside browser environments", async () => {
    const adapter = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      debug: true,
      analyticsSinks: [],
    });

    await adapter.storage.save("key", "value");
    await expect(adapter.storage.load("key")).resolves.toBe("value");
  });

  it("returns a basic purchase receipt", async () => {
    const adapter = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      analyticsSinks: [],
    });

    const receipt = await adapter.purchases.purchase("starter_pack");

    expect(receipt?.productId).toBe("starter_pack");
    expect(receipt?.purchaseToken).toContain("purchase_");
  });

  it("accepts receipts through the mock validator", async () => {
    const adapter = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      analyticsSinks: [],
    });

    const result = await adapter.purchases.validateReceipt?.({
      offerId: "starter_pack",
      productId: "starter_pack",
      purchaseToken: "purchase_test",
      anonymousId: "anon_test",
      platformTarget: "web-mock",
    });

    expect(result?.ok).toBe(true);
    expect(result?.shouldGrant).toBe(true);
    expect(result?.consumePurchase).toBe(true);
  });

  it("returns the full mock shop catalog for local monetization flows", async () => {
    const adapter = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      analyticsSinks: [],
    });

    const catalog = await adapter.purchases.getCatalog();
    const productIds = catalog.map((product) => product.id);

    expect(productIds).toContain("welcome_offer");
    expect(productIds).toContain("piggy_bank");
    expect(productIds).toContain("ad_light");
    expect(productIds).toContain("season_pass");
    expect(catalog).toHaveLength(11);
  });
});
