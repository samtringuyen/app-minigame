import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import type { SessionRow } from './session-types.js';

export type FinishPayload = {
  levelId: string;
  seed: string;
  moves: number;
  durationMs: number;
};

export function sessionPayloadMatches(session: SessionRow, input: FinishPayload): boolean {
  return (
    session.level_id === input.levelId &&
    session.seed === input.seed &&
    session.moves === input.moves &&
    session.duration_ms === input.durationMs
  );
}

export function assertFinishAccess(session: SessionRow | null, userId: string): SessionRow {
  if (!session) {
    throw notFound('Session not found');
  }
  if (session.user_id !== userId) {
    throw forbidden('Session does not belong to this user');
  }
  if (session.status === 'abandoned') {
    throw badRequest('SESSION_ABANDONED', 'Abandoned sessions cannot be finished');
  }
  return session;
}

export function assertIssuedChallenge(session: SessionRow, input: FinishPayload): void {
  if (session.level_id !== input.levelId || session.seed !== input.seed) {
    throw badRequest(
      'SESSION_MISMATCH',
      'levelId and seed must match the values issued when the session started',
    );
  }
}

/**
 * Shared path for an already-finished session (including the concurrent-finish
 * fallback when UPDATE … WHERE status='active' matches zero rows).
 */
export function resultForFinishedSession(session: SessionRow, input: FinishPayload): SessionRow {
  if (session.status !== 'finished') {
    throw notFound('Session not found');
  }
  if (!sessionPayloadMatches(session, input)) {
    throw conflict('SESSION_ALREADY_FINISHED', 'Session is already finished');
  }
  return session;
}
