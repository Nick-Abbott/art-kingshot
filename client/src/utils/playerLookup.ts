import { z } from "zod/mini";
import { lookupPlayer } from "../api/playerLookup";

const LookupResponseSchema = z.object({ data: z.any() });

type LookupResult = {
  playerName: string;
  kingdomId: number | null;
  avatar: string | null;
};

export type NormalizedPlayerLookup = LookupResult;

type LookupHandlers = {
  onStart?: () => void;
  onSuccess?: (playerName: string) => void;
  onError?: () => void;
  noPlayerNameError?: Error;
};

function getNestedValue(source: unknown, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    if (!(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function pickString(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

function pickNumber(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

export function parsePlayerLookup(payload: unknown): LookupResult | null {
  const parsed = LookupResponseSchema.safeParse(payload);
  if (!parsed.success) return null;
  const root = parsed.data;
  const data = (root as { data?: unknown }).data ?? root;

  const name = pickString(data, [
    ["data", "data", "name"],
    ["data", "data", "nickname"],
    ["data", "data", "player_name"],
    ["data", "data", "role_name"],
    ["data", "name"],
    ["data", "nickname"],
    ["data", "player_name"],
    ["data", "role_name"],
    ["data", "info", "name"],
    ["data", "info", "nickname"],
    ["data", "info", "player_name"],
    ["data", "info", "role_name"],
    ["info", "name"],
    ["info", "nickname"],
    ["info", "player_name"],
    ["info", "role_name"],
    ["name"],
    ["nickname"],
    ["player_name"],
    ["role_name"]
  ]);

  const avatar = pickString(data, [
    ["data", "data", "avatar"],
    ["data", "data", "avatar_url"],
    ["data", "data", "avatar_image"],
    ["data", "data", "headimg"],
    ["data", "data", "headimgurl"],
    ["data", "data", "icon"],
    ["data", "data", "profile", "avatar"],
    ["data", "avatar"],
    ["data", "avatar_url"],
    ["data", "avatar_image"],
    ["data", "headimg"],
    ["data", "headimgurl"],
    ["data", "icon"],
    ["data", "profile", "avatar"],
    ["avatar"],
    ["avatar_url"],
    ["headimg"],
    ["headimgurl"],
    ["icon"],
    ["profile", "avatar"]
  ]);

  const kingdomId = pickNumber(data, [
    ["data", "data", "kid"],
    ["data", "kid"],
    ["kid"]
  ]);

  if (!name) return null;
  return {
    playerName: name,
    kingdomId,
    avatar: avatar || null
  };
}

export async function lookupAndParsePlayer(
  fid: string,
  handlers: LookupHandlers = {}
): Promise<LookupResult> {
  handlers.onStart?.();
  try {
    const lookup = await lookupPlayer(fid);
    const parsed = parsePlayerLookup(lookup);
    if (!parsed?.playerName) {
      throw handlers.noPlayerNameError || new Error("Player name not found");
    }
    handlers.onSuccess?.(parsed.playerName);
    return {
      playerName: parsed.playerName,
      kingdomId: parsed.kingdomId ?? null,
      avatar: parsed.avatar ?? null
    };
  } catch (error) {
    handlers.onError?.();
    throw error;
  }
}
