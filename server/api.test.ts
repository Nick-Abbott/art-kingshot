import test from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import Database from "better-sqlite3";
import { createApp } from "./index";
import type { ApiErrorPayload } from "../shared/types";
import { DEFAULT_ALLIANCE_SETTINGS } from "../shared/allianceConfig";
import { getNextVikingEventIso } from "./utils/vikingTime";

const tmpDirs: string[] = [];

type ServerHandle = {
  httpServer: import("node:http").Server;
  port: number;
};

type ApiPayload = {
  ok: boolean;
  data: unknown;
  error?: ApiErrorPayload;
};

function startServer(): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    const app = createApp({ dbPath: process.env.DB_PATH });
    const httpServer = http.createServer(app);
    httpServer.listen(0, () => {
      const address = httpServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind test server."));
        return;
      }
      resolve({ httpServer, port: address.port });
    });
  });
}

type JsonResponse = {
  status: number | undefined;
  data: ApiPayload;
  headers: import("node:http").IncomingHttpHeaders;
};

function requestJson(
  port: number,
  method: string,
  path: string,
  headers?: Record<string, string>,
  body?: string
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        method,
        path,
        headers: headers || {},
      },
      (res: import("node:http").IncomingMessage) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            status: res.statusCode,
            data: parsed as ApiPayload,
            headers: res.headers
          });
        });
      }
    );
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function requestMultipart(
  port: number,
  method: string,
  path: string,
  {
    headers = {},
    field = "file",
    filename = "troops.png",
    contentType = "image/png",
    fileBuffer = Buffer.from([1, 2, 3, 4]),
  }: {
    headers?: Record<string, string>;
    field?: string;
    filename?: string;
    contentType?: string;
    fileBuffer?: Buffer;
  } = {}
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const boundary = `----vikingapp-${crypto.randomBytes(8).toString("hex")}`;
    const preamble = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`
    );
    const closing = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([preamble, fileBuffer, closing]);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(body.length),
          ...headers,
        },
      },
      (res: import("node:http").IncomingMessage) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            status: res.statusCode,
            data: parsed as ApiPayload,
            headers: res.headers,
          });
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function tmpDbPath() {
  const baseDir = path.join(process.cwd(), "data");
  fs.mkdirSync(baseDir, { recursive: true });
  const dir = fs.mkdtempSync(path.join(baseDir, "test-"));
  tmpDirs.push(dir);
  return path.join(dir, "test.sqlite");
}

function listFailedScreenshots() {
  const dir = path.join(process.cwd(), "data", "failed-screenshots");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((entry) => fs.statSync(entry).isDirectory());
}

test.after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const failedDir = path.join(process.cwd(), "data", "failed-screenshots");
  fs.rmSync(failedDir, { recursive: true, force: true });
});

function getPayload<T>(response: JsonResponse): T {
  return response.data.data as T;
}

function createSessionCookie(
  dbPath: string,
  { isAppAdmin = false }: { isAppAdmin?: boolean } = {}
): string {
  const db = new Database(dbPath);
  const now = Date.now();
  const userId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO users (id, discordId, displayName, avatar, isAppAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, `test-${userId}`, "Test User", null, isAppAdmin ? 1 : 0, now);
  db.prepare(
    "INSERT INTO sessions (token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)"
  ).run(token, userId, now + 7 * 24 * 60 * 60 * 1000, now);
  db.close();
  return `ak_session=${token}`;
}

function createBotUser(
  dbPath: string,
  {
    discordId,
    allianceId,
    profileId,
    playerId,
    kingdomId = 1459,
    troopCount = null,
    marchCount = null,
    power = null,
    guildId = null,
    role = "member",
    isAppAdmin = false,
  }: {
    discordId: string;
    allianceId: string;
    profileId: string;
    playerId: string;
    kingdomId?: number;
    troopCount?: number | null;
    marchCount?: number | null;
    power?: number | null;
    guildId?: string | null;
    role?: "member" | "alliance_admin";
    isAppAdmin?: boolean;
  }
) {
  const db = new Database(dbPath);
  const now = Date.now();
  const userId = crypto.randomUUID();
  const troopsSnapshot =
    troopCount == null && marchCount == null
      ? null
      : JSON.stringify({
          header: {
            totalTroops: troopCount,
            marchQueues: marchCount,
            infirmaryCapacity: 0,
          },
          troops: [],
        });
  const troopsSnapshotUpdatedAt = troopsSnapshot ? now : null;
  db.prepare(
    "INSERT INTO users (id, discordId, displayName, avatar, isAppAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, discordId, "Bot User", null, isAppAdmin ? 1 : 0, now);
  db.prepare(
    "INSERT INTO alliances (id, name, kingdomId, guildId, createdAt) VALUES (?, ?, ?, ?, ?)"
  ).run(allianceId, "Bot Alliance", kingdomId, guildId, now);
  db.prepare(
    `INSERT INTO profiles (
       id,
       userId,
       playerId,
       playerName,
       playerAvatar,
       kingdomId,
       allianceId,
       status,
       role,
       power,
       rallySize,
       troopsSnapshot,
       troopsSnapshotUpdatedAt,
       createdAt,
       updatedAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    profileId,
    userId,
    playerId,
    "Bot Player",
    null,
    kingdomId,
    allianceId,
    "active",
    role,
    power,
    null,
    troopsSnapshot,
    troopsSnapshotUpdatedAt,
    now,
    now
  );
  db.close();
  return { userId };
}

test("unauthenticated access returns 401", async () => {
  process.env.DB_PATH = tmpDbPath();
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const res = await requestJson(port, "GET", "/api/vikings");
    assert.equal(res.status, 401);
  } finally {
    httpServer.close();
  }
});

test("session auth allows access and enforces profile requirement", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const me = await requestJson(port, "GET", "/api/me", headers);
    const mePayload = getPayload<{ profiles: unknown[] }>(me);
    assert.equal(me.status, 200);
    assert.equal(me.data.ok, true);
    assert.ok(Array.isArray(mePayload.profiles));

    const missingProfile = await requestJson(
      port,
      "GET",
      "/api/vikings",
      headers
    );
    assert.equal(missingProfile.status, 400);
    assert.equal(missingProfile.data.ok, false);
  } finally {
    httpServer.close();
  }
});

