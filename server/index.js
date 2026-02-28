const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");
const { generateAssignments } = require("./assignments");
const { buildPlayerLookupPayload } = require("./kingshot");

const app = express();
const port = process.env.PORT || 3001;
const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:5173").trim();
const DISCORD_CLIENT_ID = (process.env.DISCORD_CLIENT_ID || "").trim();
const DISCORD_CLIENT_SECRET = (process.env.DISCORD_CLIENT_SECRET || "").trim();
const DISCORD_REDIRECT_URI = (process.env.DISCORD_REDIRECT_URI || "").trim();
const SESSION_TTL_DAYS_RAW = Number(process.env.SESSION_TTL_DAYS || "14");
const SESSION_TTL_DAYS = Number.isFinite(SESSION_TTL_DAYS_RAW)
  ? SESSION_TTL_DAYS_RAW
  : 14;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const DEFAULT_ALLIANCE_ID = (process.env.DEFAULT_ALLIANCE_ID || "art").trim();
const DEFAULT_ALLIANCE_NAME = (process.env.DEFAULT_ALLIANCE_NAME || "ART Alliance").trim();
const DEV_BYPASS_TOKEN = (process.env.DEV_BYPASS_TOKEN || "").trim();
const isProduction = process.env.NODE_ENV === "production";

app.use(express.json());
app.set("trust proxy", 1);

const dbPath =
  process.env.DB_PATH ||
  path.join(__dirname, "data", "viking.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    discordId TEXT UNIQUE NOT NULL,
    displayName TEXT NOT NULL,
    avatar TEXT,
    isAppAdmin INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS alliances (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    allianceId TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('member', 'alliance_admin')),
    createdAt INTEGER NOT NULL,
    UNIQUE (userId, allianceId)
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    allianceId TEXT NOT NULL,
    playerId TEXT,
    playerName TEXT,
    troopCount INTEGER,
    marchCount INTEGER,
    power INTEGER,
    UNIQUE (userId, allianceId)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS members (
    allianceId TEXT NOT NULL,
    playerId TEXT NOT NULL,
    troopCount INTEGER NOT NULL,
    marchCount INTEGER NOT NULL,
    power INTEGER NOT NULL,
    playerName TEXT NOT NULL,
    PRIMARY KEY (allianceId, playerId)
  );
  CREATE TABLE IF NOT EXISTS meta (
    allianceId TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (allianceId, key)
  );
  CREATE TABLE IF NOT EXISTS bear (
    allianceId TEXT NOT NULL,
    playerId TEXT NOT NULL,
    playerName TEXT NOT NULL,
    rallySize INTEGER NOT NULL,
    bearGroup TEXT NOT NULL CHECK (bearGroup IN ('bear1', 'bear2')),
    PRIMARY KEY (allianceId, playerId)
  );
`);

function columnExists(table, column) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    return columns.some((col) => col.name === column);
  } catch {
    return false;
  }
}

function ensureDefaultAlliance() {
  const existing = db.prepare("SELECT id FROM alliances WHERE id = ?").get(DEFAULT_ALLIANCE_ID);
  if (!existing) {
    db.prepare(
      "INSERT INTO alliances (id, name, createdAt) VALUES (?, ?, ?)"
    ).run(DEFAULT_ALLIANCE_ID, DEFAULT_ALLIANCE_NAME, Date.now());
  }
}

function migrateMembers(allianceId) {
  if (columnExists("members", "allianceId")) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS members_new (
      allianceId TEXT NOT NULL,
      playerId TEXT NOT NULL,
      troopCount INTEGER NOT NULL,
      marchCount INTEGER NOT NULL,
      power INTEGER NOT NULL,
      playerName TEXT NOT NULL,
      PRIMARY KEY (allianceId, playerId)
    );
  `);
  db.prepare(
    `INSERT INTO members_new (allianceId, playerId, troopCount, marchCount, power, playerName)
     SELECT ?, playerId, troopCount, marchCount, power, playerName FROM members`
  ).run(allianceId);
  db.exec("DROP TABLE members;");
  db.exec("ALTER TABLE members_new RENAME TO members;");
}

