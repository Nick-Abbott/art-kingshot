type BotApiOptions = {
  serverUrl: string;
  botSecret: string;
  discordId: string;
  guildId?: string | null;
};

export async function botApiRequest<T>(
  options: BotApiOptions,
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: { message: string; code?: string } ; status: number }> {
  const headers = new Headers(init?.headers);
  headers.set("x-bot-secret", options.botSecret);
  headers.set("x-discord-id", options.discordId);
  if (options.guildId) {
    headers.set("x-guild-id", options.guildId);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${options.serverUrl}${path}`, {
    ...init,
    headers,
  });

  const payload = (await response.json()) as
    | { ok: true; data: T }
    | { ok: false; error: { message: string; code?: string } };

  if (response.ok && payload.ok) {
    return payload;
  }
  return {
    ok: false,
    error: payload.ok ? { message: "Request failed." } : payload.error,
    status: response.status,
  };
}
