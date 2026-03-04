import { test } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const Database = require("better-sqlite3");

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
    throw new Error(`${name} is required for Playwright UI snapshots.`);
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
  const baseName = "Arts of War";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const tag = Math.random().toString(36).slice(2, 5).toUpperCase();
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
    if (res.status() !== 409) {
      throw new Error(`Failed to create alliance: ${res.status()} ${JSON.stringify(json)}`);
    }
  }
  throw new Error("Failed to create a unique alliance tag after retries.");
}

async function setPendingJoin(
  request: Parameters<typeof test>[0]["request"],
  profileId: string,
  allianceId: string
) {
  await apiJson(request, `${SERVER_URL}/api/profiles/${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    data: { allianceId },
  });
}

async function approveProfile(
  request: Parameters<typeof test>[0]["request"],
  adminProfileId: string,
  profileId: string
) {
  await apiJson(request, `${SERVER_URL}/api/alliance/profiles/${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      "x-profile-id": adminProfileId,
    },
    data: { status: "active" },
  });
}

async function createVikingSignup(
  request: Parameters<typeof test>[0]["request"],
  profileId: string,
  playerId: string,
  playerName: string
) {
  await apiJson(request, `${SERVER_URL}/api/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      "x-profile-id": profileId,
    },
    data: {
      playerId,
      playerName,
      troopCount: 450000,
      marchCount: 5,
      power: 33000000,
    },
  });
}

async function createBearSignup(
  request: Parameters<typeof test>[0]["request"],
  profileId: string,
  playerId: string,
  playerName: string
) {
  await apiJson(request, `${SERVER_URL}/api/bear/bear1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      "x-profile-id": profileId,
    },
    data: {
      playerId,
      playerName,
      rallySize: 800000,
    },
  });
}

async function snapshotPage(
  page: Parameters<typeof test>[0]["page"],
  name: string,
  options: {
    pageKey?: string;
    selectedProfileId?: string;
    openProfileMenu?: boolean;
    openNav?: boolean;
  }
) {
  const outputDir = path.join(process.cwd(), "snapshots", "playwright");
  fs.mkdirSync(outputDir, { recursive: true });

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

  await page.goto(CLIENT_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  if (options.openNav) {
    const navToggle = page.getByTestId("nav-toggle");
    if (await navToggle.isVisible()) {
      await navToggle.click();
      await page.waitForTimeout(150);
    }
  }

  if (options.openProfileMenu) {
    const trigger = page.getByTestId("profile-switcher");
    await trigger.click();
    await page.waitForTimeout(150);
  }

  const fileName = `${name}-${test.info().project.name}.png`;
  await page.screenshot({
    path: path.join(outputDir, fileName),
    fullPage: true,
  });
}

test("ui snapshots", async ({ browser, request }, testInfo) => {
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH);
  sessionToken = createSessionToken();
  await assertSession(request);

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
  const profileC = await createProfile(request, {
    playerId: buildPlayerId(3),
    playerName: "StaleMuffin",
    kingdomId,
  });

  const alliance = await createAlliance(request, profileA.id);
  await setPendingJoin(request, profileB.id, alliance.alliance.id);

  const contextWithAuth = await browser.newContext({ baseURL: CLIENT_URL });
  await contextWithAuth.addCookies([
    { name: "ak_session", value: sessionToken, domain: CLIENT_HOST, path: "/" },
  ]);
  await contextWithAuth.addInitScript((token) => {
    document.cookie = `ak_session=${token}; path=/`;
  }, sessionToken);

  try {
    const contextLoggedOut = await browser.newContext({ baseURL: CLIENT_URL });
    const loggedOutPage = await contextLoggedOut.newPage();
    await snapshotPage(loggedOutPage, "profiles-logged-out", { pageKey: "profiles" });
    await loggedOutPage.close();
    await contextLoggedOut.close();

    const loggedInPage = await contextWithAuth.newPage();
    await snapshotPage(loggedInPage, "profiles-logged-in", {
      pageKey: "profiles",
      selectedProfileId: profileC.id,
    });
    await loggedInPage.close();

    const pendingPage = await contextWithAuth.newPage();
    await snapshotPage(pendingPage, "profiles-pending", {
      pageKey: "profiles",
      selectedProfileId: profileB.id,
    });
    await pendingPage.close();

    await approveProfile(request, profileA.id, profileB.id);

    const activePage = await contextWithAuth.newPage();
    await snapshotPage(activePage, "profiles-active", {
      pageKey: "profiles",
      selectedProfileId: profileB.id,
    });
    await activePage.close();

    const dropdownPage = await contextWithAuth.newPage();
    await snapshotPage(dropdownPage, "profiles-dropdown-open", {
      pageKey: "profiles",
      selectedProfileId: profileC.id,
      openProfileMenu: true,
      openNav: testInfo.project.name.startsWith("mobile"),
    });
    await dropdownPage.close();

    const navPage = await contextWithAuth.newPage();
    await snapshotPage(navPage, "profiles-nav-open", {
      pageKey: "profiles",
      selectedProfileId: profileC.id,
      openNav: testInfo.project.name.startsWith("mobile"),
    });
    await navPage.close();

    const vikingNoAlliance = await contextWithAuth.newPage();
    await snapshotPage(vikingNoAlliance, "viking-no-alliance", {
      pageKey: "viking",
      selectedProfileId: profileC.id,
    });
    await vikingNoAlliance.close();

    const vikingNoSignup = await contextWithAuth.newPage();
    await snapshotPage(vikingNoSignup, "viking-active-nosignup", {
      pageKey: "viking",
      selectedProfileId: profileA.id,
    });
    await vikingNoSignup.close();

    const bearNoAlliance = await contextWithAuth.newPage();
    await snapshotPage(bearNoAlliance, "bear-no-alliance", {
      pageKey: "bear",
      selectedProfileId: profileC.id,
    });
    await bearNoAlliance.close();

    const bearNoSignup = await contextWithAuth.newPage();
    await snapshotPage(bearNoSignup, "bear-active-nosignup", {
      pageKey: "bear",
      selectedProfileId: profileA.id,
    });
    await bearNoSignup.close();

    await createVikingSignup(request, profileA.id, profileA.playerId, profileA.playerName);

    const vikingSignup = await contextWithAuth.newPage();
    await snapshotPage(vikingSignup, "viking-active-signup", {
      pageKey: "viking",
      selectedProfileId: profileA.id,
    });
    await vikingSignup.close();

    await createBearSignup(request, profileA.id, profileA.playerId, profileA.playerName);

    const bearSignup = await contextWithAuth.newPage();
    await snapshotPage(bearSignup, "bear-active-signup", {
      pageKey: "bear",
      selectedProfileId: profileA.id,
    });
    await bearSignup.close();
  } finally {
    await contextWithAuth.close();
  }
});
