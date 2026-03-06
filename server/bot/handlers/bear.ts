import type {
  BotBearViewPayload,
  BotProfilesPayload,
  BearMember,
} from "../../../shared/types";
import { botApiRequest } from "../api";

type BotConfig = {
  serverUrl: string;
  botSecret: string;
};

type BearCommandOptions = {
  getSubcommand: () => "register" | "edit" | "remove" | "view";
  getString: (name: "profile" | "group") => string | null;
  getNumber: (name: "rally_size") => number | null;
  getFocused: (required?: boolean) => { name: string; value: string } | string;
};

type BearInteraction = {
  user: { id: string };
  options: BearCommandOptions;
  respond: (choices: Array<{ name: string; value: string }>) => Promise<void>;
};

const BEAR_GROUPS: Array<{ name: string; value: "bear1" | "bear2" }> = [
  { name: "Bear 1", value: "bear1" },
  { name: "Bear 2", value: "bear2" },
];

function formatBearGroup(group: string) {
  return group === "bear2" ? "Bear 2" : "Bear 1";
}

function missingProfileCopy() {
  return "Please link a Kingshot profile on the website first, then try again.";
}

async function resolveProfileId(
  interaction: BearInteraction,
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

function parseGroup(interaction: BearInteraction): string | null {
  const group = interaction.options.getString("group");
  if (group === "bear1" || group === "bear2") return group;
  return null;
}

export async function handleBearCommand(
  interaction: BearInteraction,
  config: BotConfig
): Promise<string> {
  const discordId = interaction.user.id;
  const apiOptions = {
    serverUrl: config.serverUrl,
    botSecret: config.botSecret,
    discordId,
  };

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "view") {
    const profileId = await resolveProfileId(interaction, config);
    if (!profileId) return "Please select a profile.";
    const result = await botApiRequest<BotBearViewPayload>(
      apiOptions,
      `/api/bot/bear?profileId=${encodeURIComponent(profileId)}`
    );
    if (!result.ok) {
      if (result.status === 404) return missingProfileCopy();
      return result.error.message || "Unable to load your bear signup.";
    }
    if (!result.data.member) {
      return "No bear signup found for that profile.";
    }
    const member = result.data.member;
    return `Registered! You’re signed up for ${formatBearGroup(
      member.bearGroup
    )} with rally size ${member.rallySize}.`;
  }

  if (subcommand === "remove") {
    const profileId = await resolveProfileId(interaction, config);
    const group = parseGroup(interaction);
    if (!profileId) return "Please select a profile.";
    if (!group) return "Please select a bear group.";
    const result = await botApiRequest<{ members: BearMember[] }>(
      apiOptions,
      `/api/bot/bear/${group}/${encodeURIComponent(profileId)}`,
      { method: "DELETE" }
    );
    if (!result.ok) {
      if (result.status === 404) return missingProfileCopy();
      return result.error.message || "Unable to remove your bear signup.";
    }
    return "Removed. You are no longer signed up for this event.";
  }

  const profileId = await resolveProfileId(interaction, config);
  const group = parseGroup(interaction);
  const rallySizeInput = interaction.options.getNumber("rally_size");
  if (!profileId) return "Please select a profile.";
  if (!group) return "Please select a bear group.";

  let rallySize = rallySizeInput ?? null;
  if (rallySize == null) {
    const profileResult = await botApiRequest<BotProfilesPayload>(
      apiOptions,
      "/api/bot/profiles"
    );
    if (profileResult.ok) {
      const profile = profileResult.data.profiles.find(
        (item) => item.id === profileId
      );
      rallySize = profile?.rallySize ?? null;
    }
  }
  if (rallySize == null) return "Please enter a rally size.";

  const result = await botApiRequest<{ members: BearMember[] }>(
    apiOptions,
    `/api/bot/bear/${group}`,
    {
      method: "POST",
      body: JSON.stringify({ profileId, rallySize }),
    }
  );
  if (!result.ok) {
    if (result.status === 404) return missingProfileCopy();
    return result.error.message || "Unable to save your bear signup.";
  }

  if (subcommand === "edit") {
    return "Updated. Your registration details have been saved.";
  }

  return `Registered! You’re signed up for ${formatBearGroup(
    group
  )} with rally size ${rallySize}.`;
}

export async function handleBearAutocomplete(
  interaction: BearInteraction,
  config: BotConfig
): Promise<void> {
  const rawFocused = interaction.options.getFocused(true);
  const focused =
    typeof rawFocused === "string"
      ? { name: "profile", value: rawFocused }
      : rawFocused;
  if (focused.name === "group") {
    await interaction.respond(BEAR_GROUPS);
    return;
  }

  if (focused.name === "profile") {
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
    return;
  }

  await interaction.respond([]);
}
