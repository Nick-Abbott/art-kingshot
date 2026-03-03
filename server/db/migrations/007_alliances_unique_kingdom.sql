CREATE UNIQUE INDEX IF NOT EXISTS alliances_name_kingdom_unique
  ON alliances(name, kingdomId);

CREATE UNIQUE INDEX IF NOT EXISTS alliances_tag_kingdom_unique
  ON alliances(id, kingdomId);
