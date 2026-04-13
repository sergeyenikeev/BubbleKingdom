import {
  levels,
  chapters,
  dailyRewards,
  liveEvents,
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
  applyPreLevelLoadout,
  preLevelBoosterIds,
  togglePreLevelBoosterSelection,
  type PreLevelBoosterId,
} from "../boosters/preLevel";
import {
  applyRewardGrant,
  applyShopOffer,
  calculateExtraMovesGemCost,
  calculatePiggyBankBonusGems,
  calculatePiggyBankProgress,
  spendCurrency,
} from "../economy/economy";
import { decideFailOffer } from "../economy/offerDecisioning";
import { assignExperimentVariants } from "../features/featureFlags";
import { translate } from "../localization/messages";
import { claimDailyReward, getDailyRewardAvailability } from "../progression/dailyRewards";
import {
  claimEventMilestone,
  getEventProgressSummary,
} from "../progression/events";
import {
  canClaimChapterChest,
  chapterStarsEarned,
  claimChapterChest,
  getChapterRestorationProgress,
  restoreNode,
  totalStars,
} from "../progression/restoration";
import {
  enqueueComebackReward,
  getChapterUnlockSeenKey,
  planChapterUnlockReveal,
  planChapterFollowUp,
  planComebackReward,
  planSessionGoalSpotlight,
} from "../progression/sessionGuidance";
import {
  applyQuestProgress,
  claimQuestReward,
  initializeQuestProgress,
} from "../quests/quests";
import { createDefaultSave, type PlayerSave } from "../save/schema";
import { loadPlayerSave, writePlayerSave } from "../save/service";
import { getNextTutorialStep, markTutorialStepSeen } from "../tutorial/tutorial";

export type ScreenId =
  | "boot"
  | "map"
  | "preLevel"
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
  precisionAimActive: boolean;
  starterBoostersUsed: PreLevelBoosterId[];
  continueUsed: boolean;
  continueOffersUsed: number;
  winReward: RewardGrant | null;
  winBonusClaimed: boolean;
}

export interface LevelPreviewState {
  levelId: number;
  selectedBoosters: PreLevelBoosterId[];
}

export interface DecoratedShopOffer extends ShopOfferDefinition {
  platformPriceLabel: string;
  helperText?: string;
}

export interface RewardRevealState {
  tagKey: string;
  titleKey: string;
  bodyKey: string;
  rewards?: RewardGrant;
  featureHighlight?: {
    tagKey: string;
    titleKey: string;
    bodyKey: string;
  };
  chapterId?: string;
  restorationNodeId?: string;
  primaryAction?: {
    action:
      | "open-screen"
      | "start-current-level"
      | "restore-node"
      | "claim-event-reward"
      | "claim-chapter-chest"
      | "claim-quest";
    id?: string;
    labelKey: string;
  };
}

export interface MapSpotlightState {
  tagKey: string;
  titleKey: string;
  bodyKey: string;
  action: NonNullable<RewardRevealState["primaryAction"]>;
}

export interface GameSessionState {
  bootStatus: "idle" | "booting" | "ready" | "error";
  currentScreen: ScreenId;
  locale: LanguageCode;
  remoteConfig: RemoteConfig;
  buildProfile: BuildProfile;
  save: PlayerSave;
  activeLevel: ActiveLevelSession | null;
  levelPreview: LevelPreviewState | null;
  tutorialStep: string | null;
  lastError: string | null;
  notifications: string[];
  leaderboard: LeaderboardEntry[];
  dailyRewardAvailable: boolean;
  shopOffers: DecoratedShopOffer[];
  platformCatalog: PlatformProduct[];
  eventId: string;
  rewardReveal: RewardRevealState | null;
  mapSpotlight: MapSpotlightState | null;
  failRecoveryHint: "gems_continue" | null;
}

type GameSessionEvents = {
  state: GameSessionState;
};

