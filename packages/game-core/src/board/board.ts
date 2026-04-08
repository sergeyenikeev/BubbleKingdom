import { createId } from "@bubble-kingdom/shared";
import type {
  BubbleCell,
  BubbleColor,
  BubblePosition,
  LevelDefinition,
  ObjectiveType,
} from "@bubble-kingdom/shared";

import type { BoardSnapshot, BoardState, QueueBubbleSpec } from "./types";

const tokenColorMap: Record<string, BubbleColor> = {
  R: "ruby",
  B: "sapphire",
  G: "emerald",
  Y: "sun",
  P: "amethyst",
  C: "aqua",
};

export function createBoardState(level: LevelDefinition): BoardState {
  const cells = level.layout.map((row, rowIndex) =>
    row.split(" ").map((token, colIndex) => parseToken(token, rowIndex, colIndex)),
  );

  return {
    rows: cells.length,
    cols: Math.max(...cells.map((row) => row.length)),
    cells,
    movesRemaining: level.moves,
    queue: [...level.queue],
    score: 0,
    combo: 0,
    turn: 0,
    objectiveProgress: {},
    starsEarned: 0,
    status: "active",
    history: [],
  };
}

export function cloneBoardState(board: BoardState): BoardState {
  return {
    ...board,
    cells: cloneCells(board.cells),
    queue: [...board.queue],
    objectiveProgress: { ...board.objectiveProgress },
    history: board.history.map((snapshot) => ({
      ...snapshot,
      cells: cloneCells(snapshot.cells),
      queue: [...snapshot.queue],
      objectiveProgress: { ...snapshot.objectiveProgress },
    })),
  };
}

export function snapshotBoard(board: BoardState): BoardSnapshot {
  return {
    cells: cloneCells(board.cells),
    movesRemaining: board.movesRemaining,
    queue: [...board.queue],
    score: board.score,
    combo: board.combo,
    turn: board.turn,
    objectiveProgress: { ...board.objectiveProgress },
    starsEarned: board.starsEarned,
    status: board.status,
  };
}

export function restoreSnapshot(board: BoardState, snapshot: BoardSnapshot): BoardState {
  board.cells = cloneCells(snapshot.cells);
  board.movesRemaining = snapshot.movesRemaining;
  board.queue = [...snapshot.queue];
  board.score = snapshot.score;
  board.combo = snapshot.combo;
  board.turn = snapshot.turn;
  board.objectiveProgress = { ...snapshot.objectiveProgress };
  board.starsEarned = snapshot.starsEarned;
  board.status = snapshot.status;
  return board;
}

