import { expect, test } from "@playwright/test";
import crypto from "node:crypto";
const Database = require("better-sqlite3");

const ACTION_TIMEOUT = 5000;
const WAIT_TIMEOUT = 5000;

test.use({ actionTimeout: ACTION_TIMEOUT, navigationTimeout: 10000 });

type ProfileSeed = {
  id: string;
  playerId: string;
  playerName: string;
};

const CLIENT_URL = process.env.SNAPSHOT_URL || "http://localhost:5173";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";
const DB_PATH = process.env.PLAYWRIGHT_DB_PATH || "";
const CLIENT_HOST = new URL(CLIENT_URL).hostname;

let sessionToken = "";

function requireEnv(name: string, value: string) {
  if (!value) {
    throw new Error(`${name} is required for Playwright UI flows.`);
  }
}

function createSessionToken() {
  const db = new Database(DB_PATH);
  const now = Date.now();
  const userId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO users (id, discordId, displayName, avatar, isAppAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, `playwright-${userId}`, "Playwright", null, 0, now);
  db.prepare(
    "INSERT INTO sessions (token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)"
  ).run(token, userId, now + 14 * 24 * 60 * 60 * 1000, now);
  db.close();
  return token;
}

function authHeaders() {
  return { Cookie: `ak_session=${sessionToken}` };
}

async function assertSession(request: Parameters<typeof test>[0]["request"]) {
  const { res, json } = await apiJson(request, `${SERVER_URL}/api/me`, {
    headers: authHeaders(),
  });
  if (!res.ok()) {
    throw new Error(
      `Session token invalid: ${res.status()} ${JSON.stringify(json)}`
    );
  }
}

async function apiJson(
  request: Parameters<typeof test>[0]["request"],
  url: string,
  options: { method?: string; headers?: Record<string, string>; data?: any } = {}
) {
  const res = await request.fetch(url, {
    method: options.method || "GET",
    headers: options.headers,
    data: options.data,
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function createProfile(
  request: Parameters<typeof test>[0]["request"],
  payload: { playerId: string; playerName: string; kingdomId: number }
) {
  const { res, json } = await apiJson(request, `${SERVER_URL}/api/profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`Failed to create profile: ${res.status()} ${JSON.stringify(json)}`);
  }
  return json.data.profile as ProfileSeed;
}

async function createAlliance(
  request: Parameters<typeof test>[0]["request"],
  profileId: string
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const tag = Array.from(crypto.randomBytes(3))
      .map((byte) => String.fromCharCode(65 + (byte % 26)))
      .join("")
      .slice(0, 3);
    const baseName = `Arts of War ${tag}`;
    const { res, json } = await apiJson(request, `${SERVER_URL}/api/alliances`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        "x-profile-id": profileId,
      },
      data: { tag, name: baseName },
    });
    if (res.ok()) {
      return json.data;
    }
    if (res.status() === 409) {
      continue;
    }
    if (res.status() === 429 || res.status() >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
    throw new Error(`Failed to create alliance: ${res.status()} ${JSON.stringify(json)}`);
  }
  throw new Error("Failed to create a unique alliance tag after retries.");
}

async function joinAlliance(
  request: Parameters<typeof test>[0]["request"],
  profileId: string,
  allianceId: string
) {
  const { res, json } = await apiJson(
    request,
    `${SERVER_URL}/api/profiles/${profileId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      data: { allianceId },
    }
  );
  if (!res.ok()) {
    throw new Error(`Failed to join alliance: ${res.status()} ${JSON.stringify(json)}`);
  }
}

async function activateAllianceProfile(
  request: Parameters<typeof test>[0]["request"],
  adminProfileId: string,
  profileId: string
) {
  const { res, json } = await apiJson(
    request,
    `${SERVER_URL}/api/alliance/profiles/${profileId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        "x-profile-id": adminProfileId,
      },
      data: { status: "active" },
    }
  );
  if (!res.ok()) {
    throw new Error(
      `Failed to activate alliance profile: ${res.status()} ${JSON.stringify(json)}`
    );
  }
}

async function seedProfiles(request: Parameters<typeof test>[0]["request"]) {
  const kingdomId = 9000 + Math.floor(Math.random() * 1000);
  const runToken = `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;
  const buildPlayerId = (suffix: number) => `FID${runToken}${suffix}`;
  const profileA = await createProfile(request, {
    playerId: buildPlayerId(1),
    playerName: "Professor Muffin",
    kingdomId,
  });
  const profileB = await createProfile(request, {
    playerId: buildPlayerId(2),
    playerName: "MuffinMan",
    kingdomId,
  });
  const alliance = await createAlliance(request, profileA.id);
  return { profileA, profileB, allianceId: alliance.alliance.id };
}

async function mockPlayerLookup(
  page: Parameters<typeof test>[0]["page"],
  name: string,
  kingdomId: number
) {
  await page.route("**/api/player-lookup", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          data: {
            data: {
              name,
              kid: kingdomId,
            },
          },
        },
      }),
    })
  );
}

async function openPage(
  page: Parameters<typeof test>[0]["page"],
  options: { pageKey?: string; selectedProfileId?: string }
) {
  await page.addInitScript(
    ({ pageKey, selectedProfileId }) => {
      if (pageKey) {
        window.localStorage.setItem("currentPage", pageKey);
      }
      if (selectedProfileId) {
        window.localStorage.setItem("selectedProfile", selectedProfileId);
      } else {
        window.localStorage.removeItem("selectedProfile");
      }
    },
    { pageKey: options.pageKey, selectedProfileId: options.selectedProfileId }
  );

  await page.goto(CLIENT_URL, { waitUntil: "domcontentloaded" });
  await page.waitForResponse((res) => res.url().includes("/api/me"), {
    timeout: WAIT_TIMEOUT,
  });
  await page
    .getByTestId("profile-switcher")
    .waitFor({ state: "attached", timeout: WAIT_TIMEOUT });
}

