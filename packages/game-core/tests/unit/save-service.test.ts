import { describe, expect, it } from "vitest";

import { defaultRemoteConfig } from "../../../config/src/index";
import { createLogger } from "../../../shared/src/index";
import {
  createDefaultSave,
  loadPlayerSave,
  writePlayerSave,
} from "../../src/index";

describe("save service", () => {
  it("writes and reloads save data through shared storage", async () => {
    const storage = new Map<string, string>();
    const platform = {
      auth: {
        async getIdentity() {
          return {
            anonymousId: "anon_shared",
            authenticated: false,
          };
        },
      },
      cloudSave: {
        async isAvailable() {
          return false;
        },
        async loadCloud() {
          return null;
        },
        async saveCloud() {
          return;
        },
      },
      serverTime: {
        async now() {
          return Date.parse("2026-04-08T00:00:00.000Z");
        },
      },
      storage: {
        async load(key: string) {
          return storage.get(key) ?? null;
        },
        async save(key: string, value: string) {
          storage.set(key, value);
        },
      },
    } as never;

    const logger = createLogger({
      sessionId: "save-test",
      anonymousId: "anon_shared",
      appVersion: "0.1.0-alpha",
      buildTarget: "test",
      platformTarget: "web-mock",
    });

    const save = createDefaultSave({
      anonymousId: "anon_shared",
      language: "en",
      nowIso: "2026-04-08T00:00:00.000Z",
      remoteConfig: defaultRemoteConfig,
    });
    save.progression.currentLevelId = 5;
    save.progression.lastDailyRewardAt = "2026-04-08T00:00:00.000Z";

    await writePlayerSave({
      platform,
      save,
      logger,
    });

    const loaded = await loadPlayerSave({
      platform,
      remoteConfig: defaultRemoteConfig,
      locale: "en",
      logger,
    });

    expect(loaded.progression.currentLevelId).toBe(5);
    expect(loaded.progression.lastDailyRewardAt).toBe("2026-04-08T00:00:00.000Z");
  });
});
