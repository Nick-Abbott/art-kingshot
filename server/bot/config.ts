type EnvOptions = {
  required?: boolean;
  fallback?: string;
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

export type BotConfig = {
  discordToken: string;
  discordAppId: string;
  discordGuildId: string;
  serverUrl: string;
  botSecret: string;
  registerCommands: boolean;
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
  };
}
