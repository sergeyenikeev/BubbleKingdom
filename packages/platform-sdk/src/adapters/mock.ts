import { createId, normalizeLanguage, type LeaderboardEntry } from "@bubble-kingdom/shared";

import type { AdapterRuntimeOptions } from "./shared";
import {
  createLocalStorageBridge,
  createRuntimeContext,
  loadAnonymousId,
  resolveRemoteConfig,
} from "./shared";
import type { PlatformAdapter, PlatformProduct, PurchaseReceipt } from "../interfaces";

const mockProducts: PlatformProduct[] = [
  {
    id: "starter_pack",
    title: "Starter Pack",
    description: "Gems, gold, and boosters for a strong opening.",
    price: "149 RUB",
    priceValue: "149",
    priceCurrencyCode: "RUB",
  },
  {
    id: "welcome_offer",
    title: "Welcome Offer",
    description: "A limited starter boost for your first sessions.",
    price: "99 RUB",
    priceValue: "99",
    priceCurrencyCode: "RUB",
  },
  {
    id: "gem_pack_s",
    title: "Gem Pack S",
    description: "A compact bundle of gems.",
    price: "99 RUB",
    priceValue: "99",
    priceCurrencyCode: "RUB",
  },
  {
    id: "gem_pack_m",
    title: "Gem Pack M",
    description: "A mid-sized gem pack for event and continue spending.",
    price: "199 RUB",
    priceValue: "199",
    priceCurrencyCode: "RUB",
  },
  {
    id: "gem_pack_l",
    title: "Gem Pack L",
    description: "A large gem bundle for longer progression runs.",
    price: "399 RUB",
    priceValue: "399",
    priceCurrencyCode: "RUB",
  },
  {
    id: "booster_pack",
    title: "Booster Pack",
    description: "Precision tools for tough levels.",
    price: "149 RUB",
    priceValue: "149",
    priceCurrencyCode: "RUB",
  },
  {
    id: "renovation_pack",
    title: "Renovation Pack",
    description: "A gold and petals burst for fast kingdom restoration.",
    price: "199 RUB",
    priceValue: "199",
    priceCurrencyCode: "RUB",
  },
  {
    id: "piggy_bank",
    title: "Piggy Bank",
    description: "Break open stored progress for bonus gems.",
    price: "129 RUB",
    priceValue: "129",
    priceCurrencyCode: "RUB",
  },
  {
    id: "no_ads",
    title: "No Ads",
    description: "Remove interstitial ads and reduce banner pressure.",
    price: "249 RUB",
    priceValue: "249",
    priceCurrencyCode: "RUB",
  },
  {
    id: "season_pass",
    title: "Season Pass",
    description: "Unlock a premium seasonal reward track.",
    price: "299 RUB",
    priceValue: "299",
    priceCurrencyCode: "RUB",
  },
];

