const BASE_URL = process.env.VIKING_APP_URL || "http://localhost:3001";
const DEV_BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN || "";

async function checkAuth() {
  const res = await fetch(`${BASE_URL}/api/me`, {
    headers: DEV_BYPASS_TOKEN ? { "x-dev-bypass": DEV_BYPASS_TOKEN } : {},
  });
  if (DEV_BYPASS_TOKEN) {
    if (!res.ok) {
      throw new Error(`Expected authenticated response, got ${res.status}`);
    }
    console.log("Auth check passed (dev bypass).");
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
