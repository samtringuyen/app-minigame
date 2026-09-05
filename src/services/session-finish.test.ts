import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../lib/errors.js';
import {
  assertIssuedChallenge,
  resultForFinishedSession,
  sessionPayloadMatches,
} from './session-finish.js';
import type { SessionRow } from './session-types.js';

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'user-1',
    game_id: 'game-1',
    started_at: new Date('2026-09-05T08:00:00.000Z'),
    ended_at: new Date('2026-09-05T08:00:10.000Z'),
    level_id: 'level-1',
    seed: 'abc123',
    moves: 20,
    duration_ms: 15_000,
    score: 97_850,
    meta: {},
    status: 'finished',
    ...overrides,
  };
}

const matching = {
  levelId: 'level-1',
  seed: 'abc123',
  moves: 20,
  durationMs: 15_000,
};

describe('assertIssuedChallenge', () => {
  it('throws SESSION_MISMATCH when seed or levelId differ from start', () => {
    const active = session({ status: 'active', moves: null, duration_ms: null, score: null });

    assert.throws(
      () => assertIssuedChallenge(active, { ...matching, seed: 'spoofed' }),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 400 && error.code === 'SESSION_MISMATCH',
    );

    assert.throws(
      () => assertIssuedChallenge(active, { ...matching, levelId: 'level-9' }),
      (error: unknown) => error instanceof AppError && error.code === 'SESSION_MISMATCH',
    );
  });

  it('accepts the issued levelId and seed', () => {
    const active = session({ status: 'active', moves: null, duration_ms: null, score: null });
    assert.doesNotThrow(() => assertIssuedChallenge(active, matching));
  });
});

describe('resultForFinishedSession (race / fallback path)', () => {
  it('returns the stored session when the payload matches (idempotent)', () => {
    const finished = session();
    const resolved = resultForFinishedSession(finished, matching);
    assert.equal(resolved, finished);
    assert.equal(sessionPayloadMatches(finished, matching), true);
  });

  it('throws 409 when a later request spoofs a different payload', () => {
    const finished = session();
    assert.equal(sessionPayloadMatches(finished, { ...matching, moves: 1, durationMs: 0 }), false);
    assert.throws(
      () => resultForFinishedSession(finished, { ...matching, moves: 1, durationMs: 0 }),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'SESSION_ALREADY_FINISHED',
    );
  });
});
