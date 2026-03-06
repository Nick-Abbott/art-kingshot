import { REST, Routes } from "discord.js";

type RestClient = {
  put: (route: `/${string}`, options: { body: unknown[] }) => Promise<unknown>;
};

type RegisterOptions = {
  token: string;
  appId: string;
  guildId?: string;
  commands: unknown[];
  restClient?: RestClient;
};

export function getCommandsRoute(
  appId: string,
  guildId?: string
): `/${string}` {
  return (guildId
    ? Routes.applicationGuildCommands(appId, guildId)
    : Routes.applicationCommands(appId)) as `/${string}`;
}

export async function registerCommands({
  token,
  appId,
  guildId,
  commands,
  restClient,
}: RegisterOptions): Promise<void> {
  const rest = restClient ?? new REST({ version: "10" }).setToken(token);
  const route = getCommandsRoute(appId, guildId);
  await rest.put(route, { body: commands });
}
