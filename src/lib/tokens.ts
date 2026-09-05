import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AccessClaims = {
  sub: string;
  email: string;
  typ: 'access';
};

export type RefreshClaims = {
  sub: string;
  typ: 'refresh';
  jti: string;
};

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(user: { id: string; email: string }): string {
  return jwt.sign(
    { email: user.email, typ: 'access' } satisfies Omit<AccessClaims, 'sub'>,
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
    },
  );
}

export function signRefreshToken(userId: string): { token: string; jti: string; expiresAt: Date } {
  const jti = randomUUID();
  const token = jwt.sign(
    { typ: 'refresh' } satisfies Omit<RefreshClaims, 'sub' | 'jti'>,
    env.JWT_REFRESH_SECRET,
    {
      subject: userId,
      jwtid: jti,
      expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'],
    },
  );

  const decoded = jwt.decode(token);
  const exp =
    decoded && typeof decoded === 'object' && typeof decoded.exp === 'number'
      ? decoded.exp
      : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  return {
    token,
    jti,
    expiresAt: new Date(exp * 1000),
  };
}

export function verifyAccessToken(token: string): AccessClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof payload.sub !== 'string' ||
    payload.typ !== 'access' ||
    typeof payload.email !== 'string'
  ) {
    throw new Error('Invalid access token');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    typ: 'access',
  };
}

export function verifyRefreshToken(token: string): RefreshClaims {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof payload.sub !== 'string' ||
    payload.typ !== 'refresh' ||
    typeof payload.jti !== 'string'
  ) {
    throw new Error('Invalid refresh token');
  }

  return {
    sub: payload.sub,
    typ: 'refresh',
    jti: payload.jti,
  };
}
