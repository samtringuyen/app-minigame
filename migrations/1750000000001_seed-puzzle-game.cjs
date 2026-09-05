/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO games (slug, title, rules_version)
    VALUES ('puzzle', 'Puzzle', '1')
    ON CONFLICT (slug) DO NOTHING;
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.sql(`DELETE FROM games WHERE slug = 'puzzle';`);
};