test("alliance admin required for destructive endpoints", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDTEST", kingdomId: 1459 })
    );
    assert.equal(createProfile.status, 200);
    const createProfilePayload = getPayload<{ profile: { id: string } }>(createProfile);
    const profileId = createProfilePayload.profile.id;
    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ tag: "ART", name: "ArtsOFwar" })
    );
    assert.equal(createAlliance.status, 200);
    const createAlliancePayload = getPayload<{ profile: { id: string } }>(createAlliance);
    const profileHeaders = {
      ...headers,
      "x-profile-id": createAlliancePayload.profile.id,
    };

    const signupBody = JSON.stringify({
      playerId: "FID00001",
      troopCount: 1000,
      playerName: "Test",
      marchCount: 4,
      power: 2000000,
    });
    const signup = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...profileHeaders, "Content-Type": "application/json" },
      signupBody
    );
    assert.equal(signup.status, 200);

    const remove = await requestJson(
      port,
      "DELETE",
      "/api/vikings/FID00001",
      profileHeaders
    );
    assert.equal(remove.status, 200);
  } finally {
    httpServer.close();
  }
});

test("signup updates profile snapshot and members list uses snapshot stats", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDSNAP", kingdomId: 1459 })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ tag: "SNP", name: "Snapshot Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const profileHeaders = { ...headers, "x-profile-id": profileId };

    const signup = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...profileHeaders, "Content-Type": "application/json" },
      JSON.stringify({
        playerId: "FIDSNAP",
        troopCount: 1200,
        playerName: "Snap",
        marchCount: 4,
        power: 2000000,
      })
    );
    assert.equal(signup.status, 200);

    const members = await requestJson(port, "GET", "/api/vikings", profileHeaders);
    assert.equal(members.status, 200);
    const membersPayload = getPayload<{ members: Array<{ troopCount: number; marchCount: number }> }>(
      members
    );
    assert.equal(membersPayload.members[0]?.troopCount, 1200);
    assert.equal(membersPayload.members[0]?.marchCount, 4);

    const db = new Database(dbPath);
    const row = db.prepare(
      "SELECT troopsSnapshot FROM profiles WHERE playerId = ?"
    ).get("FIDSNAP") as { troopsSnapshot?: string | null };
    db.close();
    assert.ok(row?.troopsSnapshot);
    const snapshot = JSON.parse(row.troopsSnapshot || "{}") as {
      header?: { totalTroops?: number; marchQueues?: number };
    };
    assert.equal(snapshot.header?.totalTroops, 1200);
    assert.equal(snapshot.header?.marchQueues, 4);
  } finally {
    httpServer.close();
  }
});

test("alliance create and delete updates profile", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDCREATE", kingdomId: 1459 })
    );
    assert.equal(createProfile.status, 200);
    const createProfilePayload = getPayload<{ profile: { id: string } }>(createProfile);
    const profileId = createProfilePayload.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ tag: "XYZ", name: "Test Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const alliancePayload = getPayload<{
      alliance: { id: string };
      profile: { role: string };
    }>(createAlliance);
    assert.equal(alliancePayload.alliance.id, "xyz");
    assert.equal(alliancePayload.profile.role, "alliance_admin");

    const deleteAlliance = await requestJson(
      port,
      "DELETE",
      "/api/alliances/xyz",
      { ...headers, "x-profile-id": profileId }
    );
    assert.equal(deleteAlliance.status, 200);

    const me = await requestJson(port, "GET", "/api/me", headers);
    const mePayload = getPayload<{ profiles: Array<{ id: string; allianceId: string | null }> }>(
      me
    );
    const updated = mePayload.profiles.find(
      (p: { id: string }) => p.id === profileId
    );
    assert.ok(updated);
    assert.equal(updated.allianceId, null);
  } finally {
    httpServer.close();
  }
});

test("alliance settings return defaults and update", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDSETTINGS", kingdomId: 1459 })
    );
    assert.equal(createProfile.status, 200);
    const createProfilePayload = getPayload<{ profile: { id: string } }>(createProfile);
    const profileId = createProfilePayload.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ tag: "SET", name: "Settings Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const createAlliancePayload = getPayload<{ profile: { id: string } }>(createAlliance);
    const profileHeaders = {
      ...headers,
      "x-profile-id": createAlliancePayload.profile.id,
    };

    const initialSettings = await requestJson(
      port,
      "GET",
      "/api/alliance/settings",
      profileHeaders
    );
    assert.equal(initialSettings.status, 200);
    const initialPayload = getPayload<{
      settings: {
        bearNextTimes: { bear1: string; bear2: string };
        vikingNextTimes: { viking1: string; viking2: string };
      };
    }>(initialSettings);
    const now = new Date();
    const expectedBear1 = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1, 0, 0, 0)
    ).toISOString();
    const expectedBear2 = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0)
    ).toISOString();
    assert.equal(initialPayload.settings.bearNextTimes.bear1, expectedBear1);
    assert.equal(initialPayload.settings.bearNextTimes.bear2, expectedBear2);
    assert.equal(
      initialPayload.settings.vikingNextTimes.viking1,
      "2026-03-10T02:00:00.000Z"
    );
    assert.equal(
      initialPayload.settings.vikingNextTimes.viking2,
      "2026-03-12T02:00:00.000Z"
    );

    const updateSettings = await requestJson(
      port,
      "PUT",
      "/api/alliance/settings",
      { ...profileHeaders, "Content-Type": "application/json" },
      JSON.stringify({
        bearNextTimes: {
          bear1: "2025-01-02T02:30:00.000Z",
          bear2: "2025-01-02T14:45:00.000Z"
        },
        vikingNextTimes: {
          viking1: "2025-01-07T03:15:00.000Z",
          viking2: "2025-01-09T05:30:00.000Z"
        }
      })
    );
    assert.equal(updateSettings.status, 200);
    const updatePayload = getPayload<{
      settings: {
        bearNextTimes: { bear1: string; bear2: string };
        vikingNextTimes: { viking1: string; viking2: string };
      };
    }>(updateSettings);
    assert.equal(updatePayload.settings.bearNextTimes.bear1, "2025-01-02T02:30:00.000Z");
    assert.equal(updatePayload.settings.bearNextTimes.bear2, "2025-01-02T14:45:00.000Z");
    assert.equal(
      updatePayload.settings.vikingNextTimes.viking1,
      "2025-01-07T03:15:00.000Z"
    );
    assert.equal(
      updatePayload.settings.vikingNextTimes.viking2,
      "2025-01-09T05:30:00.000Z"
    );

    const refreshed = await requestJson(
      port,
      "GET",
      "/api/alliance/settings",
      profileHeaders
    );
    assert.equal(refreshed.status, 200);
    const refreshedPayload = getPayload<{
      settings: {
        bearNextTimes: { bear1: string; bear2: string };
        vikingNextTimes: { viking1: string; viking2: string };
      };
    }>(refreshed);
    assert.equal(refreshedPayload.settings.bearNextTimes.bear1, "2025-01-02T02:30:00.000Z");
    assert.equal(refreshedPayload.settings.bearNextTimes.bear2, "2025-01-02T14:45:00.000Z");
    assert.equal(
      refreshedPayload.settings.vikingNextTimes.viking1,
      "2025-01-07T03:15:00.000Z"
    );
    assert.equal(
      refreshedPayload.settings.vikingNextTimes.viking2,
      "2025-01-09T05:30:00.000Z"
    );
  } finally {
    httpServer.close();
  }
});

