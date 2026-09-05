import { neighborsOfBlank, type Board as BoardState } from '../puzzle/engine';

type BoardProps = {
  board: BoardState;
  disabled?: boolean;
  hintedIndex?: number | null;
  onMove: (index: number) => void;
};

export function Board({ board, disabled = false, hintedIndex = null, onMove }: BoardProps) {
  const size = Math.sqrt(board.length);
  const movable = new Set(neighborsOfBlank(board));

  return (
    <div
      className="board"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      role="grid"
      aria-label={`${size} by ${size} sliding puzzle`}
    >
      {board.map((value, index) => {
        if (value === 0) {
          return <div key={`empty-${index}`} className="tile tile-empty" role="gridcell" />;
        }

        const canMove = !disabled && movable.has(index);
        const hinted = hintedIndex === index;

        return (
          <button
            key={value}
            type="button"
            role="gridcell"
            className={`tile${hinted ? ' tile-hint' : ''}`}
            disabled={!canMove}
            onClick={() => onMove(index)}
            aria-label={`Tile ${value}${canMove ? ', slide' : ''}`}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
