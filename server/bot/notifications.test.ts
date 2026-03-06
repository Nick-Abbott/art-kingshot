import test from "node:test";
import assert from "node:assert/strict";
import { processAssignmentNotification } from "./notifications";

test("processAssignmentNotification marks failed when DM fails", async () => {
  let status: { id: string; status: string; error?: string } | null = null;
  await processAssignmentNotification(
    {
      id: "notif-1",
      discordId: "user-1",
      payload: JSON.stringify({
        playerId: "P1",
        playerName: "Player",
        outgoing: [],
        incoming: [],
        incomingTotal: 0,
      }),
    },
    {
      sendDm: async () => {
        throw new Error("DM blocked");
      },
      updateStatus: async (id, nextStatus, error) => {
        status = { id, status: nextStatus, error };
      },
      logger: {
        error: () => {},
      },
    }
  );

  assert.ok(status);
  const resolved = status as { status: string; error?: string };
  assert.equal(resolved.status, "failed");
  assert.ok(resolved.error?.includes("DM blocked"));
});
