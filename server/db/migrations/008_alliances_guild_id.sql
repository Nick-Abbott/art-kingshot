ALTER TABLE alliances ADD COLUMN guildId TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS alliances_guild_unique
  ON alliances(guildId)
  WHERE guildId IS NOT NULL;
