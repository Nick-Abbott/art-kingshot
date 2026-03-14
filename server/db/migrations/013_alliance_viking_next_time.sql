UPDATE alliances
SET config = json_set(
  COALESCE(config, '{}'),
  '$.vikingNextTime',
  '2026-03-10T02:00:00.000Z'
)
WHERE json_extract(config, '$.vikingNextTime') IS NULL;
