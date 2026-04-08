import { deepMerge } from "@bubble-kingdom/shared";
import type { BuildTarget } from "@bubble-kingdom/shared";

export interface FeatureFlagDefinition {
  key: string;
  variants: string[];
  defaultVariant: string;
}

export interface RemoteConfig {
  schemaVersion: 1;
  ads: {
    interstitialEvery: number;
    allowBannerOnMap: boolean;
    continueRewardMoves: number;
    rewardDoubleRewardMultiplier: number;
  };
  economy: {
    generousLivesEnabled: boolean;
    startingCurrencies: {
      gold: number;
      petals: number;
      gems: number;
      seasonalTokens: number;
    };
    starterPackGemBonus: number;
    piggyBankCap: number;
    piggyBankNudgeRatio: number;
    piggyBankSpotlightRatio: number;
    extraMovesGemCost: number;
    failOfferGemPrimaryLevel: number;
  };
  tutorial: {
    enabled: boolean;
    steps: Array<"aim" | "match" | "restore" | "dailyReward" | "shop">;
  };
  liveops: {
    currentEventId: string;
    comebackRewardGems: number;
    weeklyLeaderboardEnabled: boolean;
  };
  leaderboards: {
    weeklyStarsId: string;
  };
  commerce: {
    receiptValidationMode: "stub" | "server" | "platform_only";
    productIdOverrides: Record<"web-mock" | "yandex" | "vk", Record<string, string>>;
  };
  experiments: FeatureFlagDefinition[];
}

export const defaultRemoteConfig: RemoteConfig = {
  schemaVersion: 1,
  ads: {
    interstitialEvery: 3,
    allowBannerOnMap: true,
    continueRewardMoves: 5,
    rewardDoubleRewardMultiplier: 2,
  },
  economy: {
    generousLivesEnabled: true,
    startingCurrencies: {
      gold: 500,
      petals: 30,
      gems: 40,
      seasonalTokens: 0,
    },
    starterPackGemBonus: 75,
    piggyBankCap: 300,
    piggyBankNudgeRatio: 0.45,
    piggyBankSpotlightRatio: 0.85,
    extraMovesGemCost: 12,
    failOfferGemPrimaryLevel: 18,
  },
  tutorial: {
    enabled: true,
    steps: ["aim", "match", "restore", "dailyReward", "shop"],
  },
  liveops: {
    currentEventId: "spring_blossom",
    comebackRewardGems: 25,
    weeklyLeaderboardEnabled: true,
  },
  leaderboards: {
    weeklyStarsId: "weekly_stars",
  },
  commerce: {
    receiptValidationMode: "stub",
    productIdOverrides: {
      "web-mock": {},
      yandex: {},
      vk: {},
    },
  },
  experiments: [
    {
      key: "interstitial_pacing",
      variants: ["soft", "standard"],
      defaultVariant: "soft",
    },
    {
      key: "lives_mode",
      variants: ["generous", "standard", "no_lives"],
      defaultVariant: "generous",
    },
    {
      key: "starter_pack_price",
      variants: ["low", "standard"],
      defaultVariant: "standard",
    },
    {
      key: "tutorial_length",
      variants: ["short", "full"],
      defaultVariant: "full",
    },
    {
      key: "daily_reward_curve",
      variants: ["rich", "standard"],
      defaultVariant: "rich",
    },
    {
      key: "fail_offer_variant",
      variants: ["rewarded_primary", "gems_primary", "piggy_primary"],
      defaultVariant: "rewarded_primary",
    },
  ],
};

export interface BuildProfile {
  buildTarget: BuildTarget;
  platformTarget: "web-mock" | "yandex" | "vk";
  sdkMode: "mock" | "yandex" | "vk";
  backendEnabled: boolean;
  debugOverlay: boolean;
}

export const buildProfiles: Record<BuildTarget, BuildProfile> = {
  local: {
    buildTarget: "local",
    platformTarget: "web-mock",
    sdkMode: "mock",
    backendEnabled: false,
    debugOverlay: true,
  },
  test: {
    buildTarget: "test",
    platformTarget: "web-mock",
    sdkMode: "mock",
    backendEnabled: false,
    debugOverlay: true,
  },
  yandex: {
    buildTarget: "yandex",
    platformTarget: "yandex",
    sdkMode: "yandex",
    backendEnabled: true,
    debugOverlay: false,
  },
  vk: {
    buildTarget: "vk",
    platformTarget: "vk",
    sdkMode: "vk",
    backendEnabled: true,
    debugOverlay: false,
  },
};

export function resolveBuildProfile(buildTarget: BuildTarget | undefined): BuildProfile {
  const resolvedTarget = buildTarget ?? "local";
  return buildProfiles[resolvedTarget];
}

export function mergeRemoteConfig(
  base: RemoteConfig,
  override?: Partial<RemoteConfig>,
): RemoteConfig {
  if (!override) {
    return base;
  }

  return deepMerge(
    base as unknown as Record<string, unknown>,
    override as Record<string, unknown>,
  ) as unknown as RemoteConfig;
}

export function isExperimentEnabled(
  config: RemoteConfig,
  key: string,
  expectedVariant: string,
  assignments: Record<string, string>,
): boolean {
  const definition = config.experiments.find((item) => item.key === key);
  const assigned = assignments[key] ?? definition?.defaultVariant;
  return assigned === expectedVariant;
}
