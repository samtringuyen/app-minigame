import { query } from '../db/pool.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { assertValidMeta, assertValidScore } from '../lib/score.js';
import { findGameByIdOrSlug } from './games.js';

export type SessionStatus = 'active' | 'finished' | 'abandoned';

export type SessionRow = {
  id: string;
  user_id: string;
  game_id: string;
  started_at: Date;
  ended_at: Date | null;
  score: number | null;
  meta: Record<string, unknown>;
  status: SessionStatus;
};

export type PublicSession = {
  id: string;
  userId: string;
  gameId: string;
  startedAt: string;
  endedAt: string | null;
  score: number | null;
  meta: Record<string, unknown>;
  status: SessionStatus;
};

export function toPublicSession(row: SessionRow): PublicSession {
  return {
    id: row.id,
    userId: row.user_id,
    gameId: row.game_id,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at ? row.ended_at.toISOString() : null,
    score: row.score,
    meta: row.meta,
    status: row.status,
  };
}

export async function startSession(
  userId: string,
  input: { gameId?: string; gameSlug?: string },
): Promise<PublicSession> {
  const key = input.gameId ?? input.gameSlug;
  if (!key) {
    throw badRequest('GAME_REQUIRED', 'Provide gameId or gameSlug');
  }

  const game = await findGameByIdOrSlug(key);
  if (!game) {
    throw notFound('Game not found');
  }

  const result = await query<SessionRow>(
    `INSERT INTO game_sessions (user_id, game_id, status)
     VALUES ($1, $2, 'active')
     RETURNING *`,
    [userId, game.id],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create session');
  }

  return toPublicSession(row);
}

export async function finishSession(
  userId: string,
  sessionId: string,
  input: { score: number; meta?: Record<string, unknown> },
): Promise<PublicSession> {
  assertValidScore(input.score);
  const meta = assertValidMeta(input.meta);

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

  // Idempotent: a finished session is returned as-is so retries are safe.
  if (existing.status === 'finished') {
    return toPublicSession(existing);
  }

  const result = await query<SessionRow>(
    `UPDATE game_sessions
     SET score = $2,
         meta = $3::jsonb,
         ended_at = now(),
         status = 'finished'
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [sessionId, input.score, JSON.stringify(meta)],
  );

  const updated = result.rows[0] ?? (await getSession(sessionId));
  if (!updated) {
    throw notFound('Session not found');
  }

  return toPublicSession(updated);
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const result = await query<SessionRow>('SELECT * FROM game_sessions WHERE id = $1 LIMIT 1', [
    sessionId,
  ]);
  return result.rows[0] ?? null;
}
