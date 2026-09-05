import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { finishSessionSchema, sessionIdSchema, startSessionSchema } from '../lib/schemas.js';
import { finishSession, startSession } from '../services/sessions.js';

export async function sessionsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/sessions', { preHandler: authenticate }, async (request, reply) => {
    const body = startSessionSchema.parse(request.body);
    const session = await startSession(request.authUser.id, body);
    return reply.status(201).send({ session });
  });

  app.post(
    '/sessions/:id/finish',
    {
      preHandler: authenticate,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request) => {
      const sessionId = sessionIdSchema.parse((request.params as { id: string }).id);
      const body = finishSessionSchema.parse(request.body);
      const session = await finishSession(request.authUser.id, sessionId, body);
      return { session };
    },
  );
}