function migrateMeta(allianceId) {
  if (columnExists("meta", "allianceId")) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta_new (
      allianceId TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (allianceId, key)
    );
  `);
  db.prepare(
    `INSERT INTO meta_new (allianceId, key, value)
     SELECT ?, key, value FROM meta`
  ).run(allianceId);
  db.exec("DROP TABLE meta;");
  db.exec("ALTER TABLE meta_new RENAME TO meta;");
}

function migrateBear(allianceId) {
  const bearHasAlliance = columnExists("bear", "allianceId");
  if (!bearHasAlliance) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bear_new (
        allianceId TEXT NOT NULL,
        playerId TEXT NOT NULL,
        playerName TEXT NOT NULL,
        rallySize INTEGER NOT NULL,
        bearGroup TEXT NOT NULL CHECK (bearGroup IN ('bear1', 'bear2')),
        PRIMARY KEY (allianceId, playerId)
      );
    `);
    if (columnExists("bear", "bearGroup")) {
      db.prepare(
        `INSERT INTO bear_new (allianceId, playerId, playerName, rallySize, bearGroup)
         SELECT ?, playerId, playerName, rallySize, bearGroup FROM bear`
      ).run(allianceId);
      db.exec("DROP TABLE bear;");
      db.exec("ALTER TABLE bear_new RENAME TO bear;");
    }
  }

  try {
    const bear1Exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bear1'")
      .get();
    const bear2Exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bear2'")
      .get();

    if (bear1Exists) {
      db.prepare(
        `INSERT OR IGNORE INTO bear (allianceId, playerId, playerName, rallySize, bearGroup)
         SELECT ?, playerId, playerName, rallySize, 'bear1' FROM bear1`
      ).run(allianceId);
      db.exec("DROP TABLE bear1");
    }

    if (bear2Exists) {
      db.prepare(
        `INSERT OR IGNORE INTO bear (allianceId, playerId, playerName, rallySize, bearGroup)
         SELECT ?, playerId, playerName, rallySize, 'bear2' FROM bear2`
      ).run(allianceId);
      db.exec("DROP TABLE bear2");
    }
  } catch (error) {
    console.log("Migration completed or not needed");
  }
}

ensureDefaultAlliance();
migrateMembers(DEFAULT_ALLIANCE_ID);
migrateMeta(DEFAULT_ALLIANCE_ID);
migrateBear(DEFAULT_ALLIANCE_ID);

const selectUserByDiscordId = db.prepare(
  "SELECT id, discordId, displayName, avatar, isAppAdmin FROM users WHERE discordId = ?"
);
const insertUser = db.prepare(
  "INSERT INTO users (id, discordId, displayName, avatar, isAppAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
);
const updateUser = db.prepare(
  "UPDATE users SET displayName = ?, avatar = ? WHERE id = ?"
);
const selectUserById = db.prepare(
  "SELECT id, discordId, displayName, avatar, isAppAdmin FROM users WHERE id = ?"
);
const selectMembershipsByUser = db.prepare(
  `SELECT memberships.userId, memberships.allianceId, memberships.role, alliances.name AS allianceName
   FROM memberships
   JOIN alliances ON alliances.id = memberships.allianceId
   WHERE memberships.userId = ?`
);
const insertMembership = db.prepare(
  "INSERT OR IGNORE INTO memberships (id, userId, allianceId, role, createdAt) VALUES (?, ?, ?, ?, ?)"
);
const selectAllianceById = db.prepare(
  "SELECT id, name FROM alliances WHERE id = ?"
);
const selectProfile = db.prepare(
  "SELECT playerId, playerName, troopCount, marchCount, power FROM profiles WHERE userId = ? AND allianceId = ?"
);
const upsertProfile = db.prepare(
  `INSERT INTO profiles (id, userId, allianceId, playerId, playerName, troopCount, marchCount, power)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(userId, allianceId) DO UPDATE SET
     playerId=excluded.playerId,
     playerName=excluded.playerName,
     troopCount=excluded.troopCount,
     marchCount=excluded.marchCount,
     power=excluded.power`
);
const insertSession = db.prepare(
  "INSERT INTO sessions (token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)"
);
const selectSession = db.prepare(
  "SELECT token, userId, expiresAt FROM sessions WHERE token = ?"
);
const deleteSession = db.prepare("DELETE FROM sessions WHERE token = ?");

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  const next = Array.isArray(existing) ? [...existing, cookie] : [existing, cookie];
  res.setHeader("Set-Cookie", next);
}

