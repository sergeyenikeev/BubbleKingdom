import { normalizeLanguage, type LanguageCode } from "@bubble-kingdom/shared";

import type { AdapterRuntimeOptions } from "./shared";
import {
  createRuntimeContext,
  fallbackLanguage,
  loadAnonymousId,
  resolveRemoteConfig,
  validateReceiptWithBackend,
} from "./shared";
import type {
  AdOutcome,
  PlatformAdapter,
  PlatformIdentity,
  PlatformProduct,
  PurchaseReceipt,
} from "../interfaces";

const YANDEX_SDK_URL = "https://sdk.games.s3.yandex.net/sdk.js";

type YandexSdk = {
  environment: {
    i18n: {
      lang: string;
    };
  };
  adv: {
    showFullscreenAdv(input: {
      callbacks?: {
        onOpen?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (error: object) => void;
      };
    }): void;
    showRewardedVideo(input: {
      callbacks?: {
        onOpen?: () => void;
        onRewarded?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (error: object) => void;
      };
    }): void;
    showBannerAdv(): Promise<{ stickyAdvIsShowing: boolean }>;
    hideBannerAdv(): Promise<{ stickyAdvIsShowing: boolean }>;
  };
  features?: {
    LoadingAPI?: {
      ready(): void;
    };
    GameplayAPI?: {
      start(): void;
      stop(): void;
    };
  };
  payments: {
    getCatalog(): Promise<
      Array<{
        id: string;
        title: string;
        description: string;
        imageURI?: string;
        price: string;
        priceValue?: string;
        priceCurrencyCode?: string;
        getPriceCurrencyImage?: (size?: string) => string;
      }>
    >;
    purchase(input: { id: string; developerPayload?: string }): Promise<{
      productID: string;
      purchaseToken: string;
      developerPayload?: string;
    }>;
    getPurchases(): Promise<
      Array<{
        productID: string;
        purchaseToken: string;
        developerPayload?: string;
      }>
    >;
    consumePurchase(purchaseToken: string): Promise<void>;
  };
  getPayments(): Promise<YandexSdk["payments"]>;
  getPlayer(options?: { scopes?: boolean; signed?: boolean }): Promise<{
    getUniqueID(): string;
    getName?(): string;
    getPhoto?(): string;
    setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
    getData(keys?: string[]): Promise<Record<string, unknown>>;
  }>;
  getFlags(input?: {
    defaultFlags?: Record<string, string>;
    clientFeatures?: Array<{ name: string; value: string }>;
  }): Promise<Record<string, string>>;
  getStorage?(): Promise<Storage>;
  leaderboards?: {
    getEntries(
      boardId: string,
      options?: { includeUser?: boolean; quantityAround?: number; quantityTop?: number },
    ): Promise<{
      entries: Array<{
        score: number;
        rank: number;
        player: {
          publicName?: string;
          uniqueID?: string;
        };
      }>;
    }>;
    setScore(boardId: string, score: number, extraData?: string): Promise<void>;
  };
  serverTime(): number;
};

declare global {
  interface Window {
    YaGames?: {
      init(options?: { signed?: boolean }): Promise<YandexSdk>;
    };
  }
}