export function cloneCells(cells: BoardState["cells"]): BoardState["cells"] {
  return cells.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function parseToken(token: string, row: number, col: number): BubbleCell | null {
  if (token === ".") {
    return null;
  }

  const baseId = `cell_${row}_${col}_${createId("b")}`;
  if (token === "S") {
    return {
      id: baseId,
      kind: "stone",
      color: null,
      hitsRemaining: 1,
    };
  }

  const [prefix, suffix] = token.length === 1 ? ["", token] : [token[0]!, token[1]!];
  const color = tokenColorMap[suffix];
  if (!color) {
    throw new Error(`Unknown token color for ${token}`);
  }

  switch (prefix) {
    case "":
      return {
        id: baseId,
        kind: "normal",
        color,
      };
    case "I":
      return {
        id: baseId,
        kind: "ice",
        color,
        hitsRemaining: 1,
      };
    case "V":
      return {
        id: baseId,
        kind: "vine",
        color,
        chainStrength: 1,
      };
    case "F":
      return {
        id: baseId,
        kind: "fog",
        color,
        hiddenUnderFog: true,
      };
    case "C":
      return {
        id: baseId,
        kind: "crystal",
        color,
        payload: "crystal",
      };
    case "P":
      return {
        id: baseId,
        kind: "pet",
        color,
        payload: "pet",
      };
    case "H":
      return {
        id: baseId,
        kind: "flower",
        color,
        payload: "flower",
      };
    case "A":
      return {
        id: baseId,
        kind: "artifact",
        color,
        payload: "artifact",
      };
    case "L":
      return {
        id: baseId,
        kind: "line",
        color,
      };
    default:
      throw new Error(`Unknown token prefix for ${token}`);
  }
}

export function validateBoard(board: BoardState): string[] {
  const errors: string[] = [];
  if (board.rows <= 0 || board.cols <= 0) {
    errors.push("Board dimensions must be positive.");
  }

  for (const [rowIndex, row] of board.cells.entries()) {
    if (row.length !== board.cols) {
      errors.push(`Row ${rowIndex} has inconsistent width.`);
    }
  }

  return errors;
}

export function getNeighbors(board: BoardState, position: BubblePosition): BubblePosition[] {
  const { row, col } = position;
  const horizontal = [
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];
  const upper =
    row % 2 === 0
      ? [
          { row: row - 1, col: col - 1 },
          { row: row - 1, col },
        ]
      : [
          { row: row - 1, col },
          { row: row - 1, col: col + 1 },
        ];
  const lower =
    row % 2 === 0
      ? [
          { row: row + 1, col: col - 1 },
          { row: row + 1, col },
        ]
      : [
          { row: row + 1, col },
          { row: row + 1, col: col + 1 },
        ];

  return [...horizontal, ...upper, ...lower].filter((candidate) =>
    isInsideBoard(board, candidate),
  );
}

export function isInsideBoard(board: BoardState, position: BubblePosition): boolean {
  return (
    position.row >= 0 &&
    position.col >= 0 &&
    position.row < board.rows &&
    position.col < board.cols
  );
}

export function getCell(board: BoardState, position: BubblePosition): BubbleCell | null {
  return board.cells[position.row]?.[position.col] ?? null;
}

export function setCell(
  board: BoardState,
  position: BubblePosition,
  cell: BubbleCell | null,
): void {
  if (!board.cells[position.row]) {
    return;
  }
  board.cells[position.row]![position.col] = cell;
}

export function isMatchable(cell: BubbleCell | null): boolean {
  if (!cell) {
    return false;
  }
  return (
    cell.kind === "normal" ||
    cell.kind === "rainbow" ||
    cell.kind === "line" ||
    cell.kind === "bomb" ||
    cell.kind === "crystal" ||
    cell.kind === "pet"
  );
}

export function isObjectiveComplete(
  board: BoardState,
  objective: LevelDefinition["objective"],
): boolean {
  if (objective.type === "clear_all") {
    return countCells(board, (cell) => isMatchable(cell) || cell?.kind === "artifact") === 0;
  }

  return (board.objectiveProgress[objective.type] ?? 0) >= (objective.target ?? 0);
}

export function countCells(
  board: BoardState,
  predicate: (cell: BubbleCell | null) => boolean,
): number {
  return board.cells.reduce(
    (total, row) => total + row.reduce((rowTotal, cell) => rowTotal + (predicate(cell) ? 1 : 0), 0),
    0,
  );
}

export function dequeueBubble(board: BoardState, palette: BubbleColor[]): QueueBubbleSpec {
  const next = board.queue.shift();
  if (board.queue.length < 5) {
    board.queue.push(palette[(board.turn + board.queue.length) % palette.length]!);
  }

  if (next === "rainbow") {
    return { kind: "rainbow", color: "wild" };
  }
  if (next === "bomb") {
    return { kind: "bomb", color: null };
  }
  if (next === "line") {
    return { kind: "line", color: palette[board.turn % palette.length] ?? palette[0] ?? "ruby" };
  }

  return {
    kind: "normal",
    color: next ?? palette[0] ?? "ruby",
  };
}

export function pushHistory(board: BoardState): void {
  board.history.push(snapshotBoard(board));
  if (board.history.length > 5) {
    board.history.shift();
  }
}

export function incrementObjective(
  board: BoardState,
  objective: ObjectiveType,
  amount: number,
): void {
  board.objectiveProgress[objective] = (board.objectiveProgress[objective] ?? 0) + amount;
}

export function peekLastSnapshot(board: BoardState): BoardSnapshot | undefined {
  return board.history.at(-1);
}
