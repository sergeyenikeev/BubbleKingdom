import {
  levels,
  chapters,
  dailyRewards,
  questDefinitions,
  shopCatalog,
} from "@bubble-kingdom/game-data";
import type {
  BoosterId,
  LanguageCode,
  LeaderboardEntry,
  LevelDefinition,
  RewardGrant,
  ReceiptValidationRequest,
  ShopOfferDefinition,
} from "@bubble-kingdom/shared";
import {
  TinyEmitter,
  type Logger,
} from "@bubble-kingdom/shared";
import type { RemoteConfig } from "@bubble-kingdom/config";
import {
  defaultRemoteConfig,
  mergeRemoteConfig,
  resolveBuildProfile,
  type BuildProfile,
} from "@bubble-kingdom/config";
import type { PlatformAdapter, PlatformProduct } from "@bubble-kingdom/platform-sdk";

import { createBoardState } from "../board/board";
import { performShot, undoLastShot } from "../board/resolution";
import { predictShotTrace } from "../board/shot";
import type { BoardState, ResolutionSummary, ShotTrace } from "../board/types";
import {
  applyRewardGrant,
  applyShopOffer,
  calculateExtraMovesGemCost,
  calculatePiggyBankBonusGems,
  calculatePiggyBankProgress,
  spendCurrency,
} from "../economy/economy";
import { assignExperimentVariants } from "../features/featureFlags";
import { translate } from "../localization/messages";
import { claimDailyReward, getDailyRewardAvailability } from "../progression/dailyRewards";
import { restoreNode, totalStars } from "../progression/restoration";
import {
  applyQuestProgress,
  claimQuestReward,
  initializeQuestProgress,
} from "../quests/quests";
import { createDefaultSave, type PlayerSave } from "../save/schema";
import { loadPlayerSave, writePlayerSave } from "../save/service";
import { getNextTutorialStep } from "../tutorial/tutorial";

export type ScreenId =
  | "boot"
  | "map"
  | "level"
  | "win"
  | "fail"
  | "dailyRewards"
  | "quests"
  | "shop"
  | "settings"
  | "event"
  | "restoration"
  | "leaderboards"
  | "inbox";

export interface ActiveLevelSession {
  level: LevelDefinition;
  board: BoardState;
  preview: ShotTrace | null;
  lastSummary: ResolutionSummary | null;
  continueUsed: boolean;
  continueOffersUsed: number;
  winReward: RewardGrant | null;
  winBonusClaimed: boolean;
}

export interface DecoratedShopOffer extends ShopOfferDefinition {
  platformPriceLabel: string;
  helperText?: string;
}

export interface GameSessionState {
  bootStatus: "idle" | "booting" | "ready" | "error";
  currentScreen: ScreenId;
  locale: LanguageCode;
  remoteConfig: RemoteConfig;
  buildProfile: BuildProfile;
  save: PlayerSave;
  activeLevel: ActiveLevelSession | null;
  tutorialStep: string | null;
  lastError: string | null;
  notifications: string[];
  leaderboard: LeaderboardEntry[];
  dailyRewardAvailable: boolean;
  shopOffers: DecoratedShopOffer[];
  platformCatalog: PlatformProduct[];
  eventId: string;
}

type GameSessionEvents = {
  state: GameSessionState;
};

export interface GameSession {
  getState(): GameSessionState;
  subscribe(listener: (state: GameSessionState) => void): () => void;
  boot(): Promise<void>;
  openScreen(screen: ScreenId): Promise<void>;
  startLevel(levelId: number): Promise<void>;
  previewShot(angleRadians: number): void;
  fireShot(angleRadians: number): Promise<void>;
  restartLevel(): Promise<void>;
  continueWithRewarded(): Promise<boolean>;
  continueWithGems(): Promise<boolean>;
  claimWinBonusRewarded(): Promise<boolean>;
  useBooster(boosterId: BoosterId): Promise<boolean>;
  claimDailyReward(): Promise<void>;
  claimQuest(questId: string): Promise<void>;
  purchaseOffer(offerId: string): Promise<void>;
  restoreArea(nodeId: string): Promise<void>;
  claimInboxItem(itemId: string): Promise<void>;
  requestAuth(reason: string): Promise<void>;
  setLanguage(language: LanguageCode): Promise<void>;
  submitLeaderboard(): Promise<void>;
  setSetting(
    key: keyof GameSessionState["save"]["settings"],
    value: boolean | LanguageCode,
  ): Promise<void>;
  acknowledgeLevelResult(): Promise<void>;
}

