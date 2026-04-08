import { safeJsonParse, type Logger } from "@bubble-kingdom/shared";
import type { RemoteConfig } from "@bubble-kingdom/config";
import type { PlatformAdapter } from "@bubble-kingdom/platform-sdk";

import { migrateSave } from "./migrations";
import { createDefaultSave, type PlayerSave } from "./schema";

const SAVE_KEY = "save";
const CLOUD_SAVE_KEY = "cloud-save";

export async function loadPlayerSave(input: {
  platform: PlatformAdapter;
  remoteConfig: RemoteConfig;
  locale: "ru" | "en";
  logger: Logger;
}): Promise<PlayerSave> {
  const nowIso = new Date(await input.platform.serverTime.now()).toISOString();
  const identity = await input.platform.auth.getIdentity();
  const fallbackInput: Parameters<typeof createDefaultSave>[0] = {
    anonymousId: identity.anonymousId,
    language: input.locale,
    nowIso,
    remoteConfig: input.remoteConfig,
  };
  if (identity.userId) {
    fallbackInput.userId = identity.userId;
  }
  const fallback = createDefaultSave(fallbackInput);

  const rawLocal = await input.platform.storage.load(SAVE_KEY);
  const rawCloud = (await input.platform.cloudSave.isAvailable())
    ? await input.platform.cloudSave.loadCloud(CLOUD_SAVE_KEY)
    : null;

  const raw = rawCloud ?? rawLocal;
  if (!raw) {
    input.logger.info("SAVE", "No save found, creating default profile");
    return fallback;
  }

  const parsed = safeJsonParse<unknown>(raw);
  if (!parsed) {
    input.logger.warn("SAVE", "Save was corrupted, fallback applied");
    return fallback;
  }

  try {
    const migrated = migrateSave(parsed);
    const profile: PlayerSave["profile"] = {
      ...migrated.profile,
      anonymousId: identity.anonymousId,
      lastSessionAt: nowIso,
    };
    const resolvedUserId = identity.userId ?? migrated.profile.userId;
    if (resolvedUserId) {
      profile.userId = resolvedUserId;
    }
    return {
      ...migrated,
      profile,
    };
  } catch (error) {
    input.logger.error("SAVE", "Save migration failed, fallback applied", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

export async function writePlayerSave(input: {
  platform: PlatformAdapter;
  save: PlayerSave;
  logger: Logger;
}): Promise<void> {
  const payload = JSON.stringify(input.save);
  await input.platform.storage.save(SAVE_KEY, payload);

  if (await input.platform.cloudSave.isAvailable()) {
    await input.platform.cloudSave.saveCloud(CLOUD_SAVE_KEY, payload).catch((error) => {
      input.logger.warn("SAVE", "Cloud save write failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
