const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto") as typeof import("node:crypto");
const Database = require("better-sqlite3");
const { runMigrations } = require("./db/migrate");
const { config } = require("./config");
const { generateAssignments } = require("./assignments");
const { buildPlayerLookupPayload } = require("./kingshot");
const createAccessMiddleware = require("./middleware/access");
const authRoutes = require("./routes/auth");
const membersRoutes = require("./routes/members");
const assignmentsRoutes = require("./routes/assignments");
const bearRoutes = require("./routes/bear");
const profileRoutes = require("./routes/profile");
const { createMembersRepo } = require("./repos/membersRepo");
const { createMetaRepo } = require("./repos/metaRepo");
import type { Member } from "../shared/types";

const app = express();
const port = config.port;
const APP_BASE_URL = config.appBaseUrl;
const DISCORD_CLIENT_ID = config.discordClientId;
const DISCORD_CLIENT_SECRET = config.discordClientSecret;
const DISCORD_REDIRECT_URI = config.discordRedirectUri;
const SESSION_TTL_MS = config.sessionTtlDays * 24 * 60 * 60 * 1000;
const DEFAULT_ALLIANCE_ID = config.defaultAllianceId;
const DEFAULT_ALLIANCE_NAME = config.defaultAllianceName;
const DEV_BYPASS_TOKEN = config.devBypassToken;
const isProduction = config.nodeEnv === "production";

app.use(express.json());
app.set("trust proxy", 1);

const serverRoot = process.cwd();
const dbPath =
  process.env.DB_PATH ||
  path.join(serverRoot, "data", "viking.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
runMigrations(db, path.join(serverRoot, "db", "migrations"));

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
const insertBootstrapRow = db.prepare(
  "INSERT OR IGNORE INTO app_bootstrap (id, createdAt) VALUES (1, ?)"
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

function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, data });
}

function fail(res, status, message) {
  res.status(status).json({ ok: false, error: message });
}

type CookieOptions = {
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

function serializeCookie(name, value, options: CookieOptions = {}) {
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

function setCookie(res, name, value, options: CookieOptions = {}) {
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
  fail(res, 401, "Authentication required.");
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
    fail(res, 400, "Alliance is required.");
    return null;
  }
  const alliance = selectAllianceById.get(chosen);
  if (!alliance) {
    fail(res, 400, "Alliance not found.");
    return null;
  }
  const membership = memberships.find((item) => item.allianceId === chosen);
  if (!membership && !req.user?.isAppAdmin) {
    fail(res, 403, "Not a member of this alliance.");
    return null;
  }
  req.allianceId = chosen;
  req.allianceRole = membership?.role || "member";
  return chosen;
}

function requireRole(req, res, roles = []) {
  if (req.user?.isAppAdmin) return true;
  if (roles.includes(req.allianceRole)) return true;
  fail(res, 403, "Insufficient permissions.");
  return false;
}

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

const {
  requireAuthMiddleware,
  requireAllianceMiddleware,
  requireRoleMiddleware,
} = createAccessMiddleware({ requireAuth, requireAlliance, requireRole });

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

const membersRepo = createMembersRepo(db);
const metaRepo = createMetaRepo(db);

function normalizeMemberPayload(body): Member | { error: string } {
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

const routeContext = {
  db,
  ok,
  fail,
  crypto,
  APP_BASE_URL,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  SESSION_TTL_MS,
  isProduction,
  normalizeMemberPayload,
  generateAssignments,
  buildPlayerLookupPayload,
  parseCookies,
  setCookie,
  clearCookie,
  createSession,
  ensureMemberships,
  exchangeDiscordToken,
  fetchDiscordUser,
  getDiscordDisplayName,
  requireAuth,
  requireAlliance,
  requireRole,
  requireAuthMiddleware,
  requireAllianceMiddleware,
  requireRoleMiddleware,
  selectUserByDiscordId,
  insertUser,
  updateUser,
  selectUserById,
  insertBootstrapRow,
  selectProfile,
  upsertProfile,
  deleteSession,
  membersRepo,
  metaRepo,
};

app.use(authRoutes(routeContext));
app.use(membersRoutes(routeContext));
app.use(assignmentsRoutes(routeContext));
app.use(profileRoutes(routeContext));
app.use(bearRoutes(routeContext));

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = app;

export {};
