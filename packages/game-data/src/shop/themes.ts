import type { VisualThemeDefinition } from "@bubble-kingdom/shared";

export const visualThemes: VisualThemeDefinition[] = [
  {
    id: "theme_blossom_gardens",
    titleKey: "theme.blossom.title",
    descriptionKey: "theme.blossom.description",
    previewClass: "theme-preview-blossom",
    price: {
      gems: 0,
    },
    unlock: {
      type: "always",
    },
  },
  {
    id: "theme_crystal_fountain",
    titleKey: "theme.crystalFountain.title",
    descriptionKey: "theme.crystalFountain.description",
    previewClass: "theme-preview-crystal",
    price: {
      gems: 25,
    },
    unlock: {
      type: "always",
    },
  },
  {
    id: "theme_castle_gates",
    titleKey: "theme.castleGates.title",
    descriptionKey: "theme.castleGates.description",
    previewClass: "theme-preview-gates",
    price: {
      gems: 40,
    },
    unlock: {
      type: "completed_levels",
      count: 3,
    },
  },
  {
    id: "theme_spring_blossom",
    titleKey: "theme.springBlossom.title",
    descriptionKey: "theme.springBlossom.description",
    previewClass: "theme-preview-spring",
    price: {
      gems: 55,
    },
    unlock: {
      type: "seasonal_tokens",
      amount: 25,
    },
  },
  {
    id: "theme_moonlit_courtyard",
    titleKey: "theme.moonlit.title",
    descriptionKey: "theme.moonlit.description",
    previewClass: "theme-preview-moonlit",
    price: {
      gems: 80,
    },
    unlock: {
      type: "current_level",
      levelId: 51,
    },
  },
];
