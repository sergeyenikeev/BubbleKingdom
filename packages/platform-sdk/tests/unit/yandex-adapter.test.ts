import { describe, expect, it } from "vitest";

import {
  mapYandexPurchaseReceipt,
  resolveYandexSdkUrl,
  shouldUseSignedYandexPayments,
} from "../../src/adapters/yandex";

describe("yandex adapter helpers", () => {
  it("uses the relative sdk path for yandex builds by default", () => {
    expect(resolveYandexSdkUrl("yandex")).toBe("/sdk.js");
  });

  it("keeps the CDN sdk path for non-yandex builds", () => {
    expect(resolveYandexSdkUrl("local")).toBe("https://sdk.games.s3.yandex.net/sdk.js");
    expect(resolveYandexSdkUrl("test")).toBe("https://sdk.games.s3.yandex.net/sdk.js");
  });

  it("allows an explicit sdk url override", () => {
    expect(resolveYandexSdkUrl("yandex", "https://example.com/sdk.js")).toBe(
      "https://example.com/sdk.js",
    );
  });

  it("enables signed payments only for server-side receipt validation", () => {
    expect(shouldUseSignedYandexPayments("server")).toBe(true);
    expect(shouldUseSignedYandexPayments("stub")).toBe(false);
    expect(shouldUseSignedYandexPayments("platform_only")).toBe(false);
  });

  it("preserves signed receipt data from yandex purchases", () => {
    const receipt = mapYandexPurchaseReceipt({
      productID: "starter_pack",
      purchaseToken: "purchase_123",
      signature: "signed_payload",
      developerPayload: "offer=starter_pack",
    });

    expect(receipt).toEqual({
      productId: "starter_pack",
      purchaseToken: "purchase_123",
      signature: "signed_payload",
      developerPayload: "offer=starter_pack",
    });
  });
});
