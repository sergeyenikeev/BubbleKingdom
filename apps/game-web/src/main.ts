import { ConsoleAnalyticsSink } from "@bubble-kingdom/analytics";
import type { AnalyticsSink } from "@bubble-kingdom/analytics";
import { createGameSession } from "@bubble-kingdom/game-core";
import {
  type AdapterRuntimeOptions,
  createMockPlatformAdapter,
  createVkPlatformAdapterStub,
  createYandexPlatformAdapter,
} from "@bubble-kingdom/platform-sdk";
import { createLogger } from "@bubble-kingdom/shared";

import { mountApp } from "./app";
import "./styles.css";

declare const __BUILD_TARGET__: string;

async function main() {
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) {
    throw new Error("App root was not found.");
  }

  const buildTarget = resolveBuildTarget(__BUILD_TARGET__);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const yandexSdkUrl = normalizeOptionalEnv(import.meta.env.VITE_YANDEX_SDK_URL);
  const debugEnabled =
    buildTarget === "local" ||
    new URLSearchParams(window.location.search).get("debug") === "1";

  const logger = createLogger(
    {
      sessionId: "client",
      anonymousId: "pending",
      appVersion: "0.1.0-alpha",
      buildTarget,
      platformTarget:
        buildTarget === "yandex" ? "yandex" : buildTarget === "vk" ? "vk" : "web-mock",
    },
    {
      minLevel: debugEnabled ? "debug" : "info",
    },
  );

  const analyticsSinks = [
    new ConsoleAnalyticsSink(),
    backendUrl ? new BackendAnalyticsSink(backendUrl) : null,
  ].filter(isAnalyticsSink);

  const adapterOptions = createAdapterOptions({
    buildTarget,
    platformTarget:
      buildTarget === "yandex" ? "yandex" : buildTarget === "vk" ? "vk" : "web-mock",
    backendUrl,
    yandexSdkUrl,
    debug: debugEnabled,
    analyticsSinks,
    logger,
  });

  const platform =
    buildTarget === "yandex"
      ? createYandexPlatformAdapter(adapterOptions)
      : buildTarget === "vk"
        ? createVkPlatformAdapterStub(adapterOptions)
        : createMockPlatformAdapter(adapterOptions);

  const session = createGameSession({
    platform,
    logger,
    buildTarget,
  });

  mountApp(app, session, debugEnabled);
  preventBrowserGestures();
  hookVisibility(session);
  await session.boot();
}

class BackendAnalyticsSink {
  constructor(private readonly backendUrl: string) {}

  async track(event: unknown) {
    await fetch(`${this.backendUrl}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(event),
    }).catch(() => undefined);
  }
}

function isAnalyticsSink(value: AnalyticsSink | null): value is AnalyticsSink {
  return value !== null;
}

function createAdapterOptions(
  input: AdapterRuntimeOptions,
): AdapterRuntimeOptions {
  const options: AdapterRuntimeOptions = {
    buildTarget: input.buildTarget,
    platformTarget: input.platformTarget,
    debug: input.debug,
    analyticsSinks: input.analyticsSinks,
    logger: input.logger,
  };
  if (input.backendUrl) {
    options.backendUrl = input.backendUrl;
  }
  if (input.yandexSdkUrl) {
    options.yandexSdkUrl = input.yandexSdkUrl;
  }
  return options;
}

function resolveBuildTarget(value: string): "local" | "yandex" | "vk" | "test" {
  if (value === "yandex" || value === "vk" || value === "test") {
    return value;
  }
  return "local";
}

function normalizeOptionalEnv(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function preventBrowserGestures() {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener(
    "touchmove",
    (event) => {
      if ((event.target as HTMLElement).closest(".panel, .modal-card")) {
        return;
      }
      event.preventDefault();
    },
    { passive: false },
  );
}

function hookVisibility(session: Awaited<ReturnType<typeof createGameSession>>) {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && session.getState().currentScreen === "level") {
      void session.openScreen("settings");
    }
  });
}

void main().catch((error) => {
  console.error(error);
  const root = document.querySelector<HTMLElement>("#app");
  if (root) {
    root.innerHTML = `<div style="padding:24px;color:white;font-family:Trebuchet MS,sans-serif">Bubble Kingdom failed to boot.<br/>${
      error instanceof Error ? error.message : String(error)
    }</div>`;
  }
});
