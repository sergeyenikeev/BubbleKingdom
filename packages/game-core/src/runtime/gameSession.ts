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
  ShopOfferDefinition,
} from "@bubble-kingdom/shared";
import {
  TinyEmitter,
  type Logger,
} from "@bubble-kingdom/shared";
import type { RemoteConfig } from "@bubble-kingdom/config";
import {
  defaultRemoteConfig,
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
  calculatePiggyBankProgress,
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
}

export interface DecoratedShopOffer extends ShopOfferDefinition {
  platformPriceLabel: string;
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

  const resolveShopOffers = async (): Promise<DecoratedShopOffer[]> => {
    const platformCatalog = await input.platform.purchases.getCatalog().catch(() => []);
    const catalogById = new Map(platformCatalog.map((item) => [item.id, item]));

    updateState({
      platformCatalog,
    });

    return shopCatalog.map((offer) => ({
      ...offer,
      platformPriceLabel:
        ("platformPriceId" in offer.price
          ? catalogById.get(offer.price.platformPriceId)?.price
          : undefined) ??
        (offer.type === "no_ads" ? "249 RUB" : "149 RUB"),
    }));
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
      const leaderboard = await input.platform.leaderboards.getEntries("weekly_stars");
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
      const remoteConfig = await input.platform.remoteConfig.getRemoteConfig();
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
      const shopOffers = await resolveShopOffers();

      updateState({
        bootStatus: "ready",
        currentScreen: "map",
        locale: saveWithQuests.settings.language ?? locale,
        remoteConfig,
        save: {
          ...saveWithQuests,
          experiments,
        },
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
        const updatedSave = applyRewardGrant(state.save, levelReward);

        updateState({
          currentScreen: "win",
          save: {
            ...updatedSave,
            progression: {
              ...updatedSave.progression,
              currentLevelId: Math.max(
                updatedSave.progression.currentLevelId,
                levelSession.level.id + 1,
              ),
              completedLevels: [...completedLevels].sort((left, right) => left - right),
              starsByLevel: {
                ...updatedSave.progression.starsByLevel,
                [String(levelSession.level.id)]: Math.max(
                  updatedSave.progression.starsByLevel[String(levelSession.level.id)] ?? 0,
                  levelSession.board.starsEarned,
                ),
              },
            },
          },
        });

        updateState({
          save: applyQuestProgress(
            state.save,
            questDefinitions,
            {
              levels_complete: 1,
              stars_earned: levelSession.board.starsEarned,
            },
            new Date().toISOString(),
          ),
        });

        addNotification(
          `${translate(state.locale, "level.win")} +${levelReward.gold ?? 0} gold`,
        );
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
      if (!state.activeLevel || state.activeLevel.continueUsed) {
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
      updateState({
        currentScreen: "level",
        save: {
          ...state.save,
          economy: {
            ...state.save.economy,
            rewardedViews: state.save.economy.rewardedViews + 1,
          },
        },
      });
      await input.platform.lifecycle.startGameplay();
      await input.platform.analytics.track("rewarded_finished", {
        reason: "continue_after_fail",
      });
      await input.platform.analytics.track("rewarded_reward_granted", {
        reason: "continue_after_fail",
        moves: state.remoteConfig.ads.continueRewardMoves,
      });
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
        addNotification("Precision Aim active");
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
      await input.platform.analytics.track("daily_reward_claimed", {
        day: result.reward.day,
      });
      addNotification(`${translate(state.locale, "daily.title")} +${result.reward.day}`);
      await persist();
    },
    async claimQuest(questId) {
      const result = claimQuestReward(state.save, questDefinitions, questId);
      updateState({
        save: result.save,
      });
      await input.platform.analytics.track("quest_claimed", { questId });
      addNotification(translate(state.locale, "quest.claim"));
      await persist();
    },
    async purchaseOffer(offerId) {
      const offer = shopCatalog.find((item) => item.id === offerId);
      if (!offer) {
        throw new Error(`Unknown offer ${offerId}`);
      }
      await input.platform.analytics.track("iap_offer_view", { offerId });
      await input.platform.analytics.track("iap_start", { offerId });

      const receipt = await input.platform.purchases.purchase(
        offer.yandexProductId ?? offer.sku,
        JSON.stringify({ offerId }),
      );
      if (!receipt) {
        await input.platform.analytics.track("iap_cancel", { offerId });
        return;
      }

      const updated = applyShopOffer(state.save, offer);
      updateState({
        save: updated,
      });
      await input.platform.analytics.track("iap_success", { offerId });
      addNotification(`${translate(state.locale, offer.titleKey)} acquired`);
      await persist();
    },
    async restoreArea(nodeId) {
      const node = chapters.flatMap((chapter) => chapter.restorationNodes).find((item) => item.id === nodeId);
      if (!node) {
        throw new Error(`Unknown restoration node ${nodeId}`);
      }
      await input.platform.analytics.track("meta_restore_started", { nodeId });
      updateState({
        save: restoreNode(state.save, node),
      });

      updateState({
        save: applyQuestProgress(
          state.save,
          questDefinitions,
          { restoration_completed: 1 },
          new Date().toISOString(),
        ),
      });

      await input.platform.analytics.track("meta_restore_completed", { nodeId });
      addNotification(translate(state.locale, node.titleKey));
      await persist();
    },
    async claimInboxItem(itemId) {
      const item = state.save.inbox.find((entry) => entry.id === itemId);
      if (!item || item.claimed) {
        return;
      }
      const updated = applyRewardGrant(state.save, rewardGrantFromInbox(item));
      updateState({
        save: {
          ...updated,
          inbox: updated.inbox.map((entry) =>
            entry.id === itemId
              ? {
                  ...entry,
                  claimed: true,
                }
              : entry,
          ),
        },
      });
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
      const success = await input.platform.leaderboards.submitScore(
        "weekly_stars",
        score,
        JSON.stringify({
          chapter: state.save.progression.currentLevelId,
        }),
      );
      if (success) {
        await input.platform.analytics.track("leaderboard_submit", { score });
      }
      const leaderboard = await input.platform.leaderboards.getEntries("weekly_stars");
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
    const eligible =
      !state.save.economy.noAdsPurchased &&
      completedLevels > 0 &&
      completedLevels % state.remoteConfig.ads.interstitialEvery === 0;

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
