import { safeJsonParse, type Logger } from "@bubble-kingdom/shared";
import type { RemoteConfig } from "@bubble-kingdom/config";
import type { PlatformAdapter } from "@bubble-kingdom/platform-sdk";

import { migrateSave } from "./migrations";
import { createDefaultSave, SAVE_SCHEMA_VERSION, type PlayerSave } from "./schema";

const SAVE_KEY = "save";
const CLOUD_SAVE_KEY = "cloud-save";

export interface LoadPlayerSaveResult {
  save: PlayerSave;
  source: "default" | "local" | "cloud";
  previousSessionAt: string | null;
  recovered: boolean;
  migrationApplied: boolean;
  previousSchemaVersion: number | null;
}

export async function loadPlayerSave(input: {
  platform: PlatformAdapter;
  remoteConfig: RemoteConfig;
  locale: "ru" | "en";
  logger: Logger;
}): Promise<LoadPlayerSaveResult> {
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
  const source = rawCloud ? "cloud" : rawLocal ? "local" : "default";
  if (!raw) {
    input.logger.info("SAVE", "No save found, creating default profile");
    return {
      save: fallback,
      source,
      previousSessionAt: null,
      recovered: false,
      migrationApplied: false,
      previousSchemaVersion: null,
    };
  }

  const parsed = safeJsonParse<unknown>(raw);
  if (!parsed) {
    input.logger.warn("SAVE", "Save was corrupted, fallback applied");
    return {
      save: fallback,
      source: "default",
      previousSessionAt: null,
      recovered: true,
      migrationApplied: false,
      previousSchemaVersion: null,
    };
  }

  try {
    const candidate = parsed as Partial<PlayerSave> & {
      schemaVersion?: number;
      profile?: { lastSessionAt?: string };
    };
    const previousSchemaVersion = candidate.schemaVersion ?? 1;
    const previousSessionAt = candidate.profile?.lastSessionAt ?? null;
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
      save: {
        ...migrated,
        profile,
      },
      source,
      previousSessionAt,
      recovered: false,
      migrationApplied: previousSchemaVersion < SAVE_SCHEMA_VERSION,
      previousSchemaVersion,
    };
  } catch (error) {
    input.logger.error("SAVE", "Save migration failed, fallback applied", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      save: fallback,
      source: "default",
      previousSessionAt: null,
      recovered: true,
      migrationApplied: false,
      previousSchemaVersion: null,
    };
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
