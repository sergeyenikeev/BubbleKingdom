import {
  chapters,
  dailyRewards,
  levels,
  liveEvents,
  questDefinitions,
} from "@bubble-kingdom/game-data";
import type { GameSession, GameSessionState, ScreenId } from "@bubble-kingdom/game-core";
import {
  canRestoreNode,
  canSelectPreLevelBooster,
  chapterStarsEarned,
  calculateExtraMovesGemCost,
  createBoardState,
  decideFailOffer,
  deriveSessionGoal,
  getEventProgressSummary,
  planFailRescueGemOffer,
  getChapterRestorationProgress,
  getPiggyBankPresentation,
  isPreLevelBoosterSelected,
  preLevelBoosterIds,
  summarizeSessionSurfaceAlerts,
  totalStars,
  translate,
} from "@bubble-kingdom/game-core";
import type { LevelDefinition } from "@bubble-kingdom/shared";

declare global {
  interface Window {
    __bubbleKingdomDebug?: BubbleKingdomDebugHarness;
  }
}

interface BubbleKingdomDebugHarness {
  getState(): GameSessionState;
  openLevelPreview(levelId: number): Promise<void>;
  confirmLevelStart(): Promise<void>;
  startLevel(levelId: number): Promise<void>;
  forceWin(levelId?: number): Promise<void>;
  forceFail(levelId?: number): Promise<void>;
  continueWithRewarded(): Promise<boolean>;
  continueWithGems(): Promise<boolean>;
  claimWinBonusRewarded(): Promise<boolean>;
  acknowledgeLevelResult(): Promise<void>;
}

const debugWinLevel: LevelDefinition = {
  id: 1999,
  chapterId: "debug",
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

export function mountApp(root: HTMLElement, session: GameSession, debugEnabled: boolean) {
  root.innerHTML = `
    <div class="app-shell">
      <div class="background-orbs"></div>
      <div id="game-canvas" class="game-canvas-wrap"></div>
      <div id="ui-layer" class="ui-layer"></div>
    </div>
  `;

  const canvasHost = root.querySelector<HTMLElement>("#game-canvas");
  const uiLayer = root.querySelector<HTMLElement>("#ui-layer");
  if (!canvasHost || !uiLayer) {
    throw new Error("App mount points were not found.");
  }

  if (debugEnabled) {
    window.__bubbleKingdomDebug = createDebugHarness(session);
  }

  let renderer: RendererHandle | null = null;
  let rendererPromise: Promise<RendererHandle | null> | null = null;
  let latestState: GameSessionState | null = null;
  let warmupScheduled = false;
  let disposed = false;

  const ensureRenderer = () => {
    if (renderer) {
      return Promise.resolve(renderer);
    }

    if (!rendererPromise) {
      rendererPromise = import("./phaser/GameRenderer")
        .then(({ GameRenderer }) => {
          if (disposed) {
            return null;
          }

          const nextRenderer = new GameRenderer(canvasHost, {
            onPreview: (angle) => session.previewShot(angle),
            onShoot: (angle) => {
              void session.fireShot(angle);
            },
          });
          renderer = nextRenderer;
          if (latestState) {
            nextRenderer.render(latestState);
          }
          return nextRenderer;
        })
        .catch((error) => {
          rendererPromise = null;
          if (!disposed) {
            console.error("Bubble Kingdom renderer failed to load.", error);
          }
          return null;
        });
    }

    return rendererPromise;
  };

  const unsubscribe = session.subscribe((state) => {
    latestState = state;
    const gameplayVisible = isGameplayScreen(state.currentScreen);

    if (renderer) {
      renderer.render(state);
    } else if (gameplayVisible) {
      void ensureRenderer().then((loadedRenderer) => {
        if (loadedRenderer) {
          loadedRenderer.render(state);
        }
      });
    } else if (state.bootStatus === "ready" && !warmupScheduled) {
      warmupScheduled = true;
      window.setTimeout(() => {
        if (!disposed) {
          void ensureRenderer();
        }
      }, 350);
    }

    canvasHost.classList.toggle("is-hidden", !gameplayVisible);
    renderUi(uiLayer, state, debugEnabled);
  });

  uiLayer.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!target) {
      return;
    }

    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action) {
      return;
    }

    if (action === "open-screen" && isScreenId(id)) {
      void session.openScreen(id);
    } else if (action === "start-current-level") {
      void session.openLevelPreview(session.getState().save.progression.currentLevelId);
    } else if (action === "start-level" && id) {
      void session.openLevelPreview(Number(id));
    } else if (action === "confirm-start-level") {
      void session.confirmLevelStart();
    } else if (action === "close-level-preview") {
      void session.closeLevelPreview();
    } else if (action === "toggle-prelevel-booster" && id) {
      session.togglePreLevelBooster(id as never);
    } else if (action === "claim-daily") {
      void session.claimDailyReward();
    } else if (action === "claim-quest" && id) {
      void session.claimQuest(id);
    } else if (action === "claim-inbox" && id) {
      void session.claimInboxItem(id);
    } else if (action === "purchase-offer" && id) {
      void session.purchaseOffer(id);
    } else if (action === "restore-node" && id) {
      void session.restoreArea(id);
    } else if (action === "claim-chapter-chest" && id) {
      void session.claimChapterChest(id);
    } else if (action === "claim-event-reward" && id) {
      void session.claimEventReward(id);
    } else if (action === "dismiss-reward-reveal") {
      void session.dismissRewardReveal();
    } else if (action === "reward-reveal-primary") {
      void triggerRewardRevealPrimaryAction(session);
    } else if (action === "continue-rewarded") {
      void session.continueWithRewarded();
    } else if (action === "continue-gems") {
      void session.continueWithGems();
    } else if (action === "claim-win-bonus") {
      void session.claimWinBonusRewarded();
    } else if (action === "restart-level") {
      void session.restartLevel();
    } else if (action === "acknowledge-level") {
      void session.acknowledgeLevelResult();
    } else if (action === "submit-leaderboard") {
      void session.submitLeaderboard();
    } else if (action === "auth") {
      void session.requestAuth("cross_device_save");
    } else if (action === "use-booster" && id) {
      void session.useBooster(id as never);
    } else if (action === "set-language" && id) {
      void session.setLanguage(id as "ru" | "en");
    } else if (action === "toggle-setting" && id) {
      const currentState = session.getState();
      const key = id as keyof GameSessionState["save"]["settings"];
      const value = currentState.save.settings[key];
      if (typeof value === "boolean") {
        void session.setSetting(key, !value);
      }
    }
  });

  return () => {
    disposed = true;
    unsubscribe();
    renderer?.destroy();
  };
}

function createDebugHarness(session: GameSession): BubbleKingdomDebugHarness {
  return {
    getState() {
      return session.getState();
    },
    openLevelPreview(levelId) {
      return session.openLevelPreview(levelId);
    },
    confirmLevelStart() {
      return session.confirmLevelStart();
    },
    startLevel(levelId) {
      return session.startLevel(levelId);
    },
    async forceWin(levelId = 1) {
      await session.startLevel(levelId);
      const active = session.getState().activeLevel;
      if (!active) {
        throw new Error("Expected an active level for debug win flow.");
      }

      active.level.objective = { type: "clear_all" };
      active.board = createBoardState(debugWinLevel);
      await session.fireShot(-1.57);
    },
    async forceFail(levelId = 2) {
      await session.startLevel(levelId);
      const active = session.getState().activeLevel;
      if (!active) {
        throw new Error("Expected an active level for debug fail flow.");
      }

      active.level.objective = { type: "collect_crystals", target: 1 };
      active.board.movesRemaining = 1;
      active.board.cells = Array.from({ length: active.board.rows }, () =>
        Array.from({ length: active.board.cols }, () => null),
      );
      active.board.objectiveProgress = {};
      active.board.queue = [active.level.palette[0] ?? "ruby"];
      await session.fireShot(-1.1);
    },
    continueWithRewarded() {
      return session.continueWithRewarded();
    },
    continueWithGems() {
      return session.continueWithGems();
    },
    claimWinBonusRewarded() {
      return session.claimWinBonusRewarded();
    },
    acknowledgeLevelResult() {
      return session.acknowledgeLevelResult();
    },
  };
}

interface RendererHandle {
  render(state: GameSessionState): void;
  destroy(): void;
}

function renderUi(root: HTMLElement, state: GameSessionState, debugEnabled: boolean) {
  const t = (key: string) => translate(state.locale, key);
  const currentChapter =
    chapters.find((chapter) => chapter.levels.includes(state.save.progression.currentLevelId)) ??
    chapters[0]!;
  const activeEvent = resolveActiveEvent(state);
  const allowEventGoals =
    state.save.tutorial.completed || state.save.progression.completedLevels.length >= 2;
  const surfaceAlerts = summarizeSessionSurfaceAlerts({
    save: state.save,
    chapters,
    quests: questDefinitions,
    dailyRewardAvailable: state.dailyRewardAvailable,
    event: activeEvent,
  });
  const sessionGoal = deriveSessionGoal({
    save: state.save,
    chapters,
    quests: questDefinitions,
    dailyRewardAvailable: state.dailyRewardAvailable,
    event: activeEvent,
    allowEventGoals,
  });

  root.innerHTML = `
    ${renderTopBar(state, t)}
    ${
      state.currentScreen === "level" ||
      state.currentScreen === "win" ||
      state.currentScreen === "fail"
        ? renderLevelHud(state, t)
        : renderMainLayout(
            state,
            currentChapter,
            activeEvent,
            surfaceAlerts,
            sessionGoal,
            t,
          )
    }
    ${renderBottomNav(state, surfaceAlerts, t)}
    ${renderOverlay(state, currentChapter, sessionGoal, t)}
    ${debugEnabled ? renderDebug(state) : ""}
  `;
}

function renderTopBar(state: GameSessionState, t: (key: string) => string) {
  return `
    <div class="top-bar">
      <div class="brand-card">
        <div class="brand-title">${t("ui.title")}</div>
        <div class="brand-subtitle">${t("ui.tagline")}</div>
      </div>
      <div class="currency-strip">
        ${currencyPill(t("currency.gold"), state.save.currencies.gold)}
        ${currencyPill(t("currency.petals"), state.save.currencies.petals)}
        ${currencyPill(t("currency.gems"), state.save.currencies.gems)}
        ${currencyPill(t("currency.seasonalTokens"), state.save.currencies.seasonalTokens)}
      </div>
    </div>
  `;
}

