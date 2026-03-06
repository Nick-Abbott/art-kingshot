import test from "node:test";
import assert from "node:assert/strict";
import { handleBearAutocomplete, handleBearCommand } from "./bear";

type FakeOptions = {
  subcommand: "register" | "edit" | "remove" | "view";
  profileId?: string;
  group?: string;
  rallySize?: number;
};

function createInteraction(options: FakeOptions) {
  return {
    user: { id: "discord-user" },
    options: {
      getSubcommand: () => options.subcommand,
      getString: (name: "profile" | "group") => {
        if (name === "profile") return options.profileId ?? null;
        return options.group ?? null;
      },
      getNumber: () => options.rallySize ?? null,
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

test("bear register returns success copy", async () => {
  mockFetchOnce({ ok: true, data: { members: [] } });
  const message = await handleBearCommand(
    createInteraction({
      subcommand: "register",
      profileId: "profile-1",
      group: "bear1",
      rallySize: 500000,
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(
    message,
    "Registered! You’re signed up for Bear 1 with rally size 500000."
  );
});

test("bear register uses single active profile when missing profile option", async () => {
  let callCount = 0;
  global.fetch = (async (_url: string) => {
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
    if (callCount === 2) {
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
                rallySize: 900,
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

  const message = await handleBearCommand(
    createInteraction({
      subcommand: "register",
      group: "bear1",
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(
    message,
    "Registered! You’re signed up for Bear 1 with rally size 900."
  );
});

test("bear register fails when rally size missing and no default exists", async () => {
  let callCount = 0;
  global.fetch = (async (_url: string) => {
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
                rallySize: null,
              },
            ],
          },
        }),
      } as Response;
    }
    if (callCount === 2) {
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
                rallySize: null,
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

  const message = await handleBearCommand(
    createInteraction({
      subcommand: "register",
      group: "bear1",
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Please enter a rally size.");
});

test("bear autocomplete excludes non-active profiles", async () => {
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
  await handleBearAutocomplete(
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
test("bear edit returns update copy", async () => {
  mockFetchOnce({ ok: true, data: { members: [] } });
  const message = await handleBearCommand(
    createInteraction({
      subcommand: "edit",
      profileId: "profile-1",
      group: "bear2",
      rallySize: 400000,
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Updated. Your registration details have been saved.");
});

test("bear remove returns remove copy", async () => {
  mockFetchOnce({ ok: true, data: { members: [] } });
  const message = await handleBearCommand(
    createInteraction({
      subcommand: "remove",
      profileId: "profile-1",
      group: "bear1",
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(message, "Removed. You are no longer signed up for this event.");
});

test("bear view returns signup copy", async () => {
  mockFetchOnce({
    ok: true,
    data: {
      member: { playerId: "P1", playerName: "Player", rallySize: 123, bearGroup: "bear2" },
    },
  });
  const message = await handleBearCommand(
    createInteraction({
      subcommand: "view",
      profileId: "profile-1",
    }),
    { serverUrl: "http://localhost", botSecret: "secret" }
  );
  assert.equal(
    message,
    "Registered! You’re signed up for Bear 2 with rally size 123."
  );
});
