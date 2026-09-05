import { query } from '../db/pool.js';
import { isUuid } from '../lib/ids.js';
import { notFound } from '../lib/errors.js';

export type GameRow = {
  id: string;
  slug: string;
  title: string;
  rules_version: string;
  created_at: Date;
};

export type PublicGame = {
  id: string;
  slug: string;
  title: string;
  rulesVersion: string;
  createdAt: string;
};

export function toPublicGame(row: GameRow): PublicGame {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    rulesVersion: row.rules_version,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listGames(): Promise<PublicGame[]> {
  const result = await query<GameRow>('SELECT * FROM games ORDER BY title ASC');
  return result.rows.map(toPublicGame);
}

export async function findGameByIdOrSlug(gameIdOrSlug: string): Promise<GameRow | null> {
  if (isUuid(gameIdOrSlug)) {
    const byId = await query<GameRow>('SELECT * FROM games WHERE id = $1 LIMIT 1', [gameIdOrSlug]);
    if (byId.rows[0]) {
      return byId.rows[0];
    }
  }

  const bySlug = await query<GameRow>('SELECT * FROM games WHERE slug = $1 LIMIT 1', [
    gameIdOrSlug,
  ]);
  return bySlug.rows[0] ?? null;
}

export async function requireGame(gameIdOrSlug: string): Promise<GameRow> {
  const game = await findGameByIdOrSlug(gameIdOrSlug);
  if (!game) {
    throw notFound('Game not found');
  }
  return game;
}