test("alliance delete cascades vikings, bear, meta, and profile reset", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDDEL", kingdomId: 1459 })
    );
    assert.equal(createProfile.status, 200);
    const createProfilePayload = getPayload<{ profile: { id: string } }>(createProfile);
    const profileId = createProfilePayload.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ tag: "DEL", name: "Delete Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const alliancePayload = getPayload<{ alliance: { id: string } }>(createAlliance);
    const allianceId = alliancePayload.alliance.id;

    const signup = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({
        playerId: "MEMBER1",
        playerName: "Member One",
        troopCount: 1,
        marchCount: 4,
        power: 1000000
      })
    );
    assert.equal(signup.status, 200);

    const bear = await requestJson(
      port,
      "POST",
      "/api/bear/bear1",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ playerId: "MEMBER1", playerName: "Member One", rallySize: 1000 })
    );
    assert.equal(bear.status, 200);

    const run = await requestJson(
      port,
      "POST",
      "/api/run",
      { ...headers, "x-profile-id": profileId }
    );
    assert.equal(run.status, 200);

    const deleteAlliance = await requestJson(
      port,
      "DELETE",
      `/api/alliances/${allianceId}`,
      { ...headers, "x-profile-id": profileId }
    );
    assert.equal(deleteAlliance.status, 200);

    const db = new Database(dbPath);
    const vikingCount = db.prepare(
      "SELECT COUNT(1) AS count FROM vikings WHERE allianceId = ?"
    ).get(allianceId) as { count: number };
    const metaCount = db.prepare(
      "SELECT COUNT(1) AS count FROM meta WHERE allianceId = ?"
    ).get(allianceId) as { count: number };
    const bearCount = db.prepare(
      "SELECT COUNT(1) AS count FROM bear WHERE allianceId = ?"
    ).get(allianceId) as { count: number };
    const profileRow = db.prepare(
      "SELECT allianceId, status, role FROM profiles WHERE id = ?"
    ).get(profileId) as { allianceId: string | null; status: string; role: string };
    const allianceRow = db.prepare(
      "SELECT COUNT(1) AS count FROM alliances WHERE id = ?"
    ).get(allianceId) as { count: number };
    db.close();

    assert.equal(vikingCount.count, 0);
    assert.equal(metaCount.count, 0);
    assert.equal(bearCount.count, 0);
    assert.equal(allianceRow.count, 0);
    assert.equal(profileRow.allianceId, null);
    assert.equal(profileRow.status, "pending");
    assert.equal(profileRow.role, "member");
  } finally {
    httpServer.close();
  }
});

