import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/types';
import { useAuth } from '../auth/AuthContext';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'up' | 'down'>('checking');

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then(() => {
        if (!cancelled) {
          setApiStatus('up');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiStatus('down');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError('Could not reach the API. Is it running on port 3000?');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="hero">
        <p className="eyebrow">app-minigame</p>
        <h1>Slide the grove back into place.</h1>
        <p className="lede">
          A solo sliding-tile puzzle. The server issues the seed; the server derives the score. You
          just play.
        </p>
        <ul className="hero-points">
          <li>Board comes from the session <code>seed</code> + <code>levelId</code></li>
          <li>
            Finish sends <code>moves</code> and <code>durationMs</code> only
          </li>
          <li>Leaderboards rank the derived score</li>
        </ul>
      </section>

      <section className="panel auth-panel">
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
        </div>

        <form onSubmit={(event) => void onSubmit(event)} className="form">
          {mode === 'register' ? (
            <label>
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={32}
                required
                autoComplete="nickname"
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={mode === 'register' ? 8 : 1}
              required
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Enter the grove' : 'Create player'}
          </button>
        </form>

        <p className={`api-pill api-${apiStatus}`}>
          {apiStatus === 'checking' && 'Checking API…'}
          {apiStatus === 'up' && 'API reachable'}
          {apiStatus === 'down' && 'API unreachable — start the backend or `npm run mock`'}
        </p>
      </section>
    </main>
  );
}
