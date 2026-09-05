import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { ApiError, type FinishedSession, type StartedSession } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import {
  BONUS_MOVES,
  LEVELS,
  formatDuration,
  generateBoard,
  getLevel,
  hintIndex,
  isSolved,
  nextLevelId,
  tryMove,
  type Board as BoardState,
  type LevelId,
} from '../puzzle/engine';
import { Board } from './Board';
import { LeaderboardScreen } from './LeaderboardScreen';
import { RewardedAdModal, type RewardKind } from './RewardedAdModal';

type View = 'play' | 'leaderboard';

type PendingBoosts = {
  extraMoves: number;
  autoHint: boolean;
};

export function PlayScreen() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('play');
  const [levelId, setLevelId] = useState<LevelId>('level-1');
  const [session, setSession] = useState<StartedSession | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  const [moves, setMoves] = useState(0);
  const [budget, setBudget] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinishedSession | null>(null);
  const [adKind, setAdKind] = useState<RewardKind | null>(null);
  const [boosts, setBoosts] = useState<PendingBoosts>({ extraMoves: 0, autoHint: false });
  const playStartedAt = useRef<number | null>(null);

  const level = getLevel(session?.levelId ?? levelId);
  const outOfMoves = Boolean(session && board && budget <= 0 && !result);

  useEffect(() => {
    if (!session || result) {
      return undefined;
    }
    const tick = window.setInterval(() => {
      if (playStartedAt.current) {
        setElapsedMs(Date.now() - playStartedAt.current);
      }
    }, 100);
    return () => window.clearInterval(tick);
  }, [session, result]);

  const startLevel = useCallback(
    async (nextLevel: LevelId, pending = boosts) => {
      setBusy(true);
      setError(null);
      setResult(null);
      setHinted(null);
      try {
        const started = await api.startSession(nextLevel);
        const generated = generateBoard(started.seed, started.levelId);
        const config = getLevel(started.levelId);
        setSession(started);
        setBoard(generated);
        setMoves(0);
        setBudget(config.moveBudget + pending.extraMoves);
        setElapsedMs(0);
        playStartedAt.current = Date.now();
        setLevelId(started.levelId as LevelId);
        setHinted(pending.autoHint ? hintIndex(generated) : null);
        setBoosts({ extraMoves: 0, autoHint: false });
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Could not start a session');
      } finally {
        setBusy(false);
      }
    },
    [boosts],
  );

  const finishRun = useCallback(
    async (currentBoard: BoardState, currentMoves: number) => {
      if (!session || !isSolved(currentBoard)) {
        return;
      }
      const durationMs = playStartedAt.current ? Date.now() - playStartedAt.current : 0;
      setBusy(true);
      try {
        const finished = await api.finishSession(session.sessionId, {
          levelId: session.levelId,
          seed: session.seed,
          moves: currentMoves,
          durationMs,
        });
        setResult(finished);
        setElapsedMs(finished.durationMs);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Could not finish the session');
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  function onMove(index: number) {
    if (!board || !session || result || outOfMoves) {
      return;
    }
    const next = tryMove(board, index);
    if (!next) {
      return;
    }
    const nextMoves = moves + 1;
    setBoard(next);
    setMoves(nextMoves);
    setBudget((current) => Math.max(0, current - 1));
    setHinted(null);
    if (isSolved(next)) {
      void finishRun(next, nextMoves);
    }
  }

  function requestReward(kind: RewardKind) {
    if (busy) {
      return;
    }
    if (kind === 'skip' && (!session || result)) {
      return;
    }
    setAdKind(kind);
  }

  const onAdComplete = useCallback(
    (kind: RewardKind) => {
      setAdKind(null);
      if (kind === 'hint') {
        if (board && session && !result) {
          setHinted(hintIndex(board));
        } else {
          setBoosts((current) => ({ ...current, autoHint: true }));
        }
        return;
      }
      if (kind === 'moves') {
        if (session && !result) {
          setBudget((current) => current + BONUS_MOVES);
        } else {
          setBoosts((current) => ({ ...current, extraMoves: current.extraMoves + BONUS_MOVES }));
        }
        return;
      }
      if (kind === 'skip') {
        const upcoming = nextLevelId(session?.levelId ?? levelId);
        setSession(null);
        setBoard(null);
        setResult(null);
        void startLevel(upcoming);
      }
    },
    [board, levelId, result, session, startLevel],
  );

  if (view === 'leaderboard') {
    return (
      <div className="app-shell">
        <Header
          displayName={user?.displayName ?? 'Player'}
          onLeaderboard={() => setView('play')}
          onLogout={() => void logout()}
          leaderboardOpen
        />
        <LeaderboardScreen userId={user?.id} onBack={() => setView('play')} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header
        displayName={user?.displayName ?? 'Player'}
        onLeaderboard={() => setView('leaderboard')}
        onLogout={() => void logout()}
      />

      <div className="play-grid">
        <section className="panel">
          <p className="eyebrow">Choose a clearing</p>
          <h2>Levels</h2>
          <div className="level-list">
            {LEVELS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={levelId === item.id ? 'level-card active' : 'level-card'}
                onClick={() => setLevelId(item.id)}
                disabled={busy}
              >
                <strong>{item.title}</strong>
                <span>
                  {item.size}×{item.size} · {item.id}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void startLevel(levelId)}
          >
            {session ? 'New session' : 'Start session'}
          </button>
          <p className="muted compact">
            Starts <code>POST /sessions</code>. The board is built from the server seed — the client
            does not invent one.
          </p>
        </section>

        <section className="panel table-panel">
          <div className="hud">
            <HudStat label="Moves" value={String(moves)} />
            <HudStat label="Budget" value={session ? String(budget) : '—'} />
            <HudStat label="Time" value={formatDuration(elapsedMs)} />
            <HudStat label="Level" value={session?.levelId ?? level.id} />
          </div>

          {session && board ? (
            <>
              <Board
                board={board}
                disabled={busy || Boolean(result) || outOfMoves}
                hintedIndex={hinted}
                onMove={onMove}
              />
              {outOfMoves ? (
                <p className="warn">Out of local moves. The +moves stub restores the budget.</p>
              ) : null}
            </>
          ) : (
            <div className="board-placeholder">
              <p>Start a session to deal a seeded board.</p>
            </div>
          )}

          {session ? (
            <p className="seed-line">
              seed <code>{session.seed}</code>
            </p>
          ) : null}

          {error ? <p className="error">{error}</p> : null}

          <div className="reward-row">
            <button
              type="button"
              className="btn btn-ghost"
              data-testid="reward-hint"
              disabled={busy || Boolean(result)}
              onClick={() => requestReward('hint')}
            >
              Hint
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              data-testid="reward-skip"
              disabled={busy || Boolean(result) || !session}
              onClick={() => requestReward('skip')}
            >
              Skip
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              data-testid="reward-moves"
              disabled={busy || Boolean(result)}
              onClick={() => requestReward('moves')}
            >
              +Moves
            </button>
          </div>
          <p className="muted compact">
            Hint / skip / +moves are rewarded-ad stubs only. They never go into the finish body.
          </p>
        </section>
      </div>

      {result ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="modal">
            <p className="eyebrow">Server-derived score</p>
            <h2 id="result-title">Grove restored</h2>
            <p className="score-xl">{result.score}</p>
            <p className="muted">
              {result.moves} moves · {formatDuration(result.durationMs)} · {result.levelId}
            </p>
            <p className="lede">
              Submitted <code>levelId</code>, <code>seed</code>, <code>moves</code>, and{' '}
              <code>durationMs</code>. Score was computed by the API.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void startLevel(result.levelId as LevelId)}
              >
                Play again
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void startLevel(nextLevelId(result.levelId))}
              >
                Next level
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setView('leaderboard')}>
                Leaderboard
              </button>
            </div>
            <div className="reward-row between">
              <p className="muted">Boost the next round (stub)</p>
              <button
                type="button"
                className="btn btn-ghost"
                data-testid="reward-hint-next"
                onClick={() => requestReward('hint')}
              >
                Hint next
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                data-testid="reward-moves-next"
                onClick={() => requestReward('moves')}
              >
                +Moves next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adKind ? (
        <RewardedAdModal
          kind={adKind}
          onCancel={() => setAdKind(null)}
          onComplete={onAdComplete}
        />
      ) : null}
    </div>
  );
}

function Header({
  displayName,
  onLeaderboard,
  onLogout,
  leaderboardOpen = false,
}: {
  displayName: string;
  onLeaderboard: () => void;
  onLogout: () => void;
  leaderboardOpen?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="mark" aria-hidden="true" />
        <div>
          <strong>Puzzle</strong>
          <span>seeded sliding tiles</span>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="who">{displayName}</span>
        <button type="button" className="btn btn-ghost" onClick={onLeaderboard}>
          {leaderboardOpen ? 'Puzzle' : 'Leaderboard'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}

function HudStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
