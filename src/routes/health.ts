import type { FastifyInstance } from 'fastify';
import { pingRedis } from '../cache/redis.js';
import { pingPostgres } from '../db/pool.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const [postgresUp, redis] = await Promise.all([pingPostgres(), pingRedis()]);
    const status = postgresUp ? 'ok' : 'degraded';

    return reply.status(postgresUp ? 200 : 503).send({
      status,
      postgres: postgresUp ? 'up' : 'down',
      redis,
    });
  });
}
