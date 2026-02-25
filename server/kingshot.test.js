const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPlayerLookupPayload } = require("./kingshot");

test("buildPlayerLookupPayload matches known signature", () => {
  const payload = buildPlayerLookupPayload("209927780", 1771962696541);
  assert.equal(payload.fid, "209927780");
  assert.equal(payload.time, 1771962696541);
  assert.equal(payload.sign, "ab944e4c4a60e27e22252c58cba156f8");
});
