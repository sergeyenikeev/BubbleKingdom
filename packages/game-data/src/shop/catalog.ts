import type { ShopOfferDefinition } from "@bubble-kingdom/shared";

export const shopCatalog: ShopOfferDefinition[] = [
  {
    id: "starter_pack",
    sku: "starter_pack",
    titleKey: "shop.starter.title",
    descriptionKey: "shop.starter.description",
    type: "starter_pack",
    price: {
      platformPriceId: "starter_pack",
    },
    rewards: {
      source: "purchase",
      gold: 1000,
      gems: 120,
      boosters: {
        bombOrb: 3,
        rainbowOrb: 3,
        precisionAim: 3,
      },
    },
    badgeKey: "shop.badge.bestValue",
    yandexProductId: "starter_pack",
  },
  {
    id: "welcome_offer",
    sku: "welcome_offer",
    titleKey: "shop.welcome.title",
    descriptionKey: "shop.welcome.description",
    type: "welcome_offer",
    price: {
      platformPriceId: "welcome_offer",
    },
    rewards: {
      source: "purchase",
      gold: 500,
      gems: 70,
      boosters: {
        precisionAim: 4,
      },
    },
    badgeKey: "shop.badge.limited",
    yandexProductId: "welcome_offer",
  },
  {
    id: "gem_pack_s",
    sku: "gem_pack_s",
    titleKey: "shop.gems.s.title",
    descriptionKey: "shop.gems.s.description",
    type: "gem_pack",
    price: {
      platformPriceId: "gem_pack_s",
    },
    rewards: {
      source: "purchase",
      gems: 75,
    },
    yandexProductId: "gem_pack_s",
  },
  {
    id: "gem_pack_m",
    sku: "gem_pack_m",
    titleKey: "shop.gems.m.title",
    descriptionKey: "shop.gems.m.description",
    type: "gem_pack",
    price: {
      platformPriceId: "gem_pack_m",
    },
    rewards: {
      source: "purchase",
      gems: 180,
    },
    badgeKey: "shop.badge.popular",
    yandexProductId: "gem_pack_m",
  },
  {
    id: "gem_pack_l",
    sku: "gem_pack_l",
    titleKey: "shop.gems.l.title",
    descriptionKey: "shop.gems.l.description",
    type: "gem_pack",
    price: {
      platformPriceId: "gem_pack_l",
    },
    rewards: {
      source: "purchase",
      gems: 420,
    },
    badgeKey: "shop.badge.bestValue",
    yandexProductId: "gem_pack_l",
  },
  {
    id: "booster_pack",
    sku: "booster_pack",
    titleKey: "shop.booster.title",
    descriptionKey: "shop.booster.description",
    type: "booster_pack",
    price: {
      platformPriceId: "booster_pack",
    },
    rewards: {
      source: "purchase",
      boosters: {
        bombOrb: 3,
        rainbowOrb: 2,
        precisionAim: 5,
        extraMoves: 2,
      },
    },
    yandexProductId: "booster_pack",
  },
  {
    id: "renovation_pack",
    sku: "renovation_pack",
    titleKey: "shop.renovation.title",
    descriptionKey: "shop.renovation.description",
    type: "renovation_pack",
    price: {
      platformPriceId: "renovation_pack",
    },
    rewards: {
      source: "purchase",
      gold: 1500,
      petals: 120,
    },
    yandexProductId: "renovation_pack",
  },
  {
    id: "piggy_bank",
    sku: "piggy_bank",
    titleKey: "shop.piggy.title",
    descriptionKey: "shop.piggy.description",
    type: "piggy_bank",
    price: {
      platformPriceId: "piggy_bank",
    },
    rewards: {
      source: "purchase",
      gems: 250,
    },
    badgeKey: "shop.badge.full",
    yandexProductId: "piggy_bank",
  },
  {
    id: "no_ads",
    sku: "no_ads",
    titleKey: "shop.noads.title",
    descriptionKey: "shop.noads.description",
    type: "no_ads",
    price: {
      platformPriceId: "no_ads",
    },
    rewards: {
      source: "purchase",
      gems: 40,
    },
    yandexProductId: "no_ads",
  },
  {
    id: "season_pass",
    sku: "season_pass",
    titleKey: "shop.season.title",
    descriptionKey: "shop.season.description",
    type: "season_pass",
    price: {
      platformPriceId: "season_pass",
    },
    rewards: {
      source: "purchase",
      gems: 80,
      seasonalTokens: 120,
      boosters: {
        bombOrb: 2,
        rainbowOrb: 2,
      },
    },
    badgeKey: "shop.badge.season",
    yandexProductId: "season_pass",
  },
];
