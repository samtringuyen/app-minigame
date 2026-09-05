/**
 * Request bodies for the puzzle API locked in backend PR #1.
 * Clients must never invent a seed or submit a raw score.
 */

export function startSessionBody(levelId: string) {
  return {
    levelId,
    gameSlug: 'puzzle' as const,
  };
}

export function finishSessionBody(input: {
  levelId: string;
  seed: string;
  moves: number;
  durationMs: number;
}) {
  return {
    levelId: input.levelId,
    seed: input.seed,
    moves: input.moves,
    durationMs: input.durationMs,
  };
}

export const FINISH_ALLOWED_KEYS = ['levelId', 'seed', 'moves', 'durationMs'] as const;
