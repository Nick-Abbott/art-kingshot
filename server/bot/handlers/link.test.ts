import test from "node:test";
import assert from "node:assert/strict";
import { handleLinkCommand } from "./link";

function createInteraction(playerId?: string) {
  return {
    user: { id: "discord-user" },
    options: {
      getString: () => playerId ?? null,
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

test("link returns success copy", async () => {
  mockFetchOnce({ ok: true, data: { profile: { id: "p1" } } });
  const message = await handleLinkCommand(createInteraction("PLAYER1"), {
    serverUrl: "http://localhost",
    botSecret: "secret",
  });
  assert.equal(message, "Linked! Your profile has been added.");
});

test("link returns error message from API", async () => {
  mockFetchOnce({ ok: false, error: { message: "Player not found." } }, 404);
  const message = await handleLinkCommand(createInteraction("PLAYER1"), {
    serverUrl: "http://localhost",
    botSecret: "secret",
  });
  assert.equal(message, "Player not found.");
});