export function createMockPlatformAdapter(options: AdapterRuntimeOptions): PlatformAdapter {
  const storagePrefix = options.storagePrefix ?? "bubble-kingdom";
  const anonymousId = typeof window === "undefined" ? createId("anon") : loadAnonymousId(storagePrefix);
  const runtime = createRuntimeContext(options, anonymousId);
  const storage =
    typeof window === "undefined"
      ? createMemoryStorage()
      : createPersistentStorage(storagePrefix);
  const pendingPurchases: PurchaseReceipt[] = [];
  const leaderboard = new Map<string, LeaderboardEntry[]>();

  return {
    target: "web-mock",
    session: runtime.session,
    async boot() {
      runtime.logger.info("SDK", "Mock adapter booted", { storagePrefix });
    },
    auth: {
      async getIdentity() {
        return {
          anonymousId: runtime.session.anonymousId,
          authenticated: false,
        };
      },
      async promptLogin(reason) {
        runtime.logger.info("AUTH", "Mock login prompt skipped", { reason });
        return {
          anonymousId: runtime.session.anonymousId,
          authenticated: false,
        };
      },
      async canPromptLogin() {
        return true;
      },
    },
    ads: {
      async showInterstitial(reason) {
        runtime.logger.info("ADS", "Mock interstitial shown", { reason });
        await delay(150);
        return { shown: true };
      },
      async showRewarded(reason) {
        runtime.logger.info("ADS", "Mock rewarded shown", { reason });
        await delay(200);
        return { shown: true, rewarded: true };
      },
      async setStickyBannerVisible(visible) {
        runtime.logger.debug("ADS", "Mock banner visibility updated", { visible });
        return visible;
      },
    },
    purchases: {
      async getCatalog() {
        return mockProducts;
      },
      async purchase(productId, developerPayload) {
        const receipt: PurchaseReceipt = {
          productId,
          purchaseToken: createId("purchase"),
        };
        if (developerPayload) {
          receipt.developerPayload = developerPayload;
        }
        pendingPurchases.push(receipt);
        runtime.logger.info("IAP", "Mock purchase created", { productId });
        return receipt;
      },
      async getPendingPurchases() {
        return [...pendingPurchases];
      },
      async consumePurchase(purchaseToken) {
        const index = pendingPurchases.findIndex(
          (purchase) => purchase.purchaseToken === purchaseToken,
        );
        if (index >= 0) {
          pendingPurchases.splice(index, 1);
        }
      },
      async validateReceipt(input) {
        runtime.logger.info("IAP", "Mock receipt validation accepted", {
          offerId: input.offerId,
          productId: input.productId,
        });
        return {
          ok: true,
          status: "accepted_stub",
          shouldGrant: true,
          consumePurchase: true,
          source: "stub",
        };
      },
    },
    storage,
    cloudSave: {
      async isAvailable() {
        return false;
      },
      async loadCloud() {
        return null;
      },
      async saveCloud() {
        return;
      },
    },
    leaderboards: {
      async getEntries(boardId) {
        return leaderboard.get(boardId) ?? [];
      },
      async submitScore(boardId, score) {
        const entries = leaderboard.get(boardId) ?? [];
        const existing = entries.find((entry) => entry.playerId === runtime.session.anonymousId);
        if (existing) {
          existing.score = Math.max(existing.score, score);
        } else {
          entries.push({
            playerId: runtime.session.anonymousId,
            displayName: "Guest",
            score,
            rank: entries.length + 1,
          });
        }
        entries.sort((left, right) => right.score - left.score);
        entries.forEach((entry, index) => {
          entry.rank = index + 1;
        });
        leaderboard.set(boardId, entries);
        return true;
      },
    },
    locale: {
      async getLanguage() {
        return normalizeLanguage(navigator.language);
      },
    },
    serverTime: {
      async now() {
        return Date.now();
      },
    },
    analytics: {
      async track(name, payload) {
        await runtime.analytics.track(name, payload);
      },
    },
    remoteConfig: {
      async getRemoteConfig(clientFeatures) {
        return resolveRemoteConfig(runtime.backendUrl, undefined, clientFeatures);
      },
    },
    logging: {
      async capture(level, message) {
        runtime.logger[level === "error" ? "error" : level === "warn" ? "warn" : "info"](
          "SDK",
          message,
        );
      },
    },
    lifecycle: {
      async markLoadingReady() {
        runtime.logger.info("BOOT", "Mock loading ready emitted");
      },
      async startGameplay() {
        runtime.logger.debug("LEVEL", "Mock gameplay started");
      },
      async stopGameplay() {
        runtime.logger.debug("LEVEL", "Mock gameplay stopped");
      },
    },
  };
}

function createMemoryStorage() {
  const state = new Map<string, string>();
  return {
    async load(key: string) {
      return state.get(key) ?? null;
    },
    async save(key: string, value: string) {
      state.set(key, value);
    },
  };
}

function createPersistentStorage(prefix: string) {
  const localStorageBridge = createLocalStorageBridge(prefix);
  return {
    async load(key: string) {
      return localStorageBridge.load(key);
    },
    async save(key: string, value: string) {
      await localStorageBridge.save(key, value);
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
