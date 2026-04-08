import type {
  BubbleCell,
  BubbleColor,
  BubblePosition,
  LevelDefinition,
  ObjectiveType,
} from "@bubble-kingdom/shared";

import {
  dequeueBubble,
  getCell,
  getNeighbors,
  incrementObjective,
  isInsideBoard,
  isMatchable,
  isObjectiveComplete,
  pushHistory,
  restoreSnapshot,
  setCell,
} from "./board";
import { predictShotTrace } from "./shot";
import type { BoardState, QueueBubbleSpec, ResolutionSummary } from "./types";

export function performShot(
  board: BoardState,
  level: LevelDefinition,
  angleRadians: number,
): ResolutionSummary {
  pushHistory(board);

  const shot = dequeueBubble(board, level.palette);
  const trace = predictShotTrace(board, angleRadians);
  const attachedCell: BubbleCell = {
    id: `shot_${board.turn}_${trace.attachPosition.row}_${trace.attachPosition.col}`,
    kind: shot.kind,
    color: shot.color,
  };

  setCell(board, trace.attachPosition, attachedCell);
  board.turn += 1;
  board.movesRemaining -= 1;

  const summary = resolveBoard(board, level, trace.attachPosition, shot);
  summary.attached = trace.attachPosition;

  if (summary.winAchieved) {
    board.status = "won";
  } else if (summary.failAchieved) {
    board.status = "failed";
  }

  return summary;
}

export function undoLastShot(board: BoardState): boolean {
  const snapshot = board.history.pop();
  if (!snapshot) {
    return false;
  }

  restoreSnapshot(board, snapshot);
  return true;
}

function resolveBoard(
  board: BoardState,
  level: LevelDefinition,
  attachPosition: BubblePosition,
  shot: QueueBubbleSpec,
): ResolutionSummary {
  const popped = new Set<string>();
  const dropped = new Set<string>();
  const damaged = new Set<string>();
  const revealed = new Set<string>();
  const objectiveIncrements: Partial<Record<ObjectiveType, number>> = {};

  if (shot.kind === "bomb") {
    collectArea(board, attachPosition, 1).forEach((position) => popped.add(key(position)));
  } else if (shot.kind === "line") {
    for (let row = 0; row < board.rows; row += 1) {
      popped.add(key({ row, col: attachPosition.col }));
    }
    for (let col = 0; col < board.cols; col += 1) {
      popped.add(key({ row: attachPosition.row, col }));
    }
  } else {
    const cluster = findMatchCluster(board, attachPosition);
    if (cluster.length >= 3) {
      cluster.forEach((position) => popped.add(key(position)));
    }
  }

  const poppedPositions = [...popped].map(fromKey);
  applyPops(board, poppedPositions, objectiveIncrements);

  const propagated = propagateAdjacentEffects(board, poppedPositions, revealed, damaged, objectiveIncrements);
  propagated.forEach((position) => popped.add(key(position)));
  applyPops(board, propagated, objectiveIncrements);

  const droppedPositions = dropDisconnected(board);
  for (const position of droppedPositions) {
    dropped.add(key(position));
    registerObjective(board, position, objectiveIncrements);
  }

  board.combo = popped.size > 0 || dropped.size > 0 ? board.combo + 1 : 0;
  const scoreGained = popped.size * 35 + dropped.size * 50 + board.combo * 25;
  board.score += scoreGained;
  board.starsEarned = calculateStars(board, level);

  for (const [objective, amount] of Object.entries(objectiveIncrements)) {
    incrementObjective(board, objective as ObjectiveType, amount ?? 0);
  }

  const winAchieved = isObjectiveComplete(board, level.objective);
  const failAchieved = !winAchieved && board.movesRemaining <= 0;

  return {
    popped: poppedPositions,
    dropped: droppedPositions,
    damaged: [...damaged].map(fromKey),
    revealed: [...revealed].map(fromKey),
    scoreGained,
    combo: board.combo,
    objectiveIncrements,
    winAchieved,
    failAchieved,
  };
}

function collectArea(board: BoardState, center: BubblePosition, radius: number): BubblePosition[] {
  const positions: BubblePosition[] = [];
  for (let row = center.row - radius; row <= center.row + radius; row += 1) {
    for (let col = center.col - radius; col <= center.col + radius; col += 1) {
      const candidate = { row, col };
      if (isInsideBoard(board, candidate) && getCell(board, candidate)) {
        positions.push(candidate);
      }
    }
  }
  return positions;
}

function findMatchCluster(board: BoardState, start: BubblePosition): BubblePosition[] {
  const startCell = getCell(board, start);
  if (!isMatchable(startCell)) {
    return [];
  }

  const targetColors = determineTargetColors(board, startCell as BubbleCell, start);
  const cluster: BubblePosition[] = [];
  const queue: BubblePosition[] = [start];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = key(current);
    if (visited.has(currentKey)) {
      continue;
    }
    visited.add(currentKey);

    const cell = getCell(board, current);
    if (!matchesCluster(cell, targetColors)) {
      continue;
    }

    cluster.push(current);
    for (const neighbor of getNeighbors(board, current)) {
      queue.push(neighbor);
    }
  }

  return cluster;
}