function renderMainLayout(
  state: GameSessionState,
  chapter: (typeof chapters)[number],
  activeEvent: (typeof liveEvents)[number] | null,
  surfaceAlerts: ReturnType<typeof summarizeSessionSurfaceAlerts>,
  sessionGoal: ReturnType<typeof deriveSessionGoal>,
  t: (key: string) => string,
) {
  const piggyBank = getPiggyBankPresentation(state.save, state.remoteConfig, state.shopOffers);
  const shouldShowPiggyPanel = piggyBank && piggyBank.storedGold > 0;
  const currentLevel =
    levels.find((level) => level.id === state.save.progression.currentLevelId) ?? levels[0]!;
  const chestChapter = sessionGoal.kind === "chapter_chest" ? sessionGoal.chapter : chapter;
  const showMapGuidance = state.currentScreen === "map";
  const hasSpotlight = showMapGuidance && Boolean(state.mapSpotlight);
  const tutorialCard = showMapGuidance ? renderTutorialCoachCard(state, t) : "";
  return `
    <div class="main-layout">
      <div class="hero-stack">
        <section class="panel hero-panel">
          <span class="tag">${t(chapter.titleKey)}</span>
          <h2>${t(chapter.descriptionKey)}</h2>
          <div class="hero-grid">
            <div class="metric-card"><div class="small">${t("ui.currentLevel")}</div><strong>${state.save.progression.currentLevelId}</strong></div>
            <div class="metric-card"><div class="small">${t("ui.stars")}</div><strong>${totalStars(state.save)}</strong></div>
            <div class="metric-card"><div class="small">${t("ui.lives")}</div><strong>${state.save.progression.lives}</strong></div>
            <div class="metric-card metric-card-wide"><div class="small">${t("ui.event")}</div><strong>${activeEvent ? t(activeEvent.titleKey) : "-"}</strong></div>
          </div>
          ${showMapGuidance && !hasSpotlight ? renderCurrentGoalCard(sessionGoal, state, t) : ""}
          ${showMapGuidance ? renderMapSpotlightCard(state, t) : ""}
          ${showMapGuidance ? renderActionDigest(surfaceAlerts, state, t) : ""}
          ${tutorialCard}
          <div class="cta-row ${hasSpotlight ? "cta-row-support" : ""}">
            ${
              hasSpotlight
                ? ""
                : `<button class="primary-btn" data-action="start-current-level">${t("map.play")} ${state.save.progression.currentLevelId}</button>`
            }
            <button class="secondary-btn" data-action="open-screen" data-id="dailyRewards">${t("screen.rewards")}</button>
            <button class="ghost-btn" data-action="open-screen" data-id="settings">${t("screen.settings")}</button>
            <button class="ghost-btn" data-action="auth">Yandex ID</button>
          </div>
          ${
            state.notifications.length > 0
              ? `<div class="hero-grid">${state.notifications.map((notice) => `<div class="notice">${notice}</div>`).join("")}</div>`
              : ""
          }
        </section>
        <section class="panel">
          <div class="panel-actions">
            <span class="tag">${t("screen.map")}</span>
            <span class="tag">${chapter.zoneTheme}</span>
          </div>
          <div class="level-track">
            ${chapter.levels.slice(0, 12).map((levelId) => renderLevelNode(levelId, state)).join("")}
          </div>
        </section>
      </div>
      <div class="side-stack">
        ${shouldShowPiggyPanel ? renderPiggyBankPanel(piggyBank, t) : ""}
        <section class="panel">
          ${renderChapterChestCard(chestChapter, state, t)}
        </section>
        <section class="panel">
          ${renderCurrentLevelPreview(state, currentLevel, t)}
        </section>
        ${activeEvent ? renderEventSummaryCard(state, activeEvent, t) : ""}
        <section class="panel">
          ${
            isSpotlightAction(state, "restore-node") ||
            isSpotlightAction(state, "open-screen", "restoration")
              ? `<div class="panel-actions"><span class="tag">${t("screen.restore")}</span><span class="small spotlight-helper">${t("ui.featuredAbove")}</span></div>`
              : `<div class="panel-actions"><span class="tag">${t("screen.restore")}</span><button class="ghost-btn" data-action="open-screen" data-id="restoration">${t("map.restore")}</button></div>`
          }
          <div class="restoration-grid">
              ${chapter.restorationNodes
                .map((node) => {
                  const restored = state.save.progression.restoredNodes.includes(node.id);
                  const affordable = canRestoreNode(state.save, node);
                  const spotlightingNode = isSpotlightAction(state, "restore-node", node.id);
                  const cta = restored
                    ? `<button class="ghost-btn" data-action="restore-node" data-id="${node.id}" disabled>${t("ui.restored")}</button>`
                    : spotlightingNode
                      ? `<div class="small spotlight-helper">${t("ui.featuredAbove")}</div>`
                      : `<button class="${affordable ? "secondary-btn" : "ghost-btn"}" data-action="restore-node" data-id="${node.id}" ${affordable ? "" : "disabled"}>${t("map.restore")}</button>`;
                  return `<div class="restoration-card ${spotlightingNode ? "is-spotlight-target" : ""}"><strong>${t(node.titleKey)}</strong><div class="small">${t(node.descriptionKey)}</div><div class="small">&#9733; ${node.starCost} &middot; Gold ${node.goldCost} &middot; Petals ${node.petalsCost}</div>${!restored && !affordable ? `<div class="small">${formatRestoreNodeShortfall(state.save, node, t)}</div>` : ""}${cta}</div>`;
                })
                .join("")}
            </div>
          </section>
      </div>
    </div>
  `;
}

function renderLevelNode(levelId: number, state: GameSessionState) {
  const completed = state.save.progression.completedLevels.includes(levelId);
  const current = state.save.progression.currentLevelId === levelId;
  const stars = state.save.progression.starsByLevel[String(levelId)] ?? 0;
  return `<button class="level-node ${completed ? "completed" : ""} ${current ? "current" : ""}" data-action="start-level" data-id="${levelId}"><strong>${levelId}</strong><span class="small">${"&#9733;".repeat(stars)}</span></button>`;
}

function renderLevelHud(state: GameSessionState, t: (key: string) => string) {
  const level = state.activeLevel?.level;
  const board = state.activeLevel?.board;
  const precisionAimActive = state.activeLevel?.precisionAimActive ?? false;
  if (!level || !board) {
    return "";
  }

  const tutorialCard = renderTutorialCoachCard(state, t, true);
  return `
    <div class="level-hud">
      <div class="hud-row">
        <div class="pill">${t("level.goal")}: ${t(`objective.${level.objective.type}`)}${level.objective.target ? ` ${board.objectiveProgress[level.objective.type] ?? 0}/${level.objective.target}` : ""}</div>
        <div class="pill">${t("level.moves")}: ${board.movesRemaining}</div>
        ${precisionAimActive ? `<div class="pill">${t("preLevel.precisionActive")}</div>` : ""}
        <button class="icon-btn" data-action="open-screen" data-id="settings">${t("level.pause")}</button>
      </div>
      ${tutorialCard}
      <div class="booster-row">
        ${renderBoosterButton("extraMoves", t("booster.extraMoves"), state)}
        ${renderBoosterButton("rainbowOrb", t("booster.rainbowOrb"), state)}
        ${renderBoosterButton("bombOrb", t("booster.bombOrb"), state)}
        ${renderBoosterButton("precisionAim", t("booster.precisionAim"), state)}
        ${renderBoosterButton("undoShot", t("booster.undoShot"), state)}
      </div>
    </div>
  `;
}

function renderBoosterButton(id: string, label: string, state: GameSessionState) {
  return `<button class="booster-btn" data-action="use-booster" data-id="${id}"><strong>${label}</strong><div class="small">${state.save.boosters[id as keyof typeof state.save.boosters]}</div></button>`;
}

function renderCurrentGoalCard(
  goal: ReturnType<typeof deriveSessionGoal>,
  state: GameSessionState,
  t: (key: string) => string,
) {
  let title = t("goal.level.title");
  let body = `${t("goal.level.body")} ${state.save.progression.currentLevelId}`;
  let action = "start-current-level";
  let actionId = "";
  let cta = `${t("map.play")} ${state.save.progression.currentLevelId}`;
  let accent = "";

  if (goal.kind === "inbox") {
    title = t("goal.inbox.title");
    body = goal.item.labelKey ? t(goal.item.labelKey) : t("goal.inbox.body");
    action = "claim-inbox";
    actionId = goal.item.id;
    cta = t("inbox.claim");
    accent = `<span class="tag tag-accent">${t("ui.pending")}</span>`;
  } else if (goal.kind === "daily_reward") {
    title = t("goal.daily.title");
    body = `${t("goal.daily.body")} ${goal.nextDay}/7`;
    action = "claim-daily";
    cta = t("reward.claim");
  } else if (goal.kind === "chapter_chest") {
    title = t("goal.chapterChest.title");
    body = `${t(goal.chapter.chapterChest.labelKey ?? "reward.chapterChest")} &middot; ${goal.starsEarned}/${goal.starsRequired}`;
    action = "claim-chapter-chest";
    actionId = goal.chapter.id;
    cta = t("chapterChest.claim");
    accent = `<span class="tag tag-accent">${t("ui.pending")}</span>`;
  } else if (goal.kind === "event_reward") {
    title = t("goal.event.title");
    body = `${t(goal.milestone.titleKey)} &middot; ${goal.tokenBalance} ${t("currency.seasonalTokens")}`;
    action = "claim-event-reward";
    actionId = goal.milestone.id;
    cta = t("event.claim");
    accent = `<span class="tag tag-accent">${t("ui.pending")}</span>`;
  } else if (goal.kind === "quest") {
    title = t("goal.quest.title");
    body = `${t(goal.quest.titleKey)} &middot; ${goal.progress}/${goal.quest.target}`;
    action = "claim-quest";
    actionId = goal.quest.id;
    cta = t("quest.claim");
  } else if (goal.kind === "restore") {
    title = goal.affordable ? t("goal.restoreReady.title") : t("goal.restoreNext.title");
    body = goal.affordable
      ? `${t(goal.node.titleKey)} &middot; ${t("goal.restoreReady.body")}`
      : `${t(goal.node.titleKey)} &middot; ${formatResourceShortfall(goal, t)}`;
    action = goal.affordable ? "restore-node" : "open-screen";
    actionId = goal.affordable ? goal.node.id : "restoration";
    cta = goal.affordable ? t("map.restore") : t("screen.restore");
  }

  return `<div class="goal-card"><div class="panel-actions"><span class="tag">${t("ui.currentGoal")}</span>${accent}</div><strong>${title}</strong><div class="small">${body}</div><div class="cta-row"><button class="primary-btn" data-action="${action}" ${actionId ? `data-id="${actionId}"` : ""}>${cta}</button></div></div>`;
}

function renderActionDigest(
  surfaceAlerts: ReturnType<typeof summarizeSessionSurfaceAlerts>,
  state: GameSessionState,
  t: (key: string) => string,
) {
  const items: string[] = [];
  const spotlightAction = state.mapSpotlight?.action.action;
  const spotlightTarget = state.mapSpotlight?.action.id;
  const suppressChapterChest = spotlightAction === "claim-chapter-chest";
  const suppressQuest = spotlightAction === "claim-quest";
  const suppressEvent =
    spotlightAction === "claim-event-reward" ||
    (spotlightAction === "open-screen" && spotlightTarget === "event");

  if (surfaceAlerts.dailyRewardAvailable) {
    items.push(
      `<div class="notice-chip is-accent">${t("screen.rewards")}: ${t("ui.pending")}</div>`,
    );
  }

  if (surfaceAlerts.claimableChapterChestCount > 0 && !suppressChapterChest) {
    items.push(
      `<div class="notice-chip is-strong">${t("chapterChest.title")}: ${surfaceAlerts.claimableChapterChestCount}</div>`,
    );
  }

  if (surfaceAlerts.claimableEventMilestoneCount > 0 && !suppressEvent) {
    items.push(
      `<div class="notice-chip">${t("screen.event")}: ${surfaceAlerts.claimableEventMilestoneCount}</div>`,
    );
  }

  if (surfaceAlerts.claimableQuestCount > 0 && !suppressQuest) {
    items.push(
      `<div class="notice-chip">${t("screen.quests")}: ${surfaceAlerts.claimableQuestCount}</div>`,
    );
  }

  if (surfaceAlerts.pendingInboxCount > 0) {
    items.push(
      `<div class="notice-chip">${t("screen.inbox")}: ${surfaceAlerts.pendingInboxCount}</div>`,
    );
  }

  if (items.length === 0) {
    return "";
  }

  return `<div class="notice-chip-row">${items.join("")}</div>`;
}

function renderMapSpotlightCard(state: GameSessionState, t: (key: string) => string) {
  if (!state.mapSpotlight) {
    return "";
  }

  const actionId = state.mapSpotlight.action.id
    ? ` data-id="${state.mapSpotlight.action.id}"`
    : "";

  return `<div class="goal-card spotlight-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t(state.mapSpotlight.tagKey)}</span></div><strong>${t(state.mapSpotlight.titleKey)}</strong><div class="small">${t(state.mapSpotlight.bodyKey)}</div><div class="cta-row"><button class="secondary-btn" data-action="${state.mapSpotlight.action.action}"${actionId}>${t(state.mapSpotlight.action.labelKey)}</button></div></div>`;
}

