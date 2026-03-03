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

const rateBuckets = new Map();

function enforceRateLimit(req, res, { key, max, windowMs }) {
  const now = Date.now();
  const bucketKey = key || `${req.ip || "unknown"}:${req.path}`;
  const entry = rateBuckets.get(bucketKey);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) {
    res.status(429).json({ ok: false, error: "Too many requests." });
    return false;
  }
  entry.count += 1;
  return true;
}


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
const selectProfilesByUser = db.prepare(
  `SELECT profiles.id,
          profiles.userId,
          profiles.playerId,
          profiles.playerName,
          profiles.playerAvatar,
          profiles.kingdomId,
          profiles.allianceId,
          profiles.status,
          profiles.role,
          profiles.troopCount,
          profiles.marchCount,
          profiles.power,
          profiles.rallySize,
          alliances.name AS allianceName
   FROM profiles
   LEFT JOIN alliances ON alliances.id = profiles.allianceId
   WHERE profiles.userId = ?`
);
const selectProfileById = db.prepare(
  `SELECT profiles.id,
          profiles.userId,
          profiles.playerId,
          profiles.playerName,
          profiles.playerAvatar,
          profiles.kingdomId,
          profiles.allianceId,
          profiles.status,
          profiles.role,
          profiles.troopCount,
          profiles.marchCount,
          profiles.power,
          profiles.rallySize,
          alliances.name AS allianceName
   FROM profiles
   LEFT JOIN alliances ON alliances.id = profiles.allianceId
   WHERE profiles.id = ?`
);
const insertProfile = db.prepare(
  `INSERT INTO profiles (
     id,
     userId,
     playerId,
     playerName,
     playerAvatar,
     kingdomId,
     allianceId,
     status,
     role,
     troopCount,
     marchCount,
     power,
     rallySize,
     createdAt,
     updatedAt
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const updateProfile = db.prepare(
  `UPDATE profiles
   SET playerId = ?,
       playerName = ?,
       playerAvatar = ?,
       kingdomId = ?,
       allianceId = ?,
       status = ?,
       role = ?,
       troopCount = ?,
       marchCount = ?,
       power = ?,
       rallySize = ?,
       updatedAt = ?
   WHERE id = ?`
);
const updateProfileFields = db.prepare(
  `UPDATE profiles
   SET playerId = ?,
       playerName = ?,
       playerAvatar = ?,
       kingdomId = ?,
       troopCount = ?,
       marchCount = ?,
       power = ?,
       rallySize = ?,
       updatedAt = ?
   WHERE id = ?`
);
const updateProfileStatus = db.prepare(
  `UPDATE profiles
   SET status = ?,
       role = ?,
       updatedAt = ?
   WHERE id = ?`
);
const selectAllianceById = db.prepare(
  "SELECT id, name, kingdomId FROM alliances WHERE id = ?"
);
const insertBootstrapRow = db.prepare(
  "INSERT OR IGNORE INTO app_bootstrap (id, createdAt) VALUES (1, ?)"
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
  const profiles = selectProfilesByUser.all(user.id);
  return { user, profiles, sessionToken: token };
}

function ensureDevBypassUser() {
  const discordId = "dev-bypass";
  let user = selectUserByDiscordId.get(discordId);
  if (!user) {
    const id = crypto.randomUUID();
    insertUser.run(id, discordId, "Dev Bypass", null, 1, Date.now());
    user = selectUserById.get(id);
  }
  return user;
}

function requireAuth(req, res) {
  if (req.user) return true;
  fail(res, 401, "Authentication required.");
  return false;
}

function requireAlliance(req, res) {
  const profileId =
    typeof req.header("x-profile-id") === "string"
      ? req.header("x-profile-id").trim()
      : "";
  if (!profileId) {
    fail(res, 400, "Profile is required.");
    return null;
  }
  const profile = selectProfileById.get(profileId);
  if (!profile) {
    fail(res, 404, "Profile not found.");
    return null;
  }
  if (profile.userId !== req.user.id && !req.user?.isAppAdmin) {
    fail(res, 403, "Profile access denied.");
    return null;
  }
  if (!profile.allianceId || profile.status !== "active") {
    fail(res, 403, "Profile is not active in an alliance.");
    return null;
  }
  req.profile = profile;
  req.profileRole = profile.role;
  req.allianceId = profile.allianceId;
  return profile.allianceId;
}

function requireRole(req, res, roles = []) {
  if (req.user?.isAppAdmin) return true;
  if (req.profile && roles.includes(req.profile.role)) return true;
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
      req.profiles = selectProfilesByUser.all(user.id);
      return next();
    }
  }

  const auth = resolveUserFromSession(req);
  req.user = auth?.user || null;
  req.profiles = auth?.profiles || [];
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
  DEV_BYPASS_TOKEN,
  normalizeMemberPayload,
  generateAssignments,
  buildPlayerLookupPayload,
  parseCookies,
  setCookie,
  clearCookie,
  createSession,
  exchangeDiscordToken,
  fetchDiscordUser,
  getDiscordDisplayName,
  requireAuth,
  requireAlliance,
  requireRole,
  requireAuthMiddleware,
  requireAllianceMiddleware,
  requireRoleMiddleware,
  enforceRateLimit,
  selectUserByDiscordId,
  insertUser,
  updateUser,
  selectUserById,
  insertBootstrapRow,
  selectAllianceById,
  selectProfilesByUser,
  selectProfileById,
  insertProfile,
  updateProfile,
  updateProfileFields,
  updateProfileStatus,
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