function determineTargetColors(
  board: BoardState,
  startCell: BubbleCell,
  start: BubblePosition,
): Set<BubbleColor> {
  if (startCell.color && startCell.color !== "wild") {
    return new Set([startCell.color]);
  }

  const colors = new Set<BubbleColor>();
  for (const neighbor of getNeighbors(board, start)) {
    const cell = getCell(board, neighbor);
    if (cell?.color && cell.color !== "wild") {
      colors.add(cell.color);
    }
  }

  return colors.size > 0 ? colors : new Set(["ruby"]);
}

function matchesCluster(cell: BubbleCell | null, colors: Set<BubbleColor>): boolean {
  if (!cell || !isMatchable(cell)) {
    return false;
  }

  if (cell.kind === "artifact") {
    return false;
  }

  return cell.color === "wild" || (cell.color !== null && colors.has(cell.color));
}

function applyPops(
  board: BoardState,
  positions: BubblePosition[],
  objectiveIncrements: Partial<Record<ObjectiveType, number>>,
): void {
  for (const position of positions) {
    registerObjective(board, position, objectiveIncrements);
    setCell(board, position, null);
  }
}

function propagateAdjacentEffects(
  board: BoardState,
  popped: BubblePosition[],
  revealed: Set<string>,
  damaged: Set<string>,
  objectiveIncrements: Partial<Record<ObjectiveType, number>>,
): BubblePosition[] {
  const causedPops: BubblePosition[] = [];

  for (const position of popped) {
    for (const neighbor of getNeighbors(board, position)) {
      const cell = getCell(board, neighbor);
      if (!cell) {
        continue;
      }

      switch (cell.kind) {
        case "ice":
          cell.hitsRemaining = Math.max(0, (cell.hitsRemaining ?? 1) - 1);
          damaged.add(key(neighbor));
          if ((cell.hitsRemaining ?? 0) <= 0) {
            cell.kind = "normal";
          }
          break;
        case "vine":
          cell.chainStrength = Math.max(0, (cell.chainStrength ?? 1) - 1);
          damaged.add(key(neighbor));
          if ((cell.chainStrength ?? 0) <= 0) {
            cell.kind = "normal";
          }
          break;
        case "fog":
          cell.kind = "normal";
          cell.hiddenUnderFog = false;
          revealed.add(key(neighbor));
          objectiveIncrements.clear_fog = (objectiveIncrements.clear_fog ?? 0) + 1;
          break;
        case "flower":
          causedPops.push(neighbor);
          objectiveIncrements.grow_flowers = (objectiveIncrements.grow_flowers ?? 0) + 1;
          break;
        default:
          break;
      }
    }
  }

  return causedPops;
}

function dropDisconnected(board: BoardState): BubblePosition[] {
  const connected = new Set<string>();
  const queue: BubblePosition[] = [];

  for (let col = 0; col < board.cols; col += 1) {
    const position = { row: 0, col };
    if (getCell(board, position)) {
      queue.push(position);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = key(current);
    if (connected.has(currentKey)) {
      continue;
    }
    connected.add(currentKey);

    for (const neighbor of getNeighbors(board, current)) {
      if (getCell(board, neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  const dropped: BubblePosition[] = [];
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const position = { row, col };
      if (getCell(board, position) && !connected.has(key(position))) {
        dropped.push(position);
        setCell(board, position, null);
      }
    }
  }

  return dropped;
}

function registerObjective(
  board: BoardState,
  position: BubblePosition,
  objectiveIncrements: Partial<Record<ObjectiveType, number>>,
): void {
  const cell = getCell(board, position);
  if (!cell) {
    return;
  }

  switch (cell.kind) {
    case "crystal":
      objectiveIncrements.collect_crystals = (objectiveIncrements.collect_crystals ?? 0) + 1;
      break;
    case "pet":
      objectiveIncrements.free_sprites = (objectiveIncrements.free_sprites ?? 0) + 1;
      break;
    case "stone":
    case "ice":
    case "vine":
      objectiveIncrements.break_blockers = (objectiveIncrements.break_blockers ?? 0) + 1;
      break;
    case "artifact":
      objectiveIncrements.drop_artifacts = (objectiveIncrements.drop_artifacts ?? 0) + 1;
      break;
    default:
      break;
  }
}

function calculateStars(board: BoardState, level: LevelDefinition): number {
  if (board.status === "failed") {
    return 0;
  }

  const moveRatio = board.movesRemaining / Math.max(level.moves, 1);
  if (moveRatio >= 0.45) {
    return 3;
  }
  if (moveRatio >= 0.18) {
    return 2;
  }
  return 1;
}

function key(position: BubblePosition): string {
  return `${position.row}:${position.col}`;
}

function fromKey(value: string): BubblePosition {
  const [row, col] = value.split(":").map(Number);
  return { row: row ?? 0, col: col ?? 0 };
}