export interface GameSession {
  getState(): GameSessionState;
  subscribe(listener: (state: GameSessionState) => void): () => void;
  boot(): Promise<void>;
  openScreen(screen: ScreenId): Promise<void>;
  openLevelPreview(levelId: number): Promise<void>;
  closeLevelPreview(): Promise<void>;
  confirmLevelStart(): Promise<void>;
  togglePreLevelBooster(boosterId: PreLevelBoosterId): void;
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
  claimChapterChest(chapterId: string): Promise<void>;
  claimEventReward(milestoneId: string): Promise<void>;
  claimInboxItem(itemId: string): Promise<void>;
  dismissRewardReveal(): Promise<void>;
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
    levelPreview: null,
    tutorialStep: null,
    lastError: null,
    notifications: [],
    leaderboard: [],
    dailyRewardAvailable: false,
    shopOffers: [],
    platformCatalog: [],
    eventId: defaultRemoteConfig.liveops.currentEventId,
    rewardReveal: null,
    mapSpotlight: null,
    failRecoveryHint: null,
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

  const showRewardReveal = (reveal: RewardRevealState) => {
    updateState({
      rewardReveal: reveal,
      mapSpotlight: null,
    });
  };

  const getNextRestorationPurchaseContext = (save: PlayerSave) => {
    for (const chapter of chapters) {
      const progress = getChapterRestorationProgress(save, chapter);
      if (progress.nextNode) {
        return {
          chapter,
          progress,
          node: progress.nextNode,
        };
      }
    }

    return null;
  };

  const planShopPurchaseRewardReveal = (
    save: PlayerSave,
    offer: ShopOfferDefinition,
  ): RewardRevealState | null => {
    if (offer.type === "starter_pack" || offer.type === "welcome_offer") {
      return {
        tagKey: "reward.reveal.shopPurchaseTag",
        titleKey: offer.titleKey,
        bodyKey: "reward.reveal.shopPurchaseBody",
        rewards: offer.rewards,
        featureHighlight: {
          tagKey: "reward.reveal.shopPlayTag",
          titleKey: "goal.level.title",
          bodyKey: "reward.reveal.shopPlayBody",
        },
        primaryAction: {
          action: "start-current-level",
          labelKey: "reward.reveal.keepPlaying",
        },
      };
    }

    if (offer.type === "booster_pack") {
      return {
        tagKey: "reward.reveal.boosterPurchaseTag",
        titleKey: offer.titleKey,
        bodyKey: "reward.reveal.boosterPurchaseBody",
        rewards: offer.rewards,
        featureHighlight: {
          tagKey: "reward.reveal.boosterPlayTag",
          titleKey: "goal.level.title",
          bodyKey: "reward.reveal.boosterPlayBody",
        },
        primaryAction: {
          action: "start-current-level",
          labelKey: "reward.reveal.keepPlaying",
        },
      };
    }

    if (offer.type === "gem_pack" && (offer.id === "gem_pack_m" || offer.id === "gem_pack_l")) {
      return {
        tagKey: "reward.reveal.gemPurchaseTag",
        titleKey: offer.titleKey,
        bodyKey: "reward.reveal.gemPurchaseBody",
        rewards: offer.rewards,
        featureHighlight: {
          tagKey: "reward.reveal.gemSafetyTag",
          titleKey: "reward.reveal.gemSafetyTitle",
          bodyKey: "reward.reveal.gemSafetyBody",
        },
        primaryAction: {
          action: "start-current-level",
          labelKey: "reward.reveal.keepPlaying",
        },
      };
    }

    if (offer.type === "renovation_pack") {
      const restorationContext = getNextRestorationPurchaseContext(save);

      if (!restorationContext) {
        return {
          tagKey: "reward.reveal.renovationPurchaseTag",
          titleKey: offer.titleKey,
          bodyKey: "reward.reveal.renovationPurchaseBody",
          rewards: offer.rewards,
          featureHighlight: {
            tagKey: "reward.reveal.shopPlayTag",
            titleKey: "goal.level.title",
            bodyKey: "reward.reveal.shopPlayBody",
          },
          primaryAction: {
            action: "start-current-level",
            labelKey: "reward.reveal.keepPlaying",
          },
        };
      }

      return {
        tagKey: "reward.reveal.renovationPurchaseTag",
        titleKey: offer.titleKey,
        bodyKey: "reward.reveal.renovationPurchaseBody",
        rewards: offer.rewards,
        featureHighlight: {
          tagKey: restorationContext.progress.nextNodeAffordable
            ? "reward.reveal.renovationReadyTag"
            : "reward.reveal.renovationPlanTag",
          titleKey: restorationContext.node.titleKey,
          bodyKey: restorationContext.progress.nextNodeAffordable
            ? "reward.reveal.renovationReadyBody"
            : "reward.reveal.renovationPlanBody",
        },
        primaryAction: {
          action: "open-screen",
          id: "restoration",
          labelKey: "reward.reveal.viewNextRestore",
        },
      };
    }

    if (offer.type === "season_pass") {
      const activeEvent = getActiveEvent();

      if (activeEvent) {
        return {
          tagKey: "reward.reveal.seasonPurchaseTag",
          titleKey: offer.titleKey,
          bodyKey: "reward.reveal.seasonPurchaseBody",
          rewards: offer.rewards,
          featureHighlight: {
            tagKey: "reward.reveal.eventSpotlightTag",
            titleKey: activeEvent.titleKey,
            bodyKey: activeEvent.descriptionKey,
          },
          primaryAction: {
            action: "open-screen",
            id: "event",
            labelKey: "event.viewTrack",
          },
        };
      }

      return {
        tagKey: "reward.reveal.seasonPurchaseTag",
        titleKey: offer.titleKey,
        bodyKey: "reward.reveal.seasonPurchaseBody",
        rewards: offer.rewards,
        featureHighlight: {
          tagKey: "reward.reveal.shopPlayTag",
          titleKey: "goal.level.title",
          bodyKey: "reward.reveal.shopPlayBody",
        },
        primaryAction: {
          action: "start-current-level",
          labelKey: "reward.reveal.keepPlaying",
        },
      };
    }

    return null;
  };

