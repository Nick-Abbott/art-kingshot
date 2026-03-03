UPDATE alliances
SET name = 'ArtsOFwar',
    kingdomId = 1459
WHERE id = 'art';

UPDATE alliances
SET kingdomId = 1459
WHERE kingdomId IS NULL;

CREATE TABLE IF NOT EXISTS alliances_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kingdomId INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);

INSERT INTO alliances_new (id, name, kingdomId, createdAt)
SELECT id, name, kingdomId, createdAt
FROM alliances;

DROP TABLE alliances;
ALTER TABLE alliances_new RENAME TO alliances;
