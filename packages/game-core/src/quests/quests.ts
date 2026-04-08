import type { QuestDefinition } from "@bubble-kingdom/shared";

import { applyRewardGrant } from "../economy/economy";
import type { PlayerSave } from "../save/schema";

export type QuestMetricUpdate = Partial<Record<QuestDefinition["metric"], number>>;

export function initializeQuestProgress(
  save: PlayerSave,
  definitions: QuestDefinition[],
  nowIso: string,
): PlayerSave {
  const quests = { ...save.quests };
  for (const definition of definitions) {
    quests[definition.id] ??= {
      progress: 0,
      claimed: false,
      cadence: definition.cadence,
      lastUpdatedAt: nowIso,
    };
  }
  return {
    ...save,
    quests,
  };
}

export function applyQuestProgress(
  save: PlayerSave,
  definitions: QuestDefinition[],
  update: QuestMetricUpdate,
  nowIso: string,
): PlayerSave {
  const quests = { ...save.quests };
  for (const definition of definitions) {
    const entry = quests[definition.id];
    if (!entry || entry.claimed) {
      continue;
    }
    const delta = update[definition.metric] ?? 0;
    if (delta <= 0) {
      continue;
    }

    quests[definition.id] = {
      ...entry,
      progress: Math.min(definition.target, entry.progress + delta),
      lastUpdatedAt: nowIso,
    };
  }

  return {
    ...save,
    quests,
  };
}

export function claimQuestReward(
  save: PlayerSave,
  definitions: QuestDefinition[],
  questId: string,
): { save: PlayerSave; quest: QuestDefinition } {
  const definition = definitions.find((item) => item.id === questId);
  if (!definition) {
    throw new Error(`Unknown quest ${questId}`);
  }

  const entry = save.quests[questId];
  if (!entry || entry.claimed || entry.progress < definition.target) {
    throw new Error(`Quest ${questId} is not claimable.`);
  }

  const updated = applyRewardGrant(save, definition.rewards);
  return {
    quest: definition,
    save: {
      ...updated,
      quests: {
        ...updated.quests,
        [questId]: {
          ...entry,
          claimed: true,
        },
      },
    },
  };
}