function getRecommendedQuestId(
  state: GameSessionState,
  sessionGoal: ReturnType<typeof deriveSessionGoal>,
) {
  if (state.mapSpotlight?.action.action === "claim-quest") {
    return state.mapSpotlight.action.id ?? null;
  }

  return sessionGoal.kind === "quest" ? sessionGoal.quest.id : null;
}

function getRecommendedInboxId(sessionGoal: ReturnType<typeof deriveSessionGoal>) {
  return sessionGoal.kind === "inbox" ? sessionGoal.item.id : null;
}

function getRecommendedRestorationNodeId(
  state: GameSessionState,
  sessionGoal: ReturnType<typeof deriveSessionGoal>,
) {
  if (state.mapSpotlight?.action.action === "restore-node") {
    return state.mapSpotlight.action.id ?? null;
  }

  return sessionGoal.kind === "restore" ? sessionGoal.node.id : null;
}

function getRecommendedEventMilestoneId(
  state: GameSessionState,
  sessionGoal: ReturnType<typeof deriveSessionGoal>,
) {
  if (state.mapSpotlight?.action.action === "claim-event-reward") {
    return state.mapSpotlight.action.id ?? null;
  }

  return sessionGoal.kind === "event_reward" ? sessionGoal.milestone.id : null;
}

function orderRecommendedFirst<T extends { id: string }>(items: T[], recommendedId: string | null) {
  if (!recommendedId) {
    return items;
  }

  return [...items].sort((left, right) => {
    if (left.id === recommendedId) {
      return -1;
    }
    if (right.id === recommendedId) {
      return 1;
    }
    return 0;
  });
}

function isSpotlightAction(
  state: GameSessionState,
  action:
    | "open-screen"
    | "start-current-level"
    | "restore-node"
    | "claim-event-reward"
    | "claim-chapter-chest"
    | "claim-quest",
  id?: string,
) {
  const spotlight = state.mapSpotlight?.action;
  if (!spotlight || spotlight.action !== action) {
    return false;
  }

  if (!id) {
    return true;
  }

  return spotlight.id === id;
}

function renderTutorialCoachCard(
  state: GameSessionState,
  t: (key: string) => string,
  compact = false,
) {
  const step = state.tutorialStep;
  if (!step) {
    return "";
  }

  const titleKey = `tutorial.${step}.title`;
  const bodyKey = `tutorial.${step}.body`;
  return `<div class="coach-card ${compact ? "coach-card-compact" : ""}"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span></div><strong>${t(titleKey)}</strong><div class="small">${t(bodyKey)}</div></div>`;
}

function renderRemainingObjective(state: GameSessionState, t: (key: string) => string) {
  const level = state.activeLevel?.level;
  const board = state.activeLevel?.board;
  if (!level || !board) {
    return "";
  }

  const target = level.objective.target;
  const progress = board.objectiveProgress[level.objective.type] ?? 0;
  if (typeof target === "number") {
    return `<div class="objective-remaining"><strong>${t("ui.objectiveLeft")}</strong><div class="small">${t(`objective.${level.objective.type}`)} ${progress}/${target}</div></div>`;
  }

  return `<div class="objective-remaining"><strong>${t("ui.objectiveLeft")}</strong><div class="small">${t(`objective.${level.objective.type}`)}</div></div>`;
}

function renderInboxCard(
  item: GameSessionState["save"]["inbox"][number],
  recommended: boolean,
  isFocusedAbove: boolean,
  t: (key: string) => string,
) {
  const summary = formatRewardSummary(item, t);
  const cta = isFocusedAbove
    ? `<div class="small spotlight-helper">${t("ui.featuredAbove")}</div>`
    : `<button class="${item.claimed ? "ghost-btn" : "primary-btn"}" data-action="claim-inbox" data-id="${item.id}" ${item.claimed ? "disabled" : ""}>${item.claimed ? t("ui.claimed") : t("inbox.claim")}</button>`;
  return `<div class="offer-card inbox-card ${recommended ? "is-highlighted" : ""}"><div class="panel-actions"><strong>${item.labelKey ? t(item.labelKey) : t("goal.inbox.body")}</strong><span class="tag">${t("inbox.reward")}</span>${recommended ? `<span class="tag tag-accent">${t("ui.recommended")}</span>` : ""}</div><div class="small">${summary || t("goal.inbox.body")}</div><div class="panel-actions"><span class="small">${new Date(item.createdAt).toLocaleDateString()}</span>${cta}</div></div>`;
}

function renderInboxOverlayFocusCard(
  state: GameSessionState,
  recommendedInboxId: string | null,
  t: (key: string) => string,
) {
  if (recommendedInboxId) {
    const item = state.save.inbox.find((entry) => entry.id === recommendedInboxId);
    if (!item) {
      return renderOverlayMapReturnCard(state, t);
    }

    const summary = formatRewardSummary(item, t);
    return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t("inbox.reward")}</span><span class="tag tag-accent">${t("ui.recommended")}</span></div><strong>${item.labelKey ? t(item.labelKey) : t("goal.inbox.title")}</strong><div class="small">${summary || t("goal.inbox.body")}</div><div class="cta-row"><button class="${item.claimed ? "ghost-btn" : "primary-btn"}" data-action="${item.claimed ? "open-screen" : "claim-inbox"}" data-id="${item.claimed ? "map" : item.id}">${item.claimed ? t("screen.map") : t("inbox.claim")}</button></div></div>`;
  }

  return renderOverlayMapReturnCard(state, t);
}

function renderQuestOverlayFocusCard(
  state: GameSessionState,
  recommendedQuestId: string | null,
  t: (key: string) => string,
) {
  if (recommendedQuestId) {
    const quest = questDefinitions.find((item) => item.id === recommendedQuestId);
    if (!quest) {
      return renderOverlayMapReturnCard(state, t);
    }

    const progress = state.save.quests[quest.id]?.progress ?? 0;
    return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t(quest.cadence === "daily" ? "quest.daily" : "quest.weekly")}</span><span class="tag tag-accent">${t("ui.recommended")}</span></div><strong>${t(quest.titleKey)}</strong><div class="small">${t(quest.descriptionKey)}</div><div class="small">${progress}/${quest.target}</div><div class="small">${formatRewardSummary(quest.rewards, t)}</div><div class="cta-row"><button class="primary-btn" data-action="claim-quest" data-id="${quest.id}">${t("quest.claim")}</button></div></div>`;
  }

  return renderOverlayMapReturnCard(state, t);
}

function renderEventOverlayFocusCard(
  state: GameSessionState,
  event: (typeof liveEvents)[number],
  recommendedMilestoneId: string | null,
  t: (key: string) => string,
) {
  if (recommendedMilestoneId) {
    const milestone = event.rewardTrack.find((item) => item.id === recommendedMilestoneId);
    if (!milestone) {
      return renderOverlayMapReturnCard(state, t);
    }

    const progress = getEventProgressSummary(state.save, event);
    return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${milestone.tokenCost} ${t("currency.seasonalTokens")}</span><span class="tag tag-accent">${t("ui.recommended")}</span></div><strong>${t(milestone.titleKey)}</strong><div class="small">${t(milestone.descriptionKey)}</div><div class="small">${t("event.claimReady")} ${t(milestone.titleKey)}</div><div class="small">${formatRewardSummary(milestone.rewards, t)}</div><div class="small">${progress.tokens}/${milestone.tokenCost} ${t("currency.seasonalTokens")}</div><div class="cta-row"><button class="primary-btn" data-action="claim-event-reward" data-id="${milestone.id}">${t("event.claim")}</button></div></div>`;
  }

  return renderOverlayMapReturnCard(state, t);
}

function renderRestorationOverlayFocusCard(
  state: GameSessionState,
  chapter: (typeof chapters)[number],
  recommendedNodeId: string | null,
  t: (key: string) => string,
) {
  if (recommendedNodeId) {
    const node = chapter.restorationNodes.find((entry) => entry.id === recommendedNodeId);
    if (!node) {
      return renderOverlayMapReturnCard(state, t);
    }

    const restored = state.save.progression.restoredNodes.includes(node.id);
    const affordable = canRestoreNode(state.save, node);
    const cta = restored
      ? `<button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button>`
      : affordable
        ? `<button class="primary-btn" data-action="restore-node" data-id="${node.id}">${t("map.restore")}</button>`
        : `<button class="secondary-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button>`;
    return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t("screen.restore")}</span><span class="tag tag-accent">${t("ui.recommended")}</span></div><strong>${t(node.titleKey)}</strong><div class="small">${t(node.descriptionKey)}</div><div class="small">&#9733; ${node.starCost} &middot; Gold ${node.goldCost} &middot; Petals ${node.petalsCost}</div>${!restored && !affordable ? `<div class="small">${formatRestoreNodeShortfall(state.save, node, t)}</div>` : ""}<div class="cta-row">${cta}</div></div>`;
  }

  return renderOverlayMapReturnCard(state, t);
}

function renderOverlayMapReturnCard(
  state: GameSessionState,
  t: (key: string) => string,
) {
  if (!state.mapSpotlight) {
    return "";
  }

  return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t(state.mapSpotlight.tagKey)}</span></div><strong>${t(state.mapSpotlight.titleKey)}</strong><div class="small">${t(state.mapSpotlight.bodyKey)}</div><div class="cta-row"><button class="secondary-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div></div>`;
}

