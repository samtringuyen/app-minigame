import { query } from '../db/pool.js';
import { requireGame, toPublicGame, type PublicGame } from './games.js';

export type LeaderboardPeriod = 'all' | 'weekly' | 'daily';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  moves: number;
  durationMs: number;
  levelId: string;
  endedAt: string;
};

export type Leaderboard = {
  game: PublicGame;
  period: LeaderboardPeriod;
  levelId: string | null;
  entries: LeaderboardEntry[];
};

const PERIOD_INTERVAL: Record<Exclude<LeaderboardPeriod, 'all'>, string> = {
  daily: '1 day',
  weekly: '7 days',
};

export async function getLeaderboard(
  gameIdOrSlug: string,
  period: LeaderboardPeriod,
  levelId?: string,
  limit = 100,
): Promise<Leaderboard> {
  const game = await requireGame(gameIdOrSlug);

  const params: unknown[] = [game.id, limit];
  const filters: string[] = [];

  if (period !== 'all') {
    params.push(PERIOD_INTERVAL[period]);
    filters.push(`AND s.ended_at >= now() - $${params.length}::interval`);
  }

  if (levelId) {
    params.push(levelId);
    filters.push(`AND s.level_id = $${params.length}`);
  }

  const result = await query<{
    user_id: string;
    display_name: string;
    score: number;
    moves: number;
    duration_ms: number;
    level_id: string;
    ended_at: Date;
  }>(
    `SELECT ranked.user_id, ranked.display_name, ranked.score, ranked.moves,
            ranked.duration_ms, ranked.level_id, ranked.ended_at
     FROM (
       SELECT
         s.user_id,
         u.display_name,
         s.score,
         s.moves,
         s.duration_ms,
         s.level_id,
         s.ended_at,
         ROW_NUMBER() OVER (
           PARTITION BY s.user_id
           ORDER BY s.moves ASC, s.duration_ms ASC, s.ended_at ASC
         ) AS best_rank
       FROM game_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.game_id = $1
         AND s.status = 'finished'
         AND s.moves IS NOT NULL
         AND s.duration_ms IS NOT NULL
         ${filters.join('\n         ')}
     ) ranked
     WHERE ranked.best_rank = 1
     ORDER BY ranked.moves ASC, ranked.duration_ms ASC, ranked.ended_at ASC
     LIMIT $2`,
    params,
  );

  return {
    game: toPublicGame(game),
    period,
    levelId: levelId ?? null,
    entries: result.rows.map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      displayName: row.display_name,
      score: row.score,
      moves: row.moves,
      durationMs: row.duration_ms,
      levelId: row.level_id,
      endedAt: row.ended_at.toISOString(),
    })),
  };
}
