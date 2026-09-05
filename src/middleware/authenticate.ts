import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Missing or invalid access token');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw unauthorized('Missing or invalid access token');
  }

  try {
    const claims = verifyAccessToken(token);
    request.authUser = { id: claims.sub, email: claims.email };
  } catch {
    throw unauthorized('Missing or invalid access token');
  }
}
