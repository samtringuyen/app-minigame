import { env } from '../config/env.js';
import { badRequest } from './errors.js';

const META_MAX_BYTES = 8 * 1024;

/**
 * Score rule (v1):
 * - must be a finite number
 * - must be >= 0 (negative scores are rejected)
 * - must be <= MAX_SCORE (default 1_000_000) to reject absurdly high values
 */
export function assertValidScore(score: number): void {
  if (!Number.isFinite(score)) {
    throw badRequest('INVALID_SCORE', 'Score must be a finite number');
  }

  if (score < 0) {
    throw badRequest('INVALID_SCORE', 'Score cannot be negative');
  }

  if (score > env.MAX_SCORE) {
    throw badRequest('INVALID_SCORE', `Score cannot exceed ${env.MAX_SCORE}`, {
      maxScore: env.MAX_SCORE,
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
