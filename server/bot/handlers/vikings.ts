import type { BotProfilesPayload, Member } from "../../../shared/types";
import { botApiRequest } from "../api";

type BotConfig = {
  serverUrl: string;
  botSecret: string;
};

type VikingsCommandOptions = {
  getSubcommand: () => "register" | "edit" | "remove";
  getString: (name: "profile") => string | null;
  getNumber: (name: "march_count" | "troop_count" | "power") => number | null;
  getFocused: (required?: boolean) => { name: string; value: string } | string;
};

type VikingsInteraction = {
  user: { id: string };
  options: VikingsCommandOptions;
  respond: (choices: Array<{ name: string; value: string }>) => Promise<void>;
};

function missingProfileCopy() {
  return "Please link a Kingshot profile on the website first, then try again.";
}

async function resolveProfileId(
  interaction: VikingsInteraction,
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

export async function handleVikingsCommand(
  interaction: VikingsInteraction,
  config: BotConfig
): Promise<string> {
  const discordId = interaction.user.id;
  const apiOptions = {
    serverUrl: config.serverUrl,
    botSecret: config.botSecret,
    discordId,
  };

  const subcommand = interaction.options.getSubcommand();
  const profileId = await resolveProfileId(interaction, config);
  if (!profileId) return "Please select a profile.";

  if (subcommand === "remove") {
    const result = await botApiRequest<{ members: Member[] }>(
      apiOptions,
      `/api/bot/vikings/${encodeURIComponent(profileId)}`,
      { method: "DELETE" }
    );
    if (!result.ok) {
      if (result.status === 404) return missingProfileCopy();
      return result.error.message || "Unable to remove your signup.";
    }
    return "Removed. You are no longer signed up for this event.";
  }

  const marchCount = interaction.options.getNumber("march_count");
  if (!marchCount) return "Please enter a march count.";

  const troopCount = interaction.options.getNumber("troop_count");
  const power = interaction.options.getNumber("power");

  const result = await botApiRequest<{ members: Member[] }>(
    apiOptions,
    "/api/bot/vikings",
    {
      method: "POST",
      body: JSON.stringify({
        profileId,
        marchCount,
        troopCount: troopCount ?? undefined,
        power: power ?? undefined,
      }),
    }
  );
  if (!result.ok) {
    if (result.status === 404) return missingProfileCopy();
    return result.error.message || "Unable to save your signup.";
  }

  if (subcommand === "edit") {
    return "Updated. Your registration details have been saved.";
  }
  return `Registered! You’re signed up with ${marchCount} marches.`;
}

export async function handleVikingsAutocomplete(
  interaction: VikingsInteraction,
  config: BotConfig
): Promise<void> {
  const rawFocused = interaction.options.getFocused(true);
  const focused =
    typeof rawFocused === "string"
      ? { name: "profile", value: rawFocused }
      : rawFocused;

  if (focused.name !== "profile") {
    await interaction.respond([]);
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
  if (!result.ok || !result.data.profiles) {
    await interaction.respond([]);
    return;
  }

  const query = focused.value.toLowerCase();
  const choices = result.data.profiles
    .filter((profile) => {
      const name = profile.playerName || "";
      return (
        profile.playerId?.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query)
      );
    })
    .slice(0, 25)
    .map((profile) => ({
      name: profile.playerName
        ? `${profile.playerName} (${profile.playerId})`
        : profile.playerId || "Unknown",
      value: profile.id,
    }));

  await interaction.respond(choices);
}
