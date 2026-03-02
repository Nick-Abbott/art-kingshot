CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  discordId TEXT UNIQUE NOT NULL,
  displayName TEXT NOT NULL,
  avatar TEXT,
  isAppAdmin INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alliances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  allianceId TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member', 'alliance_admin')),
  createdAt INTEGER NOT NULL,
  UNIQUE (userId, allianceId)
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  allianceId TEXT NOT NULL,
  playerId TEXT,
  playerName TEXT,
  troopCount INTEGER,
  marchCount INTEGER,
  power INTEGER,
  UNIQUE (userId, allianceId)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_bootstrap (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  allianceId TEXT NOT NULL,
  playerId TEXT NOT NULL,
  troopCount INTEGER NOT NULL,
  marchCount INTEGER NOT NULL,
  power INTEGER NOT NULL,
  playerName TEXT NOT NULL,
  PRIMARY KEY (allianceId, playerId)
);

CREATE TABLE IF NOT EXISTS meta (
  allianceId TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (allianceId, key)
);

CREATE TABLE IF NOT EXISTS bear (
  allianceId TEXT NOT NULL,
  playerId TEXT NOT NULL,
  playerName TEXT NOT NULL,
  rallySize INTEGER NOT NULL,
  bearGroup TEXT NOT NULL CHECK (bearGroup IN ('bear1', 'bear2')),
  PRIMARY KEY (allianceId, playerId)
);
