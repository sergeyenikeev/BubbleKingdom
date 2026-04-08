import type { RemoteConfig } from "@bubble-kingdom/config";

import type { PlayerSave } from "../save/schema";

export function getNextTutorialStep(save: PlayerSave, remoteConfig: RemoteConfig): string | null {
  if (!remoteConfig.tutorial.enabled || save.tutorial.completed) {
    return null;
  }

  return (
    remoteConfig.tutorial.steps.find((step) => !save.tutorial.seenSteps.includes(step)) ?? null
  );
}

export function markTutorialStepSeen(save: PlayerSave, step: string): PlayerSave {
  const seenSteps = save.tutorial.seenSteps.includes(step)
    ? save.tutorial.seenSteps
    : [...save.tutorial.seenSteps, step];
  return {
    ...save,
    tutorial: {
      ...save.tutorial,
      currentStep: seenSteps.at(-1) ?? null,
      seenSteps,
      completed: seenSteps.length >= 5,
    },
  };
}