function setCookie(res, name, value, options = {}) {
  appendSetCookie(res, serializeCookie(name, value, options));
}

function clearCookie(res, name) {
  appendSetCookie(
    res,
    serializeCookie(name, "", {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      maxAge: 0,
    })
  );
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = rest.join("=");
    return acc;
  }, {});
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  insertSession.run(token, userId, now + SESSION_TTL_MS, now);
  return token;
}

function resolveUserFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.ak_session;
  if (!token) return null;
  const session = selectSession.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    deleteSession.run(token);
    return null;
  }
  const user = selectUserById.get(session.userId);
  if (!user) return null;
  const memberships = selectMembershipsByUser.all(user.id);
  return { user, memberships, sessionToken: token };
}

function ensureDefaultMembership(userId, role = "member") {
  insertMembership.run(crypto.randomUUID(), userId, DEFAULT_ALLIANCE_ID, role, Date.now());
}

function ensureDevBypassUser() {
  const discordId = "dev-bypass";
  let user = selectUserByDiscordId.get(discordId);
  if (!user) {
    const id = crypto.randomUUID();
    insertUser.run(id, discordId, "Dev Bypass", null, 1, Date.now());
    user = selectUserById.get(id);
  }
  ensureDefaultMembership(user.id, "alliance_admin");
  return user;
}

function requireAuth(req, res) {
  if (req.user) return true;
  res.status(401).json({ error: "Authentication required." });
  return false;
}

function requireAlliance(req, res) {
  const headerAlliance =
    typeof req.header("x-alliance-id") === "string"
      ? req.header("x-alliance-id").trim()
      : "";
  const queryAlliance =
    typeof req.query?.alliance === "string" ? req.query.alliance.trim() : "";
  const allianceId = headerAlliance || queryAlliance;
  const memberships = req.memberships || [];
  const chosen = allianceId || memberships[0]?.allianceId;
  if (!chosen) {
    res.status(400).json({ error: "Alliance is required." });
    return null;
  }
  const membership = memberships.find((item) => item.allianceId === chosen);
  if (!membership && !req.user?.isAppAdmin) {
    res.status(403).json({ error: "Not a member of this alliance." });
    return null;
  }
  req.allianceId = chosen;
  req.allianceRole = membership?.role || "member";
  return chosen;
}

function requireRole(req, res, roles = []) {
  if (req.user?.isAppAdmin) return true;
  if (roles.includes(req.allianceRole)) return true;
  res.status(403).json({ error: "Insufficient permissions." });
  return false;
}

app.use((req, res, next) => {
  if (!isProduction && DEV_BYPASS_TOKEN) {
    const bypass = typeof req.header("x-dev-bypass") === "string" ? req.header("x-dev-bypass").trim() : "";
    if (bypass && bypass === DEV_BYPASS_TOKEN) {
      const user = ensureDevBypassUser();
      req.user = user;
      req.memberships = selectMembershipsByUser.all(user.id);
      return next();
    }
  }

  const auth = resolveUserFromSession(req);
  req.user = auth?.user || null;
  req.memberships = auth?.memberships || [];
  req.sessionToken = auth?.sessionToken || null;
  return next();
});

function loadMembers(allianceId) {
  return db
    .prepare(
      "SELECT playerId, troopCount, marchCount, power, playerName FROM members WHERE allianceId = ?"
    )
    .all(allianceId);
}

function loadLastRun(allianceId) {
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

app.get("/api/members", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  res.json({ members: loadMembers(allianceId) });
});

