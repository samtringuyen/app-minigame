import { query } from '../db/pool.js';
import { toPublicGame, type PublicGame } from './games.js';
import { requireGame } from './games.js';

export type LeaderboardPeriod = 'all' | 'weekly' | 'daily';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  endedAt: string;
};

export type Leaderboard = {
  game: PublicGame;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
};

const PERIOD_INTERVAL: Record<Exclude<LeaderboardPeriod, 'all'>, string> = {
  daily: '1 day',
  weekly: '7 days',
};

export async function getLeaderboard(
  gameIdOrSlug: string,
  period: LeaderboardPeriod,
  limit = 100,
): Promise<Leaderboard> {
  const game = await requireGame(gameIdOrSlug);

  const params: unknown[] = [game.id, limit];
  let periodFilter = '';

  if (period !== 'all') {
    periodFilter = `AND s.ended_at >= now() - $3::interval`;
    params.push(PERIOD_INTERVAL[period]);
  }

  const result = await query<{
    user_id: string;
    display_name: string;
    score: number;
    ended_at: Date;
  }>(
    `SELECT ranked.user_id, ranked.display_name, ranked.score, ranked.ended_at
     FROM (
       SELECT
         s.user_id,
         u.display_name,
         s.score,
         s.ended_at,
         ROW_NUMBER() OVER (
           PARTITION BY s.user_id
           ORDER BY s.score DESC, s.ended_at ASC
         ) AS best_rank
       FROM game_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.game_id = $1
         AND s.status = 'finished'
         AND s.score IS NOT NULL
         ${periodFilter}
     ) ranked
     WHERE ranked.best_rank = 1
     ORDER BY ranked.score DESC, ranked.ended_at ASC
     LIMIT $2`,
    params,
  );

  return {
    game: toPublicGame(game),
    period,
    entries: result.rows.map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      displayName: row.display_name,
      score: row.score,
      endedAt: row.ended_at.toISOString(),
    })),
  };
}
