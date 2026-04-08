import { createAnalyticsTracker } from "@bubble-kingdom/analytics";
import {
  defaultRemoteConfig,
  mergeRemoteConfig,
  type RemoteConfig,
} from "@bubble-kingdom/config";
import {
  createLogger,
  createId,
  normalizeLanguage,
  type ReceiptValidationRequest,
  type ReceiptValidationResult,
  safeJsonParse,
  type LanguageCode,
  type Logger,
  type PlatformTarget,
  type SessionInfo,
} from "@bubble-kingdom/shared";

import type { AnalyticsSink } from "@bubble-kingdom/analytics";

export interface AdapterRuntimeOptions {
  buildTarget: SessionInfo["buildTarget"];
  platformTarget: PlatformTarget;
  appVersion?: string | undefined;
  backendUrl?: string | undefined;
  yandexSdkUrl?: string | undefined;
  storagePrefix?: string | undefined;
  debug?: boolean | undefined;
  analyticsSinks?: AnalyticsSink[] | undefined;
  logger?: Logger | undefined;
}

export interface PlatformRuntimeContext {
  session: SessionInfo;
  logger: Logger;
  backendUrl?: string;
  storagePrefix: string;
  analytics: ReturnType<typeof createAnalyticsTracker>;
}

export function createRuntimeContext(
  options: AdapterRuntimeOptions,
  anonymousId?: string,
): PlatformRuntimeContext {
  const session: SessionInfo = {
    sessionId: createId("session"),
    anonymousId: anonymousId ?? createId("anon"),
    appVersion: options.appVersion ?? "0.1.0-alpha",
    buildTarget: options.buildTarget,
    platformTarget: options.platformTarget,
  };

  const logger =
    options.logger ??
    createLogger(
      {
        sessionId: session.sessionId,
        anonymousId: session.anonymousId,
        appVersion: session.appVersion,
        buildTarget: session.buildTarget,
        platformTarget: session.platformTarget,
      },
      {
        minLevel: options.debug ? "debug" : "info",
      },
    );

  const context: PlatformRuntimeContext = {
    session,
    logger,
    storagePrefix: options.storagePrefix ?? "bubble-kingdom",
    analytics: createAnalyticsTracker(session, options.analyticsSinks ?? []),
  };

  if (options.backendUrl) {
    context.backendUrl = options.backendUrl;
  }

  return context;
}

