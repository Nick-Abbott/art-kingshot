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
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback ?? 0;
}

export const config = {
  port: getEnv("PORT", { fallback: "3001" }),
  appBaseUrl: getEnv("APP_BASE_URL", { fallback: "http://localhost:5173" }),
  discordClientId: getEnv("DISCORD_CLIENT_ID", { fallback: "" }),
  discordClientSecret: getEnv("DISCORD_CLIENT_SECRET", { fallback: "" }),
  discordRedirectUri: getEnv("DISCORD_REDIRECT_URI", { fallback: "" }),
  discordBotSecret: getEnv("DISCORD_BOT_SECRET", { fallback: "" }),
  sessionTtlDays: getNumberEnv("SESSION_TTL_DAYS", { fallback: 14 }),
  nodeEnv: getEnv("NODE_ENV", { fallback: "" }),
};
