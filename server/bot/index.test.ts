import test from "node:test";
import assert from "node:assert/strict";
import { Events } from "discord.js";
import { createBot } from "./index";

type InteractionHandler = (interaction: {
  isChatInputCommand: () => boolean;
  deferReply: (options: { ephemeral: boolean }) => Promise<unknown>;
  editReply: (content: string) => Promise<unknown>;
}) => void | Promise<void>;

type ReadyHandler = (readyClient: { user: { tag: string } }) => void | Promise<void>;

function createFakeClient() {
  let readyHandler: ReadyHandler | null = null;
  let interactionHandler: InteractionHandler | null = null;
  return {
    once(event: string, handler: ReadyHandler) {
      if (event === Events.ClientReady) readyHandler = handler;
    },
    on(event: string, handler: InteractionHandler) {
      if (event === Events.InteractionCreate) interactionHandler = handler;
    },
    async login() {
      if (readyHandler) {
        await readyHandler({ user: { tag: "TestBot#0001" } });
      }
      return "ok";
    },
    async triggerInteraction(interaction: Parameters<InteractionHandler>[0]) {
      if (interactionHandler) {
        await interactionHandler(interaction);
      }
    },
  };
}

test("bot init registers commands and defers interactions", async () => {
  const calls: string[] = [];
  let registerCalled = false;
  const fakeClient = createFakeClient();

  const bot = createBot({
    config: {
      discordToken: "token",
      discordAppId: "app",
      discordGuildId: "guild",
      serverUrl: "http://localhost",
      botSecret: "secret",
      registerCommands: true,
    },
    commands: [{ name: "bear" }],
    createClient: () => fakeClient,
    registerCommands: async () => {
      registerCalled = true;
    },
    logger: {
      log: (msg: string) => calls.push(msg),
      error: (_msg: string) => {},
    },
  });

  await bot.start();
  assert.equal(registerCalled, true);

  let deferred = false;
  let edited = false;
  await fakeClient.triggerInteraction({
    isChatInputCommand: () => true,
    deferReply: async ({ ephemeral }) => {
      deferred = ephemeral;
    },
    editReply: async () => {
      edited = true;
    },
  });

  assert.equal(deferred, true);
  assert.equal(edited, true);
});