function renderChapterChestCard(
  chapter: (typeof chapters)[number],
  state: GameSessionState,
  t: (key: string) => string,
) {
  const stars = chapterStarsEarned(state.save, chapter);
  const claimable =
    stars >= chapter.chapterChestStarsRequired &&
    !state.save.progression.chapterChestsClaimed.includes(chapter.id);
  const claimed = state.save.progression.chapterChestsClaimed.includes(chapter.id);
  const starsLeft = Math.max(0, chapter.chapterChestStarsRequired - stars);
  const rewards = formatRewardSummary(chapter.chapterChest, t);
  const statusCopy = claimed
    ? t("chapterChest.claimed")
    : claimable
      ? t("chapterChest.ready")
      : `${t("chapterChest.locked")} ${starsLeft}`;
  const spotlightingChest = isSpotlightAction(state, "claim-chapter-chest", chapter.id);
  const cta = spotlightingChest
    ? `<div class="small spotlight-helper">${t("ui.featuredAbove")}</div>`
    : `<div class="cta-row"><button class="${claimable ? "primary-btn" : "ghost-btn"}" data-action="claim-chapter-chest" data-id="${chapter.id}" ${!claimable || claimed ? "disabled" : ""}>${claimed ? t("chapterChest.claimed") : claimable ? t("chapterChest.claim") : t("chapterChest.locked")}</button></div>`;
  return `<div class="chapter-chest-card ${claimable && !spotlightingChest ? "is-highlighted" : ""}"><div class="panel-actions"><span class="tag">${t("chapterChest.title")}</span><span class="tag">${stars}/${chapter.chapterChestStarsRequired}</span></div><strong>${t(chapter.chapterChest.labelKey ?? "reward.chapterChest")}</strong><div class="small">${t("chapterChest.body")}</div><div class="progress-track"><div class="progress-fill" style="width: ${Math.min(100, Math.round((stars / chapter.chapterChestStarsRequired) * 100))}%"></div></div><div class="small">${statusCopy}</div><div class="small">${rewards}</div>${cta}</div>`;
}

function renderEventSummaryCard(
  state: GameSessionState,
  event: (typeof liveEvents)[number],
  t: (key: string) => string,
) {
  const progress = getEventProgressSummary(state.save, event);
  const claimableMilestone = progress.claimableMilestones[0] ?? null;
  const nextMilestone = claimableMilestone ?? progress.nextMilestone;
  const nextRewardSummary = nextMilestone ? formatRewardSummary(nextMilestone.rewards, t) : "";
  const progressLabel = nextMilestone
    ? `${progress.tokens}/${nextMilestone.tokenCost} ${t("currency.seasonalTokens")}`
    : t("event.complete");
  const ctaAction = claimableMilestone ? "claim-event-reward" : "open-screen";
  const ctaId = claimableMilestone ? claimableMilestone.id : "event";
  const ctaLabel = claimableMilestone ? t("event.claim") : t("event.viewTrack");
  const yieldingToSpotlight = Boolean(state.mapSpotlight);
  const cta = yieldingToSpotlight
    ? `<div class="small spotlight-helper">${t("ui.featuredAbove")}</div>`
    : `<div class="cta-row"><button class="${claimableMilestone ? "primary-btn" : "secondary-btn"}" data-action="${ctaAction}" data-id="${ctaId}">${ctaLabel}</button></div>`;

  return `<section class="panel event-summary-panel ${claimableMilestone && !yieldingToSpotlight ? "is-highlighted" : ""}"><div class="panel-actions"><span class="tag">${t("screen.event")}</span>${claimableMilestone ? `<span class="tag tag-accent">${t("ui.pending")}</span>` : ""}</div><strong>${t(event.titleKey)}</strong><div class="small">${t(event.subtitleKey)}</div><div class="metric-card"><div class="small">${t("event.progress")}</div><strong>${progressLabel}</strong></div><div class="progress-track"><div class="progress-fill" style="width: ${progress.progressPercent}%"></div></div>${nextMilestone ? `<div class="small"><strong>${claimableMilestone ? t("event.claimReady") : t("event.nextReward")}</strong> ${t(nextMilestone.titleKey)}</div><div class="small">${nextRewardSummary}</div>` : `<div class="small">${t("event.complete")}</div>`}${cta}</section>`;
}

function renderCurrentLevelPreview(
  state: GameSessionState,
  level: (typeof levels)[number],
  t: (key: string) => string,
) {
  const yieldingToSpotlight = Boolean(state.mapSpotlight);
  const cta = yieldingToSpotlight
    ? `<div class="small spotlight-helper">${t("ui.featuredAbove")}</div>`
    : `<div class="cta-row"><button class="secondary-btn" data-action="start-current-level">${t("map.play")} ${level.id}</button></div>`;
  return `<div class="level-preview-card"><div class="panel-actions"><span class="tag">${t("level.previewTitle")}</span><span class="tag">${t(`difficulty.${level.difficulty}`)}</span></div><strong>${t("map.play")} ${level.id}</strong><div class="small">${t("level.goal")}: ${t(`objective.${level.objective.type}`)}${level.objective.target ? ` ${level.objective.target}` : ""}</div><div class="small">${t("level.moves")}: ${level.moves}</div><div class="small">${formatRewardSummary(level.rewards, t)}</div>${cta}</div>`;
}

function renderBottomNav(
  state: GameSessionState,
  surfaceAlerts: ReturnType<typeof summarizeSessionSurfaceAlerts>,
  t: (key: string) => string,
) {
  const activeScreen = state.currentScreen === "preLevel" ? "map" : state.currentScreen;
  const tabs: Array<{ id: ScreenId; labelKey: string }> = [
    { id: "map", labelKey: "screen.map" },
    { id: "shop", labelKey: "screen.shop" },
    { id: "quests", labelKey: "screen.quests" },
    { id: "event", labelKey: "screen.event" },
    { id: "leaderboards", labelKey: "screen.leaderboards" },
    { id: "inbox", labelKey: "screen.inbox" },
  ];
  return `<div class="bottom-nav">${tabs
    .map((tab) => {
      const badgeCount =
        tab.id === "quests"
          ? surfaceAlerts.claimableQuestCount
          : tab.id === "event"
            ? surfaceAlerts.claimableEventMilestoneCount
            : tab.id === "inbox"
              ? surfaceAlerts.pendingInboxCount
              : 0;
      return `<button class="nav-btn ${activeScreen === tab.id ? "is-active" : ""}" data-action="open-screen" data-id="${tab.id}">${t(tab.labelKey)}${badgeCount > 0 ? renderCountBadge(badgeCount) : ""}</button>`;
    })
    .join("")}</div>`;
}

function renderOverlay(
  state: GameSessionState,
  chapter: (typeof chapters)[number],
  sessionGoal: ReturnType<typeof deriveSessionGoal>,
  t: (key: string) => string,
) {
  if (state.rewardReveal) {
    return renderRewardRevealModal(state, t);
  }

  if (state.currentScreen === "map" || state.currentScreen === "level") {
    return "";
  }

  if (state.currentScreen === "win" || state.currentScreen === "fail") {
    const win = state.currentScreen === "win";
    const board = state.activeLevel?.board;
    if (win) {
      const hasWinBonusOffer = Boolean(state.activeLevel && !state.activeLevel.winBonusClaimed);
      return `<div class="overlay-modal"><div class="panel modal-card fail-modal"><div class="panel-actions"><span class="tag">${t("level.win")}</span><span class="tag">${t("ui.score")} ${board?.score ?? 0}</span></div><h2>${t("level.winFlavor")}</h2>${renderWinOverlayFocusCard(state, t)}${renderWinRewardSummary(state, t)}<div class="cta-row"><button class="${hasWinBonusOffer ? "secondary-btn" : "primary-btn"}" data-action="acknowledge-level">${t("map.continue")}</button><button class="ghost-btn" data-action="acknowledge-level">${t("screen.map")}</button></div></div></div>`;
    }

    const failDecisionBase =
      state.activeLevel
        ? decideFailOffer({
            save: state.save,
            remoteConfig: state.remoteConfig,
            shopOffers: state.shopOffers,
            continueOffersUsed: state.activeLevel.continueOffersUsed,
          })
        : null;
    const failDecision =
      state.failRecoveryHint === "gems_continue" && failDecisionBase?.hasEnoughGems
        ? {
            ...failDecisionBase,
            primaryAction: "gems_continue" as const,
            headlineKey: "fail.offer.gems.readyTag" as const,
            bodyKey: "fail.offer.gems.readyBody" as const,
          }
        : failDecisionBase;
    const gemContinueCost =
      failDecision?.gemCost ??
      (state.activeLevel
        ? calculateExtraMovesGemCost(
            state.activeLevel.continueOffersUsed,
            state.remoteConfig,
          )
        : 0);
    const showPiggyUpsell = Boolean(
      failDecision?.piggyBank?.isNudged && failDecision.primaryAction !== "piggy_bank",
    );
    const failRescueGemOffer =
      failDecision &&
      !failDecision.hasEnoughGems &&
      failDecision.primaryAction !== "piggy_bank" &&
      !showPiggyUpsell
        ? planFailRescueGemOffer({
            save: state.save,
            gemContinueCost,
            shopOffers: state.shopOffers,
          })
        : null;
    const recoveryReadySecondaryActions =
      state.failRecoveryHint === "gems_continue" && failDecision?.primaryAction === "gems_continue";
    const rewardedSecondaryButtonClass = recoveryReadySecondaryActions
      ? "ghost-btn"
      : resolveFailButtonClass(failDecision?.primaryAction, "rewarded_continue");
    const alternativeActions = [
      failDecision?.primaryAction === "rewarded_continue"
        ? ""
        : `<button class="${rewardedSecondaryButtonClass}" data-action="continue-rewarded">${t("reward.watchAdContinue")}</button>`,
      failDecision?.primaryAction === "gems_continue"
        ? ""
        : `<button class="${resolveFailButtonClass(failDecision?.primaryAction, "gems_continue")}" data-action="continue-gems" ${failDecision && !failDecision.hasEnoughGems ? "disabled" : ""}>${t("level.continueWithGems")} ${gemContinueCost} ${t("currency.gems")}</button>`,
    ]
      .filter(Boolean)
      .join("");
    const alternativeActionNote =
      recoveryReadySecondaryActions && alternativeActions
        ? `<div class="small fail-secondary-note">${t("fail.offer.rewarded.optionalHint")}</div>`
        : "";
    const secondaryActionClass = recoveryReadySecondaryActions ? "is-secondary-recovery" : "";
    return `<div class="overlay-modal"><div class="panel modal-card fail-modal"><div class="panel-actions"><span class="tag">${t("level.fail")}</span><span class="tag">${t("ui.score")} ${board?.score ?? 0}</span>${failDecision ? `<span class="tag tag-accent">${t("ui.recommended")}</span>` : ""}</div><h2>${failDecision ? t(failDecision.headlineKey) : t("level.failFlavor")}</h2><p class="small fail-copy">${failDecision ? t(failDecision.bodyKey) : t("level.failFlavor")}</p>${renderFailOverlayFocusCard(state, failDecision, gemContinueCost, t)}${renderRemainingObjective(state, t)}${alternativeActions ? `${alternativeActionNote}<div class="cta-row cta-row-stacked ${secondaryActionClass}">${alternativeActions}</div>` : ""}${showPiggyUpsell && failDecision ? renderPiggyBankUpsellCard(state, failDecision, t) : ""}${failRescueGemOffer ? renderFailGemRescueCard(failRescueGemOffer, state.shopOffers.find((offer) => offer.id === failRescueGemOffer.offerId) ?? null, t) : ""}<div class="cta-row"><button class="ghost-btn" data-action="restart-level">${t("level.retry")}</button><button class="ghost-btn" data-action="acknowledge-level">${t("screen.map")}</button></div></div></div>`;
  }

  return `<div class="overlay-modal"><div class="panel modal-card">${renderModalContent(
    state,
    chapter,
    sessionGoal,
    t,
  )}</div></div>`;
}

