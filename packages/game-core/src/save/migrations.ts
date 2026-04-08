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
