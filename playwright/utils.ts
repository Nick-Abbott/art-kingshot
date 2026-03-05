import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";
import * as crypto from "node:crypto";
import Database from "better-sqlite3";

export type ProfileSeed = {
  id: string;
  playerId: string;
  playerName: string;
};

export const CLIENT_URL = process.env.SNAPSHOT_URL || "http://localhost:5173";
export const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";
export const DB_PATH = process.env.PLAYWRIGHT_DB_PATH || "";
export const TEST_TIME = Date.parse("2025-01-15T12:00:00.000Z");

function clientHost(clientUrl: string) {
  return new URL(clientUrl).hostname;
}

export function requireEnv(name: string, value: string, contextLabel: string) {
  if (!value) {
    throw new Error(`${name} is required for ${contextLabel}.`);
  }
}

export function createSessionToken(options: {
  dbPath?: string;
  isAppAdmin?: boolean;
} = {}) {
  const dbPath = options.dbPath ?? DB_PATH;
  const isAppAdmin = options.isAppAdmin ?? false;
  const db = new Database(dbPath);
  const now = Date.now();
  const userId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO users (id, discordId, displayName, avatar, isAppAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, `playwright-${userId}`, "Playwright", null, isAppAdmin ? 1 : 0, now);
  db.prepare(
    "INSERT INTO sessions (token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)"
  ).run(token, userId, now + 14 * 24 * 60 * 60 * 1000, now);
  db.close();
  return token;
}

export function resetPlaywrightDb(dbPath: string = DB_PATH) {
  if (!dbPath) {
    throw new Error("PLAYWRIGHT_DB_PATH is required to reset the test database.");
  }
  const db = new Database(dbPath);
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_version'"
    )
    .all() as { name: string }[];
  const clear = db.transaction(() => {
    for (const { name } of tables) {
      const safeName = name.replace(/"/g, '""');
      db.prepare(`DELETE FROM "${safeName}"`).run();
    }
  });
  clear();
  db.close();
}

export async function createAuthContext(
  browser: Browser,
  token: string,
  clientUrl: string = CLIENT_URL
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: clientUrl });
  await context.addCookies([
    { name: "ak_session", value: token, domain: clientHost(clientUrl), path: "/" },
  ]);
  await context.addInitScript((sessionToken) => {
    document.cookie = `ak_session=${sessionToken}; path=/`;
  }, token);
  return context;
}

export function authHeaders(token: string) {
  return { Cookie: `ak_session=${token}` };
}