test("alliance admin can edit other signups, members cannot", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createAdminProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDADMIN", kingdomId: 1459 })
    );
    const createAdminPayload = getPayload<{ profile: { id: string } }>(
      createAdminProfile
    );
    const adminProfileId = createAdminPayload.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ tag: "ADM", name: "Admin Alliance" })
    );
    const createAlliancePayload = getPayload<{ alliance: { id: string } }>(createAlliance);
    const allianceId = createAlliancePayload.alliance.id;

    const createMemberProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDMEM", kingdomId: 1459 })
    );
    const createMemberPayload = getPayload<{ profile: { id: string } }>(
      createMemberProfile
    );
    const memberProfileId = createMemberPayload.profile.id;

    await requestJson(
      port,
      "PATCH",
      `/api/profiles/${memberProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ allianceId })
    );

    await requestJson(
      port,
      "PATCH",
      `/api/alliance/profiles/${memberProfileId}`,
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ status: "active" })
    );

    const memberHeaders = { ...headers, "x-profile-id": memberProfileId };
    const memberAttempt = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...memberHeaders, "Content-Type": "application/json" },
      JSON.stringify({
        playerId: "FIDOTHER",
        troopCount: 1000,
        playerName: "Other",
        marchCount: 4,
        power: 2000000,
      })
    );
    assert.equal(memberAttempt.status, 403);

    const memberOwn = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...memberHeaders, "Content-Type": "application/json" },
      JSON.stringify({
        playerId: "FIDMEM",
        troopCount: 1000,
        playerName: "Self",
        marchCount: 4,
        power: 2000000,
      })
    );
    assert.equal(memberOwn.status, 200);

    const memberDeleteOther = await requestJson(
      port,
      "DELETE",
      "/api/vikings/FIDOTHER",
      memberHeaders
    );
    assert.equal(memberDeleteOther.status, 403);

    const memberDeleteSelf = await requestJson(
      port,
      "DELETE",
      "/api/vikings/FIDMEM",
      memberHeaders
    );
    assert.equal(memberDeleteSelf.status, 200);

    const adminHeaders = { ...headers, "x-profile-id": adminProfileId };
    const adminAttempt = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...adminHeaders, "Content-Type": "application/json" },
      JSON.stringify({
        playerId: "FIDOTHER",
        troopCount: 1000,
        playerName: "Other",
        marchCount: 4,
        power: 2000000,
      })
    );
    assert.equal(adminAttempt.status, 200);
  } finally {
    httpServer.close();
  }
});

test("eligible signup lists return active alliance members not yet signed up", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createAdminProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDADMIN", kingdomId: 1459 })
    );
    assert.equal(createAdminProfile.status, 200);
    const adminProfilePayload = getPayload<{ profile: { id: string } }>(
      createAdminProfile
    );
    const adminProfileId = adminProfilePayload.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ tag: "ADM", name: "Admin Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const alliancePayload = getPayload<{ alliance: { id: string } }>(createAlliance);
    const allianceId = alliancePayload.alliance.id;

    const createMemberOne = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({
        playerId: "FIDMEM1",
        kingdomId: 1459
      })
    );
    assert.equal(createMemberOne.status, 200);
    const memberOnePayload = getPayload<{ profile: { id: string } }>(createMemberOne);
    const memberOneId = memberOnePayload.profile.id;

    const createMemberTwo = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({
        playerId: "FIDMEM2",
        kingdomId: 1459
      })
    );
    assert.equal(createMemberTwo.status, 200);
    const memberTwoPayload = getPayload<{ profile: { id: string } }>(createMemberTwo);
    const memberTwoId = memberTwoPayload.profile.id;

    await requestJson(
      port,
      "PATCH",
      `/api/profiles/${memberOneId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ allianceId })
    );
    await requestJson(
      port,
      "PATCH",
      `/api/profiles/${memberTwoId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ allianceId })
    );

    await requestJson(
      port,
      "PATCH",
      `/api/alliance/profiles/${memberOneId}`,
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ status: "active" })
    );
    await requestJson(
      port,
      "PATCH",
      `/api/alliance/profiles/${memberTwoId}`,
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ status: "active" })
    );

    const adminHeaders = { ...headers, "x-profile-id": adminProfileId };
    const memberHeaders = { ...headers, "x-profile-id": memberOneId };

    const memberEligibleDenied = await requestJson(
      port,
      "GET",
      "/api/vikings/eligible",
      memberHeaders
    );
    assert.equal(memberEligibleDenied.status, 403);

    await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...adminHeaders, "Content-Type": "application/json" },
      JSON.stringify({
        playerId: "FIDMEM1",
        troopCount: 1000,
        playerName: "Member One",
        marchCount: 4,
        power: 2000000,
      })
    );

    const profilesAfterSignup = await requestJson(
      port,
      "GET",
      "/api/profiles",
      adminHeaders
    );
    const profilesAfterSignupPayload = getPayload<{
      profiles: Array<{ playerId: string; troopCount: number; marchCount: number; power: number }>;
    }>(profilesAfterSignup);
    const memberOneProfile = profilesAfterSignupPayload.profiles.find(
      (profile: { playerId: string }) => profile.playerId === "FIDMEM1"
    );
    assert.ok(memberOneProfile);
    assert.equal(memberOneProfile.troopCount, 1000);
    assert.equal(memberOneProfile.marchCount, 4);
    assert.equal(memberOneProfile.power, 2000000);

    const eligibleMembers = await requestJson(
      port,
      "GET",
      "/api/vikings/eligible",
      adminHeaders
    );
    assert.equal(eligibleMembers.status, 200);
    const eligiblePayload = getPayload<{ members: Array<{ playerId: string }> }>(
      eligibleMembers
    );
    const eligibleIds = eligiblePayload.members.map((m) => m.playerId);
    assert.ok(eligibleIds.includes("FIDMEM2"));
    assert.ok(!eligibleIds.includes("FIDMEM1"));

    await requestJson(
      port,
      "POST",
      "/api/bear/bear1",
      { ...adminHeaders, "Content-Type": "application/json" },
      JSON.stringify({
        playerId: "FIDMEM1",
        playerName: "Member One",
        rallySize: 500000,
      })
    );

    const profilesAfterBear = await requestJson(
      port,
      "GET",
      "/api/profiles",
      adminHeaders
    );
    const profilesAfterBearPayload = getPayload<{
      profiles: Array<{ playerId: string; rallySize?: number }>;
    }>(profilesAfterBear);
    const memberOneAfterBear = profilesAfterBearPayload.profiles.find(
      (profile) => profile.playerId === "FIDMEM1"
    );
    assert.ok(memberOneAfterBear);
    assert.equal(memberOneAfterBear.rallySize, 500000);

    const eligibleBear = await requestJson(
      port,
      "GET",
      "/api/bear/eligible",
      adminHeaders
    );
    assert.equal(eligibleBear.status, 200);
    const eligibleBearPayload = getPayload<{ members: Array<{ playerId: string }> }>(
      eligibleBear
    );
    const bearIds = eligibleBearPayload.members.map((m) => m.playerId);
    assert.ok(bearIds.includes("FIDMEM2"));
    assert.ok(!bearIds.includes("FIDMEM1"));
  } finally {
    httpServer.close();
  }
});

test("assignment run queues notifications for opted-in users", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDOPTIN", kingdomId: 1459 })
    );
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ tag: "OPT", name: "Opt Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const allianceId = getPayload<{ alliance: { id: string } }>(createAlliance).alliance.id;

    const db = new Database(dbPath);
    db.prepare("UPDATE profiles SET botOptInAssignments = 1").run();
    db.close();

    const createSecondProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDOPTIN2", kingdomId: 1459 })
    );
    const secondProfileId = getPayload<{ profile: { id: string } }>(createSecondProfile)
      .profile.id;

    await requestJson(
      port,
      "PATCH",
      `/api/profiles/${secondProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ allianceId })
    );
    await requestJson(
      port,
      "PATCH",
      `/api/alliance/profiles/${secondProfileId}`,
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ status: "active" })
    );

    const signup = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({
        playerId: "FIDOPTIN",
        troopCount: 1000,
        playerName: "Opted",
        marchCount: 4,
        power: 2000000,
      })
    );
    assert.equal(signup.status, 200);

    const signupTwo = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({
        playerId: "FIDOPTIN2",
        troopCount: 1200,
        playerName: "Opted Two",
        marchCount: 4,
        power: 1900000,
      })
    );
    assert.equal(signupTwo.status, 200);

    const run = await requestJson(
      port,
      "POST",
      "/api/run",
      { ...headers, "x-profile-id": profileId }
    );
    assert.equal(run.status, 200);

    const checkDb = new Database(dbPath);
    const row = checkDb.prepare(
      "SELECT COUNT(1) AS count FROM assignment_notifications WHERE allianceId = ? AND status = 'pending'"
    ).get(allianceId) as { count: number };
    checkDb.close();
    assert.equal(row.count, 2);
  } finally {
    httpServer.close();
  }
});

