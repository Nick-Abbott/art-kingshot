import type { BotProfilesPayload, Member } from "../../../shared/types";
import { botApiRequest } from "../api";

type BotConfig = {
  serverUrl: string;
  botSecret: string;
};

type VikingsCommandOptions = {
  getSubcommand: () => "register" | "edit" | "remove" | "assignments";
  getString: (name: "profile" | "output") => string | null;
  getNumber: (name: "march_count" | "troop_count" | "power") => number | null;
  getFocused: (required?: boolean) => { name: string; value: string } | string;
};

type VikingsInteraction = {
  user: { id: string };
  channel?: { send: (content: string) => Promise<unknown> } | null;
  options: VikingsCommandOptions;
  respond: (choices: Array<{ name: string; value: string }>) => Promise<void>;
  sendDm?: (content: string) => Promise<unknown>;
};

export type AssignmentPayload = {
  playerId: string;
  playerName: string;
  outgoing: Array<{ toName?: string; toId?: string; troops: number; lead?: boolean }>;
  incoming: Array<{ fromName?: string; fromId?: string; troops: number; lead?: boolean }>;
  incomingTotal: number;
};

const instructionsLines = [
  "If you will be offline for the event, please send out your reinforcements before you leave. You WILL receive reinforcement troops for the event to protect your city.",
  "How to run your marches",
  "- Use Equalize on every march.",
  "- Send one march to each of your assigned targets.",
  "- If you have a garrison leader incoming, send your main heroes to someone else - ideally someone whose garrison you are leading.",
  "- Use Chenko, Amane, Yeonwoo, Amadeus, or no heroes when reinforcing.",
  "Assignments are calculated assuming equalized marches and consistent march counts.",
];

export function buildAssignmentsHeader(mention?: string): string {
  const intro = mention
    ? `${mention}, here are your Viking assignments:`
    : "Here are your Viking assignments:";
  return [intro, ...instructionsLines].join("\n");
}

export function buildAssignmentsMessage(
  assignment: AssignmentPayload,
  header: string
): string {
  const lines: string[] = [header];
  if (assignment.outgoing.length > 0) {
    lines.push("");
    lines.push("Outgoing:");
    for (const outgoing of assignment.outgoing) {
      const target = outgoing.toName || outgoing.toId || "Unknown";
      const lead = outgoing.lead ? " (lead)" : "";
      lines.push(`- ${target}${lead}`);
    }
  }
  if (assignment.incoming.length > 0) {
    lines.push("");
    lines.push("Incoming:");
    for (const incoming of assignment.incoming) {
      const source = incoming.fromName || incoming.fromId || "Unknown";
      const lead = incoming.lead ? " (lead)" : "";
      lines.push(`- ${source}${lead}`);
    }
  }
  return lines.join("\n");
}

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

  if (subcommand === "assignments") {
    const output = interaction.options.getString("output") || "dm";
    const result = await botApiRequest<{
      results: { members: Array<Record<string, unknown>> } | null;
      assignment: {
        playerId: string;
        playerName: string;
        outgoing: Array<{ toName?: string; toId?: string; troops: number; lead?: boolean }>;
        incoming: Array<{ fromName?: string; fromId?: string; troops: number; lead?: boolean }>;
        incomingTotal: number;
      } | null;
    }>(
      apiOptions,
      `/api/bot/vikings/assignments?profileId=${encodeURIComponent(profileId)}`
    );
    if (!result.ok) {
      if (result.status === 404) return missingProfileCopy();
      return result.error.message || "Unable to load assignments.";
    }
    if (!result.data.assignment) {
      return "No assignments found for that profile.";
    }

    const assignment = result.data.assignment;
    const header = buildAssignmentsHeader(
      output === "channel" ? `<@${interaction.user.id}>` : undefined
    );
    const message = buildAssignmentsMessage(assignment, header);
    if (output === "channel") {
      if (!interaction.channel) {
        return "Channel output is not available here.";
      }
      await interaction.channel.send(message);
      return "Posted assignments to the channel.";
    }

    if (interaction.sendDm) {
      await interaction.sendDm(message);
      return "Sent your assignments via DM.";
    }
    return "Unable to send DM.";
  }

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
    .filter((profile) => profile.status === "active")
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