function renderRewardRevealModal(state: GameSessionState, t: (key: string) => string) {
  if (!state.rewardReveal) {
    return "";
  }

  const restorationContext = getRestorationRevealContext(state);
  const hasPrimaryAction = Boolean(state.rewardReveal.primaryAction);
  const rewardSummary = state.rewardReveal.rewards
    ? formatRewardSummary(state.rewardReveal.rewards, t)
    : "";
  return `<div class="overlay-modal"><div class="panel modal-card reward-reveal-modal"><div class="panel-actions"><span class="tag tag-accent">${t(state.rewardReveal.tagKey)}</span>${hasPrimaryAction ? `<span class="tag">${t("ui.nextStep")}</span>` : ""}</div><h2>${t(state.rewardReveal.titleKey)}</h2><p class="small">${t(state.rewardReveal.bodyKey)}</p>${renderRewardRevealFocusCard(state, t)}${state.rewardReveal.featureHighlight ? renderRewardFeatureHighlight(state.rewardReveal.featureHighlight, t) : ""}${restorationContext ? renderRestorationRevealProgress(restorationContext, t) : ""}${rewardSummary ? `<div class="reward-reveal-summary"><div class="small">${t("ui.rewards")}</div><strong>${rewardSummary}</strong></div>` : ""}<div class="cta-row"><button class="${hasPrimaryAction ? "ghost-btn" : "primary-btn"}" data-action="dismiss-reward-reveal">${t("reward.reveal.continue")}</button></div></div></div>`;
  }

function renderWinOverlayFocusCard(state: GameSessionState, t: (key: string) => string) {
  const activeLevel = state.activeLevel;
  if (!activeLevel) {
    return "";
  }

  const rewardSummary = formatRewardSummary(activeLevel.level.rewards, t);
  if (activeLevel.winBonusClaimed) {
    return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t("ui.rewards")}</span></div><strong>${t("reward.doubleClaimed")}</strong>${rewardSummary ? `<div class="small">${t("ui.rewards")}: ${rewardSummary}</div>` : ""}</div>`;
  }

  return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t("ui.rewards")}</span><span class="tag tag-accent">${t("ui.recommended")}</span></div><strong>${t("reward.doubleClaim")}</strong><div class="small">${t("reward.doubleClaimBody")}</div>${rewardSummary ? `<div class="small">${t("ui.rewards")}: ${rewardSummary}</div>` : ""}<div class="cta-row"><button class="primary-btn" data-action="claim-win-bonus">${t("reward.doubleClaim")}</button></div></div>`;
}

function renderWinRewardSummary(state: GameSessionState, t: (key: string) => string) {
  const rewards = state.activeLevel?.level.rewards;
  if (!rewards) {
    return "";
  }

  const rewardSummary = formatRewardSummary(rewards, t);
  if (!rewardSummary) {
    return "";
  }

  return `<div class="reward-reveal-summary"><div class="small">${t("ui.rewards")}</div><strong>${rewardSummary}</strong></div>`;
}

function renderFailOverlayFocusCard(
  state: GameSessionState,
  failDecision: ReturnType<typeof decideFailOffer> | null,
  gemContinueCost: number,
  t: (key: string) => string,
) {
  if (!failDecision) {
    return "";
  }

  if (failDecision.primaryAction === "gems_continue") {
    const recoveryReady = state.failRecoveryHint === "gems_continue";
    const emphasisTagKey = recoveryReady ? "fail.offer.gems.readyTag" : "ui.recommended";
    const bodyKey = recoveryReady ? "fail.offer.gems.readyBody" : failDecision.bodyKey;
    const gemsReadyNow = state.save.currencies.gems;
    const gemsLeftAfterContinue = Math.max(0, gemsReadyNow - gemContinueCost);
    const balanceLine = failDecision.hasEnoughGems
      ? `<div class="small">${t("fail.offer.gems.balanceNow")} ${gemsReadyNow} ${t("currency.gems")} &middot; ${t("fail.offer.gems.balanceAfter")} ${gemsLeftAfterContinue} ${t("currency.gems")}</div>`
      : "";
    return `<div class="reward-highlight-card overlay-focus-card ${recoveryReady ? "is-recovery-ready" : ""}"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${gemContinueCost} ${t("currency.gems")}</span><span class="tag tag-accent">${t(emphasisTagKey)}</span></div><strong>${t("level.continueWithGems")} ${gemContinueCost} ${t("currency.gems")}</strong><div class="small">${t(bodyKey)}</div>${balanceLine}<div class="cta-row"><button class="primary-btn" data-action="continue-gems" ${!failDecision.hasEnoughGems ? "disabled" : ""}>${t("level.continueWithGems")} ${gemContinueCost} ${t("currency.gems")}</button></div></div>`;
  }

  if (failDecision.primaryAction === "piggy_bank") {
    const piggyBank = failDecision.piggyBank;
    const piggyOffer = piggyBank
      ? state.shopOffers.find((offer) => offer.id === piggyBank.offerId)
      : null;
    return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t("shop.piggy.title")}</span><span class="tag tag-accent">${t("ui.recommended")}</span></div><strong>${t("fail.offer.piggy.title")}</strong><div class="small">${t("fail.offer.piggy.body")}</div>${piggyBank ? `<div class="small">${t("shop.piggy.progress")} ${piggyBank.storedGold}/${piggyBank.cap} &middot; ${piggyBank.fillPercent}%</div><div class="small">${t("shop.piggy.bonusPreview")} ${piggyBank.bonusGems} ${t("currency.gems")}</div>` : ""}<div class="cta-row"><button class="primary-btn" data-action="purchase-offer" data-id="${piggyBank?.offerId ?? piggyOffer?.id ?? ""}">${t("shop.piggy.breakOpen")}</button></div></div>`;
  }

  return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t("reward.watchAdContinue")}</span><span class="tag tag-accent">${t("ui.recommended")}</span></div><strong>${t("fail.offer.rewarded.title")}</strong><div class="small">${t("fail.offer.rewarded.body")}</div><div class="cta-row"><button class="primary-btn" data-action="continue-rewarded">${t("reward.watchAdContinue")}</button></div></div>`;
}

function renderFailGemRescueCard(
  rescuePlan: NonNullable<ReturnType<typeof planFailRescueGemOffer>>,
  offer: GameSessionState["shopOffers"][number] | null,
  t: (key: string) => string,
) {
  if (!offer) {
    return "";
  }
  const gemContinueCost = rescuePlan.gemContinueCost;
  const badge = offer.badgeKey ? `<span class="tag">${t(offer.badgeKey)}</span>` : "";
  const cleanCoverageLine = `${t("ui.missing")} ${rescuePlan.shortfall} ${t("currency.gems")} &middot; ${t("fail.offer.gemPack.grants")} ${rescuePlan.gemsGranted} ${t("currency.gems")}`;
  const cleanFollowUpLine = rescuePlan.coversContinue
    ? `${t("fail.offer.gemPack.covers")} &middot; ${t("fail.offer.gemPack.leftover")} ${rescuePlan.leftoverAfterContinue} ${t("currency.gems")}`
    : `${t("fail.offer.gemPack.stillShort")} ${Math.max(0, gemContinueCost - rescuePlan.gemsAfterPurchase)} ${t("currency.gems")}`;
  return `<div class="offer-card fail-offer-card" data-offer-id="${offer.id}"><div class="panel-actions"><strong>${t(offer.titleKey)}</strong>${badge}</div><div class="small">${t(offer.descriptionKey)}</div><div class="small">${cleanCoverageLine}</div><div class="small">${cleanFollowUpLine}</div><div class="small">${renderOfferRewards(offer, t)}</div><div class="panel-actions"><span class="small">${offer.platformPriceLabel}</span><button class="secondary-btn" data-action="purchase-offer" data-id="${offer.id}">${t("shop.buy")}</button></div></div>`;
}

function renderRewardRevealFocusCard(state: GameSessionState, t: (key: string) => string) {
  const primaryAction = state.rewardReveal?.primaryAction;
  if (!primaryAction) {
    return "";
  }

  return `<div class="reward-highlight-card overlay-focus-card"><div class="panel-actions"><span class="tag tag-accent">${t("ui.nextStep")}</span><span class="tag">${t("ui.recommended")}</span></div><strong>${t(primaryAction.labelKey)}</strong><div class="small">${t(state.rewardReveal?.bodyKey ?? "reward.reveal.body")}</div><div class="cta-row"><button class="primary-btn" data-action="reward-reveal-primary">${t(primaryAction.labelKey)}</button></div></div>`;
}

