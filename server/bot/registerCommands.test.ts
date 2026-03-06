import test from "node:test";
import assert from "node:assert/strict";
import { getCommandsRoute, registerCommands } from "./registerCommands";

test("getCommandsRoute uses guild route when guildId is provided", () => {
  const route = getCommandsRoute("app123", "guild456");
  assert.match(route, /applications\/app123\/guilds\/guild456\/commands$/);
});

test("getCommandsRoute uses global route when guildId is omitted", () => {
  const route = getCommandsRoute("app123");
  assert.match(route, /applications\/app123\/commands$/);
});

test("registerCommands uses provided rest client", async () => {
  let calledRoute = "";
  let calledBody: unknown[] | null = null;
  const restClient = {
    async put(route: string, options: { body: unknown[] }) {
      calledRoute = route;
      calledBody = options.body;
      return {};
    },
  };
  const commands = [{ name: "bear" }];
  await registerCommands({
    token: "token",
    appId: "app123",
    guildId: "guild456",
    commands,
    restClient,
  });
  assert.match(calledRoute, /applications\/app123\/guilds\/guild456\/commands$/);
  assert.deepEqual(calledBody, commands);
});
