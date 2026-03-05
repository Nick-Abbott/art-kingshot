import * as fs from "node:fs";
import * as path from "node:path";
import type { Database } from "better-sqlite3";

function ensureSchemaTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);
}

function listMigrations(dir: string): { name: string; path: string; sql: string }[] {
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

export function runMigrations(db: Database, dir: string): void {
  ensureSchemaTable(db);
  const appliedRows = db
    .prepare("SELECT name FROM schema_version ORDER BY id")
    .all() as { name: string }[];
  const applied = new Set(appliedRows.map((row) => row.name));

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
