import { describe, expect, test } from 'vitest';
import { FINISH_ALLOWED_KEYS, finishSessionBody, startSessionBody } from './contract';

describe('API contract helpers', () => {
  test('start session never includes a client seed or score', () => {
    const body = startSessionBody('level-1');
    expect(body).toEqual({ levelId: 'level-1', gameSlug: 'puzzle' });
    expect(body).not.toHaveProperty('seed');
    expect(body).not.toHaveProperty('score');
  });

  test('finish session sends only levelId, seed, moves, and durationMs', () => {
    const body = finishSessionBody({
      levelId: 'level-2',
      seed: 'abc123',
      moves: 18,
      durationMs: 45200,
    });

    expect(Object.keys(body).sort()).toEqual([...FINISH_ALLOWED_KEYS].sort());
    expect(body).toEqual({
      levelId: 'level-2',
      seed: 'abc123',
      moves: 18,
      durationMs: 45200,
    });
    expect(body).not.toHaveProperty('score');
    expect(body).not.toHaveProperty('meta');
  });
});
