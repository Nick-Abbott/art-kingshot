type BotApiOptions = {
  serverUrl: string;
  botSecret: string;
  discordId: string;
};

export async function botApiRequest<T>(
  options: BotApiOptions,
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: { message: string; code?: string } ; status: number }> {
  const response = await fetch(`${options.serverUrl}${path}`, {
    ...init,
    headers: {
      "x-bot-secret": options.botSecret,
      "x-discord-id": options.discordId,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
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
