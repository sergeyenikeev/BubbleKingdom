import { chapters, questDefinitions } from "@bubble-kingdom/game-data";
import type { GameSession, GameSessionState, ScreenId } from "@bubble-kingdom/game-core";
import { calculateExtraMovesGemCost, totalStars, translate } from "@bubble-kingdom/game-core";

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
      void session.startLevel(session.getState().save.progression.currentLevelId);
    } else if (action === "start-level" && id) {
      void session.startLevel(Number(id));
    } else if (action === "claim-daily") {
      void session.claimDailyReward();
    } else if (action === "claim-quest" && id) {
      void session.claimQuest(id);
    } else if (action === "purchase-offer" && id) {
      void session.purchaseOffer(id);
    } else if (action === "restore-node" && id) {
      void session.restoreArea(id);
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

interface RendererHandle {
  render(state: GameSessionState): void;
  destroy(): void;
}

function renderUi(root: HTMLElement, state: GameSessionState, debugEnabled: boolean) {
  const t = (key: string) => translate(state.locale, key);
  const currentChapter =
    chapters.find((chapter) => chapter.levels.includes(state.save.progression.currentLevelId)) ??
    chapters[0]!;

  root.innerHTML = `
    ${renderTopBar(state, t)}
    ${
      state.currentScreen === "level" ||
      state.currentScreen === "win" ||
      state.currentScreen === "fail"
        ? renderLevelHud(state, t)
        : renderMainLayout(state, currentChapter, t)
    }
    ${renderBottomNav(state, t)}
    ${renderOverlay(state, currentChapter, t)}
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
  t: (key: string) => string,
) {
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
            <div class="metric-card"><div class="small">${t("ui.event")}</div><strong>${state.eventId}</strong></div>
          </div>
          <div class="cta-row">
            <button class="primary-btn" data-action="start-current-level">${t("map.play")} ${state.save.progression.currentLevelId}</button>
            <button class="secondary-btn" data-action="open-screen" data-id="dailyRewards">${t("screen.rewards")}</button>
            <button class="ghost-btn" data-action="auth">Yandex ID</button>
          </div>
          <div class="hero-grid">
            ${state.notifications.map((notice) => `<div class="notice">${notice}</div>`).join("")}
          </div>
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
        <section class="panel">
          <div class="panel-actions">
            <span class="tag">${t("screen.restore")}</span>
            <button class="ghost-btn" data-action="open-screen" data-id="restoration">${t("map.restore")}</button>
          </div>
          <div class="restoration-grid">
            ${chapter.restorationNodes
              .map((node) => {
                const restored = state.save.progression.restoredNodes.includes(node.id);
                return `<div class="restoration-card"><strong>${t(node.titleKey)}</strong><div class="small">${t(node.descriptionKey)}</div><div class="small">&#9733; ${node.starCost} &middot; Gold ${node.goldCost} &middot; Petals ${node.petalsCost}</div><button class="${restored ? "ghost-btn" : "secondary-btn"}" data-action="restore-node" data-id="${node.id}" ${restored ? "disabled" : ""}>${restored ? t("ui.restored") : t("map.restore")}</button></div>`;
              })
              .join("")}
          </div>
        </section>
        <section class="panel">
          <div class="panel-actions">
            <span class="tag">${t("screen.quests")}</span>
            <button class="ghost-btn" data-action="open-screen" data-id="quests">${t("screen.quests")}</button>
          </div>
          ${questDefinitions
            .slice(0, 2)
            .map(
              (quest) =>
                `<div class="quest-card"><strong>${t(quest.titleKey)}</strong><div class="small">${t(quest.descriptionKey)}</div></div>`,
            )
            .join("")}
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
  if (!level || !board) {
    return "";
  }

  return `
    <div class="level-hud">
      <div class="hud-row">
        <div class="pill">${t("level.goal")}: ${t(`objective.${level.objective.type}`)}${level.objective.target ? ` ${board.objectiveProgress[level.objective.type] ?? 0}/${level.objective.target}` : ""}</div>
        <div class="pill">${t("level.moves")}: ${board.movesRemaining}</div>
        <button class="icon-btn" data-action="open-screen" data-id="settings">${t("level.pause")}</button>
      </div>
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

function renderBottomNav(state: GameSessionState, t: (key: string) => string) {
  const tabs: Array<{ id: ScreenId; labelKey: string }> = [
    { id: "map", labelKey: "screen.map" },
    { id: "shop", labelKey: "screen.shop" },
    { id: "quests", labelKey: "screen.quests" },
    { id: "event", labelKey: "screen.event" },
    { id: "leaderboards", labelKey: "screen.leaderboards" },
    { id: "inbox", labelKey: "screen.inbox" },
  ];
  return `<div class="bottom-nav">${tabs.map((tab) => `<button class="nav-btn ${state.currentScreen === tab.id ? "is-active" : ""}" data-action="open-screen" data-id="${tab.id}">${t(tab.labelKey)}</button>`).join("")}</div>`;
}

function renderOverlay(
  state: GameSessionState,
  chapter: (typeof chapters)[number],
  t: (key: string) => string,
) {
  if (state.currentScreen === "map" || state.currentScreen === "level") {
    return "";
  }

  if (state.currentScreen === "win" || state.currentScreen === "fail") {
    const win = state.currentScreen === "win";
    const board = state.activeLevel?.board;
    const gemContinueCost =
      state.activeLevel
        ? calculateExtraMovesGemCost(
            state.activeLevel.continueOffersUsed,
            state.remoteConfig,
          )
        : 0;
    return `<div class="overlay-modal"><div class="panel modal-card"><div class="panel-actions"><span class="tag">${win ? t("level.win") : t("level.fail")}</span><span class="tag">${t("ui.score")} ${board?.score ?? 0}</span></div><h2>${win ? t("level.winFlavor") : t("level.failFlavor")}</h2><div class="cta-row">${win ? `<button class="primary-btn" data-action="acknowledge-level">${t("map.continue")}</button>${state.activeLevel?.winBonusClaimed ? `<button class="ghost-btn" disabled>${t("reward.doubleClaimed")}</button>` : `<button class="secondary-btn" data-action="claim-win-bonus">${t("reward.doubleClaim")}</button>`}` : `<button class="primary-btn" data-action="continue-rewarded">${t("reward.watchAdContinue")}</button><button class="secondary-btn" data-action="continue-gems">${t("level.continueWithGems")} ${gemContinueCost} ${t("currency.gems")}</button><button class="ghost-btn" data-action="restart-level">${t("level.retry")}</button>`}<button class="ghost-btn" data-action="acknowledge-level">${t("screen.map")}</button></div></div></div>`;
  }

  return `<div class="overlay-modal"><div class="panel modal-card">${renderModalContent(
    state,
    chapter,
    t,
  )}</div></div>`;
}

function renderModalContent(
  state: GameSessionState,
  chapter: (typeof chapters)[number],
  t: (key: string) => string,
) {
  if (state.currentScreen === "dailyRewards") {
    return `<div class="panel-actions"><span class="tag">${t("daily.title")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><div class="offer-grid">${[1, 2, 3, 4, 5, 6, 7].map((day) => `<div class="offer-card"><strong>${t("ui.day")} ${day}</strong><div class="small">${t(`daily.day${day}`)}</div></div>`).join("")}</div><div class="cta-row"><button class="primary-btn" data-action="claim-daily">${t("reward.claim")}</button></div>`;
  }

  if (state.currentScreen === "shop") {
    return `<div class="panel-actions"><span class="tag">${t("screen.shop")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><div class="offer-grid">${state.shopOffers.map((offer) => `<div class="offer-card"><div class="panel-actions"><strong>${t(offer.titleKey)}</strong>${offer.badgeKey ? `<span class="tag">${t(offer.badgeKey)}</span>` : ""}</div><div class="small">${t(offer.descriptionKey)}</div><div class="small">${renderOfferRewards(offer, t)}</div>${offer.helperText ? `<div class="small">${t("shop.piggy.progress")} ${offer.helperText}</div>` : ""}<div class="small">${offer.platformPriceLabel}</div><button class="primary-btn" data-action="purchase-offer" data-id="${offer.id}">${t("shop.buy")}</button></div>`).join("")}</div>`;
  }

  if (state.currentScreen === "quests") {
    return `<div class="panel-actions"><span class="tag">${t("screen.quests")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div>${questDefinitions.map((quest) => { const progress = state.save.quests[quest.id]?.progress ?? 0; const claimed = state.save.quests[quest.id]?.claimed ?? false; return `<div class="quest-card"><div class="panel-actions"><strong>${t(quest.titleKey)}</strong><span class="tag">${t(quest.cadence === "daily" ? "quest.daily" : "quest.weekly")}</span></div><div class="small">${t(quest.descriptionKey)}</div><div class="small">${progress}/${quest.target}</div><button class="${claimed ? "ghost-btn" : "secondary-btn"}" data-action="claim-quest" data-id="${quest.id}" ${claimed || progress < quest.target ? "disabled" : ""}>${claimed ? t("ui.claimed") : t("quest.claim")}</button></div>`; }).join("")}`;
  }

  if (state.currentScreen === "restoration") {
    return `<div class="panel-actions"><span class="tag">${t("screen.restore")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div>${chapter.restorationNodes.map((node) => { const restored = state.save.progression.restoredNodes.includes(node.id); return `<div class="restoration-card"><strong>${t(node.titleKey)}</strong><div class="small">${t(node.descriptionKey)}</div><div class="small">&#9733; ${node.starCost} &middot; Gold ${node.goldCost} &middot; Petals ${node.petalsCost}</div><button class="${restored ? "ghost-btn" : "primary-btn"}" data-action="restore-node" data-id="${node.id}" ${restored ? "disabled" : ""}>${restored ? t("ui.restored") : t("map.restore")}</button></div>`; }).join("")}`;
  }

  if (state.currentScreen === "leaderboards") {
    return `<div class="panel-actions"><span class="tag">${t("screen.leaderboards")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><div class="list-card">${state.leaderboard.map((entry) => `<div class="panel-actions"><strong>#${entry.rank} ${entry.displayName}</strong><span class="tag">${entry.score}</span></div>`).join("")}</div><div class="cta-row"><button class="secondary-btn" data-action="submit-leaderboard">${t("leaderboard.submit")}</button></div>`;
  }

  if (state.currentScreen === "inbox") {
    return `<div class="panel-actions"><span class="tag">${t("screen.inbox")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><div class="list-card">${state.save.inbox.length === 0 ? `<div class="small">${t("inbox.empty")}</div>` : state.save.inbox.map((item) => `<div class="notice">${item.labelKey ?? item.source}</div>`).join("")}</div>`;
  }

  if (state.currentScreen === "event") {
    return `<div class="panel-actions"><span class="tag">${t("screen.event")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><h2>${state.eventId}</h2><p class="small">${t("event.weeklyDescription")}</p><div class="metric-card"><div class="small">${t("currency.seasonalTokens")}</div><strong>${state.save.currencies.seasonalTokens}</strong></div>`;
  }

  return `<div class="panel-actions"><span class="tag">${t("screen.settings")}</span><button class="ghost-btn" data-action="open-screen" data-id="map">${t("screen.map")}</button></div><div class="settings-grid">${state.activeLevel ? `<button class="primary-btn" data-action="open-screen" data-id="level">${t("level.resume")}</button>` : ""}<button class="secondary-btn" data-action="set-language" data-id="ru">RU</button><button class="secondary-btn" data-action="set-language" data-id="en">EN</button><button class="ghost-btn" data-action="toggle-setting" data-id="soundEnabled">${t("settings.sound")}: ${state.save.settings.soundEnabled ? t("ui.on") : t("ui.off")}</button><button class="ghost-btn" data-action="toggle-setting" data-id="musicEnabled">${t("settings.music")}: ${state.save.settings.musicEnabled ? t("ui.on") : t("ui.off")}</button><button class="ghost-btn" data-action="toggle-setting" data-id="vibrationEnabled">${t("settings.vibration")}: ${state.save.settings.vibrationEnabled ? t("ui.on") : t("ui.off")}</button><button class="ghost-btn" data-action="toggle-setting" data-id="muted">${t("settings.mute")}: ${state.save.settings.muted ? t("ui.on") : t("ui.off")}</button></div>`;
}

function renderDebug(state: GameSessionState) {
  return `<div class="debug-overlay">boot: ${state.bootStatus}\nscreen: ${state.currentScreen}\nlevel: ${state.activeLevel?.level.id ?? "-"}\nobjective: ${state.activeLevel?.level.objective.type ?? "-"}\nmoves: ${state.activeLevel?.board.movesRemaining ?? "-"}\nstars: ${totalStars(state.save)}\nexperiment: ${JSON.stringify(state.save.experiments, null, 2)}</div>`;
}

function currencyPill(label: string, value: number) {
  return `<div class="currency-pill"><span class="small">${label}</span><strong>${value}</strong></div>`;
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

function isGameplayScreen(screen: ScreenId) {
  return screen === "level" || screen === "win" || screen === "fail";
}

function isScreenId(value: string | undefined): value is ScreenId {
  return (
    value === "map" ||
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
