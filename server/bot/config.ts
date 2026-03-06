type EnvOptions = {
  required?: boolean;
  fallback?: string;
};

type NumberEnvOptions = {
  fallback?: number;
};

function getEnv(
  name: string,
  { required = false, fallback }: EnvOptions = {}
): string {
  const value = (process.env[name] || "").trim();
  if (!value) {
    if (required) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback ?? "";
  }
  return value;
}

function getNumberEnv(
  name: string,
  { fallback }: NumberEnvOptions = {}
): number {
  const raw = (process.env[name] || "").trim();
  if (!raw) return fallback ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback ?? 0;
}

export type BotConfig = {
  discordToken: string;
  discordAppId: string;
  discordGuildId: string;
  serverUrl: string;
  botSecret: string;
  registerCommands: boolean;
  assignmentsPollMs: number;
};

export function loadBotConfig(): BotConfig {
  return {
    discordToken: getEnv("DISCORD_BOT_TOKEN", { required: true }),
    discordAppId: getEnv("DISCORD_APP_ID", { required: true }),
    discordGuildId: getEnv("DISCORD_GUILD_ID", { fallback: "" }),
    serverUrl: getEnv("SERVER_URL", { required: true }),
    botSecret: getEnv("DISCORD_BOT_SECRET", { required: true }),
    registerCommands:
      getEnv("DISCORD_REGISTER_COMMANDS", { fallback: "" }) === "true",
    assignmentsPollMs: getNumberEnv("DISCORD_ASSIGNMENTS_POLL_MS", { fallback: 30000 }),
  };
}
