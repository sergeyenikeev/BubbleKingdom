import type { LiveEventDefinition } from "@bubble-kingdom/shared";

export const liveEvents: LiveEventDefinition[] = [
  {
    id: "spring_blossom",
    titleKey: "event.spring_blossom.title",
    subtitleKey: "event.spring_blossom.subtitle",
    descriptionKey: "event.spring_blossom.description",
    rewardTrack: [
      {
        id: "spring_blossom_seed_satchel",
        titleKey: "event.spring_blossom.milestone.seedSatchel.title",
        descriptionKey: "event.spring_blossom.milestone.seedSatchel.description",
        tokenCost: 25,
        rewards: {
          source: "event",
          gold: 220,
          petals: 12,
          labelKey: "event.spring_blossom.milestone.seedSatchel.title",
        },
      },
      {
        id: "spring_blossom_blossom_boost",
        titleKey: "event.spring_blossom.milestone.blossomBoost.title",
        descriptionKey: "event.spring_blossom.milestone.blossomBoost.description",
        tokenCost: 60,
        rewards: {
          source: "event",
          gems: 10,
          boosters: {
            precisionAim: 1,
            rainbowOrb: 1,
          },
          labelKey: "event.spring_blossom.milestone.blossomBoost.title",
        },
      },
      {
        id: "spring_blossom_garden_crate",
        titleKey: "event.spring_blossom.milestone.gardenCrate.title",
        descriptionKey: "event.spring_blossom.milestone.gardenCrate.description",
        tokenCost: 110,
        rewards: {
          source: "event",
          gold: 420,
          petals: 28,
          boosters: {
            bombOrb: 1,
          },
          labelKey: "event.spring_blossom.milestone.gardenCrate.title",
        },
      },
      {
        id: "spring_blossom_royal_bloom",
        titleKey: "event.spring_blossom.milestone.royalBloom.title",
        descriptionKey: "event.spring_blossom.milestone.royalBloom.description",
        tokenCost: 180,
        rewards: {
          source: "event",
          gold: 650,
          petals: 45,
          gems: 18,
          boosters: {
            bombOrb: 2,
            rainbowOrb: 1,
          },
          labelKey: "event.spring_blossom.milestone.royalBloom.title",
        },
      },
    ],
  },
];
