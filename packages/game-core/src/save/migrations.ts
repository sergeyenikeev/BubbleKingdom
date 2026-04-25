import { playerSaveSchema, SAVE_SCHEMA_VERSION, type PlayerSave } from "./schema";

export function migrateSave(raw: unknown): PlayerSave {
  const candidate = raw as Partial<PlayerSave> & { schemaVersion?: number };
  const version = candidate.schemaVersion ?? 1;

  let migrated = candidate;
  if (version < 2) {
    migrated = migrateV1ToV2(migrated);
  }
  if ((migrated.schemaVersion ?? 0) < 3) {
    migrated = migrateV2ToV3(migrated);
  }
  if ((migrated.schemaVersion ?? 0) < 4) {
    migrated = migrateV3ToV4(migrated);
  }
  if ((migrated.schemaVersion ?? 0) < 5) {
    migrated = migrateV4ToV5(migrated);
  }

  return playerSaveSchema.parse({
    ...migrated,
    schemaVersion: SAVE_SCHEMA_VERSION,
  });
}

function migrateV1ToV2(raw: Partial<PlayerSave>) {
  return {
    ...raw,
    schemaVersion: 2,
    economy: raw.economy ?? {
      noAdsPurchased: false,
      adLightPurchased: false,
      piggyBankGold: 0,
      firstPurchaseAt: null,
      rewardedViews: 0,
    },
  };
}

function migrateV2ToV3(raw: Partial<PlayerSave>) {
  return {
    ...raw,
    schemaVersion: 3,
    tutorial: raw.tutorial ?? {
      completed: false,
      currentStep: "aim",
      seenSteps: [],
    },
    experiments: raw.experiments ?? {},
  };
}

function migrateV3ToV4(raw: Partial<PlayerSave>) {
  return {
    ...raw,
    schemaVersion: 4,
    events: raw.events ?? {},
  };
}

function migrateV4ToV5(raw: Partial<PlayerSave>) {
  const completedLevels = raw.progression?.completedLevels ?? [];
  const inferredHasStartedLevel =
    completedLevels.length > 0 || (raw.progression?.currentLevelId ?? 1) > 1;
  const hasStartedLevel = raw.engagement?.hasStartedLevel ?? inferredHasStartedLevel;
  const firstCompletedAt =
    raw.engagement?.firstLevelCompletedAt ??
    (completedLevels.length > 0 ? raw.profile?.lastSessionAt ?? null : null);

  return {
    ...raw,
    schemaVersion: 5,
    engagement: raw.engagement ?? {
      sessionCount: 0,
      hasStartedLevel,
      firstLevelStartedAt: hasStartedLevel ? raw.profile?.lastSessionAt ?? null : null,
      firstLevelCompletedAt: firstCompletedAt,
      firstLevelFailedAt: null,
      storeIntroSeen: false,
    },
    cosmetics: raw.cosmetics ?? {
      activeThemeId: "theme_blossom_gardens",
      unlockedThemeIds: ["theme_blossom_gardens"],
    },
  };
}