export function createGameSession(input: {
  platform: PlatformAdapter;
  logger: Logger;
  buildTarget: BuildProfile["buildTarget"];
}): GameSession {
  const buildProfile = resolveBuildProfile(input.buildTarget);
  const emitter = new TinyEmitter<GameSessionEvents>();
  let state: GameSessionState = {
    bootStatus: "idle",
    currentScreen: "boot",
    locale: "en",
    remoteConfig: defaultRemoteConfig,
    buildProfile,
    save: createDefaultSave({
      anonymousId: input.platform.session.anonymousId,
      language: "en",
      nowIso: new Date().toISOString(),
      remoteConfig: defaultRemoteConfig,
    }),
    activeLevel: null,
    tutorialStep: null,
    lastError: null,
    notifications: [],
    leaderboard: [],
    dailyRewardAvailable: false,
    shopOffers: [],
    platformCatalog: [],
    eventId: defaultRemoteConfig.liveops.currentEventId,
  };

  const updateState = (patch: Partial<GameSessionState>) => {
    state = {
      ...state,
      ...patch,
    };
    emitter.emit("state", state);
  };

  const persist = async () => {
    await writePlayerSave({
      platform: input.platform,
      save: state.save,
      logger: input.logger,
    });
    await input.platform.analytics.track("save_write", {
      level: state.save.progression.currentLevelId,
      stars: totalStars(state.save),
    });
  };

  const addNotification = (message: string) => {
    updateState({
      notifications: [...state.notifications.slice(-4), message],
    });
  };

  const decorateShopOffers = (
    save: PlayerSave,
    platformCatalog: PlatformProduct[],
    remoteConfig: RemoteConfig = state.remoteConfig,
  ): DecoratedShopOffer[] => {
    const catalogById = new Map(platformCatalog.map((item) => [item.id, item]));

    return shopCatalog.flatMap((offer) => {
      if (offer.type === "no_ads" && save.economy.noAdsPurchased) {
        return [];
      }
      if (
        offer.type === "welcome_offer" &&
        (save.economy.firstPurchaseAt !== null || save.progression.currentLevelId > 10)
      ) {
        return [];
      }

      let helperText: string | undefined;
      let rewards = offer.rewards;
      let badgeKey = offer.badgeKey;
      if (offer.type === "piggy_bank") {
        rewards = {
          ...offer.rewards,
          gems: (offer.rewards.gems ?? 0) + calculatePiggyBankBonusGems(save),
        };
        helperText = `${save.economy.piggyBankGold}/${remoteConfig.economy.piggyBankCap}`;
        if (save.economy.piggyBankGold >= remoteConfig.economy.piggyBankCap) {
          badgeKey = "shop.badge.full";
        } else {
          badgeKey = "shop.badge.progress";
        }
      }

      const decorated: DecoratedShopOffer = {
        ...offer,
        rewards,
        platformPriceLabel:
          ("platformPriceId" in offer.price
            ? catalogById.get(offer.price.platformPriceId)?.price
            : undefined) ??
          (offer.type === "no_ads" ? "249 RUB" : "149 RUB"),
      };
      if (badgeKey) {
        decorated.badgeKey = badgeKey;
      }
      if (helperText) {
        decorated.helperText = helperText;
      }
      return [decorated];
    });
  };

  const resolveShopOffers = async (
    save: PlayerSave = state.save,
    remoteConfig: RemoteConfig = state.remoteConfig,
  ): Promise<DecoratedShopOffer[]> => {
    const platformCatalog = await input.platform.purchases.getCatalog().catch(() => []);
    updateState({
      platformCatalog,
    });

    return decorateShopOffers(save, platformCatalog, remoteConfig);
  };

  const refreshShopOffers = (
    save: PlayerSave = state.save,
    remoteConfig: RemoteConfig = state.remoteConfig,
  ) => {
    updateState({
      shopOffers: decorateShopOffers(save, state.platformCatalog, remoteConfig),
    });
  };

  const refreshDailyRewardState = async () => {
    const availability = getDailyRewardAvailability(
      state.save,
      await input.platform.serverTime.now(),
    );
    updateState({
      dailyRewardAvailable: availability.available,
    });
  };

  const updateTutorialStep = () => {
    updateState({
      tutorialStep: getNextTutorialStep(state.save, state.remoteConfig),
    });
  };

  const trackCurrencyDelta = async (
    before: PlayerSave,
    after: PlayerSave,
    source: string,
    extra: Record<string, unknown> = {},
  ) => {
    const currencies: Array<keyof PlayerSave["currencies"]> = [
      "gold",
      "petals",
      "gems",
      "seasonalTokens",
    ];

    for (const currency of currencies) {
      const delta = after.currencies[currency] - before.currencies[currency];
      if (delta > 0) {
        await input.platform.analytics.track("currency_earned", {
          currency,
          amount: delta,
          source,
          ...extra,
        });
      } else if (delta < 0) {
        await input.platform.analytics.track("currency_spent", {
          currency,
          amount: Math.abs(delta),
          source,
          ...extra,
        });
      }
    }
  };

  const openScreenInternal = async (screen: ScreenId) => {
    const previousScreen = state.currentScreen;
    updateState({ currentScreen: screen });
    const showBanner =
      screen !== "level" &&
      screen !== "win" &&
      screen !== "fail" &&
      state.remoteConfig.ads.allowBannerOnMap &&
      !state.save.economy.adLightPurchased;
    if (previousScreen === "level" && screen !== "level") {
      await input.platform.lifecycle.stopGameplay();
    }
    if (previousScreen !== "level" && screen === "level" && state.activeLevel) {
      await input.platform.lifecycle.startGameplay();
    }
    await input.platform.ads.setStickyBannerVisible(showBanner);
    if (screen === "shop") {
      await input.platform.analytics.track("shop_open");
    }
    if (screen === "leaderboards") {
      const leaderboardId = resolveWeeklyLeaderboardId(state.remoteConfig);
      const leaderboard = await input.platform.leaderboards.getEntries(
        leaderboardId,
      );
      updateState({ leaderboard });
      await input.platform.analytics.track("leaderboard_open");
    }
  };

  const startLevelInternal = async (levelId: number) => {
    const level = levels.find((item) => item.id === levelId);
    if (!level) {
      throw new Error(`Unknown level ${levelId}`);
    }

    const board = createBoardState(level);
    updateState({
      currentScreen: "level",
      activeLevel: {
        level,
        board,
        preview: null,
        lastSummary: null,
        continueUsed: false,
        continueOffersUsed: 0,
        winReward: null,
        winBonusClaimed: false,
      },
    });
    await input.platform.ads.setStickyBannerVisible(false);
    await input.platform.lifecycle.startGameplay();
    await input.platform.analytics.track("level_start", { levelId });
  };

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listener(state);
      return emitter.on("state", listener);
    },
    async boot() {
      updateState({ bootStatus: "booting" });
      await input.platform.analytics.track("app_start");
      await input.platform.analytics.track("session_start");
      await input.platform.analytics.track("sdk_init_started");

      try {
        await input.platform.boot();
        await input.platform.analytics.track("sdk_init_success");
      } catch (error) {
        await input.platform.analytics.track("sdk_init_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      const locale = await input.platform.locale.getLanguage();
      const remoteConfig = mergeRemoteConfig(
        defaultRemoteConfig,
        await input.platform.remoteConfig.getRemoteConfig(),
      );
      const loadedSave = await loadPlayerSave({
        platform: input.platform,
        remoteConfig,
        locale,
        logger: input.logger,
      });
      const saveWithQuests = initializeQuestProgress(
        loadedSave,
        questDefinitions,
        new Date().toISOString(),
      );
      const experiments = assignExperimentVariants(
        input.platform.session.anonymousId,
        remoteConfig,
      );
      const saveWithExperiments = {
        ...saveWithQuests,
        experiments,
      };
      const shopOffers = await resolveShopOffers(saveWithExperiments, remoteConfig);

      updateState({
        bootStatus: "ready",
        currentScreen: "map",
        locale: saveWithQuests.settings.language ?? locale,
        remoteConfig,
        save: saveWithExperiments,
        shopOffers,
        eventId: remoteConfig.liveops.currentEventId,
      });

      for (const [key, value] of Object.entries(experiments)) {
        await input.platform.analytics.track("feature_flag_assignment", { key, value });
        await input.platform.analytics.track("ab_variant_assigned", { key, value });
      }

      await refreshDailyRewardState();
      updateTutorialStep();
      await input.platform.lifecycle.markLoadingReady();
      if (state.dailyRewardAvailable) {
        updateState({ currentScreen: "dailyRewards" });
      }
      await persist();
    },
    async openScreen(screen) {
      await openScreenInternal(screen);
    },
    async startLevel(levelId) {
      await startLevelInternal(levelId);
    },
    previewShot(angleRadians) {
      if (!state.activeLevel) {
        return;
      }
      state.activeLevel.preview = predictShotTrace(state.activeLevel.board, angleRadians);
      emitter.emit("state", state);
    },
    async fireShot(angleRadians) {
      const levelSession = state.activeLevel;
      if (!levelSession) {
        return;
      }

      const beforeShotSave = state.save;
      const summary = performShot(levelSession.board, levelSession.level, angleRadians);
      levelSession.lastSummary = summary;
      levelSession.preview = null;

      if (summary.popped.length > 0 || summary.dropped.length > 0) {
        const goldGain = Math.max(0, Math.floor(summary.scoreGained / 10));
        updateState({
          save: {
            ...applyQuestProgress(
              {
                ...state.save,
                economy: {
                  ...state.save.economy,
                  piggyBankGold: calculatePiggyBankProgress(
                    state.save,
                    goldGain,
                    state.remoteConfig,
                  ),
                },
              },
              questDefinitions,
              {
                stars_earned: summary.winAchieved ? levelSession.board.starsEarned : 0,
              },
              new Date().toISOString(),
            ),
          },
        });
        refreshShopOffers(state.save);
      }

      await input.platform.analytics.track("level_objective_progress", {
        levelId: levelSession.level.id,
        objective: levelSession.level.objective.type,
        progress: levelSession.board.objectiveProgress[levelSession.level.objective.type] ?? 0,
      });

      if (summary.winAchieved) {
        const levelReward: RewardGrant = {
          source: "level_complete",
          ...levelSession.level.rewards,
          stars: levelSession.board.starsEarned,
          gold: levelSession.level.rewards.gold + levelSession.board.starsEarned * 35,
        };

        const completedLevels = new Set(state.save.progression.completedLevels);
        completedLevels.add(levelSession.level.id);
        const rewardedSave = applyRewardGrant(state.save, levelReward);
        const progressedSave = applyQuestProgress(
          {
            ...rewardedSave,
            progression: {
              ...rewardedSave.progression,
              currentLevelId: Math.max(
                rewardedSave.progression.currentLevelId,
                levelSession.level.id + 1,
              ),
              completedLevels: [...completedLevels].sort((left, right) => left - right),
              starsByLevel: {
                ...rewardedSave.progression.starsByLevel,
                [String(levelSession.level.id)]: Math.max(
                  rewardedSave.progression.starsByLevel[String(levelSession.level.id)] ?? 0,
                  levelSession.board.starsEarned,
                ),
              },
            },
          },
          questDefinitions,
          {
            levels_complete: 1,
            stars_earned: levelSession.board.starsEarned,
            gold_earned: levelReward.gold ?? 0,
          },
          new Date().toISOString(),
        );

        updateState({
          currentScreen: "win",
          save: progressedSave,
          activeLevel: {
            ...levelSession,
            winReward: levelReward,
            winBonusClaimed: false,
          },
        });
        refreshShopOffers(progressedSave);

        addNotification(
          `${translate(state.locale, "level.win")} +${levelReward.gold ?? 0} ${translate(state.locale, "currency.gold")}`,
        );
        await trackCurrencyDelta(beforeShotSave, progressedSave, "level_complete", {
          levelId: levelSession.level.id,
        });
        await input.platform.analytics.track("level_complete", {
          levelId: levelSession.level.id,
          stars: levelSession.board.starsEarned,
          score: levelSession.board.score,
        });
        await maybeShowInterstitial("level_complete");
        await persist();
      } else if (summary.failAchieved) {
        updateState({
          currentScreen: "fail",
        });
        await input.platform.lifecycle.stopGameplay();
        await input.platform.analytics.track("level_fail", {
          levelId: levelSession.level.id,
          score: levelSession.board.score,
        });
        await input.platform.analytics.track("extra_moves_offer_shown", {
          levelId: levelSession.level.id,
        });
      } else {
        emitter.emit("state", state);
      }
    },
    async restartLevel() {
      if (!state.activeLevel) {
        return;
      }
      await input.platform.analytics.track("level_restart", {
        levelId: state.activeLevel.level.id,
      });
      await startLevelInternal(state.activeLevel.level.id);
    },
    async continueWithRewarded() {
      if (
        !state.activeLevel ||
        state.currentScreen !== "fail" ||
        state.activeLevel.continueUsed
      ) {
        return false;
      }

      await input.platform.analytics.track("rewarded_offer_shown", {
        reason: "continue_after_fail",
      });
      await input.platform.analytics.track("rewarded_started", {
        reason: "continue_after_fail",
      });
      const outcome = await input.platform.ads.showRewarded("continue_after_fail");
      if (!outcome.rewarded) {
        await input.platform.analytics.track("rewarded_failed", {
          reason: "continue_after_fail",
        });
        return false;
      }

      state.activeLevel.board.movesRemaining += state.remoteConfig.ads.continueRewardMoves;
      state.activeLevel.continueUsed = true;
      state.activeLevel.continueOffersUsed += 1;
      const rewardedSave = applyQuestProgress(
        {
          ...state.save,
          economy: {
            ...state.save.economy,
            rewardedViews: state.save.economy.rewardedViews + 1,
          },
        },
        questDefinitions,
        { rewarded_watch: 1 },
        new Date().toISOString(),
      );
      updateState({
        currentScreen: "level",
        save: rewardedSave,
      });
      refreshShopOffers(rewardedSave);
      await input.platform.lifecycle.startGameplay();
      await input.platform.analytics.track("rewarded_finished", {
        reason: "continue_after_fail",
      });
      await input.platform.analytics.track("rewarded_reward_granted", {
        reason: "continue_after_fail",
        moves: state.remoteConfig.ads.continueRewardMoves,
      });
      await persist();
      return true;
    },
    async continueWithGems() {
      if (
        !state.activeLevel ||
        state.currentScreen !== "fail" ||
        state.activeLevel.continueUsed
      ) {
        return false;
      }

      const gemCost = calculateExtraMovesGemCost(
        state.activeLevel.continueOffersUsed,
        state.remoteConfig,
      );
      if (state.save.currencies.gems < gemCost) {
        addNotification(translate(state.locale, "economy.notEnoughGems"));
        return false;
      }

      const beforeSave = state.save;
      const updated = spendCurrency(state.save, "gems", gemCost);
      state.activeLevel.board.movesRemaining += state.remoteConfig.ads.continueRewardMoves;
      state.activeLevel.continueUsed = true;
      state.activeLevel.continueOffersUsed += 1;
      updateState({
        currentScreen: "level",
        save: updated,
      });
      refreshShopOffers(updated);
      await input.platform.lifecycle.startGameplay();
      await trackCurrencyDelta(beforeSave, updated, "continue_with_gems", {
        cost: gemCost,
        levelId: state.activeLevel.level.id,
      });
      await persist();
      return true;
    },
    async claimWinBonusRewarded() {
      if (
        !state.activeLevel ||
        state.currentScreen !== "win" ||
        state.activeLevel.winBonusClaimed ||
        !state.activeLevel.winReward
      ) {
        return false;
      }

      await input.platform.analytics.track("rewarded_offer_shown", {
        reason: "double_win_reward",
      });
      await input.platform.analytics.track("rewarded_started", {
        reason: "double_win_reward",
      });
      const outcome = await input.platform.ads.showRewarded("double_win_reward");
      if (!outcome.rewarded) {
        await input.platform.analytics.track("rewarded_failed", {
          reason: "double_win_reward",
        });
        return false;
      }

      const beforeSave = state.save;
      const bonusGrant = createWinBonusReward(
        state.activeLevel.winReward,
        state.remoteConfig.ads.rewardDoubleRewardMultiplier,
      );
      const updated = applyQuestProgress(
        {
          ...applyRewardGrant(state.save, bonusGrant),
          economy: {
            ...state.save.economy,
            rewardedViews: state.save.economy.rewardedViews + 1,
          },
        },
        questDefinitions,
        { rewarded_watch: 1, gold_earned: bonusGrant.gold ?? 0 },
        new Date().toISOString(),
      );
      state.activeLevel.winBonusClaimed = true;
      updateState({
        save: updated,
        activeLevel: {
          ...state.activeLevel,
          winBonusClaimed: true,
        },
      });
      refreshShopOffers(updated);
      await input.platform.analytics.track("rewarded_finished", {
        reason: "double_win_reward",
      });
      await input.platform.analytics.track("rewarded_reward_granted", {
        reason: "double_win_reward",
        multiplier: state.remoteConfig.ads.rewardDoubleRewardMultiplier,
      });
      await trackCurrencyDelta(beforeSave, updated, "double_win_reward", {
        levelId: state.activeLevel.level.id,
      });
      addNotification(translate(state.locale, "reward.doubleClaimed"));
      await persist();
      return true;
    },
    async useBooster(boosterId) {
      if (!state.activeLevel) {
        return false;
      }

      if ((state.save.boosters[boosterId] ?? 0) <= 0) {
        return false;
      }

      const save = {
        ...state.save,
        boosters: {
          ...state.save.boosters,
          [boosterId]: (state.save.boosters[boosterId] ?? 0) - 1,
        },
      };

      if (boosterId === "rainbowOrb") {
        state.activeLevel.board.queue.unshift("rainbow");
      } else if (boosterId === "bombOrb") {
        state.activeLevel.board.queue.unshift("bomb");
      } else if (boosterId === "precisionAim") {
        addNotification(translate(state.locale, "booster.precisionAim.active"));
      } else if (boosterId === "extraMoves") {
        state.activeLevel.board.movesRemaining += 3;
      } else if (boosterId === "undoShot") {
        undoLastShot(state.activeLevel.board);
      }

      updateState({ save });
      await input.platform.analytics.track("booster_used", {
        boosterId,
        levelId: state.activeLevel.level.id,
      });
      await persist();
      return true;
    },
    async claimDailyReward() {
      const beforeSave = state.save;
      const result = claimDailyReward(
        state.save,
        await input.platform.serverTime.now(),
        dailyRewards,
      );
      updateState({
        save: result.save,
        currentScreen: "map",
        dailyRewardAvailable: false,
      });
      refreshShopOffers(result.save);
      await input.platform.analytics.track("daily_reward_claimed", {
        day: result.reward.day,
      });
      await trackCurrencyDelta(beforeSave, result.save, "daily_reward", {
        day: result.reward.day,
      });
      addNotification(`${translate(state.locale, "daily.title")} +${result.reward.day}`);
      await persist();
    },
    async claimQuest(questId) {
      const beforeSave = state.save;
      const result = claimQuestReward(state.save, questDefinitions, questId);
      updateState({
        save: result.save,
      });
      refreshShopOffers(result.save);
      await input.platform.analytics.track("quest_claimed", { questId });
      await trackCurrencyDelta(beforeSave, result.save, "quest", { questId });
      addNotification(translate(state.locale, "quest.claim"));
      await persist();
    },
    async purchaseOffer(offerId) {
      const offer = shopCatalog.find((item) => item.id === offerId);
      if (!offer) {
        throw new Error(`Unknown offer ${offerId}`);
      }
      const platformProductId = resolvePlatformProductId(
        offer,
        input.platform.target,
        state.remoteConfig,
      );
      await input.platform.analytics.track("iap_offer_view", { offerId });
      await input.platform.analytics.track("iap_start", { offerId });

      let receipt: Awaited<ReturnType<PlatformAdapter["purchases"]["purchase"]>>;
      try {
        receipt = await input.platform.purchases.purchase(
          platformProductId,
          JSON.stringify({ offerId }),
        );
      } catch (error) {
        await input.platform.analytics.track("iap_failed", {
          offerId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      if (!receipt) {
        await input.platform.analytics.track("iap_cancel", { offerId });
        return;
      }

      const validationPayloadInput: {
        offerId: string;
        productId: string;
        purchaseToken?: string;
        developerPayload?: string;
        anonymousId: string;
        userId?: string;
        platformTarget: PlatformAdapter["target"];
      } = {
        offerId,
        productId: receipt.productId,
        anonymousId: state.save.profile.anonymousId,
        platformTarget: input.platform.target,
      };
      if (receipt.purchaseToken) {
        validationPayloadInput.purchaseToken = receipt.purchaseToken;
      }
      if (receipt.developerPayload) {
        validationPayloadInput.developerPayload = receipt.developerPayload;
      }
      if (state.save.profile.userId) {
        validationPayloadInput.userId = state.save.profile.userId;
      }
      const validationRequest = createReceiptValidationPayload(validationPayloadInput);
      const validation =
        (await input.platform.purchases.validateReceipt?.(validationRequest)) ?? {
          ok: true,
          status: "skipped",
          shouldGrant: true,
          consumePurchase: true,
          source: "platform",
        };

      if (!validation.ok || !validation.shouldGrant) {
        await input.platform.analytics.track("iap_failed", {
          offerId,
          productId: receipt.productId,
          validationStatus: validation.status,
          reason: validation.reason ?? "receipt_rejected",
        });
        addNotification(translate(state.locale, "shop.purchasePending"));
        return;
      }

      if (
        validation.consumePurchase &&
        receipt.purchaseToken &&
        input.platform.purchases.consumePurchase
      ) {
        await input.platform.purchases.consumePurchase(receipt.purchaseToken).catch((error) => {
          input.logger.warn("IAP", "Purchase consume failed", {
            offerId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      const beforeSave = state.save;
      const updated = applyShopOffer(state.save, offer);
      updateState({
        save: updated,
      });
      refreshShopOffers(updated);
      await input.platform.analytics.track("iap_success", {
        offerId,
        validationStatus: validation.status,
      });
      await trackCurrencyDelta(beforeSave, updated, "shop_purchase", { offerId });
      addNotification(`${translate(state.locale, offer.titleKey)} ${translate(state.locale, "shop.acquired")}`);
      await persist();
    },
    async restoreArea(nodeId) {
      const node = chapters.flatMap((chapter) => chapter.restorationNodes).find((item) => item.id === nodeId);
      if (!node) {
        throw new Error(`Unknown restoration node ${nodeId}`);
      }
      const beforeSave = state.save;
      await input.platform.analytics.track("meta_restore_started", { nodeId });
      const restoredSave = restoreNode(state.save, node);
      const updated = applyQuestProgress(
        restoredSave,
        questDefinitions,
        { restoration_completed: 1 },
        new Date().toISOString(),
      );
      updateState({
        save: updated,
      });
      refreshShopOffers(updated);

      await input.platform.analytics.track("meta_restore_completed", { nodeId });
      await trackCurrencyDelta(beforeSave, updated, "restoration", { nodeId });
      addNotification(translate(state.locale, node.titleKey));
      await persist();
    },
    async claimInboxItem(itemId) {
      const item = state.save.inbox.find((entry) => entry.id === itemId);
      if (!item || item.claimed) {
        return;
      }
      const beforeSave = state.save;
      const updated = applyRewardGrant(state.save, rewardGrantFromInbox(item));
      const nextSave = {
        ...updated,
        inbox: updated.inbox.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                claimed: true,
              }
            : entry,
        ),
      };
      updateState({
        save: nextSave,
      });
      refreshShopOffers(nextSave);
      await trackCurrencyDelta(beforeSave, nextSave, "inbox_claim", { itemId });
      await persist();
    },
    async requestAuth(reason) {
      await input.platform.analytics.track("auth_prompt_shown", { reason });
      const identity = await input.platform.auth.promptLogin(reason);
      if (identity.authenticated) {
        const profile = { ...state.save.profile };
        if (identity.userId) {
          profile.userId = identity.userId;
        }
        updateState({
          save: {
            ...state.save,
            profile,
          },
        });
        await input.platform.analytics.track("auth_success", { reason });
        await persist();
      } else {
        await input.platform.analytics.track("auth_skipped", { reason });
      }
    },
    async setLanguage(language) {
      updateState({
        locale: language,
        save: {
          ...state.save,
          settings: {
            ...state.save.settings,
            language,
          },
        },
      });
      await persist();
    },
    async submitLeaderboard() {
      const score = totalStars(state.save);
      const leaderboardId = resolveWeeklyLeaderboardId(state.remoteConfig);
      const success = await input.platform.leaderboards.submitScore(
        leaderboardId,
        score,
        JSON.stringify({
          chapter: state.save.progression.currentLevelId,
        }),
      );
      if (success) {
        await input.platform.analytics.track("leaderboard_submit", { score });
      }
      const leaderboard = await input.platform.leaderboards.getEntries(leaderboardId);
      updateState({ leaderboard });
    },
    async setSetting(key, value) {
      updateState({
        save: {
          ...state.save,
          settings: {
            ...state.save.settings,
            [key]: value,
          },
        },
      });
      await persist();
    },
    async acknowledgeLevelResult() {
      updateState({
        currentScreen: "map",
        activeLevel: null,
      });
      await input.platform.lifecycle.stopGameplay();
      await openScreenInternal("map");
    },
  };

  async function maybeShowInterstitial(reason: string) {
    const completedLevels = state.save.progression.completedLevels.length;
    const interstitialEvery =
      state.save.experiments.interstitial_pacing === "soft"
        ? state.remoteConfig.ads.interstitialEvery + 1
        : state.remoteConfig.ads.interstitialEvery;
    const eligible =
      !state.save.economy.noAdsPurchased &&
      completedLevels > 0 &&
      completedLevels % interstitialEvery === 0;

    if (!eligible) {
      return;
    }

    await input.platform.analytics.track("interstitial_requested", { reason });
    const outcome = await input.platform.ads.showInterstitial(reason);
    if (outcome.shown) {
      await input.platform.analytics.track("interstitial_shown", { reason });
      await input.platform.analytics.track("interstitial_closed", { reason });
    } else {
      await input.platform.analytics.track("interstitial_failed", {
        reason,
        detail: outcome.reason,
      });
    }
  }
}

function createWinBonusReward(baseReward: RewardGrant, multiplier: number): RewardGrant {
  const bonusMultiplier = Math.max(0, multiplier - 1);
  return {
    source: "level_complete",
    gold: Math.floor((baseReward.gold ?? 0) * bonusMultiplier),
    petals: Math.floor((baseReward.petals ?? 0) * bonusMultiplier),
    seasonalTokens: Math.floor((baseReward.seasonalTokens ?? 0) * bonusMultiplier),
  };
}

function resolveWeeklyLeaderboardId(remoteConfig: RemoteConfig): string {
  return (
    remoteConfig.leaderboards?.weeklyStarsId ??
    defaultRemoteConfig.leaderboards?.weeklyStarsId ??
    "weekly_stars"
  );
}

function resolvePlatformProductId(
  offer: ShopOfferDefinition,
  platformTarget: PlatformAdapter["target"],
  remoteConfig: RemoteConfig,
): string {
  const overrides =
    remoteConfig.commerce?.productIdOverrides ??
    defaultRemoteConfig.commerce?.productIdOverrides ?? {
      "web-mock": {},
      yandex: {},
      vk: {},
    };
  const override = overrides[platformTarget][offer.id];
  if (override) {
    return override;
  }

  if (platformTarget === "yandex") {
    return offer.yandexProductId ?? offer.sku;
  }

  return offer.sku;
}

function createReceiptValidationPayload(input: {
  offerId: string;
  productId: string;
  purchaseToken?: string;
  developerPayload?: string;
  anonymousId: string;
  userId?: string;
  platformTarget: PlatformAdapter["target"];
}): ReceiptValidationRequest {
  const payload: ReceiptValidationRequest = {
    offerId: input.offerId,
    productId: input.productId,
    anonymousId: input.anonymousId,
    platformTarget: input.platformTarget,
  };

  if (input.purchaseToken) {
    payload.purchaseToken = input.purchaseToken;
  }
  if (input.developerPayload) {
    payload.developerPayload = input.developerPayload;
  }
  if (input.userId) {
    payload.userId = input.userId;
  }

  return payload;
}

function rewardGrantFromInbox(item: GameSessionState["save"]["inbox"][number]): RewardGrant {
  const grant: RewardGrant = {
    source: item.source,
  };
  if (item.gold !== undefined) {
    grant.gold = item.gold;
  }
  if (item.petals !== undefined) {
    grant.petals = item.petals;
  }
  if (item.gems !== undefined) {
    grant.gems = item.gems;
  }
  if (item.seasonalTokens !== undefined) {
    grant.seasonalTokens = item.seasonalTokens;
  }
  if (item.boosters) {
    grant.boosters = item.boosters;
  }
  if (item.stars !== undefined) {
    grant.stars = item.stars;
  }
  if (item.labelKey) {
    grant.labelKey = item.labelKey;
  }
  return grant;
}
