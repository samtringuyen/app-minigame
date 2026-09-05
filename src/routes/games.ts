import type { FastifyInstance } from 'fastify';
import { listGames } from '../services/games.js';

export async function gamesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/games', async () => {
    const games = await listGames();
    return { games };
  });
}