  const clearMapSpotlight = () => {
    if (!state.mapSpotlight) {
      return;
    }

    updateState({
      mapSpotlight: null,
    });
  };

  const promoteRewardRevealToMapSpotlight = (reveal: RewardRevealState) => {
    if (!reveal.featureHighlight || !reveal.primaryAction) {
      return;
    }

    updateState({
      mapSpotlight: {
        ...reveal.featureHighlight,
        action: reveal.primaryAction,
      },
    });
  };

  const canAllowEventGoals = (save: PlayerSave = state.save) =>
    save.tutorial.completed || save.progression.completedLevels.length >= 2;

  const setMapSpotlightFromSave = (
    save: PlayerSave,
    options?: { clearIfNone?: boolean; ignoreDailyReward?: boolean },
  ) => {
    const spotlight = planSessionGoalSpotlight({
      save,
      chapters,
      quests: questDefinitions,
      dailyRewardAvailable: state.dailyRewardAvailable,
      event: getActiveEvent(),
      allowEventGoals: canAllowEventGoals(save),
      ...(options?.ignoreDailyReward ? { ignoreDailyReward: true } : {}),
    });

    if (spotlight) {
      updateState({
        mapSpotlight: spotlight,
      });
      return;
    }

    if (options?.clearIfNone) {
      updateState({
        mapSpotlight: null,
      });
    }
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
        offer.type === "ad_light" &&
        (save.economy.adLightPurchased || save.economy.noAdsPurchased)
      ) {
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
          (offer.type === "no_ads"
            ? "249 RUB"
            : offer.type === "ad_light"
              ? "99 RUB"
              : "149 RUB"),
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

  const updateTutorialStep = (save: PlayerSave = state.save) => {
    updateState({
      tutorialStep: getNextTutorialStep(save, state.remoteConfig),
    });
  };

  const markTutorialStep = (save: PlayerSave, step: string) => {
    if (save.tutorial.seenSteps.includes(step)) {
      return save;
    }

    return markTutorialStepSeen(save, step);
  };

  const markSeenFlag = (save: PlayerSave, seenKey: string): PlayerSave => {
    if (save.tutorial.seenSteps.includes(seenKey)) {
      return save;
    }

    return {
      ...save,
      tutorial: {
        ...save.tutorial,
        seenSteps: [...save.tutorial.seenSteps, seenKey],
      },
    };
  };

  const getActiveEvent = (eventId: string = state.eventId) =>
    liveEvents.find((event) => event.id === eventId) ?? liveEvents[0] ?? null;

  const notifyClaimableEventMilestone = (before: PlayerSave, after: PlayerSave) => {
    const activeEvent = getActiveEvent();
    if (!activeEvent) {
      return;
    }

    const beforeClaimable = getEventProgressSummary(before, activeEvent).claimableMilestones.length;
    const afterSummary = getEventProgressSummary(after, activeEvent);
    if (afterSummary.claimableMilestones.length > beforeClaimable) {
      addNotification(translate(state.locale, "event.rewardReady"));
    }
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

  const maybeShowChapterUnlockRevealOnMap = async () => {
    if (state.currentScreen !== "map" || state.rewardReveal) {
      return;
    }

    const unlockPlan = planChapterUnlockReveal({
      save: state.save,
      chapters,
    });
    if (!unlockPlan) {
      return;
    }

    const nextSave = markSeenFlag(state.save, unlockPlan.seenKey);
    const firstLandmark = unlockPlan.chapter.restorationNodes[0] ?? null;
    const rewardReveal: RewardRevealState = {
      tagKey: "reward.reveal.chapterUnlockedTag",
      titleKey: unlockPlan.chapter.titleKey,
      bodyKey: unlockPlan.chapter.descriptionKey,
      primaryAction: {
        action: "start-current-level",
        labelKey: "reward.reveal.startChapter",
      },
    };
    if (firstLandmark) {
      rewardReveal.featureHighlight = {
        tagKey: "reward.reveal.firstLandmarkTag",
        titleKey: firstLandmark.titleKey,
        bodyKey: firstLandmark.descriptionKey,
      };
    }
    updateState({
      save: nextSave,
      rewardReveal,
    });
    addNotification(translate(state.locale, "reward.reveal.chapterUnlockedTag"));
    await persist();
  };

  const restoreMapSpotlightIfNeeded = (
    options?: { clearIfNone?: boolean; ignoreDailyReward?: boolean },
  ) => {
    if (state.currentScreen !== "map" || state.rewardReveal || state.mapSpotlight) {
      return;
    }

    setMapSpotlightFromSave(state.save, {
      clearIfNone: true,
      ...(options?.ignoreDailyReward ? { ignoreDailyReward: true } : {}),
    });
  };

  const openScreenInternal = async (screen: ScreenId) => {
    const previousScreen = state.currentScreen;
    if (
      state.mapSpotlight?.action.action === "open-screen" &&
      state.mapSpotlight.action.id === screen
    ) {
      clearMapSpotlight();
    }
    updateState({
      currentScreen: screen,
      failRecoveryHint: screen === "fail" ? state.failRecoveryHint : null,
      levelPreview: screen === "preLevel" ? state.levelPreview : null,
    });
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
      const updated = markTutorialStep(state.save, "shop");
      if (updated !== state.save) {
        updateState({ save: updated });
        updateTutorialStep(updated);
        await persist();
      }
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
    if (screen === "event") {
      const activeEvent = getActiveEvent();
      if (activeEvent) {
        const nextSave = {
          ...state.save,
          events: {
            ...state.save.events,
            [activeEvent.id]: {
              claimedMilestones: state.save.events[activeEvent.id]?.claimedMilestones ?? [],
              lastViewedAt: new Date().toISOString(),
            },
          },
        };
        updateState({ save: nextSave });
        await persist();
      }
    }

    if (screen === "map") {
      await maybeShowChapterUnlockRevealOnMap();
      restoreMapSpotlightIfNeeded();
    }
  };

  const startLevelInternal = async (
    levelId: number,
    starterBoosters: PreLevelBoosterId[] = [],
  ) => {
    const level = levels.find((item) => item.id === levelId);
    if (!level) {
      throw new Error(`Unknown level ${levelId}`);
    }

    let board = createBoardState(level);
    let save = state.save;
    let precisionAimActive = false;
    let starterBoostersUsed: PreLevelBoosterId[] = [];

    if (starterBoosters.length > 0) {
      const resolution = applyPreLevelLoadout(state.save, board, starterBoosters);
      board = resolution.board;
      save = resolution.save;
      precisionAimActive = resolution.precisionAimActive;
      starterBoostersUsed = resolution.appliedBoosters;
    }

    const saveChanged = save !== state.save;

    updateState({
      currentScreen: "level",
      failRecoveryHint: null,
      save,
      activeLevel: {
        level,
        board,
        preview: null,
        lastSummary: null,
        precisionAimActive,
        starterBoostersUsed,
        continueUsed: false,
        continueOffersUsed: 0,
        winReward: null,
        winBonusClaimed: false,
      },
      levelPreview: null,
    });
    refreshShopOffers(save);
    updateTutorialStep(save);
    await input.platform.ads.setStickyBannerVisible(false);
    await input.platform.lifecycle.startGameplay();
    for (const boosterId of starterBoostersUsed) {
      await input.platform.analytics.track("booster_used", {
        boosterId,
        levelId,
        phase: "pre_level",
      });
    }
    await input.platform.analytics.track("level_start", {
      levelId,
      starterBoosters: starterBoostersUsed,
      precisionAimActive,
    });
    if (saveChanged) {
      await persist();
    }
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
      const loadedSaveResult = await loadPlayerSave({
        platform: input.platform,
        remoteConfig,
        locale,
        logger: input.logger,
      });
      await input.platform.analytics.track("save_load", {
        source: loadedSaveResult.source,
        recovered: loadedSaveResult.recovered,
        migrationApplied: loadedSaveResult.migrationApplied,
      });
      if (loadedSaveResult.migrationApplied) {
        await input.platform.analytics.track("save_migration", {
          source: loadedSaveResult.source,
          fromVersion: loadedSaveResult.previousSchemaVersion,
          toVersion: loadedSaveResult.save.schemaVersion,
        });
      }

      const saveWithQuests = initializeQuestProgress(
        loadedSaveResult.save,
        questDefinitions,
        new Date().toISOString(),
      );
      const experiments = assignExperimentVariants(
        input.platform.session.anonymousId,
        remoteConfig,
      );
      let saveWithExperiments = {
        ...saveWithQuests,
        experiments,
      };
      const comebackPlan = planComebackReward({
        save: saveWithExperiments,
        previousSessionAt: loadedSaveResult.previousSessionAt,
        nowIso: saveWithExperiments.profile.lastSessionAt,
        remoteConfig,
      });
      if (comebackPlan.available) {
        saveWithExperiments = enqueueComebackReward(
          saveWithExperiments,
          comebackPlan,
          saveWithExperiments.profile.lastSessionAt,
        );
      }
      const shopOffers = await resolveShopOffers(saveWithExperiments, remoteConfig);

      updateState({
        bootStatus: "ready",
        currentScreen: "map",
        locale: saveWithExperiments.settings.language ?? locale,
        remoteConfig,
        save: saveWithExperiments,
        shopOffers,
        eventId: remoteConfig.liveops.currentEventId,
      });

      for (const [key, value] of Object.entries(experiments)) {
        await input.platform.analytics.track("feature_flag_assignment", { key, value });
        await input.platform.analytics.track("ab_variant_assigned", { key, value });
      }

      if (comebackPlan.available) {
        addNotification(translate(state.locale, "comeback.notice"));
      }

      await refreshDailyRewardState();
      updateTutorialStep(saveWithExperiments);
      await input.platform.lifecycle.markLoadingReady();
      if (state.dailyRewardAvailable) {
        updateState({ currentScreen: "dailyRewards" });
      } else {
        await maybeShowChapterUnlockRevealOnMap();
        restoreMapSpotlightIfNeeded();
      }
      await persist();
    },
    async openScreen(screen) {
      await openScreenInternal(screen);
    },
    async openLevelPreview(levelId) {
      const level = levels.find((item) => item.id === levelId);
      if (!level) {
        throw new Error(`Unknown level ${levelId}`);
      }

      if (
        state.mapSpotlight?.action.action === "start-current-level" &&
        levelId === state.save.progression.currentLevelId
      ) {
        clearMapSpotlight();
      }

      updateState({
        currentScreen: "preLevel",
        levelPreview: {
          levelId,
          selectedBoosters: [],
        },
      });
      await input.platform.ads.setStickyBannerVisible(
        state.remoteConfig.ads.allowBannerOnMap && !state.save.economy.adLightPurchased,
      );
    },
    async closeLevelPreview() {
      updateState({
        levelPreview: null,
      });
      await openScreenInternal("map");
    },
    async confirmLevelStart() {
      if (!state.levelPreview) {
        return;
      }

      await startLevelInternal(
        state.levelPreview.levelId,
        state.levelPreview.selectedBoosters,
      );
    },
    togglePreLevelBooster(boosterId) {
      if (!state.levelPreview || !preLevelBoosterIds.includes(boosterId)) {
        return;
      }

      updateState({
        levelPreview: {
          ...state.levelPreview,
          selectedBoosters: togglePreLevelBoosterSelection(
            state.levelPreview.selectedBoosters,
            boosterId,
            state.save.boosters,
          ),
        },
      });
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
      let nextSave = markTutorialStep(state.save, "aim");
      let saveChanged = nextSave !== state.save;

      if (summary.popped.length > 0 || summary.dropped.length > 0) {
        nextSave = markTutorialStep(nextSave, "match");
        const goldGain = Math.max(0, Math.floor(summary.scoreGained / 10));
        nextSave = applyQuestProgress(
          {
            ...nextSave,
            economy: {
              ...nextSave.economy,
              piggyBankGold: calculatePiggyBankProgress(
                nextSave,
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
        );
        saveChanged = true;
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

        const completedLevels = new Set(nextSave.progression.completedLevels);
        completedLevels.add(levelSession.level.id);
        const rewardedSave = applyRewardGrant(nextSave, levelReward);
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
        updateTutorialStep(progressedSave);

        addNotification(
          `${translate(state.locale, "level.win")} +${levelReward.gold ?? 0} ${translate(state.locale, "currency.gold")}`,
        );
        const justUnlockedChest = chapters.find(
          (chapter) =>
            chapter.levels.includes(levelSession.level.id) &&
            canClaimChapterChest(progressedSave, chapter),
        );
        if (justUnlockedChest) {
          addNotification(translate(state.locale, "chapterChest.ready"));
        }
        notifyClaimableEventMilestone(beforeShotSave, progressedSave);
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
        const failOfferDecision = decideFailOffer({
          save: nextSave,
          remoteConfig: state.remoteConfig,
          shopOffers: state.shopOffers,
          continueOffersUsed: levelSession.continueOffersUsed,
        });
        updateState({
          currentScreen: "fail",
          failRecoveryHint: null,
          save: nextSave,
        });
        if (saveChanged) {
          refreshShopOffers(nextSave);
          updateTutorialStep(nextSave);
        }
        await input.platform.lifecycle.stopGameplay();
        await input.platform.analytics.track("level_fail", {
          levelId: levelSession.level.id,
          score: levelSession.board.score,
          recommendedAction: failOfferDecision.primaryAction,
          failOfferVariant: failOfferDecision.variant,
        });
        await input.platform.analytics.track("extra_moves_offer_shown", {
          levelId: levelSession.level.id,
          recommendedAction: failOfferDecision.primaryAction,
          gemCost: failOfferDecision.gemCost,
          hasEnoughGems: failOfferDecision.hasEnoughGems,
          failOfferVariant: failOfferDecision.variant,
          piggyBankShown: Boolean(failOfferDecision.piggyBank?.isNudged),
          piggyBankFillRatio: failOfferDecision.piggyBank?.fillRatio ?? 0,
        });
      } else if (saveChanged) {
        updateState({
          save: nextSave,
        });
        refreshShopOffers(nextSave);
        updateTutorialStep(nextSave);
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
        failRecoveryHint: null,
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
        failRecoveryHint: null,
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
      notifyClaimableEventMilestone(beforeSave, updated);
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
      const updatedSave = markTutorialStep(result.save, "dailyReward");
      updateState({
        save: updatedSave,
        currentScreen: "map",
        dailyRewardAvailable: false,
      });
      refreshShopOffers(updatedSave);
      updateTutorialStep(updatedSave);
      await input.platform.analytics.track("daily_reward_claimed", {
        day: result.reward.day,
      });
      notifyClaimableEventMilestone(beforeSave, updatedSave);
      await trackCurrencyDelta(beforeSave, updatedSave, "daily_reward", {
        day: result.reward.day,
      });
        addNotification(`${translate(state.locale, "daily.title")} +${result.reward.day}`);
        await maybeShowChapterUnlockRevealOnMap();
        if (!state.rewardReveal) {
          setMapSpotlightFromSave(updatedSave, {
            clearIfNone: true,
            ignoreDailyReward: true,
          });
        }
        await persist();
      },
    async claimQuest(questId) {
      const beforeSave = state.save;
      const result = claimQuestReward(state.save, questDefinitions, questId);
      updateState({
        save: result.save,
      });
      refreshShopOffers(result.save);
      updateTutorialStep(result.save);
      setMapSpotlightFromSave(result.save, {
        clearIfNone: true,
        ignoreDailyReward: true,
      });
      await input.platform.analytics.track("quest_claimed", { questId });
      notifyClaimableEventMilestone(beforeSave, result.save);
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
        signature?: string;
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
      if (receipt.signature) {
        validationPayloadInput.signature = receipt.signature;
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
      const failRecoveryHint =
        state.currentScreen === "fail" &&
        state.activeLevel &&
        !state.activeLevel.continueUsed &&
        (offer.type === "gem_pack" || offer.type === "piggy_bank")
          ? updated.currencies.gems >=
            calculateExtraMovesGemCost(state.activeLevel.continueOffersUsed, state.remoteConfig)
            ? "gems_continue"
            : null
          : state.failRecoveryHint;
      updateState({
        save: updated,
        failRecoveryHint,
      });
      refreshShopOffers(updated);
      updateTutorialStep(updated);
      const purchaseReveal =
        state.currentScreen === "fail" && offer.type === "gem_pack"
          ? null
          : planShopPurchaseRewardReveal(updated, offer);
      if (purchaseReveal) {
        showRewardReveal(purchaseReveal);
      }
      await input.platform.analytics.track("iap_success", {
        offerId,
        validationStatus: validation.status,
      });
      await trackCurrencyDelta(beforeSave, updated, "shop_purchase", { offerId });
      addNotification(`${translate(state.locale, offer.titleKey)} ${translate(state.locale, "shop.acquired")}`);
      await persist();
    },
    async restoreArea(nodeId) {
      if (
        state.mapSpotlight?.action.action === "restore-node" &&
        state.mapSpotlight.action.id === nodeId
      ) {
        clearMapSpotlight();
      }

      const chapter = chapters.find((item) =>
        item.restorationNodes.some((restorationNode) => restorationNode.id === nodeId),
      );
      const node = chapter?.restorationNodes.find((item) => item.id === nodeId);
      if (!node) {
        throw new Error(`Unknown restoration node ${nodeId}`);
      }
      const beforeSave = state.save;
      await input.platform.analytics.track("meta_restore_started", { nodeId });
      const restoredSave = restoreNode(state.save, node);
      const updated = applyQuestProgress(
        markTutorialStep(restoredSave, "restore"),
        questDefinitions,
        { restoration_completed: 1 },
        new Date().toISOString(),
      );
      const chapterRestorationComplete = Boolean(
        chapter?.restorationNodes.every((restorationNode) =>
          updated.progression.restoredNodes.includes(restorationNode.id),
        ),
      );
      updateState({
        save: updated,
      });
      refreshShopOffers(updated);
      updateTutorialStep(updated);
      showRewardReveal({
        tagKey: "reward.reveal.restorationTag",
        titleKey: node.titleKey,
        bodyKey: "reward.reveal.restorationBody",
        chapterId: node.chapterId,
        restorationNodeId: node.id,
        primaryAction: chapterRestorationComplete
          ? {
              action: "start-current-level",
              labelKey: "reward.reveal.keepPlaying",
            }
          : {
              action: "open-screen",
              id: "restoration",
              labelKey: "reward.reveal.viewNextRestore",
            },
      });

      await input.platform.analytics.track("meta_restore_completed", { nodeId });
      await trackCurrencyDelta(beforeSave, updated, "restoration", { nodeId });
      addNotification(translate(state.locale, node.titleKey));
      await persist();
    },
    async claimChapterChest(chapterId) {
      const chapter = chapters.find((item) => item.id === chapterId);
      if (!chapter) {
        throw new Error(`Unknown chapter ${chapterId}`);
      }

      if (!canClaimChapterChest(state.save, chapter)) {
        return;
      }

      const beforeSave = state.save;
      const claimedSave = claimChapterChest(state.save, chapter);
      const rewardedSave = applyRewardGrant(claimedSave, chapter.chapterChest);
      updateState({
        save: rewardedSave,
      });
      refreshShopOffers(rewardedSave);
      updateTutorialStep(rewardedSave);
      const chapterFollowUp = planChapterFollowUp({
        save: rewardedSave,
        chapters,
        chapterId,
        event: getActiveEvent(),
      });
      const rewardReveal: RewardRevealState = {
        tagKey: "reward.reveal.chapterChestTag",
        titleKey: chapter.chapterChest.labelKey ?? "reward.chapterChest",
        bodyKey: "reward.reveal.body",
        rewards: chapter.chapterChest,
      };
      if (chapterFollowUp) {
        let nextSave = rewardedSave;
        if (chapterFollowUp.chapterId) {
          nextSave = markSeenFlag(
            rewardedSave,
            getChapterUnlockSeenKey(chapterFollowUp.chapterId),
          );
          if (nextSave !== rewardedSave) {
            updateState({
              save: nextSave,
            });
          }
        }
        rewardReveal.featureHighlight = chapterFollowUp.highlight;
        rewardReveal.primaryAction = chapterFollowUp.primaryAction;
      }
      showRewardReveal(rewardReveal);
      notifyClaimableEventMilestone(beforeSave, rewardedSave);
      await trackCurrencyDelta(beforeSave, rewardedSave, "chapter_chest", {
        chapterId,
        starsEarned: chapterStarsEarned(rewardedSave, chapter),
      });
      addNotification(translate(state.locale, chapter.chapterChest.labelKey ?? "reward.chapterChest"));
      await persist();
    },
    async claimEventReward(milestoneId) {
      if (
        state.mapSpotlight?.action.action === "claim-event-reward" &&
        state.mapSpotlight.action.id === milestoneId
      ) {
        clearMapSpotlight();
      }

      const activeEvent = getActiveEvent();
      if (!activeEvent) {
        throw new Error("No live event configured.");
      }

      const beforeSave = state.save;
      const claimed = claimEventMilestone(state.save, activeEvent, milestoneId);
      updateState({
        save: claimed.save,
      });
      refreshShopOffers(claimed.save);
      updateTutorialStep(claimed.save);
      const rewardReveal: RewardRevealState = {
        tagKey: "reward.reveal.eventTag",
        titleKey: claimed.milestone.titleKey,
        bodyKey: "reward.reveal.body",
        rewards: claimed.milestone.rewards,
      };
      const followUpSpotlight = planSessionGoalSpotlight({
        save: claimed.save,
        chapters,
        quests: questDefinitions,
        dailyRewardAvailable: state.dailyRewardAvailable,
        event: activeEvent,
        allowEventGoals: canAllowEventGoals(claimed.save),
        ignoreDailyReward: true,
      });
      if (followUpSpotlight) {
        rewardReveal.featureHighlight = {
          tagKey: followUpSpotlight.tagKey,
          titleKey: followUpSpotlight.titleKey,
          bodyKey: followUpSpotlight.bodyKey,
        };
        rewardReveal.primaryAction = followUpSpotlight.action;
      }
      showRewardReveal(rewardReveal);
      await trackCurrencyDelta(beforeSave, claimed.save, "event_reward", {
        eventId: activeEvent.id,
        milestoneId,
      });
      addNotification(translate(state.locale, claimed.milestone.titleKey));
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
      updateTutorialStep(nextSave);
      if (item.source === "comeback") {
        setMapSpotlightFromSave(nextSave, {
          clearIfNone: true,
          ignoreDailyReward: true,
        });
      }
      await trackCurrencyDelta(beforeSave, nextSave, "inbox_claim", { itemId });
      await persist();
    },
    async dismissRewardReveal() {
      if (!state.rewardReveal) {
        return;
      }
      promoteRewardRevealToMapSpotlight(state.rewardReveal);
      updateState({
        rewardReveal: null,
      });
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
      updateTutorialStep({
        ...state.save,
        settings: {
          ...state.save.settings,
          language,
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
        failRecoveryHint: null,
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
  signature?: string;
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
  if (input.signature) {
    payload.signature = input.signature;
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
