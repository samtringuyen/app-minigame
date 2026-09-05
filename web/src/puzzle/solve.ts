import { isSolved, neighborsOfBlank, tryMove, type Board } from './engine';

/** Breadth-first list of tile indexes to slide. Practical for 3×3 boards. */
export function solveSlides(start: Board): number[] {
  if (isSolved(start)) {
    return [];
  }

  const queue: Array<{ board: Board; path: number[] }> = [{ board: start, path: [] }];
  const seen = new Set<string>([start.join(',')]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const index of neighborsOfBlank(current.board)) {
      const next = tryMove(current.board, index);
      if (!next) {
        continue;
      }
      const key = next.join(',');
      if (seen.has(key)) {
        continue;
      }
      const path = [...current.path, index];
      if (isSolved(next)) {
        return path;
      }
      seen.add(key);
      queue.push({ board: next, path });
    }
  }

  throw new Error('Board is not solvable');
}
