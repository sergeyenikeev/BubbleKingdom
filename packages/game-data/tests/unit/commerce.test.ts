import { describe, expect, it } from "vitest";

import { defaultRemoteConfig } from "../../../config/src/index";
import { buildCommerceBindings, resolvePlatformProductId, shopCatalog } from "../../src/index";

describe("commerce bindings", () => {
  it("resolves yandex product ids from the offer catalog by default", () => {
    const starterPack = shopCatalog.find((offer) => offer.id === "starter_pack");
    if (!starterPack) {
      throw new Error("Starter pack offer was not found.");
    }

    expect(resolvePlatformProductId(starterPack, "yandex", defaultRemoteConfig)).toBe(
      "starter_pack",
    );
    expect(resolvePlatformProductId(starterPack, "web-mock", defaultRemoteConfig)).toBe(
      starterPack.sku,
    );
  });

  it("allows remote config overrides for platform product ids", () => {
    const starterPack = shopCatalog.find((offer) => offer.id === "starter_pack");
    if (!starterPack) {
      throw new Error("Starter pack offer was not found.");
    }

    const config = {
      ...defaultRemoteConfig,
      commerce: {
        ...defaultRemoteConfig.commerce,
        productIdOverrides: {
          ...defaultRemoteConfig.commerce.productIdOverrides,
          yandex: {
            ...defaultRemoteConfig.commerce.productIdOverrides.yandex,
            starter_pack: "starter_pack_discounted",
          },
        },
      },
    };

    expect(resolvePlatformProductId(starterPack, "yandex", config)).toBe(
      "starter_pack_discounted",
    );
  });

  it("builds bindings for every live shop offer", () => {
    const bindings = buildCommerceBindings(defaultRemoteConfig);

    expect(bindings).toHaveLength(shopCatalog.length);
    expect(bindings.some((binding) => binding.offerId === "season_pass")).toBe(true);
  });
});