async function openNavMenu(page: Parameters<typeof test>[0]["page"]) {
  const navToggle = page.getByTestId("nav-toggle");
  if (await navToggle.isVisible()) {
    await navToggle.click();
    await page
      .getByTestId("profile-switcher")
      .waitFor({ state: "visible", timeout: WAIT_TIMEOUT });
  }
}

async function ensureProfileSwitcherReady(page: Parameters<typeof test>[0]["page"]) {
  await openNavMenu(page);
  const switcher = page.getByTestId("profile-switcher");
  await expect(switcher).toBeEnabled({ timeout: WAIT_TIMEOUT });
}

test("profile switcher updates selected profile", async ({ browser, request }) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH);
  sessionToken = createSessionToken();
  await assertSession(request);
  const { profileA, profileB } = await seedProfiles(request);
  const context = await browser.newContext({ baseURL: CLIENT_URL });
  await context.addCookies([
    { name: "ak_session", value: sessionToken, domain: CLIENT_HOST, path: "/" },
  ]);
  await context.addInitScript((token) => {
    document.cookie = `ak_session=${token}; path=/`;
  }, sessionToken);
  const page = await context.newPage();
  await mockPlayerLookup(page, profileA.playerName, 9001);

  await openPage(page, {
    pageKey: "viking",
    selectedProfileId: profileA.id,
  });
  await ensureProfileSwitcherReady(page);

  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).click();
  await expect(page.getByTestId("profile-switcher")).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("viking signup and reset", async ({ browser, request }) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH);
  sessionToken = createSessionToken();
  await assertSession(request);
  const { profileA } = await seedProfiles(request);
  const context = await browser.newContext({ baseURL: CLIENT_URL });
  await context.addCookies([
    { name: "ak_session", value: sessionToken, domain: CLIENT_HOST, path: "/" },
  ]);
  await context.addInitScript((token) => {
    document.cookie = `ak_session=${token}; path=/`;
  }, sessionToken);
  const page = await context.newPage();
  await mockPlayerLookup(page, profileA.playerName, 9001);

  await openPage(page, {
    pageKey: "viking",
    selectedProfileId: profileA.id,
  });

  await page.getByLabel("March count").fill("4");
  await page.getByLabel("Power").fill("33000000");
  await page.getByLabel("Troop count").fill("450000");
  await page.getByRole("button", { name: /save signup/i }).click({ timeout: WAIT_TIMEOUT });

  await expect(page.getByTestId("viking-signed-count")).toHaveText("1", {
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("viking-roster-list")).toContainText(profileA.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByRole("button", { name: /reset event/i }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("viking-signed-count")).toHaveText("0", {
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("viking-roster-list")).toContainText("No signups yet.", {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("bear signup and reset", async ({ browser, request }) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH);
  sessionToken = createSessionToken();
  await assertSession(request);
  const { profileA } = await seedProfiles(request);
  const context = await browser.newContext({ baseURL: CLIENT_URL });
  await context.addCookies([
    { name: "ak_session", value: sessionToken, domain: CLIENT_HOST, path: "/" },
  ]);
  await context.addInitScript((token) => {
    document.cookie = `ak_session=${token}; path=/`;
  }, sessionToken);
  const page = await context.newPage();
  await mockPlayerLookup(page, profileA.playerName, 9001);

  await openPage(page, {
    pageKey: "bear",
    selectedProfileId: profileA.id,
  });

  const signupForm = page.locator("form").first();
  await signupForm.getByLabel("Rally size").fill("800000");
  await signupForm.getByLabel("Bear group").selectOption("bear1");
  await page.getByRole("button", { name: /register/i }).click({ timeout: WAIT_TIMEOUT });

  await expect(page.getByTestId("bear1-count")).toHaveText("1", { timeout: WAIT_TIMEOUT });
  await expect(page.getByTestId("bear1-list")).toContainText(profileA.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByRole("button", { name: /reset bear 1/i }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("bear1-count")).toHaveText("0", { timeout: WAIT_TIMEOUT });
  await expect(page.getByTestId("bear1-list")).toContainText("No signups yet.", {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("admin signup controls are only visible to alliance admins", async ({
  browser,
  request,
}) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH);
  sessionToken = createSessionToken();
  await assertSession(request);
  const { profileA, profileB, allianceId } = await seedProfiles(request);
  await joinAlliance(request, profileB.id, allianceId);
  await activateAllianceProfile(request, profileA.id, profileB.id);

  const context = await browser.newContext({ baseURL: CLIENT_URL });
  await context.addCookies([
    { name: "ak_session", value: sessionToken, domain: CLIENT_HOST, path: "/" },
  ]);
  await context.addInitScript((token) => {
    document.cookie = `ak_session=${token}; path=/`;
  }, sessionToken);
  const page = await context.newPage();

  await openPage(page, { pageKey: "viking", selectedProfileId: profileA.id });
  await expect(page.getByLabel("Alliance member (admin)")).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });
  await ensureProfileSwitcherReady(page);
  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).click();
  await expect(page.getByLabel("Alliance member (admin)")).toHaveCount(0);

  await openPage(page, { pageKey: "bear", selectedProfileId: profileA.id });
  await expect(page.getByLabel("Alliance member (admin)")).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });
  await ensureProfileSwitcherReady(page);
  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).click();
  await expect(page.getByLabel("Alliance member (admin)")).toHaveCount(0);

  await context.close();
});
