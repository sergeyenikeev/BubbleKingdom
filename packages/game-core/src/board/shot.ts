import type { BubblePosition } from "@bubble-kingdom/shared";

import { getCell, getNeighbors } from "./board";
import type { AimGeometry, BoardState, ShotPathPoint, ShotTrace } from "./types";

const TRACE_STEP = 0.08;

export function createAimGeometry(board: BoardState): AimGeometry {
  const radius = 1;
  const horizontalStep = radius * 2;
  const verticalStep = Math.sqrt(3) * radius;
  const width = board.cols * horizontalStep + radius;
  const height = board.rows * verticalStep + radius;
  return {
    radius,
    horizontalStep,
    verticalStep,
    width,
    height,
    originX: width / 2,
    originY: height + radius * 4,
  };
}

export function positionToPoint(geometry: AimGeometry, position: BubblePosition): ShotPathPoint {
  const rowOffset = position.row % 2 === 0 ? geometry.radius : geometry.radius * 2;
  return {
    x: rowOffset + position.col * geometry.horizontalStep,
    y: geometry.radius + position.row * geometry.verticalStep,
  };
}

export function predictShotTrace(board: BoardState, angleRadians: number): ShotTrace {
  const geometry = createAimGeometry(board);
  const path: ShotPathPoint[] = [{ x: geometry.originX, y: geometry.originY }];
  let x = geometry.originX;
  let y = geometry.originY;
  let dx = Math.cos(angleRadians);
  let dy = -Math.abs(Math.sin(angleRadians));
  let bounces = 0;

  if (Math.abs(dx) < 0.0001 && dy === 0) {
    dx = 0;
    dy = -1;
  }

  for (let iteration = 0; iteration < 5000; iteration += 1) {
    x += dx * TRACE_STEP;
    y += dy * TRACE_STEP;

    if (x <= geometry.radius) {
      x = geometry.radius + (geometry.radius - x);
      dx *= -1;
      bounces += 1;
      path.push({ x, y });
    }

    if (x >= geometry.width - geometry.radius) {
      x = geometry.width - geometry.radius - (x - (geometry.width - geometry.radius));
      dx *= -1;
      bounces += 1;
      path.push({ x, y });
    }

    if (y <= geometry.radius) {
      const attachPosition = pickTopCell(board, geometry, x);
      path.push(positionToPoint(geometry, attachPosition));
      return {
        path,
        attachPosition,
        bounces,
      };
    }

    const collision = findCollision(board, geometry, { x, y });
    if (collision) {
      const attachPosition = findAttachPosition(board, collision, geometry, { x, y });
      path.push(positionToPoint(geometry, attachPosition));
      return {
        path,
        attachPosition,
        bounces,
      };
    }
  }

  const fallback = pickTopCell(board, geometry, x);
  path.push(positionToPoint(geometry, fallback));
  return {
    path,
    attachPosition: fallback,
    bounces,
  };
}

function findCollision(
  board: BoardState,
  geometry: AimGeometry,
  point: ShotPathPoint,
): BubblePosition | null {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const position = { row, col };
      const cell = getCell(board, position);
      if (!cell) {
        continue;
      }
      const center = positionToPoint(geometry, position);
      const distance = Math.hypot(center.x - point.x, center.y - point.y);
      if (distance <= geometry.radius * 1.85) {
        return position;
      }
    }
  }
  return null;
}

function findAttachPosition(
  board: BoardState,
  collision: BubblePosition,
  geometry: AimGeometry,
  point: ShotPathPoint,
): BubblePosition {
  const candidates = getNeighbors(board, collision).filter((neighbor) => getCell(board, neighbor) === null);
  if (candidates.length === 0) {
    return pickNearestEmptyCell(board, geometry, point);
  }

  candidates.sort((left, right) => {
    const leftCenter = positionToPoint(geometry, left);
    const rightCenter = positionToPoint(geometry, right);
    return (
      Math.hypot(leftCenter.x - point.x, leftCenter.y - point.y) -
      Math.hypot(rightCenter.x - point.x, rightCenter.y - point.y)
    );
  });

  return candidates[0]!;
}

function pickTopCell(board: BoardState, geometry: AimGeometry, x: number): BubblePosition {
  const candidates: BubblePosition[] = [];
  for (let col = 0; col < board.cols; col += 1) {
    const candidate = { row: 0, col };
    if (getCell(board, candidate) === null) {
      candidates.push(candidate);
    }
  }
  if (candidates.length === 0) {
    return pickNearestEmptyCell(board, geometry, { x, y: geometry.radius });
  }

  candidates.sort((left, right) => {
    const leftCenter = positionToPoint(geometry, left);
    const rightCenter = positionToPoint(geometry, right);
    return Math.abs(leftCenter.x - x) - Math.abs(rightCenter.x - x);
  });
  return candidates[0]!;
}

function pickNearestEmptyCell(
  board: BoardState,
  geometry: AimGeometry,
  point: ShotPathPoint,
): BubblePosition {
  const candidates: BubblePosition[] = [];
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const position = { row, col };
      if (getCell(board, position) === null) {
        candidates.push(position);
      }
    }
  }

  candidates.sort((left, right) => {
    const leftCenter = positionToPoint(geometry, left);
    const rightCenter = positionToPoint(geometry, right);
    return (
      Math.hypot(leftCenter.x - point.x, leftCenter.y - point.y) -
      Math.hypot(rightCenter.x - point.x, rightCenter.y - point.y)
    );
  });
  return candidates[0] ?? { row: board.rows - 1, col: Math.floor(board.cols / 2) };
}
