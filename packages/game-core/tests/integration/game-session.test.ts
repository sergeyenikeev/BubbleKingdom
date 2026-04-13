import { beforeEach, describe, expect, it } from "vitest";

import { defaultRemoteConfig } from "../../../config/src/index";
import { chapters, liveEvents } from "../../../game-data/src/index";
import { createBoardState, createDefaultSave, createGameSession } from "../../src/index";
import { createMockPlatformAdapter } from "../../../platform-sdk/src/index";
import { createLogger } from "../../../shared/src/index";
import type { LevelDefinition } from "../../../shared/src/index";
import { SAVE_SCHEMA_VERSION } from "../../src/save/schema";

describe("game session integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  type SessionPlatform = Parameters<typeof createGameSession>[0]["platform"];

  function createSession(existing?: {
    platform: SessionPlatform;
    logger: ReturnType<typeof createLogger>;
  }) {
    if (existing) {
      return createGameSession({
        platform: existing.platform,
        logger: existing.logger,
        buildTarget: "test",
      });
    }

    const logger = createLogger({
      sessionId: "test",
      anonymousId: "test-anon",
      appVersion: "0.1.0-alpha",
      buildTarget: "test",
      platformTarget: "web-mock",
    });
    const platform = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      debug: true,
      logger,
      analyticsSinks: [],
      storagePrefix: "bubble-kingdom-test",
    });
    return createGameSession({
      platform,
      logger,
      buildTarget: "test",
    });
  }

  function createInstrumentedPlatform(storagePrefix = "bubble-kingdom-test-ads") {
    const logger = createLogger({
      sessionId: "test",
      anonymousId: "test-anon",
      appVersion: "0.1.0-alpha",
      buildTarget: "test",
      platformTarget: "web-mock",
    });
    const base = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      debug: true,
      logger,
      analyticsSinks: [],
      storagePrefix,
    });
    const stats = {
      interstitialReasons: [] as string[],
      bannerVisibility: [] as boolean[],
    };
    const platform: SessionPlatform = {
      ...base,
      ads: {
        ...base.ads,
        async showInterstitial(reason) {
          stats.interstitialReasons.push(reason);
          return base.ads.showInterstitial(reason);
        },
        async setStickyBannerVisible(visible) {
          stats.bannerVisibility.push(visible);
          return base.ads.setStickyBannerVisible(visible);
        },
      },
    };
    return { platform, logger, stats };
  }

  function forceInterstitialPacingVariant(
    platform: SessionPlatform,
    variant: "soft" | "standard",
  ) {
    platform.remoteConfig.getRemoteConfig = async () => ({
      ...defaultRemoteConfig,
      experiments: defaultRemoteConfig.experiments.map((experiment) =>
        experiment.key === "interstitial_pacing"
          ? {
              ...experiment,
              variants: [variant],
              defaultVariant: variant,
            }
          : experiment,
      ),
    });
  }

  async function completeLevelWithDeterministicWin(
    session: ReturnType<typeof createSession>,
    levelId: number,
  ) {
    await session.startLevel(levelId);
    const active = session.getState().activeLevel;
    if (!active) {
      throw new Error("Expected active level");
    }

    active.level.objective = { type: "clear_all" };
    active.board = createBoardState(deterministicWinLevel);
    await session.fireShot(-1.57);
  }

  const deterministicWinLevel: LevelDefinition = {
    id: 1999,
    chapterId: "test",
    indexInChapter: 1,
    moves: 8,
    palette: ["ruby", "sapphire", "emerald"],
    objective: { type: "clear_all" },
    layout: [
      ". . . . . . . .",
      ". . . R R . . .",
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . . . . . .",
    ],
    queue: ["ruby"],
    rewards: {
      gold: 100,
      petals: 10,
      seasonalTokens: 0,
    },
    difficulty: "easy",
  };

  it("boots first-time users into the daily reward flow", async () => {
    const session = createSession();
    await session.boot();

    expect(session.getState().bootStatus).toBe("ready");
    expect(session.getState().currentScreen).toBe("dailyRewards");
    expect(session.getState().dailyRewardAvailable).toBe(true);
  });

  it("claims daily reward and persists it across sessions", async () => {
    const session = createSession();
    await session.boot();
    const before = session.getState().save.currencies.gold;
    await session.claimDailyReward();

    expect(session.getState().currentScreen).toBe("map");
    expect(session.getState().save.currencies.gold).toBeGreaterThanOrEqual(before);
    expect(session.getState().save.progression.lastDailyRewardAt).not.toBeNull();
  });

  it("turns a claimed daily reward into a single follow-up spotlight on the map", async () => {
    const session = createSession();
    await session.boot();

    await session.claimDailyReward();

    expect(session.getState().mapSpotlight?.titleKey).toBe(chapters[0]!.titleKey);
    expect(session.getState().mapSpotlight?.action).toEqual({
      action: "start-current-level",
      labelKey: "map.play",
    });
  });

  it("turns a claimed daily reward into a restoration spotlight when the first upgrade is affordable", async () => {
    const nowIso = new Date().toISOString();
    const progressedSave = createDefaultSave({
      anonymousId: "anon-daily-restore",
      language: "en",
      nowIso,
      remoteConfig: defaultRemoteConfig,
    });
    progressedSave.currencies.gold = 600;
    progressedSave.currencies.petals = 40;
    progressedSave.progression.starsByLevel["1"] = 3;
    progressedSave.progression.starsByLevel["2"] = 3;
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(progressedSave));

    const session = createSession();
    await session.boot();
    await session.claimDailyReward();

    expect(session.getState().mapSpotlight?.titleKey).toBe(chapters[0]!.restorationNodes[0]!.titleKey);
    expect(session.getState().mapSpotlight?.action).toEqual({
      action: "restore-node",
      id: chapters[0]!.restorationNodes[0]!.id,
      labelKey: "map.restore",
    });
  });

  it("boots straight into a claimable quest spotlight when daily reward is already handled", async () => {
    const nowIso = new Date().toISOString();
    const progressedSave = createDefaultSave({
      anonymousId: "anon-quest-spotlight",
      language: "en",
      nowIso,
      remoteConfig: defaultRemoteConfig,
    });
    progressedSave.progression.lastDailyRewardAt = nowIso;
    progressedSave.progression.dailyRewardDay = 1;
    progressedSave.quests.daily_complete_3 = {
      progress: 3,
      claimed: false,
      cadence: "daily",
      lastUpdatedAt: nowIso,
    };
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(progressedSave));

    const session = createSession();
    await session.boot();

    expect(session.getState().mapSpotlight?.titleKey).toBe("quest.daily.complete3.title");
    expect(session.getState().mapSpotlight?.action).toEqual({
      action: "claim-quest",
      id: "daily_complete_3",
      labelKey: "quest.claim",
    });
  });

  it("turns a claimed quest into the next best restoration spotlight", async () => {
    const nowIso = new Date().toISOString();
    const progressedSave = createDefaultSave({
      anonymousId: "anon-quest-follow-up",
      language: "en",
      nowIso,
      remoteConfig: defaultRemoteConfig,
    });
    progressedSave.progression.lastDailyRewardAt = nowIso;
    progressedSave.progression.dailyRewardDay = 1;
    progressedSave.progression.starsByLevel["1"] = 3;
    progressedSave.progression.starsByLevel["2"] = 3;
    progressedSave.quests.daily_complete_3 = {
      progress: 3,
      claimed: false,
      cadence: "daily",
      lastUpdatedAt: nowIso,
    };
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(progressedSave));

    const session = createSession();
    await session.boot();
    await session.claimQuest("daily_complete_3");

    expect(session.getState().save.quests.daily_complete_3?.claimed).toBe(true);
    expect(session.getState().mapSpotlight?.titleKey).toBe(chapters[0]!.restorationNodes[0]!.titleKey);
    expect(session.getState().mapSpotlight?.action).toEqual({
      action: "restore-node",
      id: chapters[0]!.restorationNodes[0]!.id,
      labelKey: "map.restore",
    });
  });

  it("restores the current-level spotlight when the player returns to map without active guidance", async () => {
    const nowIso = new Date().toISOString();
    const progressedSave = createDefaultSave({
      anonymousId: "anon-map-self-heal",
      language: "en",
      nowIso,
      remoteConfig: defaultRemoteConfig,
    });
    progressedSave.progression.lastDailyRewardAt = nowIso;
    progressedSave.progression.dailyRewardDay = 1;
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(progressedSave));

    const session = createSession();
    await session.boot();

    expect(session.getState().mapSpotlight?.action).toEqual({
      action: "start-current-level",
      labelKey: "map.play",
    });

    await session.openLevelPreview(1);
    expect(session.getState().mapSpotlight).toBeNull();

    await session.closeLevelPreview();

    expect(session.getState().currentScreen).toBe("map");
    expect(session.getState().mapSpotlight?.titleKey).toBe(chapters[0]!.titleKey);
    expect(session.getState().mapSpotlight?.action).toEqual({
      action: "start-current-level",
      labelKey: "map.play",
    });
  });

  it("completes a level, grants rewards, and advances progression", async () => {
    const session = createSession();
    await session.boot();
    await session.startLevel(1);

    const active = session.getState().activeLevel;
    if (!active) {
      throw new Error("Expected active level");
    }
    active.level.objective = { type: "clear_all" };
    active.board = createBoardState(deterministicWinLevel);

    await session.fireShot(-1.57);

    expect(session.getState().currentScreen).toBe("win");
    expect(session.getState().save.progression.currentLevelId).toBeGreaterThan(1);
    expect(session.getState().save.progression.completedLevels).toContain(1);
  });

  it("opens a pre-level briefing and starts with selected starter boosters", async () => {
    const session = createSession();
    await session.boot();
    await session.claimDailyReward();
    const extraMovesBefore = session.getState().save.boosters.extraMoves ?? 0;
    const rainbowBefore = session.getState().save.boosters.rainbowOrb ?? 0;

    await session.openLevelPreview(1);
    session.togglePreLevelBooster("extraMoves");
    session.togglePreLevelBooster("rainbowOrb");
    await session.confirmLevelStart();

    expect(session.getState().currentScreen).toBe("level");
    expect(session.getState().activeLevel?.starterBoostersUsed).toEqual([
      "extraMoves",
      "rainbowOrb",
    ]);
    expect(session.getState().activeLevel?.board.movesRemaining).toBeGreaterThan(
      session.getState().activeLevel?.level.moves ?? 0,
    );
    expect(session.getState().activeLevel?.board.queue[0]).toBe("rainbow");
    expect(session.getState().save.boosters.extraMoves).toBe(extraMovesBefore - 1);
    expect(session.getState().save.boosters.rainbowOrb).toBe(rainbowBefore - 1);
  });

  it("fails a level and can continue after rewarded ad", async () => {
    const session = createSession();
    await session.boot();
    await session.startLevel(2);

    const active = session.getState().activeLevel;
    if (!active) {
      throw new Error("Expected active level");
    }
    active.board.movesRemaining = 1;
    active.board.cells = [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
    ];
    active.board.queue = ["ruby"];

    await session.fireShot(-1.1);
    expect(session.getState().currentScreen).toBe("fail");

    const continued = await session.continueWithRewarded();
    expect(continued).toBe(true);
    expect(session.getState().currentScreen).toBe("level");
    expect(session.getState().activeLevel?.board.movesRemaining).toBeGreaterThan(1);
  });

  it("can spend gems for extra moves after a fail", async () => {
    const session = createSession();
    await session.boot();
    await session.startLevel(2);

    const active = session.getState().activeLevel;
    if (!active) {
      throw new Error("Expected active level");
    }
    active.board.movesRemaining = 1;
    active.board.cells = [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
    ];
    active.board.queue = ["ruby"];

    await session.fireShot(-1.1);
    const gemsBefore = session.getState().save.currencies.gems;

    const continued = await session.continueWithGems();
    expect(continued).toBe(true);
    expect(session.getState().currentScreen).toBe("level");
    expect(session.getState().save.currencies.gems).toBeLessThan(gemsBefore);
  });

  it("opens shop, purchases an offer, switches language, and submits leaderboard score", async () => {
    const session = createSession();
    await session.boot();
    await session.openScreen("shop");
    await session.purchaseOffer("starter_pack");
    await session.setLanguage("ru");
    await session.submitLeaderboard();

    expect(session.getState().save.currencies.gems).toBeGreaterThan(40);
    expect(session.getState().locale).toBe("ru");
    expect(session.getState().leaderboard.length).toBeGreaterThan(0);
  });

  it("shows a next-level reward reveal after buying the starter pack", async () => {
    const session = createSession();
    await session.boot();
    await session.openScreen("shop");
    await session.purchaseOffer("starter_pack");

    expect(session.getState().rewardReveal?.tagKey).toBe("reward.reveal.shopPurchaseTag");
    expect(session.getState().rewardReveal?.titleKey).toBe("shop.starter.title");
    expect(session.getState().rewardReveal?.featureHighlight).toEqual({
      tagKey: "reward.reveal.shopPlayTag",
      titleKey: "goal.level.title",
      bodyKey: "reward.reveal.shopPlayBody",
    });
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "start-current-level",
      labelKey: "reward.reveal.keepPlaying",
    });
    expect(session.getState().rewardReveal?.rewards?.gems).toBe(120);
    expect(session.getState().rewardReveal?.rewards?.boosters?.bombOrb).toBe(3);
  });

  it("uses the platform locale on first boot and preserves a manual language override", async () => {
    const logger = createLogger({
      sessionId: "test",
      anonymousId: "test-anon",
      appVersion: "0.1.0-alpha",
      buildTarget: "test",
      platformTarget: "web-mock",
    });
    const platform = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      debug: true,
      logger,
      analyticsSinks: [],
      storagePrefix: "bubble-kingdom-test",
    });
    platform.locale.getLanguage = async () => "ru";

    const session = createSession({ platform, logger });
    await session.boot();

    expect(session.getState().locale).toBe("ru");
    expect(session.getState().save.settings.language).toBe("ru");

    await session.setLanguage("en");

    const secondLogger = createLogger({
      sessionId: "test-2",
      anonymousId: "test-anon",
      appVersion: "0.1.0-alpha",
      buildTarget: "test",
      platformTarget: "web-mock",
    });
    const secondPlatform = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      debug: true,
      logger: secondLogger,
      analyticsSinks: [],
      storagePrefix: "bubble-kingdom-test",
    });
    secondPlatform.locale.getLanguage = async () => "ru";

    const secondSession = createSession({ platform: secondPlatform, logger: secondLogger });
    await secondSession.boot();

    expect(secondSession.getState().locale).toBe("en");
    expect(secondSession.getState().save.settings.language).toBe("en");
  });

  it("respects remote-configured leaderboard ids", async () => {
    const logger = createLogger({
      sessionId: "test",
      anonymousId: "test-anon",
      appVersion: "0.1.0-alpha",
      buildTarget: "test",
      platformTarget: "web-mock",
    });
    const platform = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      debug: true,
      logger,
      analyticsSinks: [],
      storagePrefix: "bubble-kingdom-test",
    });
    const boardIds: string[] = [];
    platform.remoteConfig.getRemoteConfig = async () => ({
      ...defaultRemoteConfig,
      leaderboards: {
        weeklyStarsId: "stars_elite",
      },
    });
    platform.leaderboards.submitScore = async (boardId, score) => {
      boardIds.push(boardId);
      return score > 0;
    };
    platform.leaderboards.getEntries = async (boardId) => {
      boardIds.push(boardId);
      return [];
    };

    const session = createSession({ platform, logger });
    await session.boot();
    await session.submitLeaderboard();

    expect(boardIds).toContain("stars_elite");
  });

  it("grants a rewarded double-win bonus and refreshes monetization state", async () => {
    const session = createSession();
    await session.boot();
    await session.startLevel(1);

    const active = session.getState().activeLevel;
    if (!active) {
      throw new Error("Expected active level");
    }
    active.level.objective = { type: "clear_all" };
    active.board = createBoardState(deterministicWinLevel);

    await session.fireShot(-1.57);
    const goldAfterWin = session.getState().save.currencies.gold;

    const doubled = await session.claimWinBonusRewarded();
    expect(doubled).toBe(true);
    expect(session.getState().save.currencies.gold).toBeGreaterThan(goldAfterWin);
    expect(session.getState().activeLevel?.winBonusClaimed).toBe(true);
  });

  it("removes one-time and permanent offers after relevant purchases", async () => {
    const session = createSession();
    await session.boot();

    expect(session.getState().shopOffers.some((offer) => offer.id === "welcome_offer")).toBe(true);
    expect(session.getState().shopOffers.some((offer) => offer.id === "ad_light")).toBe(true);
    expect(session.getState().shopOffers.some((offer) => offer.id === "no_ads")).toBe(true);

    await session.purchaseOffer("starter_pack");
    expect(session.getState().shopOffers.some((offer) => offer.id === "welcome_offer")).toBe(false);

    await session.purchaseOffer("ad_light");
    expect(session.getState().save.economy.adLightPurchased).toBe(true);
    expect(session.getState().save.economy.noAdsPurchased).toBe(false);
    expect(session.getState().shopOffers.some((offer) => offer.id === "ad_light")).toBe(false);
    expect(session.getState().shopOffers.some((offer) => offer.id === "no_ads")).toBe(true);

    await session.purchaseOffer("no_ads");
    expect(session.getState().save.economy.noAdsPurchased).toBe(true);
    expect(session.getState().shopOffers.some((offer) => offer.id === "no_ads")).toBe(false);
  });

  it("also shows the same next-level reward reveal for the welcome offer", async () => {
    const session = createSession();
    await session.boot();

    expect(session.getState().shopOffers.some((offer) => offer.id === "welcome_offer")).toBe(true);

    await session.purchaseOffer("welcome_offer");

    expect(session.getState().rewardReveal?.titleKey).toBe("shop.welcome.title");
    expect(session.getState().rewardReveal?.tagKey).toBe("reward.reveal.shopPurchaseTag");
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "start-current-level",
      labelKey: "reward.reveal.keepPlaying",
    });
    expect(session.getState().rewardReveal?.rewards?.gems).toBe(70);
    expect(session.getState().shopOffers.some((offer) => offer.id === "welcome_offer")).toBe(false);
  });

  it("shows a next-level reward reveal after buying the booster pack", async () => {
    const session = createSession();
    await session.boot();
    await session.openScreen("shop");
    await session.purchaseOffer("booster_pack");

    expect(session.getState().rewardReveal?.tagKey).toBe("reward.reveal.boosterPurchaseTag");
    expect(session.getState().rewardReveal?.titleKey).toBe("shop.booster.title");
    expect(session.getState().rewardReveal?.featureHighlight).toEqual({
      tagKey: "reward.reveal.boosterPlayTag",
      titleKey: "goal.level.title",
      bodyKey: "reward.reveal.boosterPlayBody",
    });
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "start-current-level",
      labelKey: "reward.reveal.keepPlaying",
    });
    expect(session.getState().rewardReveal?.rewards?.boosters?.precisionAim).toBe(5);
  });

  it("shows a fail-safety reveal after buying the medium gem pack", async () => {
    const session = createSession();
    await session.boot();
    await session.openScreen("shop");
    await session.purchaseOffer("gem_pack_m");

    expect(session.getState().rewardReveal?.tagKey).toBe("reward.reveal.gemPurchaseTag");
    expect(session.getState().rewardReveal?.titleKey).toBe("shop.gems.m.title");
    expect(session.getState().rewardReveal?.featureHighlight).toEqual({
      tagKey: "reward.reveal.gemSafetyTag",
      titleKey: "reward.reveal.gemSafetyTitle",
      bodyKey: "reward.reveal.gemSafetyBody",
    });
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "start-current-level",
      labelKey: "reward.reveal.keepPlaying",
    });
    expect(session.getState().rewardReveal?.rewards?.gems).toBe(180);
  });

  it("keeps the fail flow active when a gem pack is purchased as a recovery rescue", async () => {
    const session = createSession();
    await session.boot();
    session.getState().save.currencies.gems = 0;
    session.getState().save.economy.rewardedViews = 4;
    await session.startLevel(24);

    const active = session.getState().activeLevel;
    if (!active) {
      throw new Error("Expected active level");
    }
    active.board.movesRemaining = 1;
    active.board.cells = [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
    ];
    active.board.queue = ["ruby"];

    await session.fireShot(-1.1);
    expect(session.getState().currentScreen).toBe("fail");

    await session.purchaseOffer("gem_pack_s");

    expect(session.getState().currentScreen).toBe("fail");
    expect(session.getState().rewardReveal).toBeNull();
    expect(session.getState().save.currencies.gems).toBe(75);

    const continued = await session.continueWithGems();
    expect(continued).toBe(true);
    expect(session.getState().currentScreen).toBe("level");
  });

  it("promotes gem continue after a fail rescue purchase even when rewarded would normally stay primary", async () => {
    const session = createSession();
    await session.boot();
    session.getState().save.currencies.gems = 0;
    session.getState().save.economy.rewardedViews = 0;
    await session.startLevel(24);

    const active = session.getState().activeLevel;
    if (!active) {
      throw new Error("Expected active level");
    }
    active.board.movesRemaining = 1;
    active.board.cells = [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
    ];
    active.board.queue = ["ruby"];

    await session.fireShot(-1.1);
    expect(session.getState().currentScreen).toBe("fail");
    expect(session.getState().failRecoveryHint).toBeNull();

    await session.purchaseOffer("gem_pack_s");

    expect(session.getState().currentScreen).toBe("fail");
    expect(session.getState().rewardReveal).toBeNull();
    expect(session.getState().failRecoveryHint).toBe("gems_continue");
    expect(session.getState().save.currencies.gems).toBe(75);

    const continued = await session.continueWithGems();
    expect(continued).toBe(true);
    expect(session.getState().currentScreen).toBe("level");
    expect(session.getState().failRecoveryHint).toBeNull();
    expect(session.getState().save.currencies.gems).toBe(63);
  });

  it("shows a restoration follow-up reveal after buying the renovation pack", async () => {
    const session = createSession();
    await session.boot();
    await session.openScreen("shop");
    await session.purchaseOffer("renovation_pack");

    expect(session.getState().rewardReveal?.tagKey).toBe("reward.reveal.renovationPurchaseTag");
    expect(session.getState().rewardReveal?.titleKey).toBe("shop.renovation.title");
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "open-screen",
      id: "restoration",
      labelKey: "reward.reveal.viewNextRestore",
    });
    expect(session.getState().rewardReveal?.featureHighlight?.tagKey).toBe(
      "reward.reveal.renovationPlanTag",
    );
    expect(session.getState().rewardReveal?.rewards?.gold).toBe(1500);
    expect(session.getState().rewardReveal?.rewards?.petals).toBe(120);
  });

  it("shows an event follow-up reveal after buying the season pass", async () => {
    const session = createSession();
    await session.boot();
    await session.openScreen("shop");
    await session.purchaseOffer("season_pass");

    expect(session.getState().rewardReveal?.tagKey).toBe("reward.reveal.seasonPurchaseTag");
    expect(session.getState().rewardReveal?.titleKey).toBe("shop.season.title");
    expect(session.getState().rewardReveal?.featureHighlight?.titleKey).toBe(
      liveEvents[0]!.titleKey,
    );
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "open-screen",
      id: "event",
      labelKey: "event.viewTrack",
    });
    expect(session.getState().rewardReveal?.rewards?.seasonalTokens).toBe(120);
  });

  it("keeps interstitials active after ad light while suppressing sticky banners", async () => {
    const storagePrefix = "bubble-kingdom-test-ad-light";
    const { platform, logger, stats } = createInstrumentedPlatform(storagePrefix);
    forceInterstitialPacingVariant(platform, "standard");
    const nowIso = new Date().toISOString();
    const progressedSave = createDefaultSave({
      anonymousId: "anon-ad-light",
      language: "en",
      nowIso,
      remoteConfig: defaultRemoteConfig,
    });
    progressedSave.progression.currentLevelId = 3;
    progressedSave.progression.completedLevels = [1, 2];
    progressedSave.progression.starsByLevel["1"] = 3;
    progressedSave.progression.starsByLevel["2"] = 3;
    progressedSave.progression.lastDailyRewardAt = nowIso;
    progressedSave.progression.dailyRewardDay = 1;
    progressedSave.experiments.interstitial_pacing = "standard";
    window.localStorage.setItem(`${storagePrefix}:save`, JSON.stringify(progressedSave));

    const session = createSession({ platform, logger });
    await session.boot();
    await session.openScreen("shop");
    await session.purchaseOffer("ad_light");

    expect(session.getState().save.economy.adLightPurchased).toBe(true);
    expect(session.getState().save.economy.noAdsPurchased).toBe(false);
    expect(session.getState().save.experiments.interstitial_pacing).toBe("standard");

    await session.openScreen("map");

    expect(stats.bannerVisibility.at(-1)).toBe(false);

    await completeLevelWithDeterministicWin(session, 3);

    expect(stats.interstitialReasons).toContain("level_complete");
  });

  it("suppresses both interstitials and sticky banners after a no ads purchase", async () => {
    const storagePrefix = "bubble-kingdom-test-no-ads";
    const { platform, logger, stats } = createInstrumentedPlatform(storagePrefix);
    forceInterstitialPacingVariant(platform, "standard");
    const nowIso = new Date().toISOString();
    const progressedSave = createDefaultSave({
      anonymousId: "anon-no-ads",
      language: "en",
      nowIso,
      remoteConfig: defaultRemoteConfig,
    });
    progressedSave.progression.currentLevelId = 3;
    progressedSave.progression.completedLevels = [1, 2];
    progressedSave.progression.starsByLevel["1"] = 3;
    progressedSave.progression.starsByLevel["2"] = 3;
    progressedSave.progression.lastDailyRewardAt = nowIso;
    progressedSave.progression.dailyRewardDay = 1;
    progressedSave.experiments.interstitial_pacing = "standard";
    window.localStorage.setItem(`${storagePrefix}:save`, JSON.stringify(progressedSave));

    const session = createSession({ platform, logger });
    await session.boot();
    await session.openScreen("shop");
    await session.purchaseOffer("no_ads");

    expect(session.getState().save.economy.noAdsPurchased).toBe(true);
    expect(session.getState().save.economy.adLightPurchased).toBe(true);
    expect(session.getState().save.experiments.interstitial_pacing).toBe("standard");

    await session.openScreen("map");

    expect(stats.bannerVisibility.at(-1)).toBe(false);

    await completeLevelWithDeterministicWin(session, 3);

    expect(stats.interstitialReasons).toHaveLength(0);
  });

  it("does not grant a purchase when receipt validation rejects it", async () => {
    const logger = createLogger({
      sessionId: "test",
      anonymousId: "test-anon",
      appVersion: "0.1.0-alpha",
      buildTarget: "test",
      platformTarget: "web-mock",
    });
    const platform = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      debug: true,
      logger,
      analyticsSinks: [],
      storagePrefix: "bubble-kingdom-test",
    });
    platform.purchases.validateReceipt = async () => ({
      ok: false,
      status: "rejected",
      shouldGrant: false,
      consumePurchase: false,
      source: "backend",
      reason: "product_id_mismatch",
    });

    const session = createSession({ platform, logger });
    await session.boot();
    const beforeGems = session.getState().save.currencies.gems;

    await session.purchaseOffer("starter_pack");

    expect(session.getState().save.currencies.gems).toBe(beforeGems);
    expect(session.getState().save.economy.firstPurchaseAt).toBeNull();
  });

  it("recovers from corrupted saves", async () => {
    window.localStorage.setItem("bubble-kingdom-test:save", "{broken");
    const session = createSession();
    await session.boot();

    expect(session.getState().bootStatus).toBe("ready");
    expect(session.getState().save.progression.currentLevelId).toBe(1);
  });

  it("queues and claims a comeback reward for returning players", async () => {
    const returningSave = createDefaultSave({
      anonymousId: "anon-returning",
      language: "en",
      nowIso: "2026-04-03T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    returningSave.profile.lastSessionAt = "2026-04-03T00:00:00.000Z";
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(returningSave));

    const session = createSession();
    await session.boot();

    const comebackItem = session
      .getState()
      .save.inbox.find((item) => item.source === "comeback" && !item.claimed);

    expect(comebackItem).toBeDefined();
    const gemsBeforeClaim = session.getState().save.currencies.gems;

    await session.claimInboxItem(comebackItem!.id);

    expect(session.getState().save.currencies.gems).toBeGreaterThan(gemsBeforeClaim);
    expect(
      session.getState().save.inbox.find((item) => item.id === comebackItem!.id)?.claimed,
    ).toBe(true);
  });

  it("turns a comeback inbox claim into a restoration spotlight when an upgrade is affordable", async () => {
    const returningSave = createDefaultSave({
      anonymousId: "anon-returning-restore",
      language: "en",
      nowIso: "2026-04-03T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    returningSave.profile.lastSessionAt = "2026-04-03T00:00:00.000Z";
    returningSave.progression.starsByLevel["1"] = 3;
    returningSave.progression.starsByLevel["2"] = 3;
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(returningSave));

    const session = createSession();
    await session.boot();

    const comebackItem = session
      .getState()
      .save.inbox.find((item) => item.source === "comeback" && !item.claimed);
    if (!comebackItem) {
      throw new Error("Expected a comeback reward item.");
    }

    await session.claimInboxItem(comebackItem.id);

    expect(session.getState().mapSpotlight?.titleKey).toBe(chapters[0]!.restorationNodes[0]!.titleKey);
    expect(session.getState().mapSpotlight?.action).toEqual({
      action: "restore-node",
      id: chapters[0]!.restorationNodes[0]!.id,
      labelKey: "map.restore",
    });
  });

  it("claims a chapter chest once the star target is met", async () => {
    const chapter = chapters[0]!;
    const progressedSave = createDefaultSave({
      anonymousId: "anon-chapter-chest",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    for (const levelId of chapter.levels.slice(0, 10)) {
      progressedSave.progression.starsByLevel[String(levelId)] = 3;
    }
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(progressedSave));

    const session = createSession();
    await session.boot();
    const gemsBefore = session.getState().save.currencies.gems;

    await session.claimChapterChest(chapter.id);

    expect(session.getState().save.progression.chapterChestsClaimed).toContain(chapter.id);
    expect(session.getState().save.currencies.gems).toBeGreaterThan(gemsBefore);
    expect(session.getState().rewardReveal?.titleKey).toBe(
      chapter.chapterChest.labelKey ?? "reward.chapterChest",
    );
    expect(session.getState().rewardReveal?.featureHighlight?.titleKey).toBe(
      liveEvents[0]!.titleKey,
    );
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "open-screen",
      id: "event",
      labelKey: "event.viewTrack",
    });

    await session.dismissRewardReveal();

    expect(session.getState().rewardReveal).toBeNull();
  });

  it("uses the next chapter as the follow-up beat when that zone is already unlocked", async () => {
    const chapter = chapters[0]!;
    const progressedSave = createDefaultSave({
      anonymousId: "anon-next-zone-beat",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    progressedSave.progression.currentLevelId = 51;
    for (const levelId of chapter.levels.slice(0, 10)) {
      progressedSave.progression.starsByLevel[String(levelId)] = 3;
    }
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(progressedSave));

    const session = createSession();
    await session.boot();

    await session.claimChapterChest(chapter.id);

    expect(session.getState().rewardReveal?.featureHighlight?.titleKey).toBe(
      chapters[1]!.titleKey,
    );
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "start-current-level",
      labelKey: "reward.reveal.exploreZone",
    });
  });

  it("shows a one-time chapter unlock reveal on the map when a new chapter becomes available", async () => {
    const logger = createLogger({
      sessionId: "test",
      anonymousId: "test-anon",
      appVersion: "0.1.0-alpha",
      buildTarget: "test",
      platformTarget: "web-mock",
    });
    const platform = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      debug: true,
      logger,
      analyticsSinks: [],
      storagePrefix: "bubble-kingdom-test",
    });
    platform.serverTime.now = async () => Date.parse("2026-04-09T09:00:00.000Z");

    const seededSave = createDefaultSave({
      anonymousId: platform.session.anonymousId,
      language: "en",
      nowIso: "2026-04-09T09:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    seededSave.schemaVersion = SAVE_SCHEMA_VERSION;
    seededSave.profile.lastSessionAt = "2026-04-09T09:00:00.000Z";
    seededSave.progression.currentLevelId = 51;
    seededSave.progression.lastDailyRewardAt = "2026-04-09T08:00:00.000Z";

    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(seededSave));

    const session = createSession({ platform, logger });
    await session.boot();

    expect(session.getState().currentScreen).toBe("map");
    expect(session.getState().rewardReveal?.titleKey).toBe(chapters[1]!.titleKey);
    expect(session.getState().rewardReveal?.featureHighlight?.titleKey).toBe(
      chapters[1]!.restorationNodes[0]!.titleKey,
    );
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "start-current-level",
      labelKey: "reward.reveal.startChapter",
    });
    expect(session.getState().save.tutorial.seenSteps).toContain(
      `chapter_unlock:${chapters[1]!.id}`,
    );
  });

  it("keeps a zone follow-up spotlight on the map after dismissing a chapter unlock reveal", async () => {
    const logger = createLogger({
      sessionId: "test",
      anonymousId: "test-anon",
      appVersion: "0.1.0-alpha",
      buildTarget: "test",
      platformTarget: "web-mock",
    });
    const platform = createMockPlatformAdapter({
      buildTarget: "test",
      platformTarget: "web-mock",
      debug: true,
      logger,
      analyticsSinks: [],
      storagePrefix: "bubble-kingdom-test",
    });
    platform.serverTime.now = async () => Date.parse("2026-04-09T09:00:00.000Z");

    const seededSave = createDefaultSave({
      anonymousId: platform.session.anonymousId,
      language: "en",
      nowIso: "2026-04-09T09:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    seededSave.schemaVersion = SAVE_SCHEMA_VERSION;
    seededSave.profile.lastSessionAt = "2026-04-09T09:00:00.000Z";
    seededSave.progression.currentLevelId = 51;
    seededSave.progression.lastDailyRewardAt = "2026-04-09T08:00:00.000Z";

    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(seededSave));

    const session = createSession({ platform, logger });
    await session.boot();
    await session.dismissRewardReveal();

    expect(session.getState().rewardReveal).toBeNull();
    expect(session.getState().mapSpotlight?.titleKey).toBe(
      chapters[1]!.restorationNodes[0]!.titleKey,
    );
    expect(session.getState().mapSpotlight?.action).toEqual({
      action: "start-current-level",
      labelKey: "reward.reveal.startChapter",
    });

    await session.openLevelPreview(51);

    expect(session.getState().mapSpotlight).toBeNull();
  });

  it("shows a restoration reveal after rebuilding a kingdom object", async () => {
    const chapter = chapters[0]!;
    const node = chapter.restorationNodes[0]!;
    const progressedSave = createDefaultSave({
      anonymousId: "anon-restoration-reveal",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    progressedSave.progression.starsByLevel["1"] = 3;
    progressedSave.progression.starsByLevel["2"] = 3;
    progressedSave.currencies.gold = 500;
    progressedSave.currencies.petals = 20;
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(progressedSave));

    const session = createSession();
    await session.boot();

    await session.restoreArea(node.id);

    expect(session.getState().save.progression.restoredNodes).toContain(node.id);
    expect(session.getState().rewardReveal?.titleKey).toBe(node.titleKey);
    expect(session.getState().rewardReveal?.chapterId).toBe(chapter.id);
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "open-screen",
      id: "restoration",
      labelKey: "reward.reveal.viewNextRestore",
    });

    await session.dismissRewardReveal();

    expect(session.getState().rewardReveal).toBeNull();
  });

  it("keeps an event follow-up spotlight on the map after dismissing a chapter chest reveal", async () => {
    const chapter = chapters[0]!;
    const progressedSave = createDefaultSave({
      anonymousId: "anon-event-follow-up",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    for (const levelId of chapter.levels.slice(0, 10)) {
      progressedSave.progression.starsByLevel[String(levelId)] = 3;
    }
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(progressedSave));

    const session = createSession();
    await session.boot();

    await session.claimChapterChest(chapter.id);
    await session.dismissRewardReveal();

    expect(session.getState().rewardReveal).toBeNull();
    expect(session.getState().mapSpotlight?.titleKey).toBe(liveEvents[0]!.titleKey);
    expect(session.getState().mapSpotlight?.action).toEqual({
      action: "open-screen",
      id: "event",
      labelKey: "event.viewTrack",
    });

    await session.openScreen("event");

    expect(session.getState().mapSpotlight).toBeNull();
  });

  it("claims a live event milestone once enough seasonal tokens are earned", async () => {
    const event = liveEvents[0]!;
    const milestone = event.rewardTrack[0]!;
    const progressedSave = createDefaultSave({
      anonymousId: "anon-event-claim",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    progressedSave.currencies.seasonalTokens = milestone.tokenCost;
    window.localStorage.setItem("bubble-kingdom-test:save", JSON.stringify(progressedSave));

    const session = createSession();
    await session.boot();
    const goldBefore = session.getState().save.currencies.gold;

    await session.claimEventReward(milestone.id);

    expect(session.getState().save.events[event.id]?.claimedMilestones).toContain(milestone.id);
    expect(session.getState().save.currencies.gold).toBeGreaterThan(goldBefore);
    expect(session.getState().rewardReveal?.titleKey).toBe(milestone.titleKey);
    expect(session.getState().rewardReveal?.featureHighlight?.titleKey).toBe(chapters[0]!.titleKey);
    expect(session.getState().rewardReveal?.primaryAction).toEqual({
      action: "start-current-level",
      labelKey: "map.play",
    });

    await session.dismissRewardReveal();

    expect(session.getState().rewardReveal).toBeNull();
    expect(session.getState().mapSpotlight?.titleKey).toBe(chapters[0]!.titleKey);
  });
});
