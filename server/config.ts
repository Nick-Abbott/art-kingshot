type EnvOptions = {
  required?: boolean;
  fallback?: string;
};

type NumberEnvOptions = {
  fallback?: number;
};

function getEnv(name: string, { required = false, fallback }: EnvOptions = {}) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    if (required) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback;
  }
  return value;
}

function getNumberEnv(name: string, { fallback }: NumberEnvOptions = {}) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

const config = {
  port: getEnv("PORT", { fallback: "3001" }),
  appBaseUrl: getEnv("APP_BASE_URL", { fallback: "http://localhost:5173" }),
  discordClientId: getEnv("DISCORD_CLIENT_ID", { fallback: "" }),
  discordClientSecret: getEnv("DISCORD_CLIENT_SECRET", { fallback: "" }),
  discordRedirectUri: getEnv("DISCORD_REDIRECT_URI", { fallback: "" }),
  sessionTtlDays: getNumberEnv("SESSION_TTL_DAYS", { fallback: 14 }),
  devBypassToken: getEnv("DEV_BYPASS_TOKEN", { fallback: "" }),
  nodeEnv: getEnv("NODE_ENV", { fallback: "" }),
};

module.exports = { config };

export {};
