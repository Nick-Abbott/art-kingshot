type FetchLike = typeof fetch;

type KingshotStatsPlayerResponse = {
  player?: {
    nick_name?: unknown;
    kid?: unknown;
    avatar_url?: unknown;
  };
};

export type PlayerLookupResult = {
  playerName: string;
  kingdomId: number | null;
  avatar: string | null;
};

export class KingshotStatsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

export async function lookupKingshotPlayer(
  governorId: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch
): Promise<PlayerLookupResult> {
  if (!apiKey) {
    throw new KingshotStatsError(
      "Player lookup is not configured.",
      503,
      "player_lookup_not_configured"
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.kingshotstats.com/v1/players/${encodeURIComponent(governorId)}?include=base`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
  } catch {
    throw new KingshotStatsError("Lookup request failed.", 502, "lookup_failed");
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new KingshotStatsError("Player not found.", 404, "player_not_found");
    }
    if (response.status === 429) {
      throw new KingshotStatsError(
        "Player lookup is temporarily rate limited. Please try again shortly.",
        429,
        "player_lookup_rate_limited"
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new KingshotStatsError(
        "Player lookup is not configured.",
        503,
        "player_lookup_not_configured"
      );
    }
    throw new KingshotStatsError("Lookup request failed.", 502, "lookup_failed");
  }

  let payload: KingshotStatsPlayerResponse;
  try {
    payload = (await response.json()) as KingshotStatsPlayerResponse;
  } catch {
    throw new KingshotStatsError("Lookup returned invalid data.", 502, "lookup_invalid_response");
  }

  const player = payload.player;
  const playerName =
    typeof player?.nick_name === "string" ? player.nick_name.trim() : "";
  if (!playerName) {
    throw new KingshotStatsError("Lookup returned invalid data.", 502, "lookup_invalid_response");
  }

  const kingdomId = Number(player?.kid);
  const avatar =
    typeof player?.avatar_url === "string" && player.avatar_url.trim()
      ? player.avatar_url
      : null;

  return {
    playerName,
    kingdomId: Number.isFinite(kingdomId) ? kingdomId : null,
    avatar,
  };
}
