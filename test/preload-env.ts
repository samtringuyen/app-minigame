process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://minigame:minigame@127.0.0.1:5432/minigame';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-chars!!';