app.post("/api/signup", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  const normalized = normalizeMemberPayload(req.body || {});
  if (normalized.error) {
    res.status(400).json({ error: normalized.error });
    return;
  }

  db.prepare(
    `INSERT INTO members (allianceId, playerId, troopCount, marchCount, power, playerName)
     VALUES (@allianceId, @playerId, @troopCount, @marchCount, @power, @playerName)
     ON CONFLICT(allianceId, playerId) DO UPDATE SET
       troopCount=excluded.troopCount,
       marchCount=excluded.marchCount,
       power=excluded.power,
       playerName=excluded.playerName`
  ).run({ allianceId, ...normalized });

  res.json({ members: loadMembers(allianceId) });
});

app.delete("/api/members/:playerId", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  if (!requireRole(req, res, ["alliance_admin"])) return;
  const playerId =
    typeof req.params.playerId === "string" ? req.params.playerId.trim() : "";
  if (!playerId) {
    res.status(400).json({ error: "playerId is required." });
    return;
  }

  db.prepare("DELETE FROM members WHERE allianceId = ? AND playerId = ?").run(
    allianceId,
    playerId
  );
  res.json({ members: loadMembers(allianceId) });
});

app.post("/api/run", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  if (!requireRole(req, res, ["alliance_admin"])) return;
  try {
    const run = generateAssignments(loadMembers(allianceId));
    db.prepare(
      "INSERT INTO meta (allianceId, key, value) VALUES (?, 'lastRun', ?) ON CONFLICT(allianceId, key) DO UPDATE SET value=excluded.value"
    ).run(allianceId, JSON.stringify(run));
    res.json(run);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/auth/discord", (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
    res.status(500).json({ error: "Discord auth is not configured." });
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  setCookie(res, "oauth_state", state, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state,
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

async function exchangeDiscordToken(code) {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: DISCORD_REDIRECT_URI,
  });
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error("Failed to exchange Discord token.");
  }
  return response.json();
}

async function fetchDiscordUser(accessToken) {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch Discord user.");
  }
  return response.json();
}

function getDiscordDisplayName(user) {
  return user.global_name || user.username || "Discord User";
}

function ensureMemberships(userId, isAppAdmin) {
  const existing = selectMembershipsByUser.all(userId);
  if (existing.length > 0) return existing;
  const role = isAppAdmin ? "alliance_admin" : "member";
  ensureDefaultMembership(userId, role);
  return selectMembershipsByUser.all(userId);
}

app.get("/api/auth/discord/callback", async (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
    res.status(500).json({ error: "Discord auth is not configured." });
    return;
  }
  const code = typeof req.query?.code === "string" ? req.query.code.trim() : "";
  const state = typeof req.query?.state === "string" ? req.query.state.trim() : "";
  const cookies = parseCookies(req.headers.cookie || "");
  const storedState = cookies.oauth_state;
  clearCookie(res, "oauth_state");

  if (!code || !state || !storedState || storedState !== state) {
    res.status(400).json({ error: "Invalid auth state." });
    return;
  }

  try {
    const tokenPayload = await exchangeDiscordToken(code);
    const discordUser = await fetchDiscordUser(tokenPayload.access_token);
    const discordId = discordUser.id;
    const displayName = getDiscordDisplayName(discordUser);
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    let user = selectUserByDiscordId.get(discordId);
    if (!user) {
      const countRow = db.prepare("SELECT COUNT(*) as count FROM users").get();
      const isFirstUser = Number(countRow?.count || 0) === 0;
      const id = crypto.randomUUID();
      insertUser.run(id, discordId, displayName, avatar, isFirstUser ? 1 : 0, Date.now());
      user = selectUserById.get(id);
    } else {
      updateUser.run(displayName, avatar, user.id);
    }

    ensureMemberships(user.id, Boolean(user.isAppAdmin));
    const sessionToken = createSession(user.id);
    setCookie(res, "ak_session", sessionToken, {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    res.redirect(APP_BASE_URL);
  } catch (error) {
    res.status(500).json({ error: "Discord authentication failed." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  if (req.sessionToken) {
    deleteSession.run(req.sessionToken);
  }
  clearCookie(res, "ak_session");
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  if (!requireAuth(req, res)) return;
  const memberships = req.memberships || [];
  res.json({
    user: req.user,
    memberships,
  });
});

app.get("/api/alliances", (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ memberships: req.memberships || [] });
});

app.get("/api/me/profile", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  const profile = selectProfile.get(req.user.id, allianceId);
  res.json({ profile: profile || null });
});

app.post("/api/me/profile", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  const body = req.body || {};
  const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
  const playerName = typeof body.playerName === "string" ? body.playerName.trim() : "";
  const troopCount = Number(body.troopCount);
  const marchCount = Number(body.marchCount);
  const power = Number(body.power);

  upsertProfile.run(
    crypto.randomUUID(),
    req.user.id,
    allianceId,
    playerId || null,
    playerName || null,
    Number.isFinite(troopCount) ? troopCount : null,
    Number.isFinite(marchCount) ? marchCount : null,
    Number.isFinite(power) ? power : null
  );

  const profile = selectProfile.get(req.user.id, allianceId);
  res.json({ profile });
});

