import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/types';
import type { Leaderboard, LeaderboardPeriod } from '../api/types';
import { LEVELS, formatDuration } from '../puzzle/engine';

type LeaderboardScreenProps = {
  userId?: string;
  onBack: () => void;
};

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'daily', label: 'Daily' },
];

export function LeaderboardScreen({ userId, onBack }: LeaderboardScreenProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [levelId, setLevelId] = useState('');
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .leaderboard(period, levelId || undefined)
      .then((result) => {
        if (!cancelled) {
          setBoard(result);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : 'Could not load leaderboard');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [period, levelId]);

  return (
    <section className="panel board-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Ranked by moves↑ then time↑</p>
          <h2>Leaderboard</h2>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back to puzzle
        </button>
      </div>

      <div className="filters">
        <div className="pills" role="tablist" aria-label="Period">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={period === item.id ? 'pill active' : 'pill'}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="inline-label">
          Level
          <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            <option value="">All levels</option>
            {LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {level.title} ({level.id})
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="muted">Loading rankings…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && board && board.entries.length === 0 ? (
        <p className="muted">No finished runs in this window yet. Solve a puzzle to take the board.</p>
      ) : null}

      {board && board.entries.length > 0 ? (
        <div className="table-wrap">
          <table className="ranks">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Score</th>
                <th>Moves</th>
                <th>Time</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((entry) => (
                <tr key={`${entry.userId}-${entry.endedAt}`} className={entry.userId === userId ? 'me' : undefined}>
                  <td>{entry.rank}</td>
                  <td>{entry.displayName}</td>
                  <td>{entry.score}</td>
                  <td>{entry.moves}</td>
                  <td>{formatDuration(entry.durationMs)}</td>
                  <td>{entry.levelId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
