import { query } from '../db/pool.js';
import { notFound } from '../lib/errors.js';
import { assertValidAttempt, assertValidMeta, deriveScore } from '../lib/score.js';
import { generatePuzzleSeed } from '../lib/seed.js';
import { findGameByIdOrSlug } from './games.js';
import {
  assertFinishAccess,
  assertIssuedChallenge,
  resultForFinishedSession,
  type FinishPayload,
} from './session-finish.js';
import type { SessionRow } from './session-types.js';

export type { SessionRow, SessionStatus } from './session-types.js';

export const DEFAULT_GAME_SLUG = 'puzzle';

export type StartedSession = {
  sessionId: string;
  levelId: string;
  seed: string;
  gameId: string;
  startedAt: string;
};

export type FinishedSession = StartedSession & {
  score: number;
  moves: number;
  durationMs: number;
  status: 'finished';
  endedAt: string;
  meta: Record<string, unknown>;
};

export type FinishStore = {
  getById(id: string): Promise<SessionRow | null>;
  finishIfActive(input: {
    sessionId: string;
    moves: number;
    durationMs: number;
    score: number;
    meta: Record<string, unknown>;
  }): Promise<SessionRow | null>;
};

function toStartedSession(row: SessionRow): StartedSession {
  return {
    sessionId: row.id,
    levelId: row.level_id,
    seed: row.seed,
    gameId: row.game_id,
    startedAt: row.started_at.toISOString(),
  };
}

export function toFinishedSession(row: SessionRow): FinishedSession {
  return {
    ...toStartedSession(row),
    score: row.score ?? 0,
    moves: row.moves ?? 0,
    durationMs: row.duration_ms ?? 0,
    status: 'finished',
    endedAt: row.ended_at ? row.ended_at.toISOString() : new Date().toISOString(),
    meta: row.meta,
  };
}

export async function startSession(
  userId: string,
  input: { gameId?: string; gameSlug?: string; levelId: string },
): Promise<StartedSession> {
  const key = input.gameId ?? input.gameSlug ?? DEFAULT_GAME_SLUG;
  const game = await findGameByIdOrSlug(key);
  if (!game) {
    throw notFound('Game not found');
  }

  const seed = generatePuzzleSeed();
  const result = await query<SessionRow>(
    `INSERT INTO game_sessions (user_id, game_id, level_id, seed, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING *`,
    [userId, game.id, input.levelId, seed],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create session');
  }

  return toStartedSession(row);
}

const defaultFinishStore: FinishStore = {
  getById: getSession,
  async finishIfActive({ sessionId, moves, durationMs, score, meta }) {
    const result = await query<SessionRow>(
      `UPDATE game_sessions
       SET moves = $2,
           duration_ms = $3,
           score = $4,
           meta = $5::jsonb,
           ended_at = now(),
           status = 'finished'
       WHERE id = $1 AND status = 'active'
       RETURNING *`,
      [sessionId, moves, durationMs, score, JSON.stringify(meta)],
    );
    return result.rows[0] ?? null;
  },
};

export async function finishSession(
  userId: string,
  sessionId: string,
  input: FinishPayload & { meta?: Record<string, unknown> },
  store: FinishStore = defaultFinishStore,
): Promise<FinishedSession> {
  assertValidAttempt(input.moves, input.durationMs);
  const meta = assertValidMeta(input.meta);
  const score = deriveScore(input.moves, input.durationMs);

  const existing = assertFinishAccess(await store.getById(sessionId), userId);

  if (existing.status === 'finished') {
    return toFinishedSession(resultForFinishedSession(existing, input));
  }

  assertIssuedChallenge(existing, input);

  const updated = await store.finishIfActive({
    sessionId,
    moves: input.moves,
    durationMs: input.durationMs,
    score,
    meta,
  });

  if (updated) {
    return toFinishedSession(updated);
  }

  // Lost the race: another finish already committed. Re-load and apply the
  // same payload check as the explicit "already finished" path.
  const raced = assertFinishAccess(await store.getById(sessionId), userId);
  return toFinishedSession(resultForFinishedSession(raced, input));
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const result = await query<SessionRow>('SELECT * FROM game_sessions WHERE id = $1 LIMIT 1', [
    sessionId,
  ]);
  return result.rows[0] ?? null;
}
