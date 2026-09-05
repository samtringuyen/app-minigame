import { describe, expect, test } from 'vitest';
import {
  generateBoard,
  getLevel,
  hashSeed,
  hintIndex,
  isSolved,
  manhattan,
  nextLevelId,
  tryMove,
} from './engine';
import { solveSlides } from './solve';

describe('puzzle engine', () => {
  test('same seed and levelId produce the same board', () => {
    const seed = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    expect(generateBoard(seed, 'level-1')).toEqual(generateBoard(seed, 'level-1'));
    expect(generateBoard(seed, 'level-1')).not.toEqual(generateBoard(seed, 'level-2'));
  });

  test('generated boards are not already solved', () => {
    const seed = 'ffffffffffffffffffffffffffffffff';
    expect(isSolved(generateBoard(seed, 'level-1'))).toBe(false);
    expect(isSolved(generateBoard(seed, 'level-3'))).toBe(false);
  });

  test('legal slides update the board and can reach solved from a one-move position', () => {
    const board = [1, 2, 3, 4, 5, 6, 7, 0, 8];
    const moved = tryMove(board, 8);
    expect(moved).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect(isSolved(moved!)).toBe(true);
    expect(tryMove(board, 0)).toBeNull();
  });

  test('hint prefers a slide that lowers manhattan distance', () => {
    const board = [1, 2, 3, 4, 5, 6, 7, 0, 8];
    expect(hintIndex(board)).toBe(8);
    const after = tryMove(board, 8)!;
    expect(manhattan(after)).toBeLessThan(manhattan(board));
  });

  test('generated boards can be solved with legal slides', () => {
    const board = generateBoard('0123456789abcdef0123456789abcdef', 'level-1');
    const slides = solveSlides(board);
    expect(slides.length).toBeGreaterThan(0);
    const solved = slides.reduce((current, index) => {
      const next = tryMove(current, index);
      expect(next).not.toBeNull();
      return next!;
    }, board);
    expect(isSolved(solved)).toBe(true);
  });

  test('level helpers stay aligned with the API levelId format', () => {
    expect(getLevel('level-1').id).toBe('level-1');
    expect(nextLevelId('level-1')).toBe('level-2');
    expect(nextLevelId('level-3')).toBe('level-1');
    expect(hashSeed('aa', 'level-1')).not.toBe(hashSeed('bb', 'level-1'));
  });
});