function renderModalContent(
  state: GameSessionState,
  chapter: (typeof chapters)[number],
  sessionGoal: ReturnType<typeof deriveSessionGoal>,
  t: (key: string) => string,
) {
  if (state.currentScreen === "preLevel") {
    return renderPreLevelModal(state, t);
  }

  if (state.currentScreen === "dailyRewards") {
    return renderDailyRewardsScreen(state, t);
  }

  if (state.currentScreen === "shop") {
    const piggyBank = getPiggyBankPresentation(state.save, state.remoteConfig, state.shopOffers);
    const offers = orderShopOffersForDisplay(state, piggyBank);
    const featuredOfferId = getFeaturedShopOfferId(state);
    return `<div class="panel-actions"><span class="tag">${t("screen.shop")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div>${renderShopAdStatusCard(state, t)}<div class="offer-grid">${offers.map((offer) => renderShopOfferCard(offer, piggyBank, state.save, featuredOfferId, t)).join("")}</div>`;
  }

  if (state.currentScreen === "quests") {
    const recommendedQuestId = getRecommendedQuestId(state, sessionGoal);
    return `<div class="panel-actions"><span class="tag">${t("screen.quests")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div>${renderQuestOverlayFocusCard(state, recommendedQuestId, t)}${orderRecommendedFirst(questDefinitions, recommendedQuestId).map((quest) => { const progress = state.save.quests[quest.id]?.progress ?? 0; const claimed = state.save.quests[quest.id]?.claimed ?? false; const recommended = quest.id === recommendedQuestId; const claimable = !claimed && progress >= quest.target; const cta = recommended ? `<div class="small spotlight-helper">${t("ui.featuredAbove")}</div>` : `<button class="${claimable ? "primary-btn" : "ghost-btn"}" data-action="claim-quest" data-id="${quest.id}" ${claimable ? "" : "disabled"}>${claimed ? t("ui.claimed") : t("quest.claim")}</button>`; return `<div class="quest-card ${recommended ? "is-highlighted" : ""}"><div class="panel-actions"><strong>${t(quest.titleKey)}</strong><span class="tag">${t(quest.cadence === "daily" ? "quest.daily" : "quest.weekly")}</span>${recommended ? `<span class="tag tag-accent">${t("ui.recommended")}</span>` : ""}</div><div class="small">${t(quest.descriptionKey)}</div><div class="small">${progress}/${quest.target}</div><div class="small">${formatRewardSummary(quest.rewards, t)}</div>${cta}</div>`; }).join("")}`;
  }

  if (state.currentScreen === "restoration") {
    const progress = getChapterRestorationProgress(state.save, chapter);
    const recommendedNodeId = getRecommendedRestorationNodeId(state, sessionGoal);
    return `<div class="panel-actions"><span class="tag">${t("screen.restore")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div>${renderRestorationOverlayFocusCard(state, chapter, recommendedNodeId, t)}${renderRestorationScreenSummary(chapter, progress, t)}${orderRecommendedFirst(chapter.restorationNodes, recommendedNodeId).map((node) => { const restored = state.save.progression.restoredNodes.includes(node.id); const affordable = canRestoreNode(state.save, node); const recommended = node.id === recommendedNodeId; const cta = recommended ? `<div class="small spotlight-helper">${t("ui.featuredAbove")}</div>` : `<button class="${restored ? "ghost-btn" : affordable ? "primary-btn" : "ghost-btn"}" data-action="restore-node" data-id="${node.id}" ${restored || !affordable ? "disabled" : ""}>${restored ? t("ui.restored") : t("map.restore")}</button>`; return `<div class="restoration-card ${recommended ? "is-highlighted" : ""}"><div class="panel-actions"><strong>${t(node.titleKey)}</strong>${recommended ? `<span class="tag tag-accent">${t("ui.recommended")}</span>` : ""}</div><div class="small">${t(node.descriptionKey)}</div><div class="small">&#9733; ${node.starCost} &middot; Gold ${node.goldCost} &middot; Petals ${node.petalsCost}</div>${!restored && !affordable ? `<div class="small">${formatRestoreNodeShortfall(state.save, node, t)}</div>` : ""}${cta}</div>`; }).join("")}`;
  }

  if (state.currentScreen === "leaderboards") {
    return `<div class="panel-actions"><span class="tag">${t("screen.leaderboards")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><div class="list-card">${state.leaderboard.map((entry) => `<div class="panel-actions"><strong>#${entry.rank} ${entry.displayName}</strong><span class="tag">${entry.score}</span></div>`).join("")}</div><div class="cta-row"><button class="secondary-btn" data-action="submit-leaderboard">${t("leaderboard.submit")}</button></div>`;
  }

  if (state.currentScreen === "inbox") {
    const recommendedInboxId = getRecommendedInboxId(sessionGoal);
    return `<div class="panel-actions"><span class="tag">${t("screen.inbox")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div>${renderInboxOverlayFocusCard(state, recommendedInboxId, t)}<div class="offer-grid">${state.save.inbox.length === 0 ? `<div class="list-card"><div class="small">${t("inbox.empty")}</div></div>` : orderRecommendedFirst(state.save.inbox, recommendedInboxId).map((item) => renderInboxCard(item, item.id === recommendedInboxId, item.id === recommendedInboxId, t)).join("")}</div>`;
  }

  if (state.currentScreen === "event") {
    const activeEvent = liveEvents.find((event) => event.id === state.eventId) ?? liveEvents[0];
    if (!activeEvent) {
      return `<div class="panel-actions"><span class="tag">${t("screen.event")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><div class="list-card"><div class="small">${t("inbox.empty")}</div></div>`;
    }

    const progress = getEventProgressSummary(state.save, activeEvent);
    const nextMilestone = progress.claimableMilestones[0] ?? progress.nextMilestone;
    const recommendedMilestoneId = getRecommendedEventMilestoneId(state, sessionGoal);
    return `<div class="panel-actions"><span class="tag">${t("screen.event")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><h2>${t(activeEvent.titleKey)}</h2><p class="small">${t(activeEvent.descriptionKey)}</p>${renderEventOverlayFocusCard(state, activeEvent, recommendedMilestoneId, t)}<div class="prelevel-summary-grid"><div class="metric-card"><div class="small">${t("currency.seasonalTokens")}</div><strong>${progress.tokens}</strong></div><div class="metric-card"><div class="small">${t("event.completedMilestones")}</div><strong>${progress.claimedCount}/${activeEvent.rewardTrack.length}</strong></div></div><div class="small">${nextMilestone ? `${progress.claimableMilestones.length > 0 ? t("event.claimReady") : t("event.nextReward")} ${t(nextMilestone.titleKey)}` : t("event.complete")}</div><div class="progress-track"><div class="progress-fill" style="width: ${progress.progressPercent}%"></div></div><div class="offer-grid">${activeEvent.rewardTrack.map((milestone) => { const claimed = progress.claimedMilestoneIds.includes(milestone.id); const claimable = progress.claimableMilestones.some((entry) => entry.id === milestone.id); const recommended = milestone.id === recommendedMilestoneId; const cta = recommended ? `<div class="small spotlight-helper">${t("ui.featuredAbove")}</div>` : `<button class="${claimable ? "primary-btn" : "ghost-btn"}" data-action="claim-event-reward" data-id="${milestone.id}" ${!claimable || claimed ? "disabled" : ""}>${claimed ? t("event.claimed") : claimable ? t("event.claim") : t("event.locked")}</button>`; return `<div class="offer-card event-milestone-card ${claimable || recommended ? "is-highlighted" : ""}"><div class="panel-actions"><strong>${t(milestone.titleKey)}</strong><span class="tag">${milestone.tokenCost} ${t("currency.seasonalTokens")}</span>${recommended ? `<span class="tag tag-accent">${t("ui.recommended")}</span>` : ""}</div><div class="small">${t(milestone.descriptionKey)}</div><div class="small">${formatRewardSummary(milestone.rewards, t)}</div>${cta}</div>`; }).join("")}</div>`;
  }

  return `<div class="panel-actions"><span class="tag">${t("screen.settings")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><div class="settings-grid">${state.activeLevel ? `<button class="primary-btn" data-action="open-screen" data-id="level">${t("level.resume")}</button>` : ""}<button class="secondary-btn" data-action="set-language" data-id="ru">RU</button><button class="secondary-btn" data-action="set-language" data-id="en">EN</button><button class="ghost-btn" data-action="toggle-setting" data-id="soundEnabled">${t("settings.sound")}: ${state.save.settings.soundEnabled ? t("ui.on") : t("ui.off")}</button><button class="ghost-btn" data-action="toggle-setting" data-id="musicEnabled">${t("settings.music")}: ${state.save.settings.musicEnabled ? t("ui.on") : t("ui.off")}</button><button class="ghost-btn" data-action="toggle-setting" data-id="vibrationEnabled">${t("settings.vibration")}: ${state.save.settings.vibrationEnabled ? t("ui.on") : t("ui.off")}</button><button class="ghost-btn" data-action="toggle-setting" data-id="muted">${t("settings.mute")}: ${state.save.settings.muted ? t("ui.on") : t("ui.off")}</button></div>`;
}

function renderDebug(state: GameSessionState) {
  return `<div class="debug-overlay">boot: ${state.bootStatus}\nscreen: ${state.currentScreen}\nlevel: ${state.activeLevel?.level.id ?? "-"}\nobjective: ${state.activeLevel?.level.objective.type ?? "-"}\nmoves: ${state.activeLevel?.board.movesRemaining ?? "-"}\nstars: ${totalStars(state.save)}\nexperiment: ${JSON.stringify(state.save.experiments, null, 2)}</div>`;
}

function renderCountBadge(count: number) {
  return `<span class="nav-badge">${count}</span>`;
}

function currencyPill(label: string, value: number) {
  return `<div class="currency-pill"><span class="small">${label}</span><strong>${value}</strong></div>`;
}

function formatResourceShortfall(
  goal: Extract<ReturnType<typeof deriveSessionGoal>, { kind: "restore" }>,
  t: (key: string) => string,
) {
  const parts: string[] = [];
  if (goal.missingStars > 0) {
    parts.push(`&#9733; ${goal.missingStars}`);
  }
  if (goal.missingGold > 0) {
    parts.push(`${goal.missingGold} ${t("currency.gold")}`);
  }
  if (goal.missingPetals > 0) {
    parts.push(`${goal.missingPetals} ${t("currency.petals")}`);
  }
  return parts.length > 0 ? `${t("ui.missing")} ${parts.join(" &middot; ")}` : t("goal.restoreReady.body");
}

function formatRestoreNodeShortfall(
  save: GameSessionState["save"],
  node: (typeof chapters)[number]["restorationNodes"][number],
  t: (key: string) => string,
) {
  const parts: string[] = [];
  const missingStars = Math.max(0, node.starCost - totalStars(save));
  const missingGold = Math.max(0, node.goldCost - save.currencies.gold);
  const missingPetals = Math.max(0, node.petalsCost - save.currencies.petals);
  if (missingStars > 0) {
    parts.push(`&#9733; ${missingStars}`);
  }
  if (missingGold > 0) {
    parts.push(`${missingGold} ${t("currency.gold")}`);
  }
  if (missingPetals > 0) {
    parts.push(`${missingPetals} ${t("currency.petals")}`);
  }
  return parts.length > 0 ? `${t("ui.missing")} ${parts.join(" &middot; ")}` : t("reward.reveal.readyNow");
}

function formatRestorationShortfall(
  progress: ReturnType<typeof getChapterRestorationProgress>,
  t: (key: string) => string,
) {
  const parts: string[] = [];
  if (progress.missingStars > 0) {
    parts.push(`&#9733; ${progress.missingStars}`);
  }
  if (progress.missingGold > 0) {
    parts.push(`${progress.missingGold} ${t("currency.gold")}`);
  }
  if (progress.missingPetals > 0) {
    parts.push(`${progress.missingPetals} ${t("currency.petals")}`);
  }
  return parts.length > 0 ? `${t("ui.missing")} ${parts.join(" &middot; ")}` : t("reward.reveal.readyNow");
}

function getRestorationRevealContext(state: GameSessionState) {
  if (!state.rewardReveal?.chapterId) {
    return null;
  }

  const chapter = chapters.find((item) => item.id === state.rewardReveal?.chapterId);
  if (!chapter) {
    return null;
  }

  return {
    chapter,
    progress: getChapterRestorationProgress(state.save, chapter),
  };
}

