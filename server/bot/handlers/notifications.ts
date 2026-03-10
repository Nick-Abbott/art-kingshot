import type { BotProfilesPayload } from "../../../shared/types";
import { botApiRequest } from "../api";

type BotConfig = {
  serverUrl: string;
  botSecret: string;
};

type NotificationsCommandOptions = {
  getBoolean: (name: "enabled") => boolean | null;
  getString: (name: "profile") => string | null;
  getFocused: (required?: boolean) => { name: string; value: string } | string;
};

type NotificationsInteraction = {
  user: { id: string };
  options: NotificationsCommandOptions;
  respond?: (choices: Array<{ name: string; value: string }>) => Promise<void>;
};

async function resolveProfileId(
  interaction: NotificationsInteraction,
  config: BotConfig
): Promise<string | null> {
  const explicit = interaction.options.getString("profile");
  if (explicit?.trim()) return explicit.trim();

  const result = await botApiRequest<BotProfilesPayload>(
    {
      serverUrl: config.serverUrl,
      botSecret: config.botSecret,
      discordId: interaction.user.id,
    },
    "/api/bot/profiles"
  );
  if (!result.ok) return null;
  const activeProfiles = result.data.profiles.filter(
    (profile) => profile.allianceId && profile.status === "active"
  );
  if (activeProfiles.length === 1) {
    return activeProfiles[0].id;
  }
  return null;
}

export async function handleNotificationsCommand(
  interaction: NotificationsInteraction,
  config: BotConfig
): Promise<string> {
  const enabled = interaction.options.getBoolean("enabled");
  if (enabled === null) {
    return "Please choose true or false for assignment DMs.";
  }
  const profileId = await resolveProfileId(interaction, config);
  if (!profileId) {
    return "Please select a profile.";
  }

  const result = await botApiRequest<{ profile: { botOptInAssignments?: boolean } | null }>(
    {
      serverUrl: config.serverUrl,
      botSecret: config.botSecret,
      discordId: interaction.user.id,
    },
    "/api/bot/notifications/assignments",
    { method: "POST", body: JSON.stringify({ enabled, profileId }) }
  );

  if (!result.ok) {
    return result.error.message || "Unable to update notification settings.";
  }

  return enabled ? "Assignment DMs enabled." : "Assignment DMs disabled.";
}

export async function handleNotificationsAutocomplete(
  interaction: NotificationsInteraction,
  config: BotConfig
): Promise<void> {
  const rawFocused = interaction.options.getFocused(true);
  const focused =
    typeof rawFocused === "string"
      ? { name: "profile", value: rawFocused }
      : rawFocused;

  if (focused.name !== "profile" || !interaction.respond) {
    return;
  }

  const result = await botApiRequest<BotProfilesPayload>(
    {
      serverUrl: config.serverUrl,
      botSecret: config.botSecret,
      discordId: interaction.user.id,
    },
    "/api/bot/profiles"
  );
  if (!result.ok) {
    await interaction.respond([]);
    return;
  }
  const search = focused.value.toLowerCase();
  const choices = result.data.profiles
    .filter((profile) => {
      const label = profile.playerName || profile.playerId || "";
      return label.toLowerCase().includes(search);
    })
    .slice(0, 25)
    .map((profile) => ({
      name: profile.playerName || profile.playerId || profile.id,
      value: profile.id,
    }));
  await interaction.respond(choices);
}
