import {
  levels,
  chapters,
  dailyRewards,
  liveEvents,
  questDefinitions,
  shopCatalog,
  visualThemes,
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
  canOpenScreenWithDisclosure,
  getMenuState,
  getStoreState,
  getVisibleThemeIds,
  hasFirstSessionResult,
  isFeatureUnlocked,
  isThemeUnlockedForPurchase,
  type MenuStateId,
  type StoreStateId,
} from "../progression/disclosure";
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

export interface ScreenSpotlightState {
  screenId: ScreenId;
  tagKey: string;
  titleKey: string;
  bodyKey: string;
  action: MapSpotlightState["action"];
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
  screenSpotlight: ScreenSpotlightState | null;
  failRecoveryHint: "gems_continue" | null;
  menuState: MenuStateId;
  storeState: StoreStateId;
}

type RestorationFollowUpState = {
  featureHighlight: NonNullable<RewardRevealState["featureHighlight"]>;
  primaryAction: NonNullable<RewardRevealState["primaryAction"]>;
};

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
  selectTheme(themeId: string): Promise<void>;
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
  const initialSave = createDefaultSave({
    anonymousId: input.platform.session.anonymousId,
    language: "en",
    nowIso: new Date().toISOString(),
    remoteConfig: defaultRemoteConfig,
  });
  let state: GameSessionState = {
    bootStatus: "idle",
    currentScreen: "boot",
    locale: "en",
    remoteConfig: defaultRemoteConfig,
    buildProfile,
    save: initialSave,
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
    screenSpotlight: null,
    failRecoveryHint: null,
    menuState: getMenuState(initialSave, defaultRemoteConfig),
    storeState: getStoreState(initialSave, defaultRemoteConfig),
  };

  const updateState = (patch: Partial<GameSessionState>) => {
    const nextSave = patch.save ?? state.save;
    const nextRemoteConfig = patch.remoteConfig ?? state.remoteConfig;
    state = {
      ...state,
      ...patch,
      menuState: getMenuState(nextSave, nextRemoteConfig),
      storeState: getStoreState(nextSave, nextRemoteConfig),
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

  const buildRestorationFollowUp = (
    progress: ReturnType<typeof getChapterRestorationProgress>,
  ): RestorationFollowUpState | null => {
    if (!progress.nextNode) {
      return null;
    }

    return {
      featureHighlight: {
        tagKey: progress.nextNodeAffordable
          ? "reward.reveal.renovationReadyTag"
          : "reward.reveal.renovationPlanTag",
        titleKey: progress.nextNode.titleKey,
        bodyKey: progress.nextNodeAffordable
          ? "reward.reveal.renovationReadyBody"
          : "reward.reveal.renovationPlanBody",
      },
      primaryAction: {
        action: "open-screen",
        id: "restoration",
        labelKey: "reward.reveal.viewNextRestore",
      },
    };
  };

  const buildEventRewardFollowUp = (
    save: PlayerSave,
    event = getActiveEvent(),
  ): RestorationFollowUpState | null => {
    if (!event) {
      return null;
    }

    const nextClaimableMilestone = getEventProgressSummary(save, event).claimableMilestones[0] ?? null;
    if (!nextClaimableMilestone) {
      return {
        featureHighlight: {
          tagKey: "screen.event",
          titleKey: "event.followup.playTitle",
          bodyKey: "event.followup.playBody",
        },
        primaryAction: {
          action: "start-current-level",
          labelKey: "reward.reveal.keepPlaying",
        },
      };
    }

    return {
      featureHighlight: {
        tagKey: "screen.event",
        titleKey: nextClaimableMilestone.titleKey,
        bodyKey: "event.rewardReady",
      },
      primaryAction: {
        action: "claim-event-reward",
        id: nextClaimableMilestone.id,
        labelKey: "event.claim",
      },
    };
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

      const followUp = buildRestorationFollowUp(restorationContext.progress);
      if (!followUp) {
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
        featureHighlight: followUp.featureHighlight,
        primaryAction: followUp.primaryAction,
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

  const setFailRecoveryMapSpotlight = () => {
    updateState({
      mapSpotlight: {
        tagKey: "reward.reveal.gemSafetyTag",
        titleKey: "reward.reveal.gemSafetyTitle",
        bodyKey: "reward.reveal.gemSafetyBody",
        action: {
          action: "start-current-level",
          labelKey: "reward.reveal.keepPlaying",
        },
      },
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

  const promoteRewardRevealToCurrentScreenSpotlight = (
    reveal: RewardRevealState,
  ): ScreenSpotlightState | null => {
    if (!reveal.featureHighlight || !reveal.primaryAction) {
      return null;
    }

    if (state.currentScreen !== "event" && state.currentScreen !== "restoration") {
      return null;
    }

    return {
      screenId: state.currentScreen,
      tagKey: reveal.featureHighlight.tagKey,
      titleKey: reveal.featureHighlight.titleKey,
      bodyKey: reveal.featureHighlight.bodyKey,
      action: reveal.primaryAction,
    };
  };

  const canAllowEventGoals = (save: PlayerSave = state.save) =>
    isFeatureUnlocked({
      feature: "event",
      save,
      remoteConfig: state.remoteConfig,
      eventAvailable: Boolean(getActiveEvent()),
    });

  const canAllowQuestGoals = (save: PlayerSave = state.save) =>
    isFeatureUnlocked({
      feature: "quests",
      save,
      remoteConfig: state.remoteConfig,
    });

  const canAllowDailyRewardGoals = (save: PlayerSave = state.save) =>
    isFeatureUnlocked({
      feature: "dailyRewards",
      save,
      remoteConfig: state.remoteConfig,
    });

  const setMapSpotlightFromSave = (
    save: PlayerSave,
    options?: { clearIfNone?: boolean; ignoreDailyReward?: boolean },
  ) => {
    const spotlight = planSessionGoalSpotlight({
      save,
      chapters,
      quests: canAllowQuestGoals(save) ? questDefinitions : [],
      dailyRewardAvailable: canAllowDailyRewardGoals(save) && state.dailyRewardAvailable,
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

  const markSessionStarted = (save: PlayerSave): PlayerSave => ({
    ...save,
    engagement: {
      ...save.engagement,
      sessionCount: save.engagement.sessionCount + 1,
    },
  });

  const markLevelStarted = (save: PlayerSave, nowIso: string): PlayerSave => ({
    ...save,
    engagement: {
      ...save.engagement,
      hasStartedLevel: true,
      firstLevelStartedAt: save.engagement.firstLevelStartedAt ?? nowIso,
    },
  });

  const markFirstLevelCompleted = (save: PlayerSave, nowIso: string): PlayerSave => ({
    ...save,
    engagement: {
      ...save.engagement,
      hasStartedLevel: true,
      firstLevelCompletedAt: save.engagement.firstLevelCompletedAt ?? nowIso,
    },
  });

  const markFirstLevelFailed = (save: PlayerSave, nowIso: string): PlayerSave => ({
    ...save,
    engagement: {
      ...save.engagement,
      hasStartedLevel: true,
      firstLevelFailedAt: save.engagement.firstLevelFailedAt ?? nowIso,
    },
  });

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
    const requestedScreen = screen;
    const spotlightAllowsScreen =
      (state.mapSpotlight?.action.action === "open-screen" && state.mapSpotlight.action.id === screen) ||
      (state.screenSpotlight?.action.action === "open-screen" && state.screenSpotlight.action.id === screen);
    if (
      !spotlightAllowsScreen &&
      !canOpenScreenWithDisclosure({
        screenId: screen,
        save: state.save,
        remoteConfig: state.remoteConfig,
        eventAvailable: Boolean(getActiveEvent()),
      })
    ) {
      screen = "map";
      await input.platform.analytics.track("hidden_screen_deeplink_redirect", {
        requestedScreen,
        redirectedTo: screen,
        menuState: state.menuState,
        storeState: state.storeState,
      });
    }

    const previousScreen = state.currentScreen;
    const matchedScreenSpotlight =
      state.mapSpotlight?.action.action === "open-screen" && state.mapSpotlight.action.id === screen
        ? {
            screenId: screen,
            tagKey: state.mapSpotlight.tagKey,
            titleKey: state.mapSpotlight.titleKey,
            bodyKey: state.mapSpotlight.bodyKey,
            action: state.mapSpotlight.action,
          }
        : null;
    const returningScreenSpotlightToMap =
      screen === "map" && state.screenSpotlight
        ? {
            tagKey: state.screenSpotlight.tagKey,
            titleKey: state.screenSpotlight.titleKey,
            bodyKey: state.screenSpotlight.bodyKey,
            action: state.screenSpotlight.action,
          }
        : null;
    updateState({
      currentScreen: screen,
      failRecoveryHint: screen === "fail" ? state.failRecoveryHint : null,
      levelPreview: screen === "preLevel" ? state.levelPreview : null,
      mapSpotlight: matchedScreenSpotlight
        ? null
        : returningScreenSpotlightToMap ?? state.mapSpotlight,
      screenSpotlight: matchedScreenSpotlight ?? (returningScreenSpotlightToMap ? null : state.screenSpotlight),
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
      const nextSave =
        updated === state.save
          ? {
              ...state.save,
              engagement: {
                ...state.save.engagement,
                storeIntroSeen: true,
              },
            }
          : {
              ...updated,
              engagement: {
                ...updated.engagement,
                storeIntroSeen: true,
              },
            };
      if (nextSave !== state.save) {
        updateState({ save: nextSave });
        updateTutorialStep(nextSave);
        await persist();
      }
      await input.platform.analytics.track("shop_open", {
        storeState: state.storeState,
        menuState: state.menuState,
      });
      await input.platform.analytics.track("store_state_assigned", {
        storeState: state.storeState,
        menuState: state.menuState,
      });
      for (const themeId of getVisibleThemeIds({
        themes: visualThemes,
        save: state.save,
        remoteConfig: state.remoteConfig,
      })) {
        await input.platform.analytics.track("store_theme_impression", {
          themeId,
          storeState: state.storeState,
        });
      }
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

    save = markLevelStarted(save, new Date().toISOString());
    const saveChanged = save !== state.save;
    const clearCurrentLevelSpotlight =
      state.mapSpotlight?.action.action === "start-current-level" &&
      levelId === state.save.progression.currentLevelId;

    updateState({
      currentScreen: "level",
      failRecoveryHint: null,
      mapSpotlight: clearCurrentLevelSpotlight ? null : state.mapSpotlight,
      screenSpotlight: null,
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

      const saveWithSession = markSessionStarted(loadedSaveResult.save);
      const saveWithQuests = initializeQuestProgress(
        saveWithSession,
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
      await input.platform.analytics.track("menu_state_assigned", {
        menuState: state.menuState,
        storeState: state.storeState,
        completedLevels: state.save.progression.completedLevels.length,
        sessionCount: state.save.engagement.sessionCount,
        currentLevel: state.save.progression.currentLevelId,
      });
      await input.platform.analytics.track("store_state_assigned", {
        menuState: state.menuState,
        storeState: state.storeState,
        completedLevels: state.save.progression.completedLevels.length,
        sessionCount: state.save.engagement.sessionCount,
      });

      if (comebackPlan.available) {
        addNotification(translate(state.locale, "comeback.notice"));
      }

      await refreshDailyRewardState();
      updateTutorialStep(saveWithExperiments);
      await input.platform.lifecycle.markLoadingReady();
      const shouldOpenDailyReward =
        state.dailyRewardAvailable &&
        isFeatureUnlocked({
          feature: "dailyRewards",
          save: state.save,
          remoteConfig: state.remoteConfig,
        }) &&
        state.save.experiments.daily_reward_entry !== "inline_after_first_session";
      if (shouldOpenDailyReward) {
        updateState({ currentScreen: "dailyRewards" });
      } else {
        await maybeShowChapterUnlockRevealOnMap();
        restoreMapSpotlightIfNeeded();
      }
      await persist();
    },
    async openScreen(screen) {
      await input.platform.analytics.track("menu_item_click", {
        screen,
        menuState: state.menuState,
        storeState: state.storeState,
      });
      await openScreenInternal(screen);
    },
    async openLevelPreview(levelId) {
      const level = levels.find((item) => item.id === levelId);
      if (!level) {
        throw new Error(`Unknown level ${levelId}`);
      }

      updateState({
        currentScreen: "preLevel",
        levelPreview: {
          levelId,
          selectedBoosters: [],
        },
        screenSpotlight: null,
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

        const completedAt = new Date().toISOString();
        const completedLevels = new Set(nextSave.progression.completedLevels);
        completedLevels.add(levelSession.level.id);
        const rewardedSave = applyRewardGrant(nextSave, levelReward);
        const progressedSave = markFirstLevelCompleted(
          applyQuestProgress(
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
            completedAt,
          ),
          completedAt,
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
        const failedSave = markFirstLevelFailed(nextSave, new Date().toISOString());
        const failOfferDecision = decideFailOffer({
          save: failedSave,
          remoteConfig: state.remoteConfig,
          shopOffers: state.shopOffers,
          continueOffersUsed: levelSession.continueOffersUsed,
        });
        updateState({
          currentScreen: "fail",
          failRecoveryHint: null,
          save: failedSave,
        });
        if (saveChanged || failedSave !== state.save) {
          refreshShopOffers(failedSave);
          updateTutorialStep(failedSave);
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
        await persist();
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
    async selectTheme(themeId) {
      const theme = visualThemes.find((item) => item.id === themeId);
      if (!theme) {
        throw new Error(`Unknown theme ${themeId}`);
      }

      const owned = state.save.cosmetics.unlockedThemeIds.includes(theme.id);
      const unlockedForPurchase = isThemeUnlockedForPurchase(
        theme,
        state.save,
        state.remoteConfig,
      );
      if (!owned && !unlockedForPurchase) {
        await input.platform.analytics.track("feature_unlock_shown", {
          featureId: "themes",
          themeId,
          storeState: state.storeState,
          unlockReason: theme.unlock.type,
        });
        addNotification(translate(state.locale, "theme.locked"));
        return;
      }

      let updated = state.save;
      const beforeSave = state.save;
      if (!owned) {
        await input.platform.analytics.track("theme_purchase_start", {
          themeId,
          priceGems: theme.price.gems,
          storeState: state.storeState,
        });
        try {
          updated = spendCurrency(updated, "gems", theme.price.gems);
        } catch {
          await input.platform.analytics.track("theme_purchase_failed", {
            themeId,
            reason: "not_enough_gems",
            storeState: state.storeState,
          });
          addNotification(translate(state.locale, "economy.notEnoughGems"));
          return;
        }
        updated = {
          ...updated,
          cosmetics: {
            activeThemeId: theme.id,
            unlockedThemeIds: [...updated.cosmetics.unlockedThemeIds, theme.id],
          },
        };
      } else {
        updated = {
          ...updated,
          cosmetics: {
            ...updated.cosmetics,
            activeThemeId: theme.id,
          },
        };
      }

      updateState({
        save: updated,
      });
      await input.platform.analytics.track(owned ? "theme_selected" : "theme_purchase_success", {
        themeId,
        storeState: state.storeState,
      });
      await trackCurrencyDelta(beforeSave, updated, "theme_purchase", { themeId });
      addNotification(`${translate(state.locale, theme.titleKey)} ${translate(state.locale, "theme.active")}`);
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
      const chapterProgress = chapter ? getChapterRestorationProgress(updated, chapter) : null;
      const chapterRestorationComplete = chapterProgress?.isComplete ?? true;
      const restorationFollowUp = chapterProgress ? buildRestorationFollowUp(chapterProgress) : null;
      updateState({
        save: updated,
        screenSpotlight: state.screenSpotlight?.screenId === "restoration" ? null : state.screenSpotlight,
      });
      refreshShopOffers(updated);
      updateTutorialStep(updated);
      const rewardReveal: RewardRevealState = {
        tagKey: "reward.reveal.restorationTag",
        titleKey: node.titleKey,
        bodyKey: "reward.reveal.restorationBody",
        chapterId: node.chapterId,
        restorationNodeId: node.id,
      };
      if (chapterRestorationComplete) {
        rewardReveal.primaryAction = {
          action: "start-current-level",
          labelKey: "reward.reveal.keepPlaying",
        };
      } else if (restorationFollowUp) {
        rewardReveal.featureHighlight = restorationFollowUp.featureHighlight;
        rewardReveal.primaryAction = restorationFollowUp.primaryAction;
      } else {
        rewardReveal.primaryAction = {
          action: "open-screen",
          id: "restoration",
          labelKey: "reward.reveal.viewNextRestore",
        };
      }
      showRewardReveal(rewardReveal);

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
        screenSpotlight: state.screenSpotlight?.screenId === "event" ? null : state.screenSpotlight,
      });
      refreshShopOffers(claimed.save);
      updateTutorialStep(claimed.save);
      const rewardReveal: RewardRevealState = {
        tagKey: "reward.reveal.eventTag",
        titleKey: claimed.milestone.titleKey,
        bodyKey: "reward.reveal.body",
        rewards: claimed.milestone.rewards,
      };
      const eventFollowUp = buildEventRewardFollowUp(claimed.save, activeEvent);
      if (eventFollowUp) {
        rewardReveal.featureHighlight = eventFollowUp.featureHighlight;
        rewardReveal.primaryAction = eventFollowUp.primaryAction;
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
      const screenSpotlight = promoteRewardRevealToCurrentScreenSpotlight(state.rewardReveal);
      if (screenSpotlight) {
        updateState({
          rewardReveal: null,
          mapSpotlight: null,
          screenSpotlight,
        });
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
      const keepRecoveryMomentum =
        state.currentScreen === "fail" && state.failRecoveryHint === "gems_continue";
      updateState({
        currentScreen: "map",
        activeLevel: null,
        failRecoveryHint: null,
      });
      await input.platform.lifecycle.stopGameplay();
      await openScreenInternal("map");
      if (keepRecoveryMomentum && !state.rewardReveal) {
        setFailRecoveryMapSpotlight();
      }
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
