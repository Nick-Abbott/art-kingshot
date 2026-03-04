const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generateAssignments,
  NEED_PER_CITY,
  MAX_SEND,
  MAX_SEND_WHALE,
  WHALE_MULTIPLIER,
} = require("./assignments");

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

test("assignments satisfy minimum incoming and respect per-target caps", () => {
  const members = [
    { playerId: "A", troopCount: 500000, power: 35000000, marchCount: 5 },
    { playerId: "B", troopCount: 350000, power: 120000000, marchCount: 6 },
    { playerId: "C", troopCount: 420000, power: 28000000, marchCount: 5 },
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
    const outgoingTotal = sum(member.outgoing.map((item) => item.troops));
    assert.ok(outgoingTotal <= member.troopCount);
    const effectiveIncoming = sum(
      member.incoming.map((entry) =>
        entry.troops * (whaleById.get(entry.fromId) ? 1.5 : 1)
      )
    );
    const unmetWarning = result.warnings.some((warning) =>
      warning.includes(`City ${member.playerId} did not reach`)
    );
    assert.ok(
      effectiveIncoming >= NEED_PER_CITY ||
        member.garrisonLeadId ||
        unmetWarning
    );
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
    { playerId: "", troopCount: 0, power: 0, marchCount: 0 },
  ]);

  assert.equal(result.members.length, 0);
  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.warnings.length > 0);
});

test("lead is assigned when the strongest sender reinforces", () => {
  const members = [
    { playerId: "Whale1", troopCount: 600000, power: 120000000, marchCount: 6 },
    { playerId: "D", troopCount: 400000, power: 15000000, marchCount: 5 },
    { playerId: "E", troopCount: 400000, power: 16000000, marchCount: 5 },
  ];

  const result = generateAssignments(members);
  const target = result.members.find((member) => member.playerId === "D");

  assert.ok(target.garrisonLeadId, "Expected a garrison lead for D");
});

export {};
