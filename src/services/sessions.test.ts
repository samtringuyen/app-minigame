import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../lib/errors.js';
import { finishSession, type FinishStore, type SessionRow } from './sessions.js';

function row(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: 'user-1',
    game_id: 'game-1',
    started_at: new Date('2026-09-05T08:00:00.000Z'),
    ended_at: null,
    level_id: 'level-1',
    seed: 'issued-seed',
    moves: null,
    duration_ms: null,
    score: null,
    meta: {},
    status: 'active',
    ...overrides,
  };
}

const payload = {
  levelId: 'level-1',
  seed: 'issued-seed',
  moves: 20,
  durationMs: 15_000,
};

const finishedWinner: SessionRow = row({
  status: 'finished',
  ended_at: new Date('2026-09-05T08:00:12.000Z'),
  moves: 20,
  duration_ms: 15_000,
  score: 97_850,
});

describe('finishSession', () => {
  it('rejects a seed/level mismatch on an active session', async () => {
    const store: FinishStore = {
      async getById() {
        return row();
      },
      async finishIfActive() {
        throw new Error('must not update after mismatch');
      },
    };

    await assert.rejects(
      () => finishSession('user-1', row().id, { ...payload, seed: 'nope' }, store),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 400 && error.code === 'SESSION_MISMATCH',
    );
  });

  it('is idempotent when the same payload is sent after finish', async () => {
    const store: FinishStore = {
      async getById() {
        return finishedWinner;
      },
      async finishIfActive() {
        throw new Error('must not update an already finished session');
      },
    };

    const result = await finishSession('user-1', finishedWinner.id, payload, store);
    assert.equal(result.score, 97_850);
    assert.equal(result.moves, 20);
    assert.equal(result.status, 'finished');
  });

  it('returns 409 on the race fallback when the winner stored a different payload', async () => {
    let reads = 0;
    const store: FinishStore = {
      async getById() {
        reads += 1;
        if (reads === 1) {
          return row();
        }
        return finishedWinner;
      },
      async finishIfActive() {
        return null;
      },
    };

    await assert.rejects(
      () => finishSession('user-1', row().id, { ...payload, moves: 1, durationMs: 0 }, store),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'SESSION_ALREADY_FINISHED',
    );
    assert.equal(reads, 2);
  });

  it('returns 200 on the race fallback when the payload matches the winner', async () => {
    let reads = 0;
    const store: FinishStore = {
      async getById() {
        reads += 1;
        return reads === 1 ? row() : finishedWinner;
      },
      async finishIfActive() {
        return null;
      },
    };

    const result = await finishSession('user-1', row().id, payload, store);
    assert.equal(result.score, 97_850);
    assert.equal(result.sessionId, finishedWinner.id);
    assert.equal(reads, 2);
  });
});
