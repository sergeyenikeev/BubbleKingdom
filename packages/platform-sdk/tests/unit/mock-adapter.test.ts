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
});
