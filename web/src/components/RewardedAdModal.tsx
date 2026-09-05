import { useEffect, useState } from 'react';

export type RewardKind = 'hint' | 'skip' | 'moves';

const COPY: Record<RewardKind, { title: string; grant: string }> = {
  hint: {
    title: 'Hint',
    grant: 'A suggested slide will glow on the board.',
  },
  skip: {
    title: 'Skip puzzle',
    grant: 'This session stays unfinished. The next level will start instead.',
  },
  moves: {
    title: 'More moves',
    grant: 'A local move budget boost will be added. Finish still sends real moves only.',
  },
};

type RewardedAdModalProps = {
  kind: RewardKind;
  onCancel: () => void;
  onComplete: (kind: RewardKind) => void;
};

export function RewardedAdModal({ kind, onCancel, onComplete }: RewardedAdModalProps) {
  const [progress, setProgress] = useState(0);
  const copy = COPY[kind];

  useEffect(() => {
    const started = Date.now();
    const duration = 1600;
    const frame = window.setInterval(() => {
      const next = Math.min(100, ((Date.now() - started) / duration) * 100);
      setProgress(next);
      if (next >= 100) {
        window.clearInterval(frame);
        onComplete(kind);
      }
    }, 50);
    return () => window.clearInterval(frame);
  }, [kind, onComplete]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="ad-title">
      <div className="modal">
        <p className="eyebrow">Rewarded ad stub</p>
        <h2 id="ad-title">{copy.title}</h2>
        <p className="lede">
          No ad SDK is loaded. This placeholder stands in for a future rewarded placement. It is
          never sent with <code>finish</code>.
        </p>
        <div className="ad-frame" aria-hidden="true">
          <span>Watching placeholder…</span>
          <div className="ad-bar">
            <div className="ad-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <p className="muted">{copy.grant}</p>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
