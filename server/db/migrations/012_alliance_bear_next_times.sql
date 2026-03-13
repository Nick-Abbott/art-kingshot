UPDATE alliances
SET config = json_remove(
  json_set(
    config,
    '$.bearNextTimes.bear1',
    printf('%sT%s:00.000Z', date('now'), json_extract(config, '$.bearTimes.bear1')),
    '$.bearNextTimes.bear2',
    printf('%sT%s:00.000Z', date('now'), json_extract(config, '$.bearTimes.bear2'))
  ),
  '$.bearTimes'
)
WHERE config IS NOT NULL
  AND json_extract(config, '$.bearNextTimes') IS NULL;
