import { z } from "zod/mini";
import type { Member } from "../shared/types";

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

const MemberPayloadSchema = z.object({
  playerId: z.string(),
  playerName: z.optional(z.string()),
  troopCount: z.coerce.number(),
  marchCount: z.coerce.number(),
  power: z.coerce.number(),
});

export function parseMemberPayload(payload: unknown): ParseResult<Member> {
  const parsed = MemberPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid member payload." };
  }

  const playerId = parsed.data.playerId.trim();
  const playerName = parsed.data.playerName?.trim() ?? "";
  const troopCount = parsed.data.troopCount;
  const marchCount = parsed.data.marchCount;
  const power = parsed.data.power;

  if (!playerId) {
    return { ok: false, error: "playerId is required.", code: "player_id_required" };
  }
  if (!Number.isFinite(troopCount) || troopCount <= 0) {
    return { ok: false, error: "troopCount must be a positive number." };
  }
  if (!Number.isFinite(marchCount) || marchCount < 4 || marchCount > 6) {
    return { ok: false, error: "marchCount must be between 4 and 6." };
  }
  if (!Number.isFinite(power) || power < 1000000) {
    return { ok: false, error: "power must be at least 1,000,000." };
  }

  return {
    ok: true,
    data: { playerId, playerName, troopCount, marchCount, power },
  };
}

const BearPayloadSchema = z.object({
  playerId: z.string(),
  playerName: z.optional(z.string()),
  rallySize: z.coerce.number(),
});

export function parseBearPayload(
  payload: unknown
): ParseResult<{ playerId: string; playerName: string; rallySize: number }> {
  const parsed = BearPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid bear payload." };
  }

  const playerId = parsed.data.playerId.trim();
  const playerName = parsed.data.playerName?.trim() ?? "";
  const rallySize = parsed.data.rallySize;

  if (!playerId) {
    return { ok: false, error: "playerId is required.", code: "player_id_required" };
  }
  if (!Number.isFinite(rallySize) || rallySize <= 0) {
    return { ok: false, error: "rallySize must be a positive number." };
  }

  return { ok: true, data: { playerId, playerName, rallySize } };
}

const AllianceCreateSchema = z.object({
  tag: z.string(),
  name: z.string(),
});

export function parseAllianceCreatePayload(
  payload: unknown
): ParseResult<{ tag: string; name: string }> {
  const parsed = AllianceCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid alliance payload." };
  }

  const tag = parsed.data.tag.trim();
  const name = parsed.data.name.trim();

  if (!tag || tag.length !== 3) {
    return { ok: false, error: "Alliance tag must be 3 letters." };
  }
  if (!name) {
    return { ok: false, error: "Alliance name is required." };
  }

  return { ok: true, data: { tag, name } };
}

const PlayerLookupSchema = z.object({
  fid: z.string(),
});

export function parsePlayerLookupPayload(
  payload: unknown
): ParseResult<{ fid: string }> {
  const parsed = PlayerLookupSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid lookup payload." };
  }

  const fid = parsed.data.fid.trim();
  if (!fid) {
    return { ok: false, error: "fid is required.", code: "fid_required" };
  }

  return { ok: true, data: { fid } };
}

const ProfileCreateSchema = z.object({
  playerId: z.string(),
  playerName: z.optional(z.string()),
  playerAvatar: z.optional(z.string()),
  kingdomId: z.optional(z.coerce.number()),
  allianceId: z.optional(z.string()),
  troopCount: z.optional(z.coerce.number()),
  marchCount: z.optional(z.coerce.number()),
  power: z.optional(z.coerce.number()),
  rallySize: z.optional(z.coerce.number()),
});

export function parseProfileCreatePayload(payload: unknown): ParseResult<{
  playerId: string;
  playerName?: string;
  playerAvatar?: string;
  kingdomId?: number;
  allianceId?: string;
  troopCount?: number;
  marchCount?: number;
  power?: number;
  rallySize?: number;
}> {
  const parsed = ProfileCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid profile payload." };
  }

  const playerId = parsed.data.playerId.trim();
  if (!playerId) {
    return {
      ok: false,
      error: "playerId is required.",
      code: "profile_player_id_required"
    };
  }

  return {
    ok: true,
    data: {
      playerId,
      playerName: parsed.data.playerName?.trim() || undefined,
      playerAvatar: parsed.data.playerAvatar?.trim() || undefined,
      kingdomId: parsed.data.kingdomId,
      allianceId: parsed.data.allianceId?.trim() || undefined,
      troopCount: parsed.data.troopCount,
      marchCount: parsed.data.marchCount,
      power: parsed.data.power,
      rallySize: parsed.data.rallySize,
    },
  };
}

