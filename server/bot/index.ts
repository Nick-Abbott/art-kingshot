import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import type { REST } from "discord.js";
import type { BotConfig } from "./config";
import { loadBotConfig } from "./config";
import { commands } from "./commands";
import { registerCommands } from "./registerCommands";
import { handleBearAutocomplete, handleBearCommand } from "./handlers/bear";
import {
  handleVikingsAutocomplete,
  handleVikingsCommand,
} from "./handlers/vikings";
import { handleLinkCommand } from "./handlers/link";

type BotClient = {
  once: (
    event: string,
    handler: (readyClient: { user: { tag: string } }) => void | Promise<void>
  ) => void;
  on: (
    event: string,
    handler: (interaction: {
      commandName?: string;
      user?: { id: string };
      options?: unknown;
      isChatInputCommand: () => boolean;
      isAutocomplete: () => boolean;
      deferReply: (options: { ephemeral?: boolean; flags?: number }) => Promise<unknown>;
      editReply: (content: string) => Promise<unknown>;
      respond: (choices: Array<{ name: string; value: string }>) => Promise<void>;
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
    try {
      if (interaction.isAutocomplete()) {
        if (interaction.commandName === "bear") {
          await handleBearAutocomplete(interaction as unknown as Parameters<typeof handleBearAutocomplete>[0], {
            serverUrl: config.serverUrl,
            botSecret: config.botSecret,
          });
        } else if (interaction.commandName === "vikings") {
          await handleVikingsAutocomplete(
            interaction as unknown as Parameters<typeof handleVikingsAutocomplete>[0],
            {
              serverUrl: config.serverUrl,
              botSecret: config.botSecret,
            }
          );
        } else {
          await interaction.respond([]);
        }
        return;
      }

      if (!interaction.isChatInputCommand()) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (interaction.commandName === "bear") {
        const message = await handleBearCommand(interaction as unknown as Parameters<typeof handleBearCommand>[0], {
          serverUrl: config.serverUrl,
          botSecret: config.botSecret,
        });
        await interaction.editReply(message);
        return;
      }
      if (interaction.commandName === "link") {
        const message = await handleLinkCommand(
          interaction as unknown as Parameters<typeof handleLinkCommand>[0],
          {
            serverUrl: config.serverUrl,
            botSecret: config.botSecret,
          }
        );
        await interaction.editReply(message);
        return;
      }
      if (interaction.commandName === "vikings") {
        const message = await handleVikingsCommand(
          interaction as unknown as Parameters<typeof handleVikingsCommand>[0],
          {
            serverUrl: config.serverUrl,
            botSecret: config.botSecret,
          }
        );
        await interaction.editReply(message);
        return;
      }

      await interaction.editReply("Command not implemented yet.");
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
