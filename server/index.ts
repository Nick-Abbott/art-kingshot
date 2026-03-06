import type { Request, Response, NextFunction } from "express";
import express from "express";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import Database from "better-sqlite3";
import { runMigrations } from "./db/migrate";
import { createQueries } from "./db/queries";
import { config } from "./config";
import { generateAssignments } from "./assignments";
import { buildPlayerLookupPayload } from "./kingshot";
import createAccessMiddleware from "./middleware/access";
import {
  parseMemberPayload,
  parseBearPayload,
  parseAllianceCreatePayload,
  parsePlayerLookupPayload,
  parseProfileCreatePayload,
  parseProfileUpdatePayload,
  parseAllianceProfileUpdatePayload,
  parseBotMemberPayload,
  parseBotBearPayload,
} from "./validation";
import authRoutes from "./routes/auth";
import membersRoutes from "./routes/members";
import assignmentsRoutes from "./routes/assignments";
import bearRoutes from "./routes/bear";
import profileRoutes from "./routes/profile";
import adminRoutes from "./routes/admin";
import botRoutes from "./routes/bot";
import { createMembersRepo } from "./repos/membersRepo";
import { createMetaRepo } from "./repos/metaRepo";
import type {
  CookieOptions,
  RateLimitOptions,
  RouteContext,
  RoleRequirement,
} from "./types";