function renderRestorationRevealProgress(
  context: NonNullable<ReturnType<typeof getRestorationRevealContext>>,
  t: (key: string) => string,
) {
  const { chapter, progress } = context;
  return `<div class="reward-reveal-summary reward-reveal-progress"><div class="panel-actions"><span class="tag">${t("reward.reveal.progressTitle")}</span><span class="tag">${progress.restoredCount}/${progress.totalCount}</span></div><div class="small">${t(chapter.titleKey)}</div><div class="progress-track"><div class="progress-fill" style="width: ${progress.completionPercent}%"></div></div><div class="small"><strong>${t("reward.reveal.nextTarget")}</strong> ${progress.isComplete ? t("reward.reveal.chapterComplete") : t(progress.nextNode?.titleKey ?? "reward.reveal.chapterComplete")}</div>${!progress.isComplete ? `<div class="small">${progress.nextNodeAffordable ? t("reward.reveal.readyNow") : formatRestorationShortfall(progress, t)}</div>` : ""}</div>`;
}

function renderRewardFeatureHighlight(
  highlight: NonNullable<GameSessionState["rewardReveal"]>["featureHighlight"],
  t: (key: string) => string,
) {
  if (!highlight) {
    return "";
  }

  return `<div class="reward-reveal-summary reward-highlight-card"><div class="panel-actions"><span class="tag">${t(highlight.tagKey)}</span></div><strong>${t(highlight.titleKey)}</strong><div class="small">${t(highlight.bodyKey)}</div></div>`;
}

function renderRestorationScreenSummary(
  chapter: (typeof chapters)[number],
  progress: ReturnType<typeof getChapterRestorationProgress>,
  t: (key: string) => string,
) {
  return `<div class="reward-reveal-summary restoration-progress-card"><div class="panel-actions"><strong>${t(chapter.titleKey)}</strong><span class="tag">${progress.restoredCount}/${progress.totalCount}</span></div><div class="small">${t("reward.reveal.progressTitle")}</div><div class="progress-track"><div class="progress-fill" style="width: ${progress.completionPercent}%"></div></div><div class="small">${progress.isComplete ? t("reward.reveal.chapterComplete") : `${t("reward.reveal.nextTarget")} ${t(progress.nextNode?.titleKey ?? "reward.reveal.chapterComplete")}`}</div>${!progress.isComplete ? `<div class="small">${progress.nextNodeAffordable ? t("reward.reveal.readyNow") : formatRestorationShortfall(progress, t)}</div>` : ""}</div>`;
}

function formatRewardSummary(
  reward: Partial<GameSessionState["save"]["inbox"][number]>,
  t: (key: string) => string,
) {
  const entries: string[] = [];
  if (reward.gold) {
    entries.push(`${reward.gold} ${t("currency.gold")}`);
  }
  if (reward.petals) {
    entries.push(`${reward.petals} ${t("currency.petals")}`);
  }
  if (reward.gems) {
    entries.push(`${reward.gems} ${t("currency.gems")}`);
  }
  if (reward.seasonalTokens) {
    entries.push(`${reward.seasonalTokens} ${t("currency.seasonalTokens")}`);
  }
  for (const [boosterId, amount] of Object.entries(reward.boosters ?? {})) {
    if (!amount) {
      continue;
    }
    entries.push(`${amount} ${t(`booster.${boosterId}`)}`);
  }
  return entries.join(" | ");
}

function renderDailyRewardsScreen(state: GameSessionState, t: (key: string) => string) {
  const totalDays = dailyRewards.length;
  const lastClaimedDay = state.save.progression.dailyRewardDay;
  const activeDay = state.dailyRewardAvailable
    ? ((lastClaimedDay % totalDays) || 0) + 1
    : Math.max(lastClaimedDay, 1);
  const tomorrowDay = (activeDay % totalDays) + 1;
  const streak = Math.max(state.save.progression.streak, 1);
  const summaryTitleKey = state.dailyRewardAvailable
    ? "daily.claimReady"
    : "daily.claimedToday";
  const summaryBodyKey = state.dailyRewardAvailable
    ? "goal.daily.body"
    : "daily.returnTomorrow";
  const nextLabelKey = state.dailyRewardAvailable ? "daily.today" : "daily.tomorrow";

  return `<div class="daily-rewards-screen"><div class="panel-actions"><span class="tag">${t("daily.title")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><div class="goal-card daily-summary-card"><div class="panel-actions"><strong>${t(summaryTitleKey)}</strong><span class="tag ${state.dailyRewardAvailable ? "tag-accent" : ""}">${t(nextLabelKey)}</span></div><div class="small daily-summary-copy">${t(summaryBodyKey)}</div><div class="prelevel-summary-grid"><div class="metric-card"><div class="small">${t("daily.streak")}</div><strong>${streak}</strong></div><div class="metric-card"><div class="small">${t("daily.nextUp")}</div><strong>${t("ui.day")} ${state.dailyRewardAvailable ? activeDay : tomorrowDay}</strong></div></div></div><div class="offer-grid daily-offer-grid">${dailyRewards
    .map((reward) => {
      const isToday = reward.day === activeDay;
      const isTomorrow = !state.dailyRewardAvailable && reward.day === tomorrowDay;
      const cardClasses = ["offer-card", "daily-reward-card"];

      if (state.dailyRewardAvailable && isToday) {
        cardClasses.push("is-highlighted");
      }

      if (!state.dailyRewardAvailable && isToday) {
        cardClasses.push("is-claimed-today");
      }

      if (isTomorrow) {
        cardClasses.push("is-highlighted", "is-up-next");
      }

      const badge = state.dailyRewardAvailable && isToday
        ? `<span class="tag tag-accent">${t("daily.today")}</span>`
        : !state.dailyRewardAvailable && isToday
          ? `<span class="tag">${t("daily.claimedState")}</span>`
          : isTomorrow
            ? `<span class="tag tag-accent">${t("daily.tomorrow")}</span>`
            : "";

      return `<div class="${cardClasses.join(" ")}"><div class="panel-actions"><strong>${t("ui.day")} ${reward.day}</strong>${badge}</div><div class="small">${t(reward.rewards.labelKey ?? `daily.day${reward.day}`)}</div><div class="small reward-detail">${formatRewardSummary(reward.rewards, t)}</div></div>`;
    })
    .join("")}</div><div class="cta-row"><button class="${state.dailyRewardAvailable ? "primary-btn" : "ghost-btn"}" ${state.dailyRewardAvailable ? 'data-action="claim-daily"' : 'data-action="open-screen" data-id="map"'}>${state.dailyRewardAvailable ? t("reward.claim") : t("screen.map")}</button></div></div>`;
}

function renderOfferRewards(
  offer: GameSessionState["shopOffers"][number],
  t: (key: string) => string,
) {
  const entries: string[] = [];
  if (offer.rewards.gold) {
    entries.push(`${offer.rewards.gold} ${t("currency.gold")}`);
  }
  if (offer.rewards.petals) {
    entries.push(`${offer.rewards.petals} ${t("currency.petals")}`);
  }
  if (offer.rewards.gems) {
    entries.push(`${offer.rewards.gems} ${t("currency.gems")}`);
  }
  if (offer.rewards.seasonalTokens) {
    entries.push(`${offer.rewards.seasonalTokens} ${t("currency.seasonalTokens")}`);
  }
  for (const [boosterId, amount] of Object.entries(offer.rewards.boosters ?? {})) {
    if (!amount) {
      continue;
    }
    entries.push(`${amount} ${t(`booster.${boosterId}`)}`);
  }
  return entries.join(" | ");
}

function renderPiggyBankPanel(
  piggyBank: NonNullable<ReturnType<typeof getPiggyBankPresentation>>,
  t: (key: string) => string,
) {
  const statusCopy = piggyBank.isSpotlighted
    ? t("shop.piggy.readyNow")
    : piggyBank.isNudged
      ? t("shop.piggy.nearlyReady")
      : t("shop.piggy.building");
  return `<section class="panel piggy-panel ${piggyBank.isSpotlighted ? "is-spotlight" : ""}"><div class="panel-actions"><span class="tag">${t("shop.piggy.title")}</span>${piggyBank.isSpotlighted ? `<span class="tag tag-accent">${t("ui.recommended")}</span>` : ""}</div><strong>${statusCopy}</strong><div class="small">${t("shop.piggy.progress")} ${piggyBank.storedGold}/${piggyBank.cap} &middot; ${piggyBank.fillPercent}%</div><div class="progress-track"><div class="progress-fill" style="width: ${piggyBank.fillPercent}%"></div></div><div class="small">${t("shop.piggy.bonusPreview")} ${piggyBank.bonusGems} ${t("currency.gems")}</div><div class="cta-row"><button class="${piggyBank.isSpotlighted ? "primary-btn" : "secondary-btn"}" data-action="${piggyBank.isSpotlighted ? "purchase-offer" : "open-screen"}" data-id="${piggyBank.isSpotlighted ? piggyBank.offerId : "shop"}">${piggyBank.isSpotlighted ? t("shop.piggy.breakOpen") : t("shop.piggy.visitShop")}</button></div></section>`;
}

function renderPiggyBankUpsellCard(
  state: GameSessionState,
  decision: NonNullable<ReturnType<typeof decideFailOffer>>,
  t: (key: string) => string,
) {
  const piggyBank = decision.piggyBank;
  if (!piggyBank) {
    return "";
  }

  const piggyOffer = state.shopOffers.find((offer) => offer.id === piggyBank.offerId);
  return `<div class="offer-card fail-offer-card ${decision.primaryAction === "piggy_bank" ? "is-highlighted" : ""}"><div class="panel-actions"><strong>${t("shop.piggy.title")}</strong>${decision.primaryAction === "piggy_bank" ? `<span class="tag tag-accent">${t("ui.recommended")}</span>` : piggyOffer?.badgeKey ? `<span class="tag">${t(piggyOffer.badgeKey)}</span>` : ""}</div><div class="small">${piggyBank.isSpotlighted ? t("shop.piggy.readyNow") : t("shop.piggy.nearlyReady")}</div><div class="progress-track"><div class="progress-fill" style="width: ${piggyBank.fillPercent}%"></div></div><div class="small">${t("shop.piggy.progress")} ${piggyBank.storedGold}/${piggyBank.cap} &middot; ${piggyBank.fillPercent}%</div><div class="small">${t("shop.piggy.bonusPreview")} ${piggyBank.bonusGems} ${t("currency.gems")}</div><div class="panel-actions"><span class="small">${piggyOffer?.platformPriceLabel ?? ""}</span><button class="${decision.primaryAction === "piggy_bank" ? "primary-btn" : "secondary-btn"}" data-action="purchase-offer" data-id="${piggyBank.offerId}">${t("shop.piggy.breakOpen")}</button></div></div>`;
}

function orderShopOffersForDisplay(
  state: GameSessionState,
  piggyBank: ReturnType<typeof getPiggyBankPresentation>,
) {
  return [...state.shopOffers].sort((left, right) => {
    return getShopOfferPriority(left, state, piggyBank) - getShopOfferPriority(right, state, piggyBank);
  });
}

function getShopOfferPriority(
  offer: GameSessionState["shopOffers"][number],
  state: GameSessionState,
  piggyBank: ReturnType<typeof getPiggyBankPresentation>,
) {
  if (piggyBank?.isNudged && offer.id === piggyBank.offerId) {
    return -20;
  }
  if (state.save.economy.adLightPurchased && offer.type === "no_ads") {
    return -10;
  }
  return state.shopOffers.findIndex((item) => item.id === offer.id);
}

