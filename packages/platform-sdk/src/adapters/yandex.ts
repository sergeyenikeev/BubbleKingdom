import {
  normalizeLanguage,
  type BuildTarget,
  type LanguageCode,
  type ReceiptValidationResult,
} from "@bubble-kingdom/shared";
import { defaultRemoteConfig, type RemoteConfig } from "@bubble-kingdom/config";

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

const YANDEX_SDK_CDN_URL = "https://sdk.games.s3.yandex.net/sdk.js";
const YANDEX_SDK_RELATIVE_URL = "/sdk.js";

type YandexPaymentReceipt = {
  productID: string;
  purchaseToken: string;
  signature?: string;
  developerPayload?: string;
};

type YandexPayments = {
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
  purchase(input: { id: string; developerPayload?: string }): Promise<YandexPaymentReceipt>;
  getPurchases(): Promise<YandexPaymentReceipt[]>;
  consumePurchase(purchaseToken: string): Promise<void>;
};

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
  payments: YandexPayments;
  getPayments(options?: { signed?: boolean }): Promise<YandexPayments>;
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

let sdkLoadPromise: Promise<void> | null = null;

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
  const primarySdkUrl = resolveYandexSdkUrl(options.buildTarget, options.yandexSdkUrl);
  let ysdk: YandexSdk | null = null;
  let storageBridge: Storage = window.localStorage;
  let remoteConfigCache = defaultRemoteConfig;
  let playerIdentity: PlatformIdentity = {
    anonymousId: runtime.session.anonymousId,
    authenticated: false,
  };
  const paymentsCache = new Map<"plain" | "signed", Promise<YandexPayments>>();

  const ensureSdk = async (): Promise<YandexSdk> => {
    if (ysdk) {
      return ysdk;
    }

    await loadSdkScript(primarySdkUrl, runtime.logger);
    if (!window.YaGames) {
      throw new Error("YaGames global is unavailable after SDK load.");
    }
    ysdk = await window.YaGames.init();
    if (ysdk.getStorage) {
      storageBridge = await ysdk.getStorage();
    }
    return ysdk;
  };

  const ensurePayments = async (): Promise<YandexPayments> => {
    const sdk = await ensureSdk();
    const paymentsMode = shouldUseSignedYandexPayments(
      remoteConfigCache.commerce.receiptValidationMode,
    )
      ? "signed"
      : "plain";
    const cached = paymentsCache.get(paymentsMode);
    if (cached) {
      return cached;
    }

    const promise = (
      paymentsMode === "signed" ? sdk.getPayments({ signed: true }) : sdk.getPayments()
    ).catch((error) => {
      paymentsCache.delete(paymentsMode);
      throw error;
    });
    paymentsCache.set(paymentsMode, promise);
    return promise;
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
      runtime.logger.info("SDK", "Yandex SDK ready", {
        language,
        sdkScriptUrl: primarySdkUrl,
      });
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
        const payments = await ensurePayments();
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
        const payments = await ensurePayments();
        const request: { id: string; developerPayload?: string } = {
          id: productId,
        };
        if (developerPayload) {
          request.developerPayload = developerPayload;
        }
        const purchase = await payments.purchase(request);
        return mapYandexPurchaseReceipt(purchase);
      },
      async getPendingPurchases() {
        const payments = await ensurePayments();
        const purchases = await payments.getPurchases();
        return purchases.map(mapYandexPurchaseReceipt);
      },
      async consumePurchase(purchaseToken) {
        const payments = await ensurePayments();
        await payments.consumePurchase(purchaseToken);
      },
      async validateReceipt(input) {
        const receiptValidationMode = remoteConfigCache.commerce.receiptValidationMode;
        if (shouldUseSignedYandexPayments(receiptValidationMode) && !input.signature) {
          runtime.logger.warn("IAP", "Signed Yandex receipt rejected before backend validation", {
            offerId: input.offerId,
            productId: input.productId,
            reason: "missing_signature",
          });
          return createRejectedReceiptValidation("missing_signature");
        }

        const validated = await validateReceiptWithBackend(runtime.backendUrl, input).catch(
          (error) => {
            runtime.logger.warn("IAP", "Yandex receipt validation fallback activated", {
              error: error instanceof Error ? error.message : String(error),
              offerId: input.offerId,
              receiptValidationMode,
            });
            return null;
          },
        );
        if (validated) {
          return validated;
        }

        if (shouldUseSignedYandexPayments(receiptValidationMode)) {
          return createRejectedReceiptValidation("server_validation_unavailable");
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
        remoteConfigCache = await resolveRemoteConfig(runtime.backendUrl, flags, clientFeatures);
        runtime.logger.info("LIVEOPS", "Yandex remote config resolved", {
          receiptValidationMode: remoteConfigCache.commerce.receiptValidationMode,
          weeklyStarsId: remoteConfigCache.leaderboards.weeklyStarsId,
        });
        return remoteConfigCache;
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

export function resolveYandexSdkUrl(
  buildTarget: BuildTarget,
  overrideUrl?: string,
): string {
  if (overrideUrl?.trim()) {
    return overrideUrl.trim();
  }

  return buildTarget === "yandex" ? YANDEX_SDK_RELATIVE_URL : YANDEX_SDK_CDN_URL;
}

export function shouldUseSignedYandexPayments(
  receiptValidationMode: RemoteConfig["commerce"]["receiptValidationMode"],
): boolean {
  return receiptValidationMode === "server";
}

export function mapYandexPurchaseReceipt(purchase: YandexPaymentReceipt): PurchaseReceipt {
  const receipt: PurchaseReceipt = {
    productId: purchase.productID,
    purchaseToken: purchase.purchaseToken,
  };

  if (purchase.signature) {
    receipt.signature = purchase.signature;
  }
  if (purchase.developerPayload) {
    receipt.developerPayload = purchase.developerPayload;
  }

  return receipt;
}

function createRejectedReceiptValidation(reason: string): ReceiptValidationResult {
  return {
    ok: false,
    status: "rejected",
    shouldGrant: false,
    consumePurchase: false,
    source: "backend",
    reason,
  };
}

async function loadSdkScript(
  primarySdkUrl: string,
  logger: AdapterRuntimeOptions["logger"],
): Promise<void> {
  if (window.YaGames) {
    return;
  }

  if (!sdkLoadPromise) {
    sdkLoadPromise = (async () => {
      try {
        await injectSdkScript(primarySdkUrl);
      } catch (error) {
        if (primarySdkUrl === YANDEX_SDK_CDN_URL) {
          throw error;
        }

        logger?.warn("SDK", "Primary Yandex SDK script failed, retrying CDN fallback", {
          primarySdkUrl,
          fallbackUrl: YANDEX_SDK_CDN_URL,
          error: error instanceof Error ? error.message : String(error),
        });
        removeInjectedSdkScript();
        await injectSdkScript(YANDEX_SDK_CDN_URL);
      }
    })().catch((error) => {
      sdkLoadPromise = null;
      throw error;
    });
  }

  await sdkLoadPromise;
}

async function injectSdkScript(url: string): Promise<void> {
  const resolvedUrl = new URL(url, window.location.href).toString();
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-sdk="yandex-games"]');
    if (existing) {
      if (existing.src === resolvedUrl) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Yandex SDK failed to load")), {
          once: true,
        });
        return;
      }

      existing.remove();
    }

    const script = document.createElement("script");
    script.src = resolvedUrl;
    script.async = true;
    script.dataset.sdk = "yandex-games";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Yandex SDK failed to load"));
    document.head.append(script);
  });
}

function removeInjectedSdkScript() {
  const existing = document.querySelector<HTMLScriptElement>('script[data-sdk="yandex-games"]');
  existing?.remove();
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
