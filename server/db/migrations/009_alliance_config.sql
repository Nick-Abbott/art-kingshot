ALTER TABLE alliances ADD COLUMN config TEXT NOT NULL DEFAULT '{"bearTimes":{"bear1":"01:00","bear2":"12:00"}}';
UPDATE alliances
SET config = '{"bearTimes":{"bear1":"01:00","bear2":"12:00"}}'
WHERE config IS NULL;