export function createApp({ dbPath: dbPathOverride }: { dbPath?: string } = {}) {
  const app = express();
  const APP_BASE_URL = config.appBaseUrl;
  const DISCORD_CLIENT_ID = config.discordClientId;
  const DISCORD_CLIENT_SECRET = config.discordClientSecret;
  const DISCORD_REDIRECT_URI = config.discordRedirectUri;
  const DISCORD_BOT_SECRET =
    (process.env.DISCORD_BOT_SECRET || "").trim() || config.discordBotSecret;
  const SESSION_TTL_MS = config.sessionTtlDays * 24 * 60 * 60 * 1000;
  const isProduction = config.nodeEnv === "production";

  app.use(express.json());
  app.set("trust proxy", 1);
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const serverRoot = process.cwd();
  const dbPath =
    dbPathOverride ||
    process.env.DB_PATH ||
    path.join(serverRoot, "data", "viking.sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  runMigrations(db, path.join(serverRoot, "db", "migrations"));

  const rateBuckets = new Map<string, { count: number; resetAt: number }>();

  function enforceRateLimit(
    req: Request,
    res: Response,
    { key, max, windowMs }: RateLimitOptions
  ): boolean {
    const now = Date.now();
    const bucketKey = key || `${req.ip || "unknown"}:${req.path}`;
    const entry = rateBuckets.get(bucketKey);
    if (!entry || entry.resetAt <= now) {
      rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) {
      res.status(429).json({
        ok: false,
        error: { message: "Too many requests.", code: "rate_limited" },
      });
      return false;
    }
    entry.count += 1;
    return true;
  }

  const queries = createQueries(db);
  const {
    getUserByDiscordId,
    getUserById,
    getProfileById,
    getProfileByPlayerId,
    getProfilesByUser,
    getAllianceById,
    insertUser,
    updateUser,
    insertBootstrapRow,
    insertSession,
    getSession,
    deleteSession,
    insertProfile,
    updateProfile,
    updateProfileClaim,
    updateProfileFields,
    updateProfileStatus,
  } = queries;

  function ok(res: Response, data: unknown, status = 200): void {
    res.status(status).json({ ok: true, data });
  }

  function fail(
    res: Response,
    status: number,
    message: string,
    code?: string,
    details?: Record<string, unknown> | null
  ): void {
    const normalizedCode =
      code ||
      (status >= 500
        ? "server_error"
        : status === 429
          ? "rate_limited"
          : status === 401
            ? "unauthorized"
            : status === 403
              ? "forbidden"
              : status === 404
                ? "not_found"
                : status === 409
                  ? "conflict"
                  : "bad_request");
    res.status(status).json({
      ok: false,
      error: {
        message,
        code: normalizedCode,
        ...(details ? { details } : {}),
      },
    });
  }

  function serializeCookie(
    name: string,
    value: string,
    options: CookieOptions = {}
  ) {
    const parts = [`${name}=${value}`];
    if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.httpOnly) parts.push("HttpOnly");
    if (options.secure) parts.push("Secure");
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    return parts.join("; ");
  }

  function appendSetCookie(res: Response, cookie: string): void {
    const existing = res.getHeader("Set-Cookie");
    if (!existing) {
      res.setHeader("Set-Cookie", cookie);
      return;
    }
    const currentValues = Array.isArray(existing)
      ? existing.map((value) => String(value))
      : [String(existing)];
    res.setHeader("Set-Cookie", [...currentValues, cookie]);
  }

  function setCookie(
    res: Response,
    name: string,
    value: string,
    options: CookieOptions = {}
  ): void {
    appendSetCookie(res, serializeCookie(name, value, options));
  }

  function clearCookie(res: Response, name: string): void {
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

  function parseCookies(cookieHeader: string): Record<string, string> {
    if (!cookieHeader) return {};
    return cookieHeader.split(";").reduce((acc, part) => {
      const [rawKey, ...rest] = part.trim().split("=");
      if (!rawKey) return acc;
      acc[rawKey] = rest.join("=");
      return acc;
    }, {} as Record<string, string>);
  }

  function createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    insertSession(token, userId, now + SESSION_TTL_MS, now);
    return token;
  }

  function resolveUserFromSession(req: Request) {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies.ak_session;
    if (!token) return null;
    const session = getSession(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      deleteSession(token);
      return null;
    }
    const user = getUserById(session.userId);
    if (!user) return null;
    const profiles = getProfilesByUser(user.id);
    return { user, profiles, sessionToken: token };
  }

  function requireAuth(req: Request, res: Response): boolean {
    if (req.user) return true;
    fail(res, 401, "Authentication required.");
    return false;
  }

  function requireAlliance(req: Request, res: Response): string | null {
    if (!req.user) {
      fail(res, 401, "Authentication required.");
      return null;
    }
    const headerProfileId = req.header("x-profile-id");
    const profileId =
      typeof headerProfileId === "string" ? headerProfileId.trim() : "";
    if (!profileId) {
      fail(res, 400, "Profile is required.");
      return null;
    }
    const profile = getProfileById(profileId);
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

  function requireRole(
    req: Request,
    res: Response,
    roles: RoleRequirement[] = []
  ): boolean {
    if (req.user?.isAppAdmin) return true;
    if (req.profile && roles.includes(req.profile.role)) return true;
    fail(res, 403, "Insufficient permissions.");
    return false;
  }

  async function exchangeDiscordToken(
    code: string
  ): Promise<{ access_token: string }> {
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

  async function fetchDiscordUser(accessToken: string): Promise<{
    id: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
  }> {
    const response = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch Discord user.");
    }
    return response.json();
  }

  function getDiscordDisplayName(user: {
    username?: string;
    global_name?: string | null;
  }): string {
    return user.global_name || user.username || "Discord User";
  }

  const {
    requireAuthMiddleware,
    requireAllianceMiddleware,
    requireRoleMiddleware,
  } = createAccessMiddleware({ requireAuth, requireAlliance, requireRole });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const auth = resolveUserFromSession(req);
    req.user = auth?.user || null;
    req.profiles = auth?.profiles || [];
    req.sessionToken = auth?.sessionToken || null;
    return next();
  });

  const membersRepo = createMembersRepo(db);
  const metaRepo = createMetaRepo(db);

  const routeContext: RouteContext = {
    db,
    queries,
    ok,
    fail,
    crypto,
    APP_BASE_URL,
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI,
    DISCORD_BOT_SECRET,
    SESSION_TTL_MS,
    isProduction,
    parseMemberPayload,
    parseBearPayload,
    parseAllianceCreatePayload,
    parsePlayerLookupPayload,
    parseProfileCreatePayload,
    parseProfileUpdatePayload,
    parseAllianceProfileUpdatePayload,
    parseBotMemberPayload,
    parseBotBearPayload,
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
    getUserByDiscordId,
    getUserById,
    getProfileById,
    getProfileByPlayerId,
    getProfilesByUser,
    getAllianceById,
    insertUser,
    updateUser,
    insertBootstrapRow,
    insertSession,
    getSession,
    insertProfile,
    updateProfile,
    updateProfileClaim,
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
  app.use(adminRoutes(routeContext));
  app.use(botRoutes(routeContext));

  return app;
}

const app = createApp();
const port = config.port;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export default app;
