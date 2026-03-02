function createMembersRepo(db) {
  function list(allianceId) {
    return db
      .prepare(
        "SELECT playerId, troopCount, marchCount, power, playerName FROM members WHERE allianceId = ?"
      )
      .all(allianceId);
  }

  function clear(allianceId) {
    db.prepare("DELETE FROM members WHERE allianceId = ?").run(allianceId);
  }

  function upsert(allianceId, member) {
    db.prepare(
      `INSERT INTO members (allianceId, playerId, troopCount, marchCount, power, playerName)
       VALUES (@allianceId, @playerId, @troopCount, @marchCount, @power, @playerName)
       ON CONFLICT(allianceId, playerId) DO UPDATE SET
         troopCount=excluded.troopCount,
         marchCount=excluded.marchCount,
         power=excluded.power,
         playerName=excluded.playerName`
    ).run({ allianceId, ...member });
    return list(allianceId);
  }

  function remove(allianceId, playerId) {
    db.prepare("DELETE FROM members WHERE allianceId = ? AND playerId = ?").run(
      allianceId,
      playerId
    );
    return list(allianceId);
  }

  return { list, upsert, remove, clear };
}

module.exports = { createMembersRepo };

export {};
