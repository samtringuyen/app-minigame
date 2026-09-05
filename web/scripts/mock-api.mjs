/**
 * In-memory stand-in for the Fastify API in backend PR #1.
 * Same routes, score formula, and finish rules. Not for production.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.MOCK_API_PORT ?? 3000);
const ACCESS_TTL_MS = 15 * 60 * 1000;

const users = new Map();
const sessions = new Map();
const refreshTokens = new Map();

const puzzleGame = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'puzzle',
  title: 'Puzzle',
  rulesVersion: '1',
  createdAt: new Date().toISOString(),
};

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function error(res, status, code, message) {
  json(res, status, { error: { code, message } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (cause) {
        reject(cause);
      }
    });
    req.on('error', reject);
  });
}

function bearer(req) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' ? token : null;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function issueAuth(user) {
  const accessToken = `access-${user.id}-${Date.now()}`;
  const refreshToken = `refresh-${user.id}-${randomBytes(8).toString('hex')}`;
  user.accessToken = accessToken;
  user.accessExpiresAt = Date.now() + ACCESS_TTL_MS;
  refreshTokens.set(refreshToken, user.id);
  return {
    user: publicUser(user),
    tokens: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: '15m',
    },
  };
}

function userFromAccess(req) {
  const token = bearer(req);
  if (!token) {
    return null;
  }
  return [...users.values()].find((user) => user.accessToken === token && user.accessExpiresAt > Date.now()) ?? null;
}

function deriveScore(moves, durationMs) {
  return Math.max(0, 100000 - moves * 100 - Math.floor(durationMs / 100));
}

function requireAuth(req, res) {
  const user = userFromAccess(req);
  if (!user) {
    error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    return null;
  }
  return user;
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204);
    return;
  }

  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/health') {
      json(res, 200, { status: 'ok', postgres: 'mock', redis: 'disabled' });
      return;
    }

    if (req.method === 'POST' && path === '/auth/register') {
      const body = await readBody(req);
      if (!body.email || !body.password || !body.displayName || String(body.password).length < 8) {
        error(res, 400, 'VALIDATION_ERROR', 'Request validation failed');
        return;
      }
      const email = String(body.email).toLowerCase();
      if ([...users.values()].some((user) => user.email === email)) {
        error(res, 409, 'EMAIL_TAKEN', 'An account with this email already exists');
        return;
      }
      const user = {
        id: crypto.randomUUID(),
        email,
        password: String(body.password),
        displayName: String(body.displayName).slice(0, 32),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      users.set(user.id, user);
      json(res, 201, issueAuth(user));
      return;
    }

    if (req.method === 'POST' && path === '/auth/login') {
      const body = await readBody(req);
      const email = String(body.email ?? '').toLowerCase();
      const user = [...users.values()].find((item) => item.email === email && item.password === body.password);
      if (!user) {
        error(res, 401, 'UNAUTHORIZED', 'Invalid email or password');
        return;
      }
      json(res, 200, issueAuth(user));
      return;
    }

    if (req.method === 'POST' && path === '/auth/refresh') {
      const body = await readBody(req);
      const userId = refreshTokens.get(body.refreshToken);
      const user = userId ? users.get(userId) : null;
      if (!user) {
        error(res, 401, 'UNAUTHORIZED', 'Invalid refresh token');
        return;
      }
      refreshTokens.delete(body.refreshToken);
      json(res, 200, issueAuth(user));
      return;
    }

    if (req.method === 'POST' && path === '/auth/logout') {
      const body = await readBody(req);
      refreshTokens.delete(body.refreshToken);
      json(res, 204);
      return;
    }

    if (req.method === 'GET' && path === '/me') {
      const user = requireAuth(req, res);
      if (!user) {
        return;
      }
      json(res, 200, { user: publicUser(user) });
      return;
    }

    if (req.method === 'PATCH' && path === '/me') {
      const user = requireAuth(req, res);
      if (!user) {
        return;
      }
      const body = await readBody(req);
      user.displayName = String(body.displayName ?? user.displayName).slice(0, 32);
      user.updatedAt = new Date().toISOString();
      json(res, 200, { user: publicUser(user) });
      return;
    }

    if (req.method === 'GET' && path === '/games') {
      json(res, 200, { games: [puzzleGame] });
      return;
    }

    if (req.method === 'POST' && path === '/sessions') {
      const user = requireAuth(req, res);
      if (!user) {
        return;
      }
      const body = await readBody(req);
      if (body.seed) {
        error(res, 400, 'VALIDATION_ERROR', 'Clients must not send a seed');
        return;
      }
      if (!body.levelId) {
        error(res, 400, 'VALIDATION_ERROR', 'levelId is required');
        return;
      }
      const session = {
        sessionId: crypto.randomUUID(),
        userId: user.id,
        levelId: String(body.levelId),
        seed: randomBytes(16).toString('hex'),
        gameId: puzzleGame.id,
        startedAt: new Date().toISOString(),
        status: 'active',
      };
      sessions.set(session.sessionId, session);
      json(res, 201, {
        sessionId: session.sessionId,
        levelId: session.levelId,
        seed: session.seed,
        gameId: session.gameId,
        startedAt: session.startedAt,
      });
      return;
    }

    const finishMatch = path.match(/^\/sessions\/([^/]+)\/finish$/);
    if (req.method === 'POST' && finishMatch) {
      const user = requireAuth(req, res);
      if (!user) {
        return;
      }
      const body = await readBody(req);
      if (Object.hasOwn(body, 'score')) {
        error(res, 400, 'VALIDATION_ERROR', 'Client score is rejected');
        return;
      }
      const session = sessions.get(finishMatch[1]);
      if (!session || session.userId !== user.id) {
        error(res, 404, 'NOT_FOUND', 'Session not found');
        return;
      }
      if (session.levelId !== body.levelId || session.seed !== body.seed) {
        error(res, 400, 'SESSION_MISMATCH', 'levelId and seed must match the values issued when the session started');
        return;
      }
      if (!Number.isInteger(body.moves) || body.moves < 0 || body.moves > 10_000) {
        error(res, 400, 'INVALID_MOVES', 'moves must be an integer >= 0');
        return;
      }
      if (!Number.isInteger(body.durationMs) || body.durationMs < 0 || body.durationMs > 3_600_000) {
        error(res, 400, 'INVALID_DURATION', 'durationMs must be an integer >= 0');
        return;
      }

      const score = deriveScore(body.moves, body.durationMs);
      if (session.status === 'finished') {
        if (session.moves === body.moves && session.durationMs === body.durationMs) {
          json(res, 200, session.finished);
          return;
        }
        error(res, 409, 'SESSION_ALREADY_FINISHED', 'Session is already finished');
        return;
      }

      session.status = 'finished';
      session.moves = body.moves;
      session.durationMs = body.durationMs;
      session.score = score;
      session.endedAt = new Date().toISOString();
      session.finished = {
        sessionId: session.sessionId,
        levelId: session.levelId,
        seed: session.seed,
        gameId: session.gameId,
        startedAt: session.startedAt,
        score,
        moves: body.moves,
        durationMs: body.durationMs,
        status: 'finished',
        endedAt: session.endedAt,
        meta: {},
      };
      json(res, 200, session.finished);
      return;
    }

    if (req.method === 'GET' && path.startsWith('/leaderboards/')) {
      const period = url.searchParams.get('period') ?? 'all';
      const levelId = url.searchParams.get('levelId') ?? null;
      const now = Date.now();
      const windowMs = period === 'daily' ? 86_400_000 : period === 'weekly' ? 7 * 86_400_000 : null;
      const best = new Map();

      for (const session of sessions.values()) {
        if (session.status !== 'finished') {
          continue;
        }
        if (levelId && session.levelId !== levelId) {
          continue;
        }
        if (windowMs && now - Date.parse(session.endedAt) > windowMs) {
          continue;
        }
        const current = best.get(session.userId);
        if (
          !current ||
          session.moves < current.moves ||
          (session.moves === current.moves && session.durationMs < current.durationMs)
        ) {
          const owner = users.get(session.userId);
          best.set(session.userId, {
            userId: session.userId,
            displayName: owner?.displayName ?? 'Player',
            score: session.score,
            moves: session.moves,
            durationMs: session.durationMs,
            levelId: session.levelId,
            endedAt: session.endedAt,
          });
        }
      }

      const entries = [...best.values()]
        .sort((a, b) => a.moves - b.moves || a.durationMs - b.durationMs)
        .map((entry, index) => ({ rank: index + 1, ...entry }));

      json(res, 200, {
        game: puzzleGame,
        period,
        levelId,
        entries,
      });
      return;
    }

    error(res, 404, 'NOT_FOUND', 'Not found');
  } catch {
    error(res, 500, 'INTERNAL', 'Mock API failed');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock puzzle API on http://localhost:${PORT}`);
});
