export type BuildTarget = "local" | "yandex" | "vk" | "test";

export type PlatformTarget = "web-mock" | "yandex" | "vk";

export type LanguageCode = "ru" | "en";

export type CurrencyId = "gold" | "petals" | "gems" | "seasonalTokens";

export type BoosterId =
  | "extraMoves"
  | "rainbowOrb"
  | "bombOrb"
  | "precisionAim"
  | "undoShot";

export type BubbleColor =
  | "ruby"
  | "sapphire"
  | "emerald"
  | "sun"
  | "amethyst"
  | "aqua";

export type BubbleKind =
  | "normal"
  | "rainbow"
  | "bomb"
  | "line"
  | "stone"
  | "ice"
  | "vine"
  | "fog"
  | "crystal"
  | "pet"
  | "flower"
  | "artifact";

export type ObjectiveType =
  | "clear_all"
  | "free_sprites"
  | "collect_crystals"
  | "break_blockers"
  | "clear_fog"
  | "grow_flowers"
  | "drop_artifacts";

export type RewardSource =
  | "level_complete"
  | "daily_reward"
  | "quest"
  | "chapter_chest"
  | "event"
  | "purchase"
  | "comeback";

export interface BubbleCell {
  id: string;
  kind: BubbleKind;
  color: BubbleColor | "wild" | null;
  hitsRemaining?: number;
  chainStrength?: number;
  hiddenUnderFog?: boolean;
  payload?: "crystal" | "pet" | "flower" | "artifact";
}

export interface BubblePosition {
  row: number;
  col: number;
}

export interface LevelObjectiveDefinition {
  type: ObjectiveType;
  target?: number;
}

export interface LevelRewards {
  gold: number;
  petals: number;
  seasonalTokens: number;
}

export interface LevelDefinition {
  id: number;
  chapterId: string;
  indexInChapter: number;
  moves: number;
  palette: BubbleColor[];
  objective: LevelObjectiveDefinition;
  layout: string[];
  queue: Array<BubbleColor | "rainbow" | "bomb" | "line">;
  rewards: LevelRewards;
  difficulty: "easy" | "medium" | "hard";
}

export interface RestorationNodeDefinition {
  id: string;
  chapterId: string;
  titleKey: string;
  descriptionKey: string;
  starCost: number;
  goldCost: number;
  petalsCost: number;
}

export interface ChapterDefinition {
  id: string;
  titleKey: string;
  descriptionKey: string;
  zoneTheme: string;
  unlockLevel: number;
  levels: number[];
  restorationNodes: RestorationNodeDefinition[];
  chapterChest: RewardGrant;
}

export interface RewardGrant {
  source: RewardSource;
  gold?: number;
  petals?: number;
  gems?: number;
  seasonalTokens?: number;
  boosters?: Partial<Record<BoosterId, number>>;
  stars?: number;
  labelKey?: string;
}

export interface DailyRewardStep {
  day: number;
  rewards: RewardGrant;
}

export interface QuestDefinition {
  id: string;
  cadence: "daily" | "weekly";
  titleKey: string;
  descriptionKey: string;
  target: number;
  metric:
    | "levels_complete"
    | "levels_win_streak"
    | "gold_earned"
    | "rewarded_watch"
    | "restoration_completed"
    | "stars_earned";
  rewards: RewardGrant;
}

export interface ShopOfferDefinition {
  id: string;
  sku: string;
  titleKey: string;
  descriptionKey: string;
  type:
    | "starter_pack"
    | "welcome_offer"
    | "gem_pack"
    | "booster_pack"
    | "renovation_pack"
    | "piggy_bank"
    | "no_ads"
    | "season_pass";
  price:
    | {
        soft?: number;
        hard?: number;
      }
    | {
        platformPriceId: string;
      };
  rewards: RewardGrant;
  badgeKey?: string;
  yandexProductId?: string;
}

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  score: number;
  rank: number;
}

export interface RewardInboxItem extends RewardGrant {
  id: string;
  claimed: boolean;
  createdAt: string;
}

export interface SessionInfo {
  sessionId: string;
  anonymousId: string;
  userId?: string;
  appVersion: string;
  buildTarget: BuildTarget;
  platformTarget: PlatformTarget;
}
