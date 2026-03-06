import { Client, Events, GatewayIntentBits } from "discord.js";
import type { REST } from "discord.js";
import type { BotConfig } from "./config";
import { loadBotConfig } from "./config";
import { commands } from "./commands";
import { registerCommands } from "./registerCommands";

type BotClient = {
  once: (
    event: string,
    handler: (readyClient: { user: { tag: string } }) => void | Promise<void>
  ) => void;
  on: (
    event: string,
    handler: (interaction: {
      isChatInputCommand: () => boolean;
      deferReply: (options: { ephemeral: boolean }) => Promise<unknown>;
      editReply: (content: string) => Promise<unknown>;
    }) => void | Promise<void>
  ) => void;
  login: (token: string) => Promise<unknown>;
};

type BotDeps = {
  config: BotConfig;
  commands: unknown[];
  createClient: () => BotClient;
  registerCommands: (options: {
    token: string;
    appId: string;
    guildId?: string;
    commands: unknown[];
    restClient?: REST;
  }) => Promise<void>;
  logger: Pick<typeof console, "log" | "error">;
};

export function createBot(deps: BotDeps) {
  const {
    config,
    commands,
    createClient,
    registerCommands: register,
    logger,
  } = deps;

  const client = createClient();

  client.once(Events.ClientReady, async (readyClient) => {
    logger.log(`Discord bot logged in as ${readyClient.user.tag}.`);
    if (config.registerCommands) {
      try {
        await register({
          token: config.discordToken,
          appId: config.discordAppId,
          guildId: config.discordGuildId || undefined,
          commands,
        });
        logger.log("Discord commands registered.");
      } catch (error) {
        logger.error("Failed to register Discord commands.", error);
      }
    } else {
      logger.log("Discord command registration skipped.");
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply("Bot is online. Commands will be available soon.");
    } catch (error) {
      logger.error("Failed to respond to interaction.", error);
    }
  });

  return {
    start: () => client.login(config.discordToken),
  };
}

async function boot() {
  const config = loadBotConfig();
  const bot = createBot({
    config,
    commands,
    createClient: () => new Client({ intents: [GatewayIntentBits.Guilds] }),
    registerCommands,
    logger: console,
  });

  await bot.start();
}

if (require.main === module) {
  boot().catch((error) => {
    console.error("Bot failed to start.", error);
    process.exit(1);
  });
}