export function createYandexPlatformAdapter(options: AdapterRuntimeOptions): PlatformAdapter {
  const storagePrefix = options.storagePrefix ?? "bubble-kingdom";
  const runtime = createRuntimeContext(options, loadAnonymousId(storagePrefix));
  let ysdk: YandexSdk | null = null;
  let storageBridge: Storage = window.localStorage;
  let playerIdentity: PlatformIdentity = {
    anonymousId: runtime.session.anonymousId,
    authenticated: false,
  };

  const ensureSdk = async (): Promise<YandexSdk> => {
    if (ysdk) {
      return ysdk;
    }

    await loadSdkScript();
    if (!window.YaGames) {
      throw new Error("YaGames global is unavailable after SDK load.");
    }
    ysdk = await window.YaGames.init();
    if (ysdk.getStorage) {
      storageBridge = await ysdk.getStorage();
    }
    return ysdk;
  };

  const ensureIdentity = async (): Promise<PlatformIdentity> => {
    const sdk = await ensureSdk();
    try {
      const player = await sdk.getPlayer({ scopes: false });
      playerIdentity = {
        anonymousId: runtime.session.anonymousId,
        userId: player.getUniqueID(),
        authenticated: true,
      };
      const displayName = player.getName?.();
      const avatarUrl = player.getPhoto?.();
      if (displayName) {
        playerIdentity.displayName = displayName;
      }
      if (avatarUrl) {
        playerIdentity.avatarUrl = avatarUrl;
      }
      if (playerIdentity.userId) {
        runtime.session.userId = playerIdentity.userId;
      }
      return playerIdentity;
    } catch {
      return playerIdentity;
    }
  };

  return {
    target: "yandex",
    session: runtime.session,
    async boot() {
      runtime.logger.info("SDK", "Booting Yandex adapter");
      const sdk = await ensureSdk();
      const language = normalizeLanguage(sdk.environment.i18n.lang);
      runtime.logger.info("SDK", "Yandex SDK ready", { language });
      await ensureIdentity();
    },
    auth: {
      async getIdentity() {
        return ensureIdentity();
      },
      async promptLogin(reason) {
        runtime.logger.info("AUTH", "Auth prompt requested", { reason });
        return ensureIdentity();
      },
      async canPromptLogin() {
        return true;
      },
    },
    ads: {
      async showInterstitial(reason) {
        const sdk = await ensureSdk();
        runtime.logger.info("ADS", "Yandex interstitial requested", { reason });
        return withFullscreenAd(sdk);
      },
      async showRewarded(reason) {
        const sdk = await ensureSdk();
        runtime.logger.info("ADS", "Yandex rewarded requested", { reason });
        return withRewardedAd(sdk);
      },
      async setStickyBannerVisible(visible) {
        const sdk = await ensureSdk();
        const result = visible
          ? await sdk.adv.showBannerAdv()
          : await sdk.adv.hideBannerAdv();
        return result.stickyAdvIsShowing;
      },
    },
    purchases: {
      async getCatalog() {
        const sdk = await ensureSdk();
        const payments = await sdk.getPayments();
        const products = await payments.getCatalog();
        return products.map<PlatformProduct>((product) => {
          const mapped: PlatformProduct = {
            id: product.id,
            title: product.title,
            description: product.description,
            price: product.price,
          };
          if (product.imageURI) {
            mapped.imageUri = product.imageURI;
          }
          if (product.priceValue) {
            mapped.priceValue = product.priceValue;
          }
          if (product.priceCurrencyCode) {
            mapped.priceCurrencyCode = product.priceCurrencyCode;
          }
          const currencyIconUri = product.getPriceCurrencyImage?.("small");
          if (currencyIconUri) {
            mapped.currencyIconUri = currencyIconUri;
          }
          return mapped;
        });
      },
      async purchase(productId, developerPayload) {
        const sdk = await ensureSdk();
        const payments = await sdk.getPayments();
        const request: { id: string; developerPayload?: string } = {
          id: productId,
        };
        if (developerPayload) {
          request.developerPayload = developerPayload;
        }
        const purchase = await payments.purchase(request);
        const receipt: PurchaseReceipt = {
          productId: purchase.productID,
          purchaseToken: purchase.purchaseToken,
        };
        if (purchase.developerPayload) {
          receipt.developerPayload = purchase.developerPayload;
        }
        return receipt;
      },
      async getPendingPurchases() {
        const sdk = await ensureSdk();
        const payments = await sdk.getPayments();
        const purchases = await payments.getPurchases();
        return purchases.map<PurchaseReceipt>((purchase) => {
          const receipt: PurchaseReceipt = {
            productId: purchase.productID,
            purchaseToken: purchase.purchaseToken,
          };
          if (purchase.developerPayload) {
            receipt.developerPayload = purchase.developerPayload;
          }
          return receipt;
        });
      },
      async consumePurchase(purchaseToken) {
        const sdk = await ensureSdk();
        const payments = await sdk.getPayments();
        await payments.consumePurchase(purchaseToken);
      },
      async validateReceipt(input) {
        const validated = await validateReceiptWithBackend(runtime.backendUrl, input).catch(
          (error) => {
            runtime.logger.warn("IAP", "Yandex receipt validation fallback activated", {
              error: error instanceof Error ? error.message : String(error),
              offerId: input.offerId,
            });
            return null;
          },
        );
        if (validated) {
          return validated;
        }

        return {
          ok: true,
          status: "skipped",
          shouldGrant: true,
          consumePurchase: true,
          source: "platform",
        };
      },
    },
    storage: {
      async load(key) {
        return storageBridge.getItem(`${storagePrefix}:${key}`);
      },
      async save(key, value) {
        storageBridge.setItem(`${storagePrefix}:${key}`, value);
      },
    },
    cloudSave: {
      async isAvailable() {
        return true;
      },
      async loadCloud(key) {
        const sdk = await ensureSdk();
        try {
          const player = await sdk.getPlayer({ scopes: false });
          const data = await player.getData([key]);
          const value = data[key];
          return typeof value === "string" ? value : null;
        } catch {
          return null;
        }
      },
      async saveCloud(key, value) {
        const sdk = await ensureSdk();
        const player = await sdk.getPlayer({ scopes: false });
        await player.setData({ [key]: value }, true);
      },
    },
    leaderboards: {
      async getEntries(boardId) {
        const sdk = await ensureSdk();
        if (!sdk.leaderboards) {
          return [];
        }
        const result = await sdk.leaderboards.getEntries(boardId, {
          includeUser: true,
          quantityTop: 10,
          quantityAround: 3,
        });
        return result.entries.map((entry) => ({
          playerId: entry.player.uniqueID ?? `rank-${entry.rank}`,
          displayName: entry.player.publicName ?? "Hidden Hero",
          score: entry.score,
          rank: entry.rank,
        }));
      },
      async submitScore(boardId, score, extraData) {
        const sdk = await ensureSdk();
        if (!sdk.leaderboards) {
          return false;
        }
        await sdk.leaderboards.setScore(boardId, score, extraData);
        return true;
      },
    },
    locale: {
      async getLanguage(): Promise<LanguageCode> {
        const sdk = await ensureSdk().catch(() => null);
        return sdk ? normalizeLanguage(sdk.environment.i18n.lang) : fallbackLanguage();
      },
    },
    serverTime: {
      async now() {
        const sdk = await ensureSdk();
        return sdk.serverTime();
      },
    },
    analytics: {
      async track(name, payload) {
        await runtime.analytics.track(name, payload);
      },
    },
    remoteConfig: {
      async getRemoteConfig(clientFeatures) {
        const sdk = await ensureSdk();
        const flags = await sdk.getFlags({
          defaultFlags: {},
          clientFeatures: Object.entries(clientFeatures ?? {}).map(([name, value]) => ({
            name,
            value,
          })),
        });
        return resolveRemoteConfig(runtime.backendUrl, flags, clientFeatures);
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
        const sdk = await ensureSdk();
        sdk.features?.LoadingAPI?.ready();
      },
      async startGameplay() {
        const sdk = await ensureSdk();
        sdk.features?.GameplayAPI?.start();
      },
      async stopGameplay() {
        const sdk = await ensureSdk();
        sdk.features?.GameplayAPI?.stop();
      },
    },
  };
}

async function loadSdkScript(): Promise<void> {
  if (window.YaGames) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-sdk="yandex-games"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Yandex SDK failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = YANDEX_SDK_URL;
    script.async = true;
    script.dataset.sdk = "yandex-games";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Yandex SDK failed to load"));
    document.head.append(script);
  });
}

function withFullscreenAd(sdk: YandexSdk): Promise<AdOutcome> {
  return new Promise((resolve) => {
    sdk.adv.showFullscreenAdv({
      callbacks: {
        onClose: (wasShown) => resolve({ shown: wasShown }),
        onError: (error) => resolve({ shown: false, reason: JSON.stringify(error) }),
      },
    });
  });
}

function withRewardedAd(sdk: YandexSdk): Promise<AdOutcome> {
  return new Promise((resolve) => {
    let rewarded = false;
    sdk.adv.showRewardedVideo({
      callbacks: {
        onRewarded: () => {
          rewarded = true;
        },
        onClose: (wasShown) => resolve({ shown: wasShown, rewarded }),
        onError: (error) => resolve({ shown: false, rewarded: false, reason: JSON.stringify(error) }),
      },
    });
  });
}