test("assignment run skips members missing snapshot", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createAdminProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDADMIN", kingdomId: 1459 })
    );
    const adminProfileId = getPayload<{ profile: { id: string } }>(createAdminProfile)
      .profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ tag: "ASN", name: "Assignments Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const allianceId = getPayload<{ alliance: { id: string } }>(createAlliance).alliance.id;

    const createValidProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDGOOD", kingdomId: 1459 })
    );
    const validProfileId = getPayload<{ profile: { id: string } }>(createValidProfile)
      .profile.id;

    await requestJson(
      port,
      "PATCH",
      `/api/profiles/${validProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ allianceId })
    );
    await requestJson(
      port,
      "PATCH",
      `/api/alliance/profiles/${validProfileId}`,
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ status: "active" })
    );

    await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({
        playerId: "FIDGOOD",
        troopCount: 1000,
        playerName: "Valid",
        marchCount: 4,
        power: 2000000,
      })
    );

    const createMissingProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDMISS", kingdomId: 1459 })
    );
    const missingProfileId = getPayload<{ profile: { id: string } }>(createMissingProfile)
      .profile.id;

    await requestJson(
      port,
      "PATCH",
      `/api/profiles/${missingProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ allianceId })
    );
    await requestJson(
      port,
      "PATCH",
      `/api/alliance/profiles/${missingProfileId}`,
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ status: "active" })
    );

    const db = new Database(dbPath);
    db.prepare(
      "INSERT INTO vikings (allianceId, playerId, troopCount, marchCount, power, playerName) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(allianceId, "FIDMISS", 0, 0, 0, "Missing");
    db.close();

    const run = await requestJson(
      port,
      "POST",
      "/api/run",
      { ...headers, "x-profile-id": adminProfileId }
    );
    assert.equal(run.status, 200);
    const runPayload = getPayload<{
      members: Array<{ playerId: string }>;
      warningCodes?: string[];
    }>(run);
    const ids = runPayload.members.map((member) => member.playerId);
    assert.ok(!ids.includes("FIDMISS"));
    assert.ok(runPayload.warningCodes?.includes("assignments_invalid_troop_count"));
  } finally {
    httpServer.close();
  }
});

test("reset keeps viking signups but clears last run", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath) };
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDRESET", kingdomId: 1459 })
    );
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ tag: "RST", name: "Reset Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const allianceId = getPayload<{ alliance: { id: string } }>(createAlliance).alliance.id;

    const signupOne = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({
        playerId: "RESET1",
        troopCount: 1000,
        playerName: "Reset One",
        marchCount: 4,
        power: 2000000
      })
    );
    assert.equal(signupOne.status, 200);

    const signupTwo = await requestJson(
      port,
      "POST",
      "/api/vikings",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({
        playerId: "RESET2",
        troopCount: 1000,
        playerName: "Reset Two",
        marchCount: 4,
        power: 1900000
      })
    );
    assert.equal(signupTwo.status, 200);

    const run = await requestJson(
      port,
      "POST",
      "/api/run",
      { ...headers, "x-profile-id": profileId }
    );
    assert.equal(run.status, 200);

    const reset = await requestJson(
      port,
      "POST",
      "/api/reset",
      { ...headers, "x-profile-id": profileId }
    );
    assert.equal(reset.status, 200);

    const db = new Database(dbPath);
    const vikingsCount = db.prepare(
      "SELECT COUNT(1) AS count FROM vikings WHERE allianceId = ?"
    ).get(allianceId) as { count: number };
    const lastRunCount = db.prepare(
      "SELECT COUNT(1) AS count FROM meta WHERE allianceId = ? AND key = 'lastRun'"
    ).get(allianceId) as { count: number };
    db.close();

    assert.equal(vikingsCount.count, 2);
    assert.equal(lastRunCount.count, 0);
  } finally {
    httpServer.close();
  }
});

test("bot notifications endpoint returns pending for all alliances", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.DISCORD_BOT_SECRET = "bot-secret";
  const { httpServer, port } = await startServer();
  try {
    const db = new Database(dbPath);
    const now = Date.now();
    db.prepare(
      `INSERT INTO assignment_notifications (
        id,
        allianceId,
        playerId,
        discordId,
        payload,
        status,
        error,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      "alpha",
      "P1",
      "D1",
      JSON.stringify({ assignment: "one" }),
      "pending",
      null,
      now,
      now
    );
    db.prepare(
      `INSERT INTO assignment_notifications (
        id,
        allianceId,
        playerId,
        discordId,
        payload,
        status,
        error,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      "beta",
      "P2",
      "D2",
      JSON.stringify({ assignment: "two" }),
      "pending",
      null,
      now,
      now
    );
    db.close();

    const res = await requestJson(
      port,
      "GET",
      "/api/bot/assignments/notifications",
      { "x-bot-secret": "bot-secret" }
    );
    assert.equal(res.status, 200);
    const payload = getPayload<{ notifications: Array<{ allianceId: string }> }>(res);
    const alliances = payload.notifications.map((item) => item.allianceId);
    assert.ok(alliances.includes("alpha"));
    assert.ok(alliances.includes("beta"));
  } finally {
    httpServer.close();
  }
});

test("unclaimed profiles can be added by admins and claimed on login", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const adminHeaders = { Cookie: createSessionCookie(dbPath) };
    const createAdminProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...adminHeaders, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDADMIN", kingdomId: 1459 })
    );
    assert.equal(createAdminProfile.status, 200);
    const createAdminPayload = getPayload<{ profile: { id: string } }>(
      createAdminProfile
    );
    const adminProfileId = createAdminPayload.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...adminHeaders, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ tag: "ADM", name: "Admin Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const createAlliancePayload = getPayload<{ alliance: { id: string } }>(createAlliance);
    const allianceId = createAlliancePayload.alliance.id;

    const addUnclaimed = await requestJson(
      port,
      "POST",
      "/api/alliance/profiles",
      { ...adminHeaders, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ playerId: "FIDCLAIM", kingdomId: 1459 })
    );
    assert.equal(addUnclaimed.status, 200);
    const addUnclaimedPayload = getPayload<{ profile: { userId: string | null; status: string } }>(
      addUnclaimed
    );
    assert.equal(addUnclaimedPayload.profile.userId, null);
    assert.equal(addUnclaimedPayload.profile.status, "active");

    const memberHeaders = { Cookie: createSessionCookie(dbPath) };
    const me = await requestJson(port, "GET", "/api/me", memberHeaders);
    assert.equal(me.status, 200);
    const mePayload = getPayload<{ user: { id: string } }>(me);
    const userId = mePayload.user.id;

    const claim = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...memberHeaders, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDCLAIM", kingdomId: 1459 })
    );
    assert.equal(claim.status, 200);
    const claimPayload = getPayload<{ profile: { userId: string | null; allianceId: string | null; status: string; role: string } }>(
      claim
    );
    assert.equal(claimPayload.profile.userId, userId);
    assert.equal(claimPayload.profile.allianceId, allianceId);
    assert.equal(claimPayload.profile.status, "pending");
    assert.equal(claimPayload.profile.role, "member");
  } finally {
    httpServer.close();
  }
});

