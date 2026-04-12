import type { EventMilestoneDefinition, LiveEventDefinition } from "@bubble-kingdom/shared";

import { applyRewardGrant } from "../economy/economy";
import type { PlayerSave } from "../save/schema";

export interface EventProgressSummary {
  event: LiveEventDefinition;
  tokens: number;
  claimedMilestoneIds: string[];
  claimedCount: number;
  claimableMilestones: EventMilestoneDefinition[];
  nextMilestone: EventMilestoneDefinition | null;
  progressPercent: number;
}

export function getEventProgressSummary(
  save: PlayerSave,
  event: LiveEventDefinition,
): EventProgressSummary {
  const claimedMilestoneIds = save.events[event.id]?.claimedMilestones ?? [];
  const claimableMilestones = event.rewardTrack.filter(
    (milestone) =>
      !claimedMilestoneIds.includes(milestone.id) && save.currencies.seasonalTokens >= milestone.tokenCost,
  );
  const nextMilestone =
    event.rewardTrack.find((milestone) => !claimedMilestoneIds.includes(milestone.id)) ?? null;
  const maxTokenCost = event.rewardTrack.at(-1)?.tokenCost ?? 0;

  return {
    event,
    tokens: save.currencies.seasonalTokens,
    claimedMilestoneIds,
    claimedCount: claimedMilestoneIds.length,
    claimableMilestones,
    nextMilestone,
    progressPercent:
      maxTokenCost > 0 ? Math.min(100, Math.round((save.currencies.seasonalTokens / maxTokenCost) * 100)) : 100,
  };
}

export function canClaimEventMilestone(
  save: PlayerSave,
  event: LiveEventDefinition,
  milestoneId: string,
): boolean {
  return getEventProgressSummary(save, event).claimableMilestones.some(
    (milestone) => milestone.id === milestoneId,
  );
}

export function claimEventMilestone(
  save: PlayerSave,
  event: LiveEventDefinition,
  milestoneId: string,
): { save: PlayerSave; milestone: EventMilestoneDefinition } {
  const milestone = event.rewardTrack.find((entry) => entry.id === milestoneId);
  if (!milestone) {
    throw new Error(`Unknown event milestone ${milestoneId}`);
  }

  if (!canClaimEventMilestone(save, event, milestoneId)) {
    throw new Error(`Event milestone ${milestoneId} is not claimable.`);
  }

  const rewarded = applyRewardGrant(save, milestone.rewards);
  const currentState = rewarded.events[event.id] ?? {
    claimedMilestones: [],
    lastViewedAt: null,
  };

  return {
    milestone,
    save: {
      ...rewarded,
      events: {
        ...rewarded.events,
        [event.id]: {
          ...currentState,
          claimedMilestones: [...currentState.claimedMilestones, milestoneId],
        },
      },
    },
  };
}
