import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, clearAuth, getStoredUser, hasRefreshToken, persistAuth } from '../api/client';
import { ApiError, type PublicUser } from '../api/types';

type AuthContextValue = {
  user: PublicUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(getStoredUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!hasRefreshToken() && !getStoredUser()) {
        if (!cancelled) {
          setReady(true);
        }
        return;
      }

      try {
        const result = await api.me();
        if (!cancelled) {
          setUser(result.user);
          localStorage.setItem('minigame.user', JSON.stringify(result.user));
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearAuth();
          if (!cancelled) {
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login({ email, password });
    persistAuth(result);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await api.register({ email, password, displayName });
    persistAuth(result);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
