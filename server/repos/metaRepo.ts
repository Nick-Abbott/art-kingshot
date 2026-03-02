function createMetaRepo(db) {
  function setLastRun(allianceId, run) {
    db.prepare(
      "INSERT INTO meta (allianceId, key, value) VALUES (?, 'lastRun', ?) ON CONFLICT(allianceId, key) DO UPDATE SET value=excluded.value"
    ).run(allianceId, JSON.stringify(run));
  }

  function getLastRun(allianceId) {
    const row = db
      .prepare("SELECT value FROM meta WHERE allianceId = ? AND key = 'lastRun'")
      .get(allianceId);
    if (!row?.value) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }

  function clearLastRun(allianceId) {
    db.prepare("DELETE FROM meta WHERE allianceId = ? AND key = 'lastRun'").run(
      allianceId
    );
  }

  function clearAll(allianceId, membersRepo) {
    db.transaction(() => {
      membersRepo.clear(allianceId);
      clearLastRun(allianceId);
    })();
  }

  return { setLastRun, getLastRun, clearLastRun, clearAll };
}

module.exports = { createMetaRepo };

export {};
