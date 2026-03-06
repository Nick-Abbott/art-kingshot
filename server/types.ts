import type { Database } from "better-sqlite3";
import type { Request, RequestHandler, Response } from "express";
import type {
  AllianceRole,
  Alliance,
  AssignmentResult,
  Member,
  Profile,
  User,
} from "../shared/types";
import type { MembersRepo } from "./repos/membersRepo";
import type { MetaRepo } from "./repos/metaRepo";
import type { Queries } from "./db/queries";

export type CookieOptions = {
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
};

export type RateLimitOptions = {
  key?: string;
  max: number;
  windowMs: number;
};

export type RoleRequirement = AllianceRole | "app_admin";

export type RouteContext = {
  db: Database;
  ok: (res: Response, data: unknown, status?: number) => void;
  fail: (
    res: Response,
    status: number,
    message: string,
    code?: string,
    details?: Record<string, unknown> | null
  ) => void;
  crypto: typeof import("node:crypto");
  APP_BASE_URL: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  DISCORD_BOT_SECRET: string;
  SESSION_TTL_MS: number;
  isProduction: boolean;
  parseMemberPayload: (
    body: unknown
  ) => { ok: true; data: Member } | { ok: false; error: string; code?: string };
  parseBearPayload: (
    body: unknown
  ) =>
    | { ok: true; data: { playerId: string; playerName: string; rallySize: number } }
    | { ok: false; error: string; code?: string };
  parseAllianceCreatePayload: (
    body: unknown
  ) =>
    | { ok: true; data: { tag: string; name: string } }
    | { ok: false; error: string; code?: string };
  parsePlayerLookupPayload: (
    body: unknown
  ) => { ok: true; data: { fid: string } } | { ok: false; error: string; code?: string };
  parseProfileCreatePayload: (
    body: unknown
  ) =>
    | {
        ok: true;
        data: {
          playerId: string;
          playerName?: string;
          playerAvatar?: string;
          kingdomId?: number;
          allianceId?: string;
          troopCount?: number;
          marchCount?: number;
          power?: number;
          rallySize?: number;
        };
      }
    | { ok: false; error: string; code?: string };
  parseProfileUpdatePayload: (
    body: unknown
  ) =>
    | {
        ok: true;
        data: {
          playerId?: string;
          playerName?: string;
          playerAvatar?: string;
          kingdomId?: number | null;
          allianceId?: string | null;
          troopCount?: number | null;
          marchCount?: number | null;
          power?: number | null;
          rallySize?: number | null;
        };
      }
    | { ok: false; error: string; code?: string };
  parseAllianceProfileUpdatePayload: (
    body: unknown
  ) =>
    | { ok: true; data: { action?: string; status?: string; role?: string } }
    | { ok: false; error: string; code?: string };
  parseBotMemberPayload: (
    body: unknown
  ) =>
    | {
        ok: true;
        data: {
          profileId: string;
          troopCount?: number;
          marchCount: number;
          power?: number;
          playerName?: string;
        };
      }
    | { ok: false; error: string; code?: string };
  parseBotBearPayload: (
    body: unknown
  ) =>
    | {
        ok: true;
        data: { profileId: string; rallySize: number; playerName?: string };
      }
    | { ok: false; error: string; code?: string };
  parseBotLinkPayload: (
    body: unknown
  ) =>
    | { ok: true; data: { playerId: string } }
    | { ok: false; error: string; code?: string };
  parseBotGuildAssociatePayload: (
    body: unknown
  ) =>
    | { ok: true; data: { allianceId: string } }
    | { ok: false; error: string; code?: string };
  generateAssignments: (members: Member[]) => AssignmentResult;
  buildPlayerLookupPayload: (fid: string | number, now?: number) => {
    fid: string;
    time: number;
    sign: string;
  };
  parseCookies: (cookieHeader: string) => Record<string, string>;
  setCookie: (
    res: Response,
    name: string,
    value: string,
    options?: CookieOptions
  ) => void;
  clearCookie: (res: Response, name: string) => void;
  createSession: (userId: string) => string;
  exchangeDiscordToken: (code: string) => Promise<{ access_token: string }>;
  fetchDiscordUser: (accessToken: string) => Promise<{
    id: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
  }>;
  getDiscordDisplayName: (user: {
    username?: string;
    global_name?: string | null;
  }) => string;
  requireAuth: (req: Request, res: Response) => boolean;
  requireAlliance: (req: Request, res: Response) => string | null;
  requireRole: (
    req: Request,
    res: Response,
    roles?: RoleRequirement[]
  ) => boolean;
  requireAuthMiddleware: RequestHandler;
  requireAllianceMiddleware: RequestHandler;
  requireRoleMiddleware: (roles?: RoleRequirement[]) => RequestHandler;
  enforceRateLimit: (
    req: Request,
    res: Response,
    options: RateLimitOptions
  ) => boolean;
  queries: Queries;
  getUserByDiscordId: (discordId: string) => User | null;
  getUserById: (id: string) => User | null;
  getProfileById: (id: string) => Profile | null;
  getProfileByPlayerId: (playerId: string) => Profile | null;
  getProfilesByUser: (userId: string) => Profile[];
  getAllianceById: (id: string) => Alliance | null;
  insertUser: Queries["insertUser"];
  updateUser: Queries["updateUser"];
  updateUserBotOptIn: Queries["updateUserBotOptIn"];
  insertBootstrapRow: Queries["insertBootstrapRow"];
  insertProfile: Queries["insertProfile"];
  updateProfile: Queries["updateProfile"];
  updateProfileClaim: Queries["updateProfileClaim"];
  updateProfileFields: Queries["updateProfileFields"];
  updateProfileStatus: Queries["updateProfileStatus"];
  insertSession: Queries["insertSession"];
  getSession: Queries["getSession"];
  deleteSession: Queries["deleteSession"];
  membersRepo: MembersRepo;
  metaRepo: MetaRepo;
};
