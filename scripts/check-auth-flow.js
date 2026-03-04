const BASE_URL = process.env.VIKING_APP_URL || "http://localhost:3001";
const SESSION_TOKEN = process.env.SESSION_TOKEN || "";

async function checkAuth() {
  const res = await fetch(`${BASE_URL}/api/me`, {
    headers: SESSION_TOKEN ? { Cookie: `ak_session=${SESSION_TOKEN}` } : {},
  });
  if (SESSION_TOKEN) {
    if (!res.ok) {
      throw new Error(`Expected authenticated response, got ${res.status}`);
    }
    console.log("Auth check passed (session).");
    return;
  }

  if (res.status !== 401) {
    throw new Error(`Expected 401 when unauthenticated, got ${res.status}`);
  }
  console.log("Auth check passed (unauthenticated).");
}

checkAuth().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
