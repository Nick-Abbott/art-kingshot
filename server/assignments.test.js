const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generateAssignments,
  NEED_PER_CITY,
  MAX_SEND,
  MAX_SEND_WHALE,
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

  for (const member of result.members) {
    const outgoingTotal = sum(member.outgoing.map((item) => item.troops));
    assert.ok(outgoingTotal <= member.troopCount);
    const unmetWarning = result.warnings.some((warning) =>
      warning.includes(`City ${member.playerId} did not reach`)
    );
    assert.ok(
      member.incomingTotal >= NEED_PER_CITY ||
        member.garrisonLeadId ||
        unmetWarning
    );
  }

  for (const member of result.members) {
    const seenTargets = new Set();
    for (const item of member.outgoing) {
      assert.ok(!seenTargets.has(item.toId));
      seenTargets.add(item.toId);
      const maxCap = member.whale ? MAX_SEND_WHALE : MAX_SEND;
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

test("whale garrison lead is assigned when whale reinforces", () => {
  const members = [
    { playerId: "Whale1", troopCount: 600000, power: 120000000, marchCount: 6 },
    { playerId: "D", troopCount: 400000, power: 15000000, marchCount: 5 },
    { playerId: "E", troopCount: 400000, power: 16000000, marchCount: 5 },
  ];

  const result = generateAssignments(members);
  const target = result.members.find((member) => member.playerId === "D");

  assert.ok(target.garrisonLeadId, "Expected a garrison lead for D");
});
