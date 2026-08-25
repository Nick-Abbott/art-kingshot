import test from "node:test";
import assert from "node:assert/strict";
import { KingshotStatsError, lookupKingshotPlayer } from "./kingshot";

test("lookupKingshotPlayer requests base stats by governor ID", async () => {
  let requestUrl = "";
  let authorization = "";
  const result = await lookupKingshotPlayer(
    "209927780",
    "kss_test",
    (async (input, init) => {
      requestUrl = String(input);
      authorization = new Headers(init?.headers).get("Authorization") || "";
      return new Response(
        JSON.stringify({
          player: {
            nick_name: "Viking",
            kid: 1459,
            avatar_url: "https://example.test/avatar.png",
          },
        }),
        { status: 200 }
      );
    }) as typeof fetch
  );

  assert.equal(
    requestUrl,
    "https://api.kingshotstats.com/v1/players/209927780?include=base"
  );
  assert.equal(authorization, "Bearer kss_test");
  assert.deepEqual(result, {
    playerName: "Viking",
    kingdomId: 1459,
    avatar: "https://example.test/avatar.png",
  });
});

test("lookupKingshotPlayer maps provider failures", async () => {
  await assert.rejects(
    lookupKingshotPlayer(
      "missing",
      "kss_test",
      (async () => new Response(null, { status: 404 })) as typeof fetch
    ),
    (error: unknown) =>
      error instanceof KingshotStatsError &&
      error.status === 404 &&
      error.code === "player_not_found"
  );

  await assert.rejects(
    lookupKingshotPlayer(
      "limited",
      "kss_test",
      (async () => new Response(null, { status: 429 })) as typeof fetch
    ),
    (error: unknown) =>
      error instanceof KingshotStatsError &&
      error.status === 429 &&
      error.code === "player_lookup_rate_limited"
  );
});

test("lookupKingshotPlayer rejects incomplete player responses", async () => {
  await assert.rejects(
    lookupKingshotPlayer(
      "invalid",
      "kss_test",
      (async () =>
        new Response(JSON.stringify({ player: { kid: 1459 } }), {
          status: 200,
        })) as typeof fetch
    ),
    (error: unknown) =>
      error instanceof KingshotStatsError &&
      error.code === "lookup_invalid_response"
  );
});

export {};
