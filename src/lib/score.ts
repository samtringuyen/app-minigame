import { badRequest } from './errors.js';

const META_MAX_BYTES = 8 * 1024;

/** Highest accepted move count (inclusive). */
export const MAX_MOVES = 10_000;

/** Highest accepted solve time (inclusive): 1 hour. */
export const MAX_DURATION_MS = 60 * 60 * 1000;

/**
 * Derived score (higher is better):
 *   max(0, 100_000 - moves * 100 - floor(durationMs / 100))
 *
 * Fewer moves and faster times rank higher. The server never accepts a client score.
 */
export const SCORE_BASE = 100_000;
export const SCORE_MOVE_PENALTY = 100;
export const SCORE_MS_PER_POINT = 100;

export function deriveScore(moves: number, durationMs: number): number {
  return Math.max(
    0,
    SCORE_BASE - moves * SCORE_MOVE_PENALTY - Math.floor(durationMs / SCORE_MS_PER_POINT),
  );
}

export function assertValidAttempt(moves: number, durationMs: number): void {
  if (!Number.isInteger(moves) || moves < 0) {
    throw badRequest('INVALID_MOVES', 'moves must be an integer >= 0');
  }
  if (moves > MAX_MOVES) {
    throw badRequest('INVALID_MOVES', `moves cannot exceed ${MAX_MOVES}`, { maxMoves: MAX_MOVES });
  }

  if (!Number.isInteger(durationMs) || durationMs < 0) {
    throw badRequest('INVALID_DURATION', 'durationMs must be an integer >= 0');
  }
  if (durationMs > MAX_DURATION_MS) {
    throw badRequest('INVALID_DURATION', `durationMs cannot exceed ${MAX_DURATION_MS}`, {
      maxDurationMs: MAX_DURATION_MS,
    });
  }
}

export function assertValidMeta(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const value = meta ?? {};
  const serialized = JSON.stringify(value);

  if (serialized.length > META_MAX_BYTES) {
    throw badRequest('INVALID_META', `meta must be smaller than ${META_MAX_BYTES} bytes`);
  }

  return value;
}