export async function apiJson(
  request: APIRequestContext,
  url: string,
  options: { method?: string; headers?: Record<string, string>; data?: unknown } = {}
) {
  const res = await request.fetch(url, {
    method: options.method || "GET",
    headers: options.headers,
    data: options.data,
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

export async function assertSession(
  request: APIRequestContext,
  token: string,
  serverUrl: string = SERVER_URL
) {
  const { res, json } = await apiJson(request, `${serverUrl}/api/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) {
    throw new Error(
      `Session token invalid: ${res.status()} ${JSON.stringify(json)}`
    );
  }
}

export async function createProfile(
  request: APIRequestContext,
  token: string,
  payload: { playerId: string; playerName: string; kingdomId: number },
  serverUrl: string = SERVER_URL
) {
  const { res, json } = await apiJson(request, `${serverUrl}/api/profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`Failed to create profile: ${res.status()} ${JSON.stringify(json)}`);
  }
  return json.data.profile as ProfileSeed;
}

export async function createAlliance(
  request: APIRequestContext,
  token: string,
  profileId: string,
  serverUrl: string = SERVER_URL,
  options: { tag?: string; name?: string } = {}
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const tag = options.tag ?? "AOW";
    const baseName = options.name ?? `Arts of War ${tag}`;
    const { res, json } = await apiJson(request, `${serverUrl}/api/alliances`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
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

export async function joinAlliance(
  request: APIRequestContext,
  token: string,
  profileId: string,
  allianceId: string,
  serverUrl: string = SERVER_URL
) {
  const { res, json } = await apiJson(
    request,
    `${serverUrl}/api/profiles/${profileId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      data: { allianceId },
    }
  );
  if (!res.ok()) {
    throw new Error(`Failed to join alliance: ${res.status()} ${JSON.stringify(json)}`);
  }
}

export async function setPendingJoin(
  request: APIRequestContext,
  token: string,
  profileId: string,
  allianceId: string,
  serverUrl: string = SERVER_URL
) {
  await apiJson(request, `${serverUrl}/api/profiles/${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    data: { allianceId },
  });
}

export async function activateAllianceProfile(
  request: APIRequestContext,
  token: string,
  adminProfileId: string,
  profileId: string,
  serverUrl: string = SERVER_URL
) {
  const { res, json } = await apiJson(
    request,
    `${serverUrl}/api/alliance/profiles/${profileId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
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

export async function approveProfile(
  request: APIRequestContext,
  token: string,
  adminProfileId: string,
  profileId: string,
  serverUrl: string = SERVER_URL
) {
  await apiJson(request, `${serverUrl}/api/alliance/profiles/${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
      "x-profile-id": adminProfileId,
    },
    data: { status: "active" },
  });
}

export async function createVikingSignup(
  request: APIRequestContext,
  token: string,
  profileId: string,
  playerId: string,
  playerName: string,
  serverUrl: string = SERVER_URL
) {
  await apiJson(request, `${serverUrl}/api/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
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

export async function createBearSignup(
  request: APIRequestContext,
  token: string,
  profileId: string,
  playerId: string,
  playerName: string,
  serverUrl: string = SERVER_URL
) {
  await apiJson(request, `${serverUrl}/api/bear/bear1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
      "x-profile-id": profileId,
    },
    data: {
      playerId,
      playerName,
      rallySize: 800000,
    },
  });
}

export async function mockPlayerLookup(page: Page, name: string, kingdomId: number) {
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

export async function openPage(
  page: Page,
  options: {
    pageKey?: string;
    selectedProfileId?: string;
    clientUrl?: string;
    waitForMe?: boolean;
    waitForMeTimeout?: number;
    readySelector?: string;
    readyTimeout?: number;
    readyTestId?: string;
    readyState?: "attached" | "visible";
    fixedTime?: number | null;
  }
) {
  const clientUrl = options.clientUrl ?? CLIENT_URL;
  const waitForMe = options.waitForMe ?? true;
  const waitForMeTimeout = options.waitForMeTimeout ?? 5000;
  const fixedTime = options.fixedTime ?? TEST_TIME;

  if (fixedTime !== null) {
    await page.addInitScript((time) => {
      const OriginalDate = Date;
      class FixedDate extends OriginalDate {
        constructor(...args: ConstructorParameters<DateConstructor>) {
          if (args.length === 0) {
            super(time);
          } else {
            super(...args);
          }
        }
        static now() {
          return time;
        }
      }
      FixedDate.UTC = OriginalDate.UTC;
      FixedDate.parse = OriginalDate.parse;
      FixedDate.prototype = OriginalDate.prototype;
      // eslint-disable-next-line no-global-assign
      Date = FixedDate;
    }, fixedTime);
  }

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

  const meResponse = waitForMe
    ? page.waitForResponse((res) => res.url().includes("/api/me"), {
        timeout: waitForMeTimeout,
      })
    : null;

  await page.goto(clientUrl, { waitUntil: "domcontentloaded" });
  if (meResponse) {
    await meResponse;
  }

  if (options.readySelector) {
    await page
      .locator(options.readySelector)
      .waitFor({ state: "visible", timeout: options.readyTimeout ?? 10000 });
  }

  if (options.readyTestId) {
    await page
      .getByTestId(options.readyTestId)
      .waitFor({
        state: options.readyState ?? "visible",
        timeout: options.readyTimeout ?? 5000,
      });
  }
}

export async function waitForSnapshotReady(
  page: Page,
  options: { pageKey?: string; loggedOut?: boolean } = {}
) {
  const timeout = 10000;
  if (options.loggedOut) {
    await page.getByTestId("auth-login").waitFor({ state: "visible", timeout });
    return;
  }

  if (options.pageKey === "profiles") {
    await page.getByTestId("profiles-page").waitFor({ state: "visible", timeout });
    return;
  }

  if (options.pageKey === "viking") {
    await Promise.race([
      page.getByTestId("viking-roster").waitFor({ state: "visible", timeout }),
      page.getByTestId("profiles-page").waitFor({ state: "visible", timeout }),
    ]);
    return;
  }

  if (options.pageKey === "bear") {
    await Promise.race([
      page.getByTestId("bear1-list").waitFor({ state: "visible", timeout }),
      page.getByTestId("profiles-page").waitFor({ state: "visible", timeout }),
    ]);
    return;
  }

  await page.getByTestId("profile-switcher").waitFor({ state: "visible", timeout });
}

export async function openNavMenu(
  page: Page,
  options: { timeout?: number; force?: boolean } = {}
) {
  const navToggle = page.getByTestId("nav-toggle");
  if (await navToggle.isVisible()) {
    await navToggle.click({ force: options.force });
    await page
      .getByTestId("profile-switcher")
      .waitFor({ state: "visible", timeout: options.timeout ?? 5000 });
  }
}
