import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { conflict, unauthorized } from '../lib/errors.js';
import { verifyPassword } from '../lib/password.js';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/tokens.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  toPublicUser,
  type PublicUser,
  type UserRow,
} from './users.js';

export type AuthResult = {
  user: PublicUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
  };
};

type RefreshTokenRow = {
  id: string;
  user_id: string;
  jti: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
};

export async function register(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthResult> {
  const user = await createUser(input);
  return issueAuth(user);
}

export async function login(input: { email: string; password: string }): Promise<AuthResult> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw unauthorized('Invalid email or password');
  }

  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) {
    throw unauthorized('Invalid email or password');
  }

  return issueAuth(user);
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let claims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorized('Invalid refresh token');
  }

  const stored = await findRefreshToken(claims.jti);
  if (!stored || stored.revoked_at || stored.expires_at.getTime() <= Date.now()) {
    throw unauthorized('Invalid refresh token');
  }

  if (stored.token_hash !== hashToken(refreshToken) || stored.user_id !== claims.sub) {
    throw unauthorized('Invalid refresh token');
  }

  await revokeRefreshToken(claims.jti);

  const user = await findUserById(claims.sub);
  if (!user) {
    throw unauthorized('Invalid refresh token');
  }

  return issueAuth(user);
}

export async function logout(refreshToken: string): Promise<void> {
  let claims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    // Treat invalid tokens as already logged out so clients can clear state.
    return;
  }

  await revokeRefreshToken(claims.jti);
}

async function issueAuth(user: UserRow): Promise<AuthResult> {
  const accessToken = signAccessToken({ id: user.id, email: user.email });
  const refresh = signRefreshToken(user.id);

  try {
    await query(
      `INSERT INTO refresh_tokens (user_id, jti, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, refresh.jti, hashToken(refresh.token), refresh.expiresAt],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('TOKEN_CONFLICT', 'Could not issue refresh token, please retry');
    }
    throw error;
  }

  return {
    user: toPublicUser(user),
    tokens: {
      accessToken,
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      expiresIn: env.JWT_ACCESS_TTL,
    },
  };
}

async function findRefreshToken(jti: string): Promise<RefreshTokenRow | null> {
  const result = await query<RefreshTokenRow>(
    'SELECT * FROM refresh_tokens WHERE jti = $1 LIMIT 1',
    [jti],
  );
  return result.rows[0] ?? null;
}

async function revokeRefreshToken(jti: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE jti = $1 AND revoked_at IS NULL`,
    [jti],
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
