import test from "node:test";
import assert from "node:assert/strict";
import { handleVikingsCommand } from "./vikings";

type FakeOptions = {
  subcommand: "register" | "edit" | "remove";
  profileId?: string;
  marchCount?: number;
  troopCount?: number;
  power?: number;
};

function createInteraction(options: FakeOptions) {
  return {
    user: { id: "discord-user" },
    options: {
      getSubcommand: () => options.subcommand,
      getString: () => options.profileId ?? null,
      getNumber: (name: "march_count" | "troop_count" | "power") => {
        if (name === "march_count") return options.marchCount ?? null;
        if (name === "troop_count") return options.troopCount ?? null;
        return options.power ?? null;
      },
      getFocused: () => ({ name: "profile", value: "" }),
    },
    respond: async () => {},
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

test("vikings register returns success copy", async () => {
  mockFetchOnce({ ok: true, data: { members: [] } });
  const message = await handleVikingsCommand(
    createInteraction({
      subcommand: "register",
      profileId: "profile-1",
      marchCount: 5,
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Registered! You’re signed up with 5 marches.");
});

test("vikings edit returns update copy", async () => {
  mockFetchOnce({ ok: true, data: { members: [] } });
  const message = await handleVikingsCommand(
    createInteraction({
      subcommand: "edit",
      profileId: "profile-1",
      marchCount: 4,
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Updated. Your registration details have been saved.");
});

test("vikings remove returns remove copy", async () => {
  mockFetchOnce({ ok: true, data: { members: [] } });
  const message = await handleVikingsCommand(
    createInteraction({
      subcommand: "remove",
      profileId: "profile-1",
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Removed. You are no longer signed up for this event.");
});

test("vikings register uses single active profile when missing profile option", async () => {
  let callCount = 0;
  global.fetch = (async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            profiles: [
              {
                id: "profile-1",
                playerId: "P1",
                playerName: "Player",
                allianceId: "alliance",
                status: "active",
              },
            ],
          },
        }),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { members: [] } }),
    } as Response;
  }) as typeof fetch;

  const message = await handleVikingsCommand(
    createInteraction({
      subcommand: "register",
      marchCount: 4,
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Registered! You’re signed up with 4 marches.");
});

test("vikings register fails when optional stats missing and no defaults exist", async () => {
  let callCount = 0;
  global.fetch = (async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            profiles: [
              {
                id: "profile-1",
                playerId: "P1",
                playerName: "Player",
                allianceId: "alliance",
                status: "active",
                troopCount: null,
                power: null,
              },
            ],
          },
        }),
      } as Response;
    }
    return {
      ok: false,
      status: 400,
      json: async () => ({
        ok: false,
        error: { message: "troopCount is required." },
      }),
    } as Response;
  }) as typeof fetch;

  const message = await handleVikingsCommand(
    createInteraction({
      subcommand: "register",
      marchCount: 4,
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "troopCount is required.");
});
