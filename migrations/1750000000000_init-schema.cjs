/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    display_name: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);

  pgm.createTable('games', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    slug: { type: 'text', notNull: true, unique: true },
    title: { type: 'text', notNull: true },
    rules_version: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createTable('game_sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    game_id: {
      type: 'uuid',
      notNull: true,
      references: 'games',
      onDelete: 'RESTRICT',
    },
    started_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    ended_at: { type: 'timestamptz' },
    level_id: { type: 'text', notNull: true },
    seed: { type: 'text', notNull: true },
    moves: { type: 'integer' },
    duration_ms: { type: 'integer' },
    score: { type: 'integer' },
    meta: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    status: { type: 'text', notNull: true, default: 'active' },
  });

  pgm.addConstraint('game_sessions', 'game_sessions_status_check', {
    check: "status IN ('active', 'finished', 'abandoned')",
  });

  pgm.createIndex('game_sessions', ['user_id']);
  pgm.createIndex('game_sessions', ['game_id', 'status', 'ended_at']);
  pgm.createIndex('game_sessions', ['game_id', 'level_id', 'score'], {
    where: "status = 'finished' AND score IS NOT NULL",
  });

  // Refresh tokens are stored hashed so logout / rotation can revoke them.
  pgm.createTable('refresh_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    jti: { type: 'uuid', notNull: true, unique: true },
    token_hash: { type: 'text', notNull: true, unique: true },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('refresh_tokens', ['user_id']);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('game_sessions');
  pgm.dropTable('games');
  pgm.dropTable('users');
  pgm.sql('DROP FUNCTION IF EXISTS set_updated_at()');
};
