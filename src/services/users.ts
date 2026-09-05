import { query } from '../db/pool.js';
import { conflict, notFound } from '../lib/errors.js';
import { hashPassword } from '../lib/password.js';

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: Date;
  updated_at: Date;
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await query<UserRow>('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return result.rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<UserRow> {
  const passwordHash = await hashPassword(input.password);

  try {
    const result = await query<UserRow>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.email, passwordHash, input.displayName],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create user');
    }
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw error;
  }
}

export async function updateDisplayName(userId: string, displayName: string): Promise<UserRow> {
  const result = await query<UserRow>(
    `UPDATE users
     SET display_name = $2
     WHERE id = $1
     RETURNING *`,
    [userId, displayName],
  );
  const row = result.rows[0];
  if (!row) {
    throw notFound('User not found');
  }
  return row;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
