import { finishSessionBody, startSessionBody } from './contract';
import {
  ApiError,
  type AuthResult,
  type FinishedSession,
  type Leaderboard,
  type LeaderboardPeriod,
  type PublicGame,
  type PublicUser,
  type StartedSession,
} from './types';

const STORAGE_ACCESS = 'minigame.accessToken';
const STORAGE_REFRESH = 'minigame.refreshToken';
const STORAGE_USER = 'minigame.user';

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

let accessToken: string | null = localStorage.getItem(STORAGE_ACCESS);
let refreshToken: string | null = localStorage.getItem(STORAGE_REFRESH);
let refreshInFlight: Promise<boolean> | null = null;

export function getStoredUser(): PublicUser | null {
  const raw = localStorage.getItem(STORAGE_USER);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PublicUser;
  } catch {
    return null;
  }
}

export function persistAuth(result: AuthResult): void {
  accessToken = result.tokens.accessToken;
  refreshToken = result.tokens.refreshToken;
  localStorage.setItem(STORAGE_ACCESS, result.tokens.accessToken);
  localStorage.setItem(STORAGE_REFRESH, result.tokens.refreshToken);
  localStorage.setItem(STORAGE_USER, JSON.stringify(result.user));
}

export function clearAuth(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(STORAGE_ACCESS);
  localStorage.removeItem(STORAGE_REFRESH);
  localStorage.removeItem(STORAGE_USER);
}

export function hasRefreshToken(): boolean {
  return Boolean(refreshToken);
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    return new ApiError(
      response.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? response.statusText,
      body.error?.details,
    );
  } catch {
    return new ApiError(response.status, 'UNKNOWN', response.statusText);
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) {
    return false;
  }
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        clearAuth();
        return false;
      }
      const result = (await response.json()) as AuthResult;
      persistAuth(result);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

type RequestOptions = RequestInit & { auth?: boolean };

async function request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.auth !== false && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry && options.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>('/health', { auth: false }),

  register: (input: { email: string; password: string; displayName: string }) =>
    request<AuthResult>('/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(input),
    }),

  login: (input: { email: string; password: string }) =>
    request<AuthResult>('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(input),
    }),

  logout: async () => {
    const token = refreshToken;
    if (token) {
      try {
        await request<void>('/auth/logout', {
          method: 'POST',
          auth: false,
          body: JSON.stringify({ refreshToken: token }),
        });
      } catch {
        // Client still clears local session.
      }
    }
    clearAuth();
  },

  me: () => request<{ user: PublicUser }>('/me'),

  games: () => request<{ games: PublicGame[] }>('/games', { auth: false }),

  startSession: (levelId: string) =>
    request<StartedSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(startSessionBody(levelId)),
    }),

  finishSession: (sessionId: string, input: Parameters<typeof finishSessionBody>[0]) =>
    request<FinishedSession>(`/sessions/${sessionId}/finish`, {
      method: 'POST',
      body: JSON.stringify(finishSessionBody(input)),
    }),

  leaderboard: (period: LeaderboardPeriod, levelId?: string) => {
    const params = new URLSearchParams({ period });
    if (levelId) {
      params.set('levelId', levelId);
    }
    return request<Leaderboard>(`/leaderboards/puzzle?${params.toString()}`, { auth: false });
  },
};