export function parseRemoteFlags(flags: Record<string, string> | undefined): Partial<RemoteConfig> {
  if (!flags) {
    return {};
  }

  const number = (key: string): number | undefined => {
    const value = flags[key];
    if (value === undefined) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const bool = (key: string): boolean | undefined => {
    const value = flags[key];
    if (value === undefined) {
      return undefined;
    }

    return value === "true" || value === "yes" || value === "1";
  };

  const receiptValidationMode = (
    value: string | undefined,
  ): RemoteConfig["commerce"]["receiptValidationMode"] | undefined => {
    if (value === "stub" || value === "server" || value === "platform_only") {
      return value;
    }
    return undefined;
  };

  return {
    ads: {
      interstitialEvery: number("ads_interstitial_every") ?? defaultRemoteConfig.ads.interstitialEvery,
      allowBannerOnMap: bool("ads_banner_on_map") ?? defaultRemoteConfig.ads.allowBannerOnMap,
      continueRewardMoves:
        number("ads_continue_reward_moves") ?? defaultRemoteConfig.ads.continueRewardMoves,
      rewardDoubleRewardMultiplier:
        number("ads_double_reward_multiplier") ??
        defaultRemoteConfig.ads.rewardDoubleRewardMultiplier,
    },
    economy: {
      generousLivesEnabled:
        bool("economy_generous_lives") ?? defaultRemoteConfig.economy.generousLivesEnabled,
      startingCurrencies: defaultRemoteConfig.economy.startingCurrencies,
      starterPackGemBonus:
        number("economy_starter_pack_bonus") ?? defaultRemoteConfig.economy.starterPackGemBonus,
      piggyBankCap: number("economy_piggy_bank_cap") ?? defaultRemoteConfig.economy.piggyBankCap,
      piggyBankNudgeRatio:
        number("economy_piggy_bank_nudge_ratio") ??
        defaultRemoteConfig.economy.piggyBankNudgeRatio,
      piggyBankSpotlightRatio:
        number("economy_piggy_bank_spotlight_ratio") ??
        defaultRemoteConfig.economy.piggyBankSpotlightRatio,
      extraMovesGemCost:
        number("economy_extra_moves_cost") ?? defaultRemoteConfig.economy.extraMovesGemCost,
      failOfferGemPrimaryLevel:
        number("economy_fail_offer_gem_primary_level") ??
        defaultRemoteConfig.economy.failOfferGemPrimaryLevel,
    },
    tutorial: {
      enabled: bool("tutorial_enabled") ?? defaultRemoteConfig.tutorial.enabled,
      steps: defaultRemoteConfig.tutorial.steps,
    },
    liveops: {
      currentEventId: flags.liveops_current_event ?? defaultRemoteConfig.liveops.currentEventId,
      comebackRewardGems:
        number("liveops_comeback_gems") ?? defaultRemoteConfig.liveops.comebackRewardGems,
      weeklyLeaderboardEnabled:
        bool("liveops_weekly_lb_enabled") ?? defaultRemoteConfig.liveops.weeklyLeaderboardEnabled,
    },
    leaderboards: {
      weeklyStarsId:
        flags.leaderboards_weekly_stars_id ?? defaultRemoteConfig.leaderboards.weeklyStarsId,
    },
    commerce: {
      receiptValidationMode:
        receiptValidationMode(flags.commerce_receipt_validation_mode) ??
        defaultRemoteConfig.commerce.receiptValidationMode,
      productIdOverrides: defaultRemoteConfig.commerce.productIdOverrides,
    },
    experiments: defaultRemoteConfig.experiments,
  };
}

export async function validateReceiptWithBackend(
  backendUrl: string | undefined,
  payload: ReceiptValidationRequest,
): Promise<ReceiptValidationResult | null> {
  if (!backendUrl) {
    return null;
  }

  const response = await fetch(`${backendUrl}/receipts/validate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Receipt validation failed: ${response.status}`);
  }

  return (await response.json()) as ReceiptValidationResult;
}

export async function fetchRemoteConfigFromBackend(
  backendUrl: string | undefined,
  clientFeatures?: Record<string, string>,
): Promise<Partial<RemoteConfig>> {
  if (!backendUrl) {
    return {};
  }

  const params = new URLSearchParams();
  if (clientFeatures) {
    params.set("features", JSON.stringify(clientFeatures));
  }

  const response = await fetch(`${backendUrl}/config?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Remote config fetch failed: ${response.status}`);
  }

  const json = (await response.json()) as Partial<RemoteConfig>;
  return json;
}

export async function resolveRemoteConfig(
  backendUrl: string | undefined,
  flags?: Record<string, string>,
  clientFeatures?: Record<string, string>,
): Promise<RemoteConfig> {
  const backendConfig = await fetchRemoteConfigFromBackend(backendUrl, clientFeatures).catch(
    () => ({}),
  );

  const withFlags = mergeRemoteConfig(defaultRemoteConfig, parseRemoteFlags(flags));
  return mergeRemoteConfig(withFlags, backendConfig);
}

export function createLocalStorageBridge(prefix: string) {
  return {
    async load(key: string): Promise<string | null> {
      return window.localStorage.getItem(`${prefix}:${key}`);
    },
    async save(key: string, value: string): Promise<void> {
      window.localStorage.setItem(`${prefix}:${key}`, value);
    },
  };
}

export function loadAnonymousId(storagePrefix: string): string {
  const key = `${storagePrefix}:anonymous-id`;
  const saved = window.localStorage.getItem(key);
  if (saved) {
    return saved;
  }

  const created = createId("anon");
  window.localStorage.setItem(key, created);
  return created;
}

export function loadLanguageOverride(storagePrefix: string): LanguageCode | null {
  return safeJsonParse<LanguageCode>(
    window.localStorage.getItem(`${storagePrefix}:language-override`),
  );
}

export function saveLanguageOverride(storagePrefix: string, language: LanguageCode): void {
  window.localStorage.setItem(`${storagePrefix}:language-override`, JSON.stringify(language));
}

export function fallbackLanguage(): LanguageCode {
  return normalizeLanguage(navigator.language);
}
