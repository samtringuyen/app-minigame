import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { patchMeSchema } from '../lib/schemas.js';
import { findUserById, toPublicUser, updateDisplayName } from '../services/users.js';
import { unauthorized } from '../lib/errors.js';

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: authenticate }, async (request) => {
    const user = await findUserById(request.authUser.id);
    if (!user) {
      throw unauthorized('Authentication required');
    }
    return { user: toPublicUser(user) };
  });

  app.patch('/me', { preHandler: authenticate }, async (request) => {
    const body = patchMeSchema.parse(request.body);
    const user = await updateDisplayName(request.authUser.id, body.displayName);
    return { user: toPublicUser(user) };
  });
}
