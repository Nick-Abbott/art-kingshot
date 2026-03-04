const BASE_URL = process.env.VIKING_APP_URL || "http://localhost:3001";
const SESSION_TOKEN = process.env.SESSION_TOKEN || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function run() {
  if (!SESSION_TOKEN) {
    throw new Error("SESSION_TOKEN is required for this smoke check.");
  }

  const headers = { Cookie: `ak_session=${SESSION_TOKEN}` };
  const me = await request("/api/me", { headers });
  if (!me.res.ok) {
    throw new Error(`Expected /api/me ok, got ${me.res.status}`);
  }
  let profiles = me.data?.data?.profiles || [];

  if (profiles.length === 0) {
    const playerId = `FID${Math.floor(Math.random() * 900000 + 100000)}`;
    const created = await request("/api/profiles", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, allianceId: "art" })
    });
    if (!created.res.ok) {
      throw new Error(`Expected profile create ok, got ${created.res.status}`);
    }
    profiles = [created.data?.data?.profile].filter(Boolean);
  }

  const profileId = profiles[0].id;
  if (!profileId) {
    throw new Error("Expected a profile id.");
  }

  const explicit = await request("/api/members", {
    headers: { ...headers, "x-profile-id": profileId }
  });
  if (!explicit.res.ok) {
    throw new Error(`Expected profile-scoped members to work, got ${explicit.res.status}`);
  }

  const invalid = await request("/api/members", {
    headers: { ...headers, "x-profile-id": "invalid-profile" }
  });
  if (invalid.res.status !== 404) {
    throw new Error(`Expected invalid profile to 404, got ${invalid.res.status}`);
  }

  console.log("Profile switch smoke check passed.");
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