const ProfileUpdateSchema = z.object({
  playerId: z.optional(z.string()),
  playerName: z.optional(z.string()),
  playerAvatar: z.optional(z.string()),
  kingdomId: z.optional(z.union([z.null(), z.coerce.number()])),
  allianceId: z.optional(z.union([z.null(), z.string()])),
  troopCount: z.optional(z.union([z.null(), z.coerce.number()])),
  marchCount: z.optional(z.union([z.null(), z.coerce.number()])),
  power: z.optional(z.union([z.null(), z.coerce.number()])),
  rallySize: z.optional(z.union([z.null(), z.coerce.number()])),
});

export function parseProfileUpdatePayload(payload: unknown): ParseResult<{
  playerId?: string;
  playerName?: string;
  playerAvatar?: string;
  kingdomId?: number | null;
  allianceId?: string | null;
  troopCount?: number | null;
  marchCount?: number | null;
  power?: number | null;
  rallySize?: number | null;
}> {
  const parsed = ProfileUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid profile update payload." };
  }

  return {
    ok: true,
    data: {
      playerId: parsed.data.playerId?.trim(),
      playerName: parsed.data.playerName?.trim(),
      playerAvatar: parsed.data.playerAvatar?.trim(),
      kingdomId: parsed.data.kingdomId,
      allianceId:
        typeof parsed.data.allianceId === "string"
          ? parsed.data.allianceId.trim()
          : parsed.data.allianceId,
      troopCount: parsed.data.troopCount,
      marchCount: parsed.data.marchCount,
      power: parsed.data.power,
      rallySize: parsed.data.rallySize,
    },
  };
}

const AllianceProfileUpdateSchema = z.object({
  action: z.optional(z.string()),
  status: z.optional(z.string()),
  role: z.optional(z.string()),
});

export function parseAllianceProfileUpdatePayload(payload: unknown): ParseResult<{
  action?: string;
  status?: string;
  role?: string;
}> {
  const parsed = AllianceProfileUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid alliance profile payload." };
  }

  return {
    ok: true,
    data: {
      action: parsed.data.action?.trim(),
      status: parsed.data.status?.trim(),
      role: parsed.data.role?.trim(),
    },
  };
}

const BotMemberSchema = z.object({
  profileId: z.string(),
  troopCount: z.optional(z.coerce.number()),
  marchCount: z.coerce.number(),
  power: z.optional(z.coerce.number()),
  playerName: z.optional(z.string()),
});

export function parseBotMemberPayload(payload: unknown): ParseResult<{
  profileId: string;
  troopCount?: number;
  marchCount: number;
  power?: number;
  playerName?: string;
}> {
  const parsed = BotMemberSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid bot member payload." };
  }

  const profileId = parsed.data.profileId.trim();
  if (!profileId) {
    return { ok: false, error: "profileId is required.", code: "profile_id_required" };
  }

  return {
    ok: true,
    data: {
      profileId,
      troopCount: parsed.data.troopCount,
      marchCount: parsed.data.marchCount,
      power: parsed.data.power,
      playerName: parsed.data.playerName?.trim() || undefined,
    },
  };
}

const BotBearSchema = z.object({
  profileId: z.string(),
  rallySize: z.coerce.number(),
  playerName: z.optional(z.string()),
});

export function parseBotBearPayload(payload: unknown): ParseResult<{
  profileId: string;
  rallySize: number;
  playerName?: string;
}> {
  const parsed = BotBearSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid bot bear payload." };
  }

  const profileId = parsed.data.profileId.trim();
  if (!profileId) {
    return { ok: false, error: "profileId is required.", code: "profile_id_required" };
  }

  return {
    ok: true,
    data: {
      profileId,
      rallySize: parsed.data.rallySize,
      playerName: parsed.data.playerName?.trim() || undefined,
    },
  };
}
