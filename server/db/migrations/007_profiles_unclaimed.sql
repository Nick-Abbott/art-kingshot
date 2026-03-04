CREATE TABLE IF NOT EXISTS profiles_new (
  id TEXT PRIMARY KEY,
  userId TEXT,
  playerId TEXT NOT NULL UNIQUE,
  playerName TEXT,
  playerAvatar TEXT,
  kingdomId INTEGER,
  allianceId TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'alliance_admin')),
  troopCount INTEGER,
  marchCount INTEGER,
  power INTEGER,
  rallySize INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

INSERT INTO profiles_new (
  id,
  userId,
  playerId,
  playerName,
  playerAvatar,
  kingdomId,
  allianceId,
  status,
  role,
  troopCount,
  marchCount,
  power,
  rallySize,
  createdAt,
  updatedAt
)
SELECT
  id,
  userId,
  playerId,
  playerName,
  playerAvatar,
  kingdomId,
  allianceId,
  status,
  role,
  troopCount,
  marchCount,
  power,
  rallySize,
  createdAt,
  updatedAt
FROM profiles;

DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;

CREATE INDEX IF NOT EXISTS profiles_user_idx ON profiles(userId);
CREATE INDEX IF NOT EXISTS profiles_alliance_status_idx ON profiles(allianceId, status);
CREATE INDEX IF NOT EXISTS profiles_kingdom_idx ON profiles(kingdomId);
