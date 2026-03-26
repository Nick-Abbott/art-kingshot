import type { Database } from "better-sqlite3";
import type { VikingMember } from "../../shared/types";

export function createVikingsRepo(db: Database) {
  function list(allianceId: string): VikingMember[] {
    return db
      .prepare(
        `SELECT vikings.playerId,
                COALESCE(profiles.playerName, vikings.playerName) AS playerName,
                COALESCE(json_extract(profiles.troopsSnapshot, '$.header.totalTroops'), 0) AS troopCount,
                COALESCE(json_extract(profiles.troopsSnapshot, '$.header.marchQueues'), 0) AS marchCount,
                COALESCE(profiles.power, 0) AS power
         FROM vikings
         LEFT JOIN profiles
           ON profiles.playerId = vikings.playerId
          AND profiles.allianceId = vikings.allianceId
         WHERE vikings.allianceId = ?`
      )
      .all(allianceId) as VikingMember[];
  }

  function clear(allianceId: string): void {
    db.prepare("DELETE FROM vikings WHERE allianceId = ?").run(allianceId);
  }

  function upsert(allianceId: string, member: VikingMember): VikingMember[] {
    db.prepare(
      `INSERT INTO vikings (allianceId, playerId, troopCount, marchCount, power, playerName)
       VALUES (@allianceId, @playerId, @troopCount, @marchCount, @power, @playerName)
       ON CONFLICT(allianceId, playerId) DO UPDATE SET
         troopCount=excluded.troopCount,
         marchCount=excluded.marchCount,
         power=excluded.power,
         playerName=excluded.playerName`
    ).run({ allianceId, ...member });
    return list(allianceId);
  }

  function remove(allianceId: string, playerId: string): VikingMember[] {
    db.prepare("DELETE FROM vikings WHERE allianceId = ? AND playerId = ?").run(
      allianceId,
      playerId
    );
    return list(allianceId);
  }

  return { list, upsert, remove, clear };
}

export type VikingsRepo = ReturnType<typeof createVikingsRepo>;
