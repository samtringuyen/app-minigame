# Puzzle web client

Browser MVP for the solo sliding-tile puzzle. It talks to the HTTP API locked in
[backend PR #1](https://github.com/samtringuyen/app-minigame/pull/1).

The client **never invents a `seed`** and **never submits a raw `score`**.

- `POST /sessions` with `{ levelId, gameSlug: "puzzle" }` — use the returned
  `{ sessionId, levelId, seed, gameId, startedAt }`
- `POST /sessions/:id/finish` with `{ levelId, seed, moves, durationMs }` only
- `GET /leaderboards/puzzle?period=all|weekly|daily` (optional `levelId`)
- Auth: `POST /auth/register`, `/login`, `/refresh`, `/logout`, plus `GET /me`

## Run against the API

1. Start the Fastify API from PR #1 (`cursor/backend-scaffold-6323`) on
   `http://localhost:3000`.
2. In this folder:

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Create an account (password
at least 8 characters), start a session, slide tiles, finish, then open the
leaderboard.

`VITE_API_URL` defaults to empty so the Vite dev server proxies `/auth`,
`/sessions`, `/leaderboards`, `/games`, `/me`, and `/health` to
`http://localhost:3000` (override with `VITE_API_PROXY`). Set `VITE_API_URL` when
the built client should call a remote API directly.

Backend CORS in PR #1 accepts `*` by default, so a separate origin also works.

## Optional mock API

If the backend branch is not running locally, this folder includes an in-memory
stand-in that follows the same routes and score formula:

```
score = max(0, 100000 - moves * 100 - floor(durationMs / 100))
```

```bash
npm run mock
```

It listens on port 3000, issues a 16-byte hex seed on start, and rejects a client
`score` on finish. Do not use it in production.

## Puzzle

The board is a deterministic function of the **server** `seed` plus `levelId`.
Tiles slide into the empty cell. The HUD shows move count and a timer.

| `levelId` | Grid | Name |
| --------- | ---- | ---- |
| `level-1` | 3×3  | Grove |
| `level-2` | 3×3  | Garden (longer scramble) |
| `level-3` | 4×4  | Labyrinth |

Hint / skip / +moves are **rewarded-ad UI stubs** only (no ad SDK, no IAP). They
change local UX (glow a suggested tile, skip without finishing, or add a local
move budget). They are not sent on `finish`.

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Typecheck and production build |
| `npm test` | Puzzle engine + API contract unit tests |
| `npm run mock` | In-memory API on port 3000 |
| `npm run lint` | oxlint |
