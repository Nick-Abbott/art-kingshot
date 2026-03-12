import test from "node:test";
import assert from "node:assert/strict";
import {
  generateAssignments,
  MAX_SEND,
  MAX_SEND_WHALE,
  WHALE_MULTIPLIER,
  getRecencyPenaltyStep,
  getLeaderPenaltyMultiplier,
} from "./assignments";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

test("assignments respect per-target caps", () => {
  const members = [
    {
      playerId: "A",
      playerName: "A",
      troopCount: 500000,
      power: 35000000,
      marchCount: 5,
    },
    {
      playerId: "B",
      playerName: "B",
      troopCount: 350000,
      power: 120000000,
      marchCount: 6,
    },
    {
      playerId: "C",
      playerName: "C",
      troopCount: 420000,
      power: 28000000,
      marchCount: 5,
    },
  ];

  const result = generateAssignments(members);
  const powers = members.map((member) => member.power).sort((a, b) => a - b);
  const mid = Math.floor(powers.length / 2);
  const median =
    powers.length % 2 === 0 ? (powers[mid - 1] + powers[mid]) / 2 : powers[mid];
  const whaleThreshold = median * WHALE_MULTIPLIER;
  const whaleById = new Map(
    members.map((member) => [member.playerId, member.power >= whaleThreshold])
  );

  for (const member of result.members) {
    const outgoingTotal = sum(member.outgoing.map((item: { troops: number }) => item.troops));
    assert.ok(outgoingTotal <= member.troopCount);
  }

  for (const member of result.members) {
    const seenTargets = new Set();
    for (const item of member.outgoing) {
      assert.ok(!seenTargets.has(item.toId));
      seenTargets.add(item.toId);
      const maxCap = whaleById.get(member.playerId) ? MAX_SEND_WHALE : MAX_SEND;
      assert.ok(item.troops <= maxCap);
    }
  }
});

test("returns warnings instead of throwing on invalid inputs", () => {
  const result = generateAssignments([
    { playerId: "", playerName: "", troopCount: 0, power: 0, marchCount: 0 },
  ]);

  assert.equal(result.members.length, 0);
  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.warnings.length > 0);
});

test("lead is assigned when the strongest sender reinforces", () => {
  const members = [
    {
      playerId: "Whale1",
      playerName: "Whale1",
      troopCount: 600000,
      power: 120000000,
      marchCount: 6,
    },
    {
      playerId: "D",
      playerName: "D",
      troopCount: 400000,
      power: 15000000,
      marchCount: 5,
    },
    {
      playerId: "E",
      playerName: "E",
      troopCount: 400000,
      power: 16000000,
      marchCount: 5,
    },
  ];

  const result = generateAssignments(members);
  const target = result.members.find((member: { playerId: string }) => member.playerId === "D");

  assert.ok(target, "Expected a target member for D");
  assert.ok(target.garrisonLeadId, "Expected a garrison lead for D");
});

test("lead is only assigned when sender is at least 25% stronger or a whale", () => {
  const members = [
    {
      playerId: "A",
      playerName: "A",
      troopCount: 200000,
      power: 10000000,
      marchCount: 2,
    },
    {
      playerId: "B",
      playerName: "B",
      troopCount: 200000,
      power: 11000000,
      marchCount: 2,
    },
  ];

  const result = generateAssignments(members);
  const memberA = result.members.find((member: { playerId: string }) => member.playerId === "A");
  const memberB = result.members.find((member: { playerId: string }) => member.playerId === "B");

  assert.ok(memberA);
  assert.ok(memberB);
  assert.equal(memberA.garrisonLeadId, undefined);
  assert.equal(memberB.garrisonLeadId, undefined);
});

test("recency penalty step scales to whale march totals", () => {
  const step = getRecencyPenaltyStep(12);
  assert.equal(step, (1 - 0.6) / 12);
});

test("recency penalty step defaults to fallback rounds without whales", () => {
  const step = getRecencyPenaltyStep(0);
  assert.equal(step, (1 - 0.6) / 4);
});

test("leader penalty multiplier drops exponentially after free picks", () => {
  assert.equal(getLeaderPenaltyMultiplier(0), 1);
  assert.equal(getLeaderPenaltyMultiplier(2), 1);
  assert.equal(getLeaderPenaltyMultiplier(6), 0.6);
  const mid = getLeaderPenaltyMultiplier(4);
  assert.ok(mid < 1 && mid > 0.6);
});

export {};
