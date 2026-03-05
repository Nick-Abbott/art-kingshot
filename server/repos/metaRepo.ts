import type { Database } from "better-sqlite3";
import type { MembersRepo } from "./membersRepo";

export function createMetaRepo(db: Database) {
  function setLastRun(allianceId: string, run: unknown): void {
    db.prepare(
      "INSERT INTO meta (allianceId, key, value) VALUES (?, 'lastRun', ?) ON CONFLICT(allianceId, key) DO UPDATE SET value=excluded.value"
    ).run(allianceId, JSON.stringify(run));
  }

  function getLastRun(allianceId: string): unknown | null {
    const row = db
      .prepare("SELECT value FROM meta WHERE allianceId = ? AND key = 'lastRun'")
      .get(allianceId) as { value?: string } | undefined;
    if (!row?.value) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }

  function clearLastRun(allianceId: string): void {
    db.prepare("DELETE FROM meta WHERE allianceId = ? AND key = 'lastRun'").run(
      allianceId
    );
  }

  function clearAll(allianceId: string, membersRepo: MembersRepo): void {
    db.transaction(() => {
      membersRepo.clear(allianceId);
      clearLastRun(allianceId);
    })();
  }

  return { setLastRun, getLastRun, clearLastRun, clearAll };
}

export type MetaRepo = ReturnType<typeof createMetaRepo>;
