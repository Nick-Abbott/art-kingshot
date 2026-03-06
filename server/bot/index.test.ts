import test from "node:test";
import assert from "node:assert/strict";
import { Events } from "discord.js";
import { createBot } from "./index";

type ReadyHandler = (readyClient: { user: { tag: string } }) => void | Promise<void>;

function createFakeClient() {
  let readyHandler: ReadyHandler | null = null;
  let onceCalled = false;
  let onCalled = false;
  let loginCalled = false;
  return {
    once(event: string, handler: ReadyHandler) {
      if (event === Events.ClientReady || event) readyHandler = handler;
      onceCalled = true;
    },
    on() {
      onCalled = true;
    },
    async login() {
      loginCalled = true;
      if (readyHandler) {
        await readyHandler({ user: { tag: "TestBot#0001" } });
      }
      return "ok";
    },
    users: {
      async fetch() {
        return { send: async () => {} };
      },
    },
    getState() {
      return { onceCalled, onCalled, loginCalled };
    },
  };
}

test("bot init wires handlers and logs in", async () => {
  const calls: string[] = [];
  const fakeClient = createFakeClient();

  const bot = createBot({
    config: {
      discordToken: "token",
      discordAppId: "app",
      discordGuildId: "guild",
      serverUrl: "http://localhost",
      botSecret: "secret",
      registerCommands: true,
      assignmentsPollMs: 0,
    },
    commands: [{ name: "bear" }],
    createClient: () => fakeClient,
    registerCommands: async () => {},
    logger: {
      log: (msg: string) => calls.push(msg),
      error: (_msg: string) => {},
    },
  });

  await bot.start();
  const state = fakeClient.getState();
  assert.equal(state.onceCalled, true);
  assert.equal(state.onCalled, true);
  assert.equal(state.loginCalled, true);
});
