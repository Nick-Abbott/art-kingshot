const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");
const { generateAssignments } = require("./assignments");
const { buildPlayerLookupPayload } = require("./kingshot");

const app = express();
const port = process.env.PORT || 3001;
const RUN_CODE = (process.env.RUN_CODE || "").trim();

app.use(express.json());

const dbPath =
  process.env.DB_PATH ||
  path.join(__dirname, "data", "viking.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    playerId TEXT PRIMARY KEY,
    troopCount INTEGER NOT NULL,
    marchCount INTEGER NOT NULL,
    power INTEGER NOT NULL,
    playerName TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bear (
    playerId TEXT PRIMARY KEY,
    playerName TEXT NOT NULL,
    rallySize INTEGER NOT NULL,
    bearGroup TEXT NOT NULL CHECK (bearGroup IN ('bear1', 'bear2'))
  );
`);

// Migrate data from old bear1/bear2 tables to new bear table
try {
  const bear1Exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bear1'").get();
  const bear2Exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bear2'").get();
  
  if (bear1Exists) {
    db.prepare(`INSERT OR IGNORE INTO bear (playerId, playerName, rallySize, bearGroup) 
                SELECT playerId, playerName, rallySize, 'bear1' FROM bear1`).run();
    db.exec('DROP TABLE bear1');
  }
  
  if (bear2Exists) {
    db.prepare(`INSERT OR IGNORE INTO bear (playerId, playerName, rallySize, bearGroup) 
                SELECT playerId, playerName, rallySize, 'bear2' FROM bear2`).run();
    db.exec('DROP TABLE bear2');
  }
} catch (error) {
  console.log('Migration completed or not needed');
}

function loadMembers() {
  return db
    .prepare(
      "SELECT playerId, troopCount, marchCount, power, playerName FROM members"
    )
    .all();
}

function loadLastRun() {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'lastRun'").get();
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

function normalizeMemberPayload(body) {
  const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
  const troopCount = Number(body.troopCount);
  const playerName =
    typeof body.playerName === "string" ? body.playerName.trim() : "";
  const marchCount = Number(body.marchCount);
  const power = Number(body.power);

  if (!playerId) {
    return { error: "playerId is required." };
  }
  if (!Number.isFinite(troopCount) || troopCount <= 0) {
    return { error: "troopCount must be a positive number." };
  }
  if (!Number.isFinite(marchCount) || marchCount < 4 || marchCount > 6) {
    return { error: "marchCount must be between 4 and 6." };
  }
  if (!Number.isFinite(power) || power < 1000000) {
    return { error: "power must be at least 1,000,000." };
  }

  return { playerId, troopCount, marchCount, power, playerName };
}

function requireRunCode(req, res) {
  if (!RUN_CODE) {
    res.status(403).json({ error: "Run code not configured." });
    return false;
  }
  const provided =
    (req.header("x-run-code") || "").trim() ||
    (typeof req.body?.runCode === "string" ? req.body.runCode.trim() : "");
  if (provided && provided === RUN_CODE) return true;
  res.status(403).json({ error: "Invalid run code." });
  return false;
}

app.get("/api/members", (req, res) => {
  res.json({ members: loadMembers() });
});

app.post("/api/signup", (req, res) => {
  const normalized = normalizeMemberPayload(req.body || {});
  if (normalized.error) {
    res.status(400).json({ error: normalized.error });
    return;
  }

  db.prepare(
    `INSERT INTO members (playerId, troopCount, marchCount, power, playerName)
     VALUES (@playerId, @troopCount, @marchCount, @power, @playerName)
     ON CONFLICT(playerId) DO UPDATE SET
       troopCount=excluded.troopCount,
       marchCount=excluded.marchCount,
       power=excluded.power,
       playerName=excluded.playerName`
  ).run(normalized);

  res.json({ members: loadMembers() });
});

app.delete("/api/members/:playerId", (req, res) => {
  if (!requireRunCode(req, res)) return;
  const playerId =
    typeof req.params.playerId === "string" ? req.params.playerId.trim() : "";
  if (!playerId) {
    res.status(400).json({ error: "playerId is required." });
    return;
  }

  db.prepare("DELETE FROM members WHERE playerId = ?").run(playerId);
  res.json({ members: loadMembers() });
});

app.post("/api/run", (req, res) => {
  if (!requireRunCode(req, res)) return;
  try {
    const run = generateAssignments(loadMembers());
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('lastRun', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(JSON.stringify(run));
    res.json(run);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/player-lookup", async (req, res) => {
  const fid = typeof req.body?.fid === "string" ? req.body.fid.trim() : "";
  if (!fid) {
    res.status(400).json({ error: "fid is required." });
    return;
  }

  const payload = buildPlayerLookupPayload(fid);
  const body = new URLSearchParams(payload).toString();

  try {
    const response = await fetch(
      "https://kingshot-giftcode.centurygame.com/api/player",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }
    );

    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      data = { raw: text };
    }

    res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      status: response.status,
      data,
    });
  } catch (error) {
    res.status(502).json({ error: "Lookup request failed." });
  }
});

app.get("/api/results", (req, res) => {
  res.json({ results: loadLastRun() });
});

app.post("/api/reset", (req, res) => {
  if (!requireRunCode(req, res)) return;
  db.exec("DELETE FROM members; DELETE FROM meta WHERE key = 'lastRun';");
  res.json({ ok: true });
});

app.get("/api/bear/:group", (req, res) => {
  const group = req.params.group;
  if (group !== "bear1" && group !== "bear2") {
    res.status(400).json({ error: "Invalid bear group." });
    return;
  }
  const members = db.prepare(`SELECT playerId, playerName, rallySize FROM bear WHERE bearGroup = ?`).all(group);
  res.json({ members });
});

app.post("/api/bear/:group", (req, res) => {
  const group = req.params.group;
  if (group !== "bear1" && group !== "bear2") {
    res.status(400).json({ error: "Invalid bear group." });
    return;
  }
  const playerId = typeof req.body.playerId === "string" ? req.body.playerId.trim() : "";
  const playerName = typeof req.body.playerName === "string" ? req.body.playerName.trim() : "";
  const rallySize = Number(req.body.rallySize);

  if (!playerId) {
    res.status(400).json({ error: "playerId is required." });
    return;
  }
  if (!Number.isFinite(rallySize) || rallySize <= 0) {
    res.status(400).json({ error: "rallySize must be a positive number." });
    return;
  }

  const otherGroup = group === "bear1" ? "bear2" : "bear1";
  const existsInOther = db.prepare(`SELECT playerId FROM bear WHERE playerId = ? AND bearGroup = ?`).get(playerId, otherGroup);
  if (existsInOther) {
    res.status(400).json({ error: `Player is already in ${otherGroup === "bear1" ? "Bear 1" : "Bear 2"}.` });
    return;
  }

  db.prepare(
    `INSERT INTO bear (playerId, playerName, rallySize, bearGroup)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(playerId) DO UPDATE SET
       playerName=excluded.playerName,
       rallySize=excluded.rallySize,
       bearGroup=excluded.bearGroup`
  ).run(playerId, playerName, rallySize, group);

  const members = db.prepare(`SELECT playerId, playerName, rallySize FROM bear WHERE bearGroup = ?`).all(group);
  res.json({ members });
});

app.delete("/api/bear/:group", (req, res) => {
  if (!requireRunCode(req, res)) return;
  const group = req.params.group;
  if (group !== "bear1" && group !== "bear2") {
    res.status(400).json({ error: "Invalid bear group." });
    return;
  }

  db.prepare(`DELETE FROM bear WHERE bearGroup = ?`).run(group);
  const members = db.prepare(`SELECT playerId, playerName, rallySize FROM bear WHERE bearGroup = ?`).all(group);
  res.json({ members });
});

app.delete("/api/bear/:group/:playerId", (req, res) => {
  if (!requireRunCode(req, res)) return;
  const group = req.params.group;
  if (group !== "bear1" && group !== "bear2") {
    res.status(400).json({ error: "Invalid bear group." });
    return;
  }
  const playerId = typeof req.params.playerId === "string" ? req.params.playerId.trim() : "";
  if (!playerId) {
    res.status(400).json({ error: "playerId is required." });
    return;
  }

  db.prepare(`DELETE FROM bear WHERE playerId = ? AND bearGroup = ?`).run(playerId, group);
  const members = db.prepare(`SELECT playerId, playerName, rallySize FROM bear WHERE bearGroup = ?`).all(group);
  res.json({ members });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
