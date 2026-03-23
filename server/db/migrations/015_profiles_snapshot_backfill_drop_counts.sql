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
  power INTEGER,
  rallySize INTEGER,
  troopsSnapshot TEXT,
  troopsSnapshotUpdatedAt INTEGER,
  botOptInAssignments INTEGER NOT NULL DEFAULT 1,
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
  power,
  rallySize,
  troopsSnapshot,
  troopsSnapshotUpdatedAt,
  botOptInAssignments,
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
  power,
  rallySize,
  CASE
    WHEN troopCount IS NOT NULL OR marchCount IS NOT NULL THEN json_object(
      'header',
      json_object(
        'totalTroops',
        troopCount,
        'marchQueues',
        marchCount,
        'infirmaryCapacity',
        0
      ),
      'troops',
      json('[]')
    )
    ELSE troopsSnapshot
  END,
  CASE
    WHEN troopCount IS NOT NULL OR marchCount IS NOT NULL THEN updatedAt
    ELSE troopsSnapshotUpdatedAt
  END,
  COALESCE(botOptInAssignments, 1),
  createdAt,
  updatedAt
FROM profiles;

DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;

CREATE INDEX IF NOT EXISTS profiles_user_idx ON profiles(userId);
CREATE INDEX IF NOT EXISTS profiles_alliance_status_idx ON profiles(allianceId, status);
CREATE INDEX IF NOT EXISTS profiles_kingdom_idx ON profiles(kingdomId);