test("app admin can manage alliances across kingdoms", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const headers = { Cookie: createSessionCookie(dbPath, { isAppAdmin: true }) };
    const createAdminProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDADMIN", kingdomId: 1459 })
    );
    assert.equal(createAdminProfile.status, 200);
    const adminProfilePayload = getPayload<{ profile: { id: string } }>(
      createAdminProfile
    );
    const adminProfileId = adminProfilePayload.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ tag: "ADM", name: "Admin Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const alliancePayload = getPayload<{ alliance: { id: string } }>(createAlliance);
    const allianceId = alliancePayload.alliance.id;

    const createMemberProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDMEM", kingdomId: 1459 })
    );
    assert.equal(createMemberProfile.status, 200);
    const memberProfilePayload = getPayload<{ profile: { id: string } }>(
      createMemberProfile
    );
    const memberProfileId = memberProfilePayload.profile.id;

    const joinAlliance = await requestJson(
      port,
      "PATCH",
      `/api/profiles/${memberProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ allianceId })
    );
    assert.equal(joinAlliance.status, 200);

    const createRejectProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDREJECT", kingdomId: 1459 })
    );
    assert.equal(createRejectProfile.status, 200);
    const rejectProfilePayload = getPayload<{ profile: { id: string } }>(
      createRejectProfile
    );
    const rejectProfileId = rejectProfilePayload.profile.id;

    const joinToReject = await requestJson(
      port,
      "PATCH",
      `/api/profiles/${rejectProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ allianceId })
    );
    assert.equal(joinToReject.status, 200);

    const kingdoms = await requestJson(port, "GET", "/api/admin/kingdoms", headers);
    assert.equal(kingdoms.status, 200);
    const kingdomsPayload = getPayload<{ kingdoms: number[] }>(kingdoms);
    assert.ok(kingdomsPayload.kingdoms.includes(1459));

    const alliances = await requestJson(
      port,
      "GET",
      `/api/admin/alliances?kingdomId=1459`,
      headers
    );
    assert.equal(alliances.status, 200);
    const alliancesPayload = getPayload<{ alliances: Array<{ id: string }> }>(alliances);
    assert.equal(alliancesPayload.alliances[0].id, allianceId);

    const profiles = await requestJson(
      port,
      "GET",
      `/api/admin/alliances/${allianceId}/profiles`,
      headers
    );
    assert.equal(profiles.status, 200);
    const profilesPayload = getPayload<{ profiles: Array<{ id: string }> }>(profiles);
    const pending = profilesPayload.profiles.find((p) => p.id === memberProfileId);
    assert.ok(pending);

    const approve = await requestJson(
      port,
      "PATCH",
      `/api/admin/alliances/${allianceId}/profiles/${memberProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ status: "active" })
    );
    assert.equal(approve.status, 200);
    const approvePayload = getPayload<{ profile: { status: string } }>(approve);
    assert.equal(approvePayload.profile.status, "active");

    const reject = await requestJson(
      port,
      "PATCH",
      `/api/admin/alliances/${allianceId}/profiles/${rejectProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ action: "reject" })
    );
    assert.equal(reject.status, 200);
    const rejectPayload = getPayload<{ profile: { allianceId: string | null } }>(reject);
    assert.equal(rejectPayload.profile.allianceId, null);

    const deleteAlliance = await requestJson(
      port,
      "DELETE",
      `/api/admin/alliances/${allianceId}`,
      headers
    );
    assert.equal(deleteAlliance.status, 200);
  } finally {
    httpServer.close();
  }
});

test("bot endpoints resolve discord user and enforce ownership", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.DISCORD_BOT_SECRET = "bot-secret";
  const { httpServer, port } = await startServer();
  try {
    const discordId = "discord-bot-user";
    const allianceId = "bot";
    const profileId = crypto.randomUUID();
    const playerId = "BOTPLAYER1";
    createBotUser(dbPath, {
      discordId,
      allianceId,
      profileId,
      playerId,
      troopCount: 1200,
      marchCount: 4,
      power: 2000000,
      guildId: "guild-1",
    });

    const headers = {
      "x-bot-secret": "bot-secret",
      "x-discord-id": discordId,
      "Content-Type": "application/json",
    };

    const signup = await requestJson(
      port,
      "POST",
      "/api/bot/vikings",
      headers,
      JSON.stringify({
        profileId,
        troopCount: 1000,
        marchCount: 4,
        power: 2000000,
        playerName: "Bot Player",
      })
    );
    assert.equal(signup.status, 200);

    const optionalSignup = await requestJson(
      port,
      "POST",
      "/api/bot/vikings",
      headers,
      JSON.stringify({
        profileId,
        marchCount: 4,
      })
    );
    assert.equal(optionalSignup.status, 200);

    const bear = await requestJson(
      port,
      "POST",
      "/api/bot/bear/bear1",
      headers,
      JSON.stringify({ profileId, rallySize: 500000, playerName: "Bot Player" })
    );
    assert.equal(bear.status, 200);

    const profiles = await requestJson(
      port,
      "GET",
      "/api/bot/profiles",
      { "x-bot-secret": "bot-secret", "x-discord-id": discordId }
    );
    assert.equal(profiles.status, 200);
    const profilesPayload = getPayload<{ profiles: Array<{ id: string }> }>(
      profiles
    );
    assert.ok(profilesPayload.profiles.some((p) => p.id === profileId));

    const bearView = await requestJson(
      port,
      "GET",
      `/api/bot/bear?profileId=${profileId}`,
      { "x-bot-secret": "bot-secret", "x-discord-id": discordId }
    );
    assert.equal(bearView.status, 200);
    const bearViewPayload = getPayload<{ member: { bearGroup: string } | null }>(
      bearView
    );
    assert.equal(bearViewPayload.member?.bearGroup, "bear1");

    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: { data: { name: "Linked Player", kid: 1459, avatar: "icon" } },
          }),
      } as Response)) as typeof fetch;

    const link = await requestJson(
      port,
      "POST",
      "/api/bot/profiles/link",
      { ...headers, "Content-Type": "application/json", "x-guild-id": "guild-1" },
      JSON.stringify({ playerId: "NEWPLAYER" })
    );
    assert.equal(link.status, 200);
    const linkPayload = getPayload<{ profile: { playerId: string; allianceId: string | null; status: string } }>(link);
    assert.equal(linkPayload.profile.playerId, "NEWPLAYER");
    assert.equal(linkPayload.profile.allianceId, allianceId);
    assert.equal(linkPayload.profile.status, "pending");

    const dbAfterLink = new Database(dbPath);
    const optInRow = dbAfterLink.prepare(
      "SELECT botOptInAssignments FROM profiles WHERE playerId = ?"
    ).get("NEWPLAYER") as { botOptInAssignments: number };
    assert.equal(optInRow.botOptInAssignments, 1);
    dbAfterLink.close();

    const db = new Database(dbPath);
    db.prepare(
      "INSERT INTO meta (allianceId, key, value) VALUES (?, 'lastRun', ?)"
    ).run(
      allianceId,
      JSON.stringify({
        members: [
          {
            playerId,
            playerName: "Bot Player",
            troopCount: 1000,
            outgoing: [],
            incoming: [],
            incomingTotal: 0,
          },
        ],
        warnings: [],
      })
    );
    db.close();

    const assignments = await requestJson(
      port,
      "GET",
      `/api/bot/vikings/assignments?profileId=${profileId}`,
      {
        "x-bot-secret": "bot-secret",
        "x-discord-id": discordId,
      }
    );
    assert.equal(assignments.status, 200);
    const assignmentsPayload = getPayload<{
      assignment: { playerId: string } | null;
      vikingNextTime?: string;
    }>(assignments);
    assert.equal(assignmentsPayload.assignment?.playerId, playerId);
    const expectedNextViking = getNextVikingEventIso(
      DEFAULT_ALLIANCE_SETTINGS.vikingNextTimes
    );
    assert.equal(assignmentsPayload.vikingNextTime, expectedNextViking);

    const remove = await requestJson(
      port,
      "DELETE",
      `/api/bot/vikings/${profileId}`,
      { "x-bot-secret": "bot-secret", "x-discord-id": discordId }
    );
    assert.equal(remove.status, 200);

    const otherHeaders = {
      "x-bot-secret": "bot-secret",
      "x-discord-id": "other-discord",
      "Content-Type": "application/json",
    };
    const otherUser = await requestJson(
      port,
      "POST",
      "/api/bot/vikings",
      otherHeaders,
      JSON.stringify({
        profileId,
        troopCount: 1000,
        marchCount: 4,
        power: 2000000,
      })
    );
    assert.equal(otherUser.status, 404);
  } finally {
    httpServer.close();
  }
});

