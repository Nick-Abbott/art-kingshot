const BASE_URL = process.env.VIKING_APP_URL || "http://localhost:3001";
const DEV_BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function run() {
  if (!DEV_BYPASS_TOKEN) {
    throw new Error("DEV_BYPASS_TOKEN is required for this smoke check.");
  }

  const headers = { "x-dev-bypass": DEV_BYPASS_TOKEN };
  const me = await request("/api/me", { headers });
  if (!me.res.ok) {
    throw new Error(`Expected /api/me ok, got ${me.res.status}`);
  }
  const memberships = me.data?.data?.memberships || [];
  if (memberships.length === 0) {
    throw new Error("Expected at least one membership.");
  }
  const allianceId = memberships[0].allianceId;

  const implicit = await request("/api/members", { headers });
  if (!implicit.res.ok) {
    throw new Error(`Expected implicit alliance to work, got ${implicit.res.status}`);
  }

  const explicit = await request("/api/members", {
    headers: { ...headers, "x-alliance-id": allianceId },
  });
  if (!explicit.res.ok) {
    throw new Error(`Expected explicit alliance to work, got ${explicit.res.status}`);
  }

  const invalid = await request("/api/members", {
    headers: { ...headers, "x-alliance-id": "invalid-alliance" },
  });
  if (invalid.res.status !== 400) {
    throw new Error(`Expected invalid alliance to 400, got ${invalid.res.status}`);
  }

  console.log("Alliance switch smoke check passed.");
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
