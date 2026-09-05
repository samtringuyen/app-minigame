# app-minigame

Backend for the minigame app: solo play, accounts, sessions, and leaderboards.

v1 is a small HTTP API. There are no rooms or WebSockets.

## Stack

- Node.js 20+ and TypeScript
- Fastify
- Postgres (required) with [node-pg-migrate](https://github.com/salsita/node-pg-migrate)
- Redis client (optional — the process boots and serves traffic if Redis is missing)
- JWT access + refresh tokens

## Local setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate up
npm run dev
```

The API listens on `http://localhost:3000` by default.

Without Docker, point `DATABASE_URL` at any Postgres 16 instance and optionally set `REDIS_URL`. Leave `REDIS_URL` empty to skip Redis.

### Useful scripts

| Script                 | Purpose                         |
| ---------------------- | ------------------------------- |
| `npm run dev`          | TypeScript watch server (`tsx`) |
| `npm run build`        | Compile to `dist/`              |
| `npm start`            | Run the compiled server         |
| `npm run migrate up`   | Apply pending migrations        |
| `npm run migrate down` | Roll back the latest migration  |
| `npm run lint`         | ESLint                          |
| `npm run format`       | Prettier                        |

## Environment

See `.env.example`. Required values:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET` (at least 32 characters)
- `JWT_REFRESH_SECRET` (at least 32 characters)

Optional:

- `REDIS_URL` — when unset, `/health` reports `"redis": "disabled"`
- `JWT_ACCESS_TTL` (default `15m`) and `JWT_REFRESH_TTL` (default `7d`)
- `MAX_SCORE` (default `1000000`)
- `CORS_ORIGIN` (`*` or a comma-separated list)

Do not commit `.env` or real secrets.

## HTTP API

All error responses use the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {}
  }
}
```

`details` is omitted when there is nothing extra to report.

Auth routes (`/auth/*`) are limited to 10 requests / IP / minute. Finishing a session is limited to 30 requests / IP / minute. Other routes share a global 300 / IP / minute cap.

### Health

`GET /health`

Returns `200` when Postgres answers, `503` if it does not. Redis never fails the process:

```json
{ "status": "ok", "postgres": "up", "redis": "up" }
```

`redis` can also be `"disabled"` or `"down"`.

### Auth

`POST /auth/register` `{ email, password, displayName }` → `201`

`POST /auth/login` `{ email, password }`

`POST /auth/refresh` `{ refreshToken }`

`POST /auth/logout` `{ refreshToken }` → `204`

Successful register / login / refresh:

```json
{
  "user": {
    "id": "...",
    "email": "...",
    "displayName": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "tokenType": "Bearer",
    "expiresIn": "15m"
  }
}
```

Send the access token as `Authorization: Bearer <token>`. Refresh tokens are JWTs stored hashed in Postgres so logout and rotation can revoke them. Password minimum is 8 characters.

### Player

`GET /me` (auth)

`PATCH /me` `{ displayName }` (auth)

### Games

`GET /games`

A `demo` game is seeded by migrations (`slug: "demo"`, `rules_version: "1"`).

### Sessions

`POST /sessions` `{ gameId }` or `{ gameSlug }` (auth) → `201`

`POST /sessions/:id/finish` `{ score, meta? }` (auth)

**Score rule:** `score` must be a finite number, `>= 0`, and `<= MAX_SCORE` (default **1,000,000**). Negative and absurdly high scores are rejected with `INVALID_SCORE`. Optional `meta` must be a JSON object smaller than 8 KB.

Finishing is **idempotent**: repeating `POST /sessions/:id/finish` on an already finished session returns the stored session and does not change score or meta. Abandoned sessions cannot be finished.

### Leaderboards

`GET /leaderboards/:gameIdOrSlug?period=all|weekly|daily`

`:gameIdOrSlug` accepts a game UUID or slug (for example `demo`).

- `all` — every finished session
- `weekly` — `ended_at` within the last 7 days
- `daily` — `ended_at` within the last 24 hours

Each player appears once, using their best score in that window (ties break by earlier `ended_at`).

## Project layout

```
src/
  app.ts              Fastify app + plugins
  index.ts            Process entry
  config/             Environment
  db/                 Postgres pool
  cache/              Optional Redis
  routes/             HTTP handlers
  services/           Business logic
  middleware/         Auth + error shape
  lib/                Tokens, passwords, validation
migrations/           node-pg-migrate files
```

## Out of scope (v1)

Realtime rooms, matchmaking, and WebSockets are intentionally omitted.
