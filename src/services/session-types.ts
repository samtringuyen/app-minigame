export type SessionStatus = 'active' | 'finished' | 'abandoned';

export type SessionRow = {
  id: string;
  user_id: string;
  game_id: string;
  started_at: Date;
  ended_at: Date | null;
  level_id: string;
  seed: string;
  moves: number | null;
  duration_ms: number | null;
  score: number | null;
  meta: Record<string, unknown>;
  status: SessionStatus;
};
