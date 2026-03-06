import { botApiRequest } from "../api";

type BotConfig = {
  serverUrl: string;
  botSecret: string;
};

type GuildCommandOptions = {
  getSubcommand: () => string;
  getString: (name: "alliance_id") => string | null;
};

type GuildInteraction = {
  user: { id: string };
  guildId?: string | null;
  options: GuildCommandOptions;
};

export async function handleGuildCommand(
  interaction: GuildInteraction,
  config: BotConfig
): Promise<string> {
  if (interaction.options.getSubcommand() !== "associate") {
    return "Unsupported guild command.";
  }
  const guildId = interaction.guildId ?? null;
  if (!guildId) return "This command must be used in a server.";

  const allianceId = interaction.options.getString("alliance_id")?.trim();
  if (!allianceId) return "Please provide an alliance ID.";

  const result = await botApiRequest<{ allianceId: string; guildId: string }>(
    {
      serverUrl: config.serverUrl,
      botSecret: config.botSecret,
      discordId: interaction.user.id,
      guildId,
    },
    "/api/bot/guild/associate",
    {
      method: "POST",
      body: JSON.stringify({ allianceId }),
    }
  );

  if (!result.ok) {
    return result.error.message || "Unable to link guild.";
  }

  return `Guild linked to alliance ${result.data.allianceId.toUpperCase()}.`;
}