function renderShopOfferCard(
  offer: GameSessionState["shopOffers"][number],
  piggyBank: ReturnType<typeof getPiggyBankPresentation>,
  save: GameSessionState["save"],
  featuredOfferId: string | null,
  t: (key: string) => string,
) {
  const isPiggy = piggyBank?.offerId === offer.id;
  const isNoAdsUpgrade = offer.type === "no_ads" && save.economy.adLightPurchased;
  const isFeaturedAbove = featuredOfferId === offer.id;
  const isOfferHighlighted =
    (isPiggy && piggyBank?.isSpotlighted) || isNoAdsUpgrade || isFeaturedAbove;
  const piggyDetails = isPiggy && piggyBank
    ? `<div class="small">${t("shop.piggy.progress")} ${piggyBank.storedGold}/${piggyBank.cap} &middot; ${piggyBank.fillPercent}%</div><div class="progress-track"><div class="progress-fill" style="width: ${piggyBank.fillPercent}%"></div></div><div class="small">${t("shop.piggy.bonusPreview")} ${piggyBank.bonusGems} ${t("currency.gems")}</div>`
    : offer.helperText
      ? `<div class="small">${offer.helperText}</div>`
      : "";
  const adOfferBenefits = renderAdOfferBenefits(offer, t);
  const badgeKey = isNoAdsUpgrade ? "shop.badge.upgrade" : offer.badgeKey;
  const upgradeHint =
    isNoAdsUpgrade && !isPiggy
      ? `<div class="small offer-upgrade-hint">${t("shop.noads.upgradeHint")}</div>`
      : "";
  const cta = isFeaturedAbove
    ? `<div class="small spotlight-helper">${t("ui.featuredAbove")}</div>`
    : `<button class="${isOfferHighlighted ? "primary-btn" : "secondary-btn"}" data-action="purchase-offer" data-id="${offer.id}">${isPiggy ? t("shop.piggy.breakOpen") : t("shop.buy")}</button>`;
  return `<div class="offer-card ${isOfferHighlighted ? "is-highlighted" : ""}" data-offer-id="${offer.id}">${isPiggy && piggyBank ? `<div class="progress-ribbon">${piggyBank.fillPercent}%</div>` : ""}<div class="panel-actions"><strong>${t(offer.titleKey)}</strong>${badgeKey ? `<span class="tag ${isOfferHighlighted ? "tag-accent" : ""}">${t(badgeKey)}</span>` : ""}</div><div class="small">${t(offer.descriptionKey)}</div>${upgradeHint}${adOfferBenefits}<div class="small">${renderOfferRewards(offer, t)}</div>${piggyDetails}<div class="small">${offer.platformPriceLabel}</div>${cta}</div>`;
}

function renderAdOfferBenefits(
  offer: GameSessionState["shopOffers"][number],
  t: (key: string) => string,
) {
  if (offer.type !== "ad_light" && offer.type !== "no_ads") {
    return "";
  }

  const benefitRows = buildAdBenefitRows(offer.type);

  return `<div class="offer-benefit-grid">${benefitRows
    .map(
      (row) =>
        `<div class="offer-benefit-pill ${row.accent ? "is-accent" : ""}"><span>${t(row.labelKey)}</span><strong>${t(row.valueKey)}</strong></div>`,
    )
    .join("")}</div>`;
}

function renderShopAdStatusCard(state: GameSessionState, t: (key: string) => string) {
  const mode = resolveAdStatusMode(state.save);
  const noAdsOffer = state.shopOffers.find((offer) => offer.type === "no_ads");
  const canUpgrade = mode === "ad_light" && Boolean(noAdsOffer);
  const titleKey =
    mode === "no_ads"
      ? "shop.adStatus.noAds.title"
      : mode === "ad_light"
        ? "shop.adStatus.adLight.title"
        : "shop.adStatus.standard.title";
  const bodyKey =
    mode === "no_ads"
      ? "shop.adStatus.noAds.body"
      : mode === "ad_light"
        ? "shop.adStatus.adLight.body"
        : "shop.adStatus.standard.body";
  const benefitRows = buildAdBenefitRows(mode);
  const upgradeCta =
    canUpgrade && noAdsOffer
      ? `<div class="cta-row"><button class="primary-btn" data-action="purchase-offer" data-id="${noAdsOffer.id}">${t("shop.adStatus.upgradeCta")}</button><span class="small">${noAdsOffer.platformPriceLabel}</span></div>`
      : "";
  const completionCta =
    mode === "no_ads"
      ? `<div class="cta-row"><button class="primary-btn" data-action="start-current-level">${t("shop.adStatus.resumeCta")}</button></div>`
      : "";

  return `<section class="panel shop-status-card ${mode === "no_ads" ? "is-complete" : mode === "ad_light" ? "is-upgraded" : ""}" data-shop-status-mode="${mode}"><div class="panel-actions"><span class="tag">${t("shop.adStatus.title")}</span><span class="tag ${mode === "standard" ? "" : "tag-accent"}">${t(titleKey)}</span></div><strong>${t(titleKey)}</strong><div class="small">${t(bodyKey)}</div><div class="offer-benefit-grid">${benefitRows
    .map(
      (row) =>
        `<div class="offer-benefit-pill ${row.accent ? "is-accent" : ""}"><span>${t(row.labelKey)}</span><strong>${t(row.valueKey)}</strong></div>`,
    )
    .join("")}</div>${upgradeCta}${completionCta}</section>`;
}

function getFeaturedShopOfferId(state: GameSessionState) {
  if (state.save.economy.adLightPurchased) {
    return state.shopOffers.find((offer) => offer.type === "no_ads")?.id ?? null;
  }
  return null;
}

function resolveAdStatusMode(save: GameSessionState["save"]) {
  if (save.economy.noAdsPurchased) {
    return "no_ads";
  }
  if (save.economy.adLightPurchased) {
    return "ad_light";
  }
  return "standard";
}

function buildAdBenefitRows(mode: "standard" | "ad_light" | "no_ads") {
  return [
    {
      labelKey: "shop.ads.stickyBanners",
      valueKey: mode === "standard" ? "ui.on" : "ui.off",
      accent: mode !== "standard",
    },
    {
      labelKey: "shop.ads.interstitials",
      valueKey: mode === "no_ads" ? "ui.off" : "ui.on",
      accent: mode === "no_ads",
    },
    {
      labelKey: "shop.ads.rewarded",
      valueKey: "shop.ads.optional",
      accent: false,
    },
  ];
}

function renderPreLevelModal(state: GameSessionState, t: (key: string) => string) {
  const levelId = state.levelPreview?.levelId ?? state.save.progression.currentLevelId;
  const level = levels.find((entry) => entry.id === levelId);
  if (!level) {
    return "";
  }

  const selectedBoosters = state.levelPreview?.selectedBoosters ?? [];
  return `<div class="prelevel-modal"><div class="panel-actions"><span class="tag">${t("preLevel.title")}</span><span class="tag">${t(`difficulty.${level.difficulty}`)}</span></div><h2>${t("map.play")} ${level.id}</h2><p class="small">${t("preLevel.subtitle")}</p><div class="prelevel-summary-grid"><div class="metric-card"><div class="small">${t("level.goal")}</div><strong>${t(`objective.${level.objective.type}`)}${level.objective.target ? ` ${level.objective.target}` : ""}</strong></div><div class="metric-card"><div class="small">${t("level.moves")}</div><strong>${level.moves}</strong></div></div><div class="small prelevel-rewards"><strong>${t("preLevel.rewards")}</strong><br />${formatRewardSummary(level.rewards, t)}</div><div class="panel-actions"><strong>${t("preLevel.boosters")}</strong><span class="small">${t("preLevel.limit")}</span></div><div class="prelevel-booster-grid">${preLevelBoosterIds.map((boosterId) => renderPreLevelBoosterCard(state, boosterId, selectedBoosters, t)).join("")}</div><div class="cta-row"><button class="ghost-btn" data-action="close-level-preview">${t("preLevel.back")}</button><button class="primary-btn" data-action="confirm-start-level">${t("preLevel.start")}</button></div></div>`;
}

function renderPreLevelBoosterCard(
  state: GameSessionState,
  boosterId: (typeof preLevelBoosterIds)[number],
  selectedBoosters: (typeof preLevelBoosterIds)[number][],
  t: (key: string) => string,
) {
  const count = state.save.boosters[boosterId] ?? 0;
  const selected = isPreLevelBoosterSelected(selectedBoosters, boosterId);
  const selectable = canSelectPreLevelBooster(selectedBoosters, boosterId, state.save.boosters);
  return `<button class="prelevel-booster-card ${selected ? "is-selected" : ""}" data-action="toggle-prelevel-booster" data-id="${boosterId}" ${!selectable ? "disabled" : ""}><div class="panel-actions"><strong>${t(`booster.${boosterId}`)}</strong>${selected ? `<span class="tag tag-accent">${t("preLevel.selected")}</span>` : ""}</div><div class="small">${t(`preLevel.booster.${boosterId}`)}</div><div class="small">${t("preLevel.stock")} ${count}</div></button>`;
}

function resolveFailButtonClass(
  primaryAction: ReturnType<typeof decideFailOffer>["primaryAction"] | undefined,
  action: ReturnType<typeof decideFailOffer>["primaryAction"],
) {
  return primaryAction === action ? "primary-btn" : "secondary-btn";
}

async function triggerRewardRevealPrimaryAction(session: GameSession) {
  const action = session.getState().rewardReveal?.primaryAction;
  if (!action) {
    return;
  }

  await session.dismissRewardReveal();

  if (action.action === "start-current-level") {
    await session.openLevelPreview(session.getState().save.progression.currentLevelId);
    return;
  }

  if (action.action === "restore-node" && action.id) {
    await session.restoreArea(action.id);
    return;
  }

  if (action.action === "claim-event-reward" && action.id) {
    await session.claimEventReward(action.id);
    return;
  }

  if (action.action === "claim-chapter-chest" && action.id) {
    await session.claimChapterChest(action.id);
    return;
  }

  if (action.action === "claim-quest" && action.id) {
    await session.claimQuest(action.id);
    return;
  }

  if (action.action === "open-screen" && isScreenId(action.id)) {
    await session.openScreen(action.id);
  }
}

function isGameplayScreen(screen: ScreenId) {
  return screen === "level" || screen === "win" || screen === "fail";
}

function isScreenId(value: string | undefined): value is ScreenId {
  return (
    value === "map" ||
    value === "preLevel" ||
    value === "level" ||
    value === "dailyRewards" ||
    value === "quests" ||
    value === "shop" ||
    value === "settings" ||
    value === "event" ||
    value === "restoration" ||
    value === "leaderboards" ||
    value === "inbox" ||
    value === "win" ||
    value === "fail" ||
    value === "boot"
  );
}

function resolveActiveEvent(state: GameSessionState) {
  return liveEvents.find((event) => event.id === state.eventId) ?? liveEvents[0] ?? null;
}

