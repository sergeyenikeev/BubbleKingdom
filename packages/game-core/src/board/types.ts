import type {
  BubbleCell,
  BubbleColor,
  BubblePosition,
  LevelDefinition,
  ObjectiveType,
} from "@bubble-kingdom/shared";

export interface BoardState {
  rows: number;
  cols: number;
  cells: Array<Array<BubbleCell | null>>;
  movesRemaining: number;
  queue: LevelDefinition["queue"];
  score: number;
  combo: number;
  turn: number;
  objectiveProgress: Partial<Record<ObjectiveType, number>>;
  starsEarned: number;
  status: "active" | "won" | "failed";
  history: BoardSnapshot[];
}

export interface BoardSnapshot {
  cells: Array<Array<BubbleCell | null>>;
  movesRemaining: number;
  queue: LevelDefinition["queue"];
  score: number;
  combo: number;
  turn: number;
  objectiveProgress: Partial<Record<ObjectiveType, number>>;
  starsEarned: number;
  status: BoardState["status"];
}

export interface ShotPathPoint {
  x: number;
  y: number;
}

export interface ShotTrace {
  path: ShotPathPoint[];
  attachPosition: BubblePosition;
  bounces: number;
}

export interface ResolutionSummary {
  popped: BubblePosition[];
  dropped: BubblePosition[];
  damaged: BubblePosition[];
  revealed: BubblePosition[];
  attached?: BubblePosition;
  scoreGained: number;
  combo: number;
  objectiveIncrements: Partial<Record<ObjectiveType, number>>;
  winAchieved: boolean;
  failAchieved: boolean;
}

export interface AimGeometry {
  radius: number;
  horizontalStep: number;
  verticalStep: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
}

export interface QueueBubbleSpec {
  kind: BubbleCell["kind"];
  color: BubbleColor | "wild" | null;
}