test("bot link creates user when discord account is missing", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.DISCORD_BOT_SECRET = "bot-secret";
  const { httpServer, port } = await startServer();
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: { data: { name: "Linked Player", kid: 1459, avatar: "icon" } },
          }),
      } as Response)) as typeof fetch;

    const headers = {
      "x-bot-secret": "bot-secret",
      "x-discord-id": "new-discord-user",
      "Content-Type": "application/json",
    };

    const link = await requestJson(
      port,
      "POST",
      "/api/bot/profiles/link",
      headers,
      JSON.stringify({ playerId: "NEWPLAYER2" })
    );
    assert.equal(link.status, 200);

    const db = new Database(dbPath);
    const row = db
      .prepare("SELECT id FROM users WHERE discordId = ?")
      .get("new-discord-user") as { id: string } | undefined;
    db.close();
    assert.ok(row?.id);
  } finally {
    httpServer.close();
  }
});

test("bot guild association enforces admin access and updates guild", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.DISCORD_BOT_SECRET = "bot-secret";
  const { httpServer, port } = await startServer();
  const discordId = "guild-admin";
  const allianceId = "alpha";
  const profileId = crypto.randomUUID();
  createBotUser(dbPath, {
    discordId,
    allianceId,
    profileId,
    playerId: "ALPHA1",
  });
  try {
    const headers = {
      "x-bot-secret": "bot-secret",
      "x-discord-id": discordId,
      "x-guild-id": "guild-123",
      "Content-Type": "application/json",
    };

    const denied = await requestJson(
      port,
      "POST",
      "/api/bot/guild/associate",
      headers,
      JSON.stringify({ allianceId, kingdomId: 1459 })
    );
    assert.equal(denied.status, 403);

    const db = new Database(dbPath);
    db.prepare("UPDATE profiles SET role = 'alliance_admin' WHERE id = ?").run(
      profileId
    );
    db.close();

    const linked = await requestJson(
      port,
      "POST",
      "/api/bot/guild/associate",
      headers,
      JSON.stringify({ allianceId, kingdomId: 1459 })
    );
    assert.equal(linked.status, 200);

    const dbAfter = new Database(dbPath);
    const row = dbAfter
      .prepare("SELECT guildId FROM alliances WHERE id = ?")
      .get(allianceId) as { guildId: string | null };
    dbAfter.close();
    assert.equal(row.guildId, "guild-123");
  } finally {
    httpServer.close();
  }
});

test("troops snapshot upload stores processor 200 response", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYER200" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            header: { totalTroops: 123, marchQueues: 1, infirmaryCapacity: 0 },
            troops: [
              {
                type: "infantry",
                tier: "t9",
                count: 123,
                conf: { type: 0.9, tier: 0.8, count: 0.7 },
              },
            ],
            meta: { partial: false },
          },
        }),
      } as Response)) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 200);

    const db = new Database(dbPath);
    const row = db
      .prepare("SELECT troopsSnapshot FROM profiles WHERE id = ?")
      .get(profileId) as { troopsSnapshot: string | null };
    db.close();
    assert.ok(row.troopsSnapshot);
    const snapshot = JSON.parse(row.troopsSnapshot || "{}") as {
      header: { totalTroops: number };
      troops: Array<{ type: string }>;
    };
    assert.equal(snapshot.header.totalTroops, 123);
    assert.equal(snapshot.troops[0]?.type, "infantry");
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

test("troops snapshot upload stores processor 206 partial response", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYER206" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () =>
      ({
        ok: true,
        status: 206,
        json: async () => ({
          result: {
            header: { totalTroops: 0, marchQueues: 1, infirmaryCapacity: 0 },
            troops: [
              {
                type: null,
                tier: null,
                count: null,
                conf: { type: 0.2, tier: 0.1, count: 0.05 },
              },
            ],
            meta: { partial: true },
          },
        }),
      } as Response)) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 200);

    const db = new Database(dbPath);
    const row = db
      .prepare("SELECT troopsSnapshot FROM profiles WHERE id = ?")
      .get(profileId) as { troopsSnapshot: string | null };
    db.close();
    assert.ok(row.troopsSnapshot);
    const snapshot = JSON.parse(row.troopsSnapshot || "{}") as {
      troops: Array<{ type: string | null }>;
      meta?: { partial?: boolean };
    };
    assert.equal(snapshot.troops[0]?.type, null);
    assert.equal(snapshot.meta, undefined);
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

