CREATE TABLE IF NOT EXISTS profiles_new (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  playerId TEXT,
  playerName TEXT,
  kingdomId INTEGER,
  allianceId TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'alliance_admin')),
  troopCount INTEGER,
  marchCount INTEGER,
  power INTEGER,
  rallySize INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  UNIQUE (playerId)
);

INSERT INTO profiles_new (
  id,
  userId,
  playerId,
  playerName,
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
  p.id,
  p.userId,
  p.playerId,
  p.playerName,
  p.kingdomId,
  p.allianceId,
  CASE
    WHEN p.allianceId IS NULL OR p.allianceId = '' THEN 'pending'
    ELSE 'active'
  END,
  COALESCE(m.role, 'member'),
  p.troopCount,
  p.marchCount,
  p.power,
  NULL,
  unixepoch(),
  unixepoch()
FROM profiles p
LEFT JOIN memberships m
  ON m.userId = p.userId AND m.allianceId = p.allianceId;

DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;

CREATE INDEX IF NOT EXISTS profiles_user_idx ON profiles(userId);
CREATE INDEX IF NOT EXISTS profiles_alliance_status_idx ON profiles(allianceId, status);