app.post("/api/player-lookup", async (req, res) => {
  if (!requireAuth(req, res)) return;
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
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  res.json({ results: loadLastRun(allianceId) });
});

app.post("/api/reset", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  if (!requireRole(req, res, ["alliance_admin"])) return;
  db.prepare("DELETE FROM members WHERE allianceId = ?").run(allianceId);
  db.prepare("DELETE FROM meta WHERE allianceId = ? AND key = 'lastRun'").run(
    allianceId
  );
  res.json({ ok: true });
});

app.get("/api/bear/:group", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  const group = req.params.group;
  if (group !== "bear1" && group !== "bear2") {
    res.status(400).json({ error: "Invalid bear group." });
    return;
  }
  const members = db
    .prepare(
      `SELECT playerId, playerName, rallySize FROM bear WHERE allianceId = ? AND bearGroup = ?`
    )
    .all(allianceId, group);
  res.json({ members });
});

app.post("/api/bear/:group", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
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

  db.prepare(
    `INSERT INTO bear (allianceId, playerId, playerName, rallySize, bearGroup)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(allianceId, playerId) DO UPDATE SET
       playerName=excluded.playerName,
       rallySize=excluded.rallySize,
       bearGroup=excluded.bearGroup`
  ).run(allianceId, playerId, playerName, rallySize, group);

  const members = db
    .prepare(
      `SELECT playerId, playerName, rallySize FROM bear WHERE allianceId = ? AND bearGroup = ?`
    )
    .all(allianceId, group);
  res.json({ members });
});

app.delete("/api/bear/:group", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  if (!requireRole(req, res, ["alliance_admin"])) return;
  const group = req.params.group;
  if (group !== "bear1" && group !== "bear2") {
    res.status(400).json({ error: "Invalid bear group." });
    return;
  }

  db.prepare(`DELETE FROM bear WHERE allianceId = ? AND bearGroup = ?`).run(
    allianceId,
    group
  );
  const members = db
    .prepare(
      `SELECT playerId, playerName, rallySize FROM bear WHERE allianceId = ? AND bearGroup = ?`
    )
    .all(allianceId, group);
  res.json({ members });
});

app.delete("/api/bear/:group/:playerId", (req, res) => {
  if (!requireAuth(req, res)) return;
  const allianceId = requireAlliance(req, res);
  if (!allianceId) return;
  if (!requireRole(req, res, ["alliance_admin"])) return;
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

  db.prepare(`DELETE FROM bear WHERE allianceId = ? AND playerId = ? AND bearGroup = ?`).run(
    allianceId,
    playerId,
    group
  );
  const members = db
    .prepare(
      `SELECT playerId, playerName, rallySize FROM bear WHERE allianceId = ? AND bearGroup = ?`
    )
    .all(allianceId, group);
  res.json({ members });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
