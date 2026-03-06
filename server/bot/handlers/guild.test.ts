import test from "node:test";
import assert from "node:assert/strict";
import { handleGuildCommand } from "./guild";

function createInteraction({
  allianceId,
  guildId = "guild-1",
  subcommand = "associate",
}: {
  allianceId?: string;
  guildId?: string | null;
  subcommand?: string;
}) {
  return {
    user: { id: "discord-user" },
    guildId,
    options: {
      getSubcommand: () => subcommand,
      getString: () => allianceId ?? null,
    },
  };
}

function mockFetchOnce(payload: unknown, status = 200) {
  global.fetch = (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    } as Response)) as typeof fetch;
}

test("guild associate returns success copy", async () => {
  mockFetchOnce({ ok: true, data: { allianceId: "art", guildId: "guild-1" } });
  const message = await handleGuildCommand(
    createInteraction({ allianceId: "art" }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Guild linked to alliance ART.");
});

test("guild associate requires guild context", async () => {
  const message = await handleGuildCommand(
    createInteraction({ allianceId: "art", guildId: null }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "This command must be used in a server.");
});

test("guild associate returns API error message", async () => {
  mockFetchOnce(
    { ok: false, error: { message: "Alliance admin access required." } },
    403
  );
  const message = await handleGuildCommand(
    createInteraction({ allianceId: "art" }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Alliance admin access required.");
});
