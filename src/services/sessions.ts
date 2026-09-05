import { query } from '../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { assertValidAttempt, assertValidMeta, deriveScore } from '../lib/score.js';
import { generatePuzzleSeed } from '../lib/seed.js';
import { findGameByIdOrSlug } from './games.js';

export const DEFAULT_GAME_SLUG = 'puzzle';

export type SessionStatus = 'active' | 'finished' | 'abandoned';

export type SessionRow = {
  id: string;
  user_id: string;
  game_id: string;
  started_at: Date;
  ended_at: Date | null;
  level_id: string;
  seed: string;
  moves: number | null;
  duration_ms: number | null;
  score: number | null;
  meta: Record<string, unknown>;
  status: SessionStatus;
};

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

function toStartedSession(row: SessionRow): StartedSession {
  return {
    sessionId: row.id,
    levelId: row.level_id,
    seed: row.seed,
    gameId: row.game_id,
    startedAt: row.started_at.toISOString(),
  };
}

function toFinishedSession(row: SessionRow): FinishedSession {
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

export async function finishSession(
  userId: string,
  sessionId: string,
  input: {
    levelId: string;
    seed: string;
    moves: number;
    durationMs: number;
    meta?: Record<string, unknown>;
  },
): Promise<FinishedSession> {
  assertValidAttempt(input.moves, input.durationMs);
  const meta = assertValidMeta(input.meta);
  const score = deriveScore(input.moves, input.durationMs);

  const existing = await getSession(sessionId);
  if (!existing) {
    throw notFound('Session not found');
  }

  if (existing.user_id !== userId) {
    throw forbidden('Session does not belong to this user');
  }

  if (existing.status === 'abandoned') {
    throw badRequest('SESSION_ABANDONED', 'Abandoned sessions cannot be finished');
  }

  const payloadMatches =
    existing.level_id === input.levelId &&
    existing.seed === input.seed &&
    existing.moves === input.moves &&
    existing.duration_ms === input.durationMs;

  if (existing.status === 'finished') {
    if (payloadMatches) {
      return toFinishedSession(existing);
    }
    throw conflict('SESSION_ALREADY_FINISHED', 'Session is already finished');
  }

  if (existing.level_id !== input.levelId || existing.seed !== input.seed) {
    throw badRequest(
      'SESSION_MISMATCH',
      'levelId and seed must match the values issued when the session started',
    );
  }

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
    [sessionId, input.moves, input.durationMs, score, JSON.stringify(meta)],
  );

  const updated = result.rows[0] ?? (await getSession(sessionId));
  if (!updated) {
    throw notFound('Session not found');
  }

  return toFinishedSession(updated);
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const result = await query<SessionRow>('SELECT * FROM game_sessions WHERE id = $1 LIMIT 1', [
    sessionId,
  ]);
  return result.rows[0] ?? null;
}
