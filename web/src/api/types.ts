export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
};

export type AuthResult = {
  user: PublicUser;
  tokens: AuthTokens;
};

export type StartedSession = {
  sessionId: string;
  levelId: string;
  seed: string;
  gameId: string;
  startedAt: string;
};

export type FinishedSession = StartedSession & {
  score: number;
  moves: number;
  durationMs: number;
  status: 'finished';
  endedAt: string;
  meta: Record<string, unknown>;
};

export type LeaderboardPeriod = 'all' | 'weekly' | 'daily';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  moves: number;
  durationMs: number;
  levelId: string;
  endedAt: string;
};

export type PublicGame = {
  id: string;
  slug: string;
  title: string;
  rulesVersion: string;
  createdAt: string;
};

export type Leaderboard = {
  game: PublicGame;
  period: LeaderboardPeriod;
  levelId: string | null;
  entries: LeaderboardEntry[];
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
