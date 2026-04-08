import { beforeEach, describe, expect, it } from "vitest";

import { defaultRemoteConfig } from "../../../config/src/index";
import { createBoardState, createGameSession } from "../../src/index";
import { createMockPlatformAdapter } from "../../../platform-sdk/src/index";
import { createLogger } from "../../../shared/src/index";
import type { LevelDefinition } from "../../../shared/src/index";

describe("game session integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function createSession(existing?: {
    platform: ReturnType<typeof createMockPlatformAdapter>;
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
    expect(session.getState().shopOffers.some((offer) => offer.id === "no_ads")).toBe(true);

    await session.purchaseOffer("starter_pack");
    expect(session.getState().shopOffers.some((offer) => offer.id === "welcome_offer")).toBe(false);

    await session.purchaseOffer("no_ads");
    expect(session.getState().shopOffers.some((offer) => offer.id === "no_ads")).toBe(false);
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
});
