import type { ChapterDefinition, RestorationNodeDefinition } from "@bubble-kingdom/shared";

function createRestorationNodes(chapterId: string): RestorationNodeDefinition[] {
  const names = [
    ["gardens", "meta.restoration.gardens"],
    ["fountain", "meta.restoration.fountain"],
    ["gates", "meta.restoration.gates"],
    ["tower", "meta.restoration.tower"],
    ["greenhouse", "meta.restoration.greenhouse"],
    ["treasury", "meta.restoration.treasury"],
  ] as const;

  return names.map(([suffix, key], index) => ({
    id: `${chapterId}_${suffix}`,
    chapterId,
    titleKey: key,
    descriptionKey: `${key}.description`,
    starCost: 4 + index * 2,
    goldCost: 150 + index * 75,
    petalsCost: index >= 4 ? 12 + index * 3 : 0,
  }));
}

export const chapters: ChapterDefinition[] = [
  {
    id: "chapter_blossom_gardens",
    titleKey: "chapter.blossom.title",
    descriptionKey: "chapter.blossom.description",
    zoneTheme: "blossom-gardens",
    unlockLevel: 1,
    levels: Array.from({ length: 50 }, (_, index) => index + 1),
    restorationNodes: createRestorationNodes("chapter_blossom_gardens"),
    chapterChest: {
      source: "chapter_chest",
      gold: 700,
      petals: 50,
      gems: 40,
      boosters: {
        bombOrb: 2,
        rainbowOrb: 2,
      },
      labelKey: "reward.chapterChest",
    },
  },
  {
    id: "chapter_moonlit_courtyard",
    titleKey: "chapter.moonlit.title",
    descriptionKey: "chapter.moonlit.description",
    zoneTheme: "moonlit-courtyard",
    unlockLevel: 51,
    levels: Array.from({ length: 50 }, (_, index) => index + 51),
    restorationNodes: createRestorationNodes("chapter_moonlit_courtyard"),
    chapterChest: {
      source: "chapter_chest",
      gold: 1100,
      petals: 90,
      gems: 70,
      seasonalTokens: 40,
      boosters: {
        bombOrb: 3,
        rainbowOrb: 3,
        precisionAim: 2,
      },
      labelKey: "reward.chapterChestGrand",
    },
  },
];
