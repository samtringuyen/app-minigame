import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRoutes } from './routes/auth.js';
import { gamesRoutes } from './routes/games.js';
import { healthRoutes } from './routes/health.js';
import { leaderboardRoutes } from './routes/leaderboards.js';
import { meRoutes } from './routes/me.js';
import { sessionsRoutes } from './routes/sessions.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    trustProxy: true,
  });

  app.setErrorHandler(errorHandler);

  app.addHook('onRequest', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  const corsOrigin =
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

  await app.register(cors, { origin: corsOrigin });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(gamesRoutes);
  await app.register(sessionsRoutes);
  await app.register(leaderboardRoutes);

  return app;
}
