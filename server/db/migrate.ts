const fs = require("node:fs");
const path = require("node:path");

function ensureSchemaTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);
}

function listMigrations(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      name: file,
      path: path.join(dir, file),
      sql: fs.readFileSync(path.join(dir, file), "utf8"),
    }));
}

function runMigrations(db, dir) {
  ensureSchemaTable(db);
  const applied = new Set(
    db
      .prepare("SELECT name FROM schema_version ORDER BY id")
      .all()
      .map((row) => row.name)
  );

  const migrations = listMigrations(dir);
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO schema_version (name, applied_at) VALUES (?, ?)"
      ).run(migration.name, Date.now());
    })();
  }
}

module.exports = { runMigrations };

export {};
