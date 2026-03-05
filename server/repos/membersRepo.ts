import type { Database } from "better-sqlite3";
import type { Member } from "../../shared/types";

export function createMembersRepo(db: Database) {
  function list(allianceId: string): Member[] {
    return db
      .prepare(
        "SELECT playerId, troopCount, marchCount, power, playerName FROM members WHERE allianceId = ?"
      )
      .all(allianceId) as Member[];
  }

  function clear(allianceId: string): void {
    db.prepare("DELETE FROM members WHERE allianceId = ?").run(allianceId);
  }

  function upsert(allianceId: string, member: Member): Member[] {
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

  function remove(allianceId: string, playerId: string): Member[] {
    db.prepare("DELETE FROM members WHERE allianceId = ? AND playerId = ?").run(
      allianceId,
      playerId
    );
    return list(allianceId);
  }

  return { list, upsert, remove, clear };
}

export type MembersRepo = ReturnType<typeof createMembersRepo>;
