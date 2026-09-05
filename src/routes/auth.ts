import type { FastifyInstance } from 'fastify';
import { login, logout, refresh, register } from '../services/auth.js';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from '../lib/schemas.js';

const authRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
    },
  },
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', authRateLimit, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await register(body);
    return reply.status(201).send(result);
  });

  app.post('/auth/login', authRateLimit, async (request) => {
    const body = loginSchema.parse(request.body);
    return login(body);
  });

  app.post('/auth/refresh', authRateLimit, async (request) => {
    const body = refreshSchema.parse(request.body);
    return refresh(body.refreshToken);
  });

  app.post('/auth/logout', authRateLimit, async (request, reply) => {
    const body = logoutSchema.parse(request.body);
    await logout(body.refreshToken);
    return reply.status(204).send();
  });
}
