import type { FastifyInstance } from 'fastify';
import { gameIdOrSlugSchema, leaderboardQuerySchema } from '../lib/schemas.js';
import { getLeaderboard } from '../services/leaderboards.js';

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/leaderboards/:gameIdOrSlug', async (request) => {
    const gameIdOrSlug = gameIdOrSlugSchema.parse(
      (request.params as { gameIdOrSlug: string }).gameIdOrSlug,
    );
    const query = leaderboardQuerySchema.parse(request.query);
    return getLeaderboard(gameIdOrSlug, query.period);
  });
}
