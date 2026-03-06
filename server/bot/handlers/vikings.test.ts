import test from "node:test";
import assert from "node:assert/strict";
import { handleVikingsAutocomplete, handleVikingsCommand } from "./vikings";

type FakeOptions = {
  subcommand: "register" | "edit" | "remove" | "assignments";
  profileId?: string;
  marchCount?: number;
  troopCount?: number;
  power?: number;
  output?: "dm" | "channel";
};

function createInteraction(options: FakeOptions) {
  return {
    user: { id: "discord-user" },
    options: {
      getSubcommand: () => options.subcommand,
      getString: (name: "profile" | "output") => {
        if (name === "profile") return options.profileId ?? null;
        return options.output ?? null;
      },
      getNumber: (name: "march_count" | "troop_count" | "power") => {
        if (name === "march_count") return options.marchCount ?? null;
        if (name === "troop_count") return options.troopCount ?? null;
        return options.power ?? null;
      },
      getFocused: () => ({ name: "profile", value: "" }),
    },
    respond: async () => {},
    channel: {
      send: async () => {},
    },
    sendDm: async () => {},
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

test("vikings assignments sends dm by default", async () => {
  let dmSent = false;
  global.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          assignment: {
            playerId: "P1",
            playerName: "Player",
            outgoing: [{ toName: "Target", troops: 1000 }],
            incoming: [],
            incomingTotal: 0,
          },
          results: { members: [] },
        },
      }),
    } as Response)) as typeof fetch;

  const message = await handleVikingsCommand(
    {
      ...createInteraction({
        subcommand: "assignments",
        profileId: "profile-1",
      }),
      sendDm: async () => {
        dmSent = true;
      },
    },
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Sent your assignments via DM.");
  assert.equal(dmSent, true);
});

test("vikings assignments posts to channel when requested", async () => {
  let channelSent = false;
  global.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          assignment: {
            playerId: "P1",
            playerName: "Player",
            outgoing: [{ toName: "Target", troops: 1000 }],
            incoming: [],
            incomingTotal: 0,
          },
          results: { members: [] },
        },
      }),
    } as Response)) as typeof fetch;

  const message = await handleVikingsCommand(
    {
      ...createInteraction({
        subcommand: "assignments",
        profileId: "profile-1",
        output: "channel",
      }),
      channel: {
        send: async () => {
          channelSent = true;
        },
      },
    },
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Posted assignments to the channel.");
  assert.equal(channelSent, true);
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

test("vikings autocomplete excludes non-active profiles", async () => {
  global.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          profiles: [
            {
              id: "active-1",
              playerId: "ACTIVE1",
              playerName: "Active One",
              allianceId: "alliance",
              status: "active",
            },
            {
              id: "pending-1",
              playerId: "PENDING1",
              playerName: "Pending One",
              allianceId: "alliance",
              status: "pending",
            },
          ],
        },
      }),
    } as Response)) as typeof fetch;

  const choices: Array<{ name: string; value: string }> = [];
  await handleVikingsAutocomplete(
    {
      user: { id: "discord-user" },
      options: {
        getSubcommand: () => "register",
        getString: () => null,
        getNumber: () => null,
        getFocused: () => ({ name: "profile", value: "" }),
      },
      respond: async (list: Array<{ name: string; value: string }>) => {
        choices.push(...list);
      },
    },
    { serverUrl: "http://localhost", botSecret: "secret" }
  );

  assert.equal(choices.length, 1);
  assert.equal(choices[0].value, "active-1");
});
