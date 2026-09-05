export const LEVEL_IDS = ['level-1', 'level-2', 'level-3'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export type LevelConfig = {
  id: LevelId;
  title: string;
  size: number;
  scramble: number;
  moveBudget: number;
};

export const LEVELS: LevelConfig[] = [
  { id: 'level-1', title: 'Grove', size: 3, scramble: 8, moveBudget: 24 },
  { id: 'level-2', title: 'Garden', size: 3, scramble: 20, moveBudget: 40 },
  { id: 'level-3', title: 'Labyrinth', size: 4, scramble: 32, moveBudget: 80 },
];

export const BONUS_MOVES = 12;

/** Board is row-major. 0 is the empty cell. */
export type Board = number[];

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export function isLevelId(value: string): value is LevelId {
  return (LEVEL_IDS as readonly string[]).includes(value);
}

export function getLevel(levelId: string): LevelConfig {
  const found = LEVELS.find((level) => level.id === levelId);
  if (!found) {
    throw new Error(`Unknown levelId: ${levelId}`);
  }
  return found;
}

export function nextLevelId(levelId: string): LevelId {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  if (index < 0 || index === LEVELS.length - 1) {
    return LEVELS[0]!.id;
  }
  return LEVELS[index + 1]!.id;
}

export function createSolvedBoard(size: number): Board {
  const cells = size * size;
  return Array.from({ length: cells }, (_, i) => (i === cells - 1 ? 0 : i + 1));
}

export function isSolved(board: Board): boolean {
  const size = Math.sqrt(board.length);
  const target = createSolvedBoard(size);
  return board.every((value, index) => value === target[index]);
}

export function hashSeed(seed: string, levelId: string): number {
  const input = `${seed}:${levelId}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inBounds(row: number, col: number, size: number): boolean {
  return row >= 0 && row < size && col >= 0 && col < size;
}

export function generateBoard(seed: string, levelId: string): Board {
  const level = getLevel(levelId);
  const { size, scramble } = level;
  const board = createSolvedBoard(size);
  const random = mulberry32(hashSeed(seed, levelId));

  let blank = size * size - 1;
  let lastReverse = -1;

  for (let step = 0; step < scramble; step += 1) {
    const blankRow = Math.floor(blank / size);
    const blankCol = blank % size;
    const options: number[] = [];

    for (let dir = 0; dir < DIRS.length; dir += 1) {
      if (dir === lastReverse) {
        continue;
      }
      const nextRow = blankRow + DIRS[dir]![1];
      const nextCol = blankCol + DIRS[dir]![0];
      if (inBounds(nextRow, nextCol, size)) {
        options.push(dir);
      }
    }

    const pool =
      options.length > 0
        ? options
        : DIRS.map((_, dir) => dir).filter((dir) => {
            const nextRow = blankRow + DIRS[dir]![1];
            const nextCol = blankCol + DIRS[dir]![0];
            return inBounds(nextRow, nextCol, size);
          });

    const dir = pool[Math.floor(random() * pool.length)]!;
    const next = (blankRow + DIRS[dir]![1]) * size + (blankCol + DIRS[dir]![0]);
    const blankValue = board[blank]!;
    board[blank] = board[next]!;
    board[next] = blankValue;
    lastReverse = (dir + 2) % 4;
    blank = next;
  }

  if (isSolved(board)) {
    const swapWith = blank === 0 ? 1 : blank - 1;
    const blankValue = board[blank]!;
    board[blank] = board[swapWith]!;
    board[swapWith] = blankValue;
  }

  return board;
}

export function neighborsOfBlank(board: Board): number[] {
  const size = Math.sqrt(board.length);
  const blank = board.indexOf(0);
  const row = Math.floor(blank / size);
  const col = blank % size;
  const neighbors: number[] = [];

  for (const [dx, dy] of DIRS) {
    const nextRow = row + dy;
    const nextCol = col + dx;
    if (inBounds(nextRow, nextCol, size)) {
      neighbors.push(nextRow * size + nextCol);
    }
  }

  return neighbors;
}

export function tryMove(board: Board, tileIndex: number): Board | null {
  if (!neighborsOfBlank(board).includes(tileIndex)) {
    return null;
  }
  const next = board.slice();
  const blank = next.indexOf(0);
  const blankValue = next[blank]!;
  next[blank] = next[tileIndex]!;
  next[tileIndex] = blankValue;
  return next;
}

export function manhattan(board: Board): number {
  const size = Math.sqrt(board.length);
  let total = 0;
  for (let index = 0; index < board.length; index += 1) {
    const value = board[index]!;
    if (value === 0) {
      continue;
    }
    const target = value - 1;
    const row = Math.floor(index / size);
    const col = index % size;
    const targetRow = Math.floor(target / size);
    const targetCol = target % size;
    total += Math.abs(row - targetRow) + Math.abs(col - targetCol);
  }
  return total;
}

/** Legal slide that most reduces Manhattan distance. */
export function hintIndex(board: Board): number | null {
  const legal = neighborsOfBlank(board);
  if (legal.length === 0) {
    return null;
  }

  let best = legal[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const index of legal) {
    const next = tryMove(board, index);
    if (!next) {
      continue;
    }
    const score = manhattan(next);
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return best;
}

export function formatDuration(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}
