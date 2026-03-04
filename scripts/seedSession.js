const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");
const fs = require("node:fs");

function parseArgs(argv) {
  const args = { appAdmin: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db") {
      args.dbPath = argv[i + 1];
      i += 1;
    } else if (arg === "--discord-id") {
      args.discordId = argv[i + 1];
      i += 1;
    } else if (arg === "--display-name") {
      args.displayName = argv[i + 1];
      i += 1;
    } else if (arg === "--app-admin") {
      args.appAdmin = true;
    }
  }
  return args;
}

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

function ensureValue(value, name) {
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required.`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureValue(args.dbPath, "--db");

  const dbPath = args.dbPath;
  const discordId =
    args.discordId || `session-${crypto.randomBytes(6).toString("hex")}`;
  const displayName = args.displayName || "Session User";
  const now = Date.now();

  const db = new Database(dbPath);
  runMigrations(db, path.join(process.cwd(), "server", "db", "migrations"));

  const userId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO users (id, discordId, displayName, avatar, isAppAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, discordId, displayName, null, args.appAdmin ? 1 : 0, now);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = now + 14 * 24 * 60 * 60 * 1000;
  db.prepare(
    "INSERT INTO sessions (token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)"
  ).run(token, userId, expiresAt, now);

  db.close();
  process.stdout.write(token);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