test("troops snapshot upload rejects invalid processor payload", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYERBAD" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            header: { totalTroops: "nope", marchQueues: 1 },
            troops: [],
          },
        }),
      } as Response)) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 500);

    const db = new Database(dbPath);
    const row = db
      .prepare("SELECT troopsSnapshot FROM profiles WHERE id = ?")
      .get(profileId) as { troopsSnapshot: string | null };
    db.close();
    assert.equal(row.troopsSnapshot, null);
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

test("troops snapshot upload rejects invalid payload even on 206", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYERBAD206" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () =>
      ({
        ok: true,
        status: 206,
        json: async () => ({
          result: {
            header: { totalTroops: "nope", marchQueues: 1 },
            troops: [],
          },
        }),
      } as Response)) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 500);
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

test("troops snapshot upload handles processor non-ok response", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYERFAIL" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () =>
      ({
        ok: false,
        status: 400,
        json: async () => ({ detail: "No detections." }),
      } as Response)) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 502);
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

test("troops snapshot upload handles processor fetch failure", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYERFETCHFAIL" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () => {
      throw new Error("fetch failed");
    }) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 502);
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

test("troops snapshot upload saves failed image on non-200 response", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  const before = listFailedScreenshots();
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYERFAILSAVE", playerName: "Test Profile" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () =>
      ({
        ok: false,
        status: 400,
        json: async () => ({ detail: "No detections." }),
      } as Response)) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 502);

    const after = listFailedScreenshots();
    const created = after.filter((item) => !before.includes(item));
    assert.ok(created.length >= 1);
    const match = created.find((item) => item.includes("test-profile"));
    assert.ok(match);
    assert.ok(fs.existsSync(path.join(match, "upload.png")));
    assert.ok(fs.existsSync(path.join(match, "output.txt")));
    created.forEach((item) => fs.rmSync(item, { recursive: true, force: true }));
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

test("troops snapshot upload saves failed image on invalid payload", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  const before = listFailedScreenshots();
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYERBADSAVE", playerName: "Bad Profile" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            header: { totalTroops: "nope", marchQueues: 1 },
            troops: [],
          },
        }),
      } as Response)) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 500);

    const after = listFailedScreenshots();
    const created = after.filter((item) => !before.includes(item));
    assert.ok(created.length >= 1);
    const match = created.find((item) => item.includes("bad-profile"));
    assert.ok(match);
    assert.ok(fs.existsSync(path.join(match, "upload.png")));
    assert.ok(fs.existsSync(path.join(match, "output.txt")));
    created.forEach((item) => fs.rmSync(item, { recursive: true, force: true }));
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

test("troops snapshot upload drops troops on count mismatch with <=14 stacks", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  const before = listFailedScreenshots();
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYERMISMATCH", playerName: "Mismatch Profile" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            header: { totalTroops: 1000, marchQueues: 1, infirmaryCapacity: 0 },
            troops: [
              { type: "infantry", tier: "t9", count: 100, conf: { count: 0.9 } },
              { type: "archer", tier: "t9", count: 100, conf: { count: 0.9 } },
            ],
          },
        }),
      } as Response)) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 200);

    const db = new Database(dbPath);
    const row = db
      .prepare("SELECT troopsSnapshot FROM profiles WHERE id = ?")
      .get(profileId) as { troopsSnapshot: string | null };
    db.close();
    const snapshot = JSON.parse(row.troopsSnapshot || "{}") as {
      header: { totalTroops: number };
      troops: unknown[];
    };
    assert.equal(snapshot.header.totalTroops, 1000);
    assert.equal(snapshot.troops.length, 0);

    const after = listFailedScreenshots();
    const created = after.filter((item) => !before.includes(item));
    assert.ok(created.length >= 1);
    const match = created.find((item) => item.includes("mismatch-profile"));
    assert.ok(match);
    assert.ok(fs.existsSync(path.join(match, "upload.png")));
    assert.ok(fs.existsSync(path.join(match, "output.txt")));
    created.forEach((item) => fs.rmSync(item, { recursive: true, force: true }));
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

test("troops snapshot upload drops troops on duplicate type/tier stacks", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.SCREENSHOT_PROCESSOR_URL = "http://processor.test";
  const { httpServer, port } = await startServer();
  const originalFetch = global.fetch;
  const before = listFailedScreenshots();
  try {
    const cookie = createSessionCookie(dbPath);
    const createProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { "Content-Type": "application/json", Cookie: cookie },
      JSON.stringify({ playerId: "PLAYERDUPES", playerName: "Dupes Profile" })
    );
    assert.equal(createProfile.status, 200);
    const profileId = getPayload<{ profile: { id: string } }>(createProfile).profile.id;

    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            header: { totalTroops: 1000, marchQueues: 1, infirmaryCapacity: 0 },
            troops: [
              { type: "infantry", tier: "t3", count: 500 },
              { type: "infantry", tier: "t3", count: 500 },
            ],
          },
        }),
      } as Response)) as typeof fetch;

    const upload = await requestMultipart(
      port,
      "POST",
      `/api/profiles/${profileId}/troops-snapshot`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(upload.status, 200);

    const db = new Database(dbPath);
    const row = db
      .prepare("SELECT troopsSnapshot FROM profiles WHERE id = ?")
      .get(profileId) as { troopsSnapshot: string | null };
    db.close();
    const snapshot = JSON.parse(row.troopsSnapshot || "{}") as {
      header: { totalTroops: number };
      troops: unknown[];
    };
    assert.equal(snapshot.header.totalTroops, 1000);
    assert.equal(snapshot.troops.length, 0);

    const after = listFailedScreenshots();
    const created = after.filter((item) => !before.includes(item));
    assert.ok(created.length >= 1);
    const match = created.find((item) => item.includes("dupes-profile"));
    assert.ok(match);
    assert.ok(fs.existsSync(path.join(match, "upload.png")));
    assert.ok(fs.existsSync(path.join(match, "output.txt")));
    created.forEach((item) => fs.rmSync(item, { recursive: true, force: true }));
  } finally {
    global.fetch = originalFetch;
    httpServer.close();
  }
});

export {};
