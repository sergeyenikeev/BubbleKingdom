import type { RemoteConfig } from "@bubble-kingdom/config";
import type { PlatformTarget, ShopOfferDefinition } from "@bubble-kingdom/shared";

import { shopCatalog } from "./catalog";

export interface CommerceOfferBinding {
  offerId: string;
  sku: string;
  productIds: Record<PlatformTarget, string>;
}

export function getShopOfferById(offerId: string): ShopOfferDefinition | undefined {
  return shopCatalog.find((offer) => offer.id === offerId);
}

export function resolvePlatformProductId(
  offer: ShopOfferDefinition,
  platformTarget: PlatformTarget,
  remoteConfig: RemoteConfig,
): string {
  const override = remoteConfig.commerce.productIdOverrides[platformTarget][offer.id];
  if (override) {
    return override;
  }

  if (platformTarget === "yandex") {
    return offer.yandexProductId ?? offer.sku;
  }

  return offer.sku;
}

export function buildCommerceBindings(remoteConfig: RemoteConfig): CommerceOfferBinding[] {
  return shopCatalog.map((offer) => ({
    offerId: offer.id,
    sku: offer.sku,
    productIds: {
      "web-mock": resolvePlatformProductId(offer, "web-mock", remoteConfig),
      yandex: resolvePlatformProductId(offer, "yandex", remoteConfig),
      vk: resolvePlatformProductId(offer, "vk", remoteConfig),
    },
  }));
}
