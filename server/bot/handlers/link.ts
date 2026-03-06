import type { Profile } from "../../../shared/types";
import { botApiRequest } from "../api";

type BotConfig = {
  serverUrl: string;
  botSecret: string;
};

type LinkCommandOptions = {
  getString: (name: "player_id") => string | null;
};

type LinkInteraction = {
  user: { id: string };
  guildId?: string | null;
  options: LinkCommandOptions;
};

export async function handleLinkCommand(
  interaction: LinkInteraction,
  config: BotConfig
): Promise<string> {
  const playerId = interaction.options.getString("player_id")?.trim();
  if (!playerId) return "Please provide a player ID.";

  const result = await botApiRequest<{ profile: Profile | null }>(
    {
      serverUrl: config.serverUrl,
      botSecret: config.botSecret,
      discordId: interaction.user.id,
      guildId: interaction.guildId ?? null,
    },
    "/api/bot/profiles/link",
    {
      method: "POST",
      body: JSON.stringify({ playerId }),
    }
  );

  if (!result.ok) {
    return result.error.message || "Unable to link profile.";
  }

  return "Linked! Your profile has been added.";
}
