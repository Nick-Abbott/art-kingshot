import test from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import Database from "better-sqlite3";
import { createApp } from "./index";

type ServerHandle = {
  httpServer: import("node:http").Server;
  port: number;
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
  data: any;
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
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
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

function tmpDbPath() {
  const baseDir = path.join(process.cwd(), "data");
  fs.mkdirSync(baseDir, { recursive: true });
  const dir = fs.mkdtempSync(path.join(baseDir, "test-"));
  return path.join(dir, "test.sqlite");
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

test("unauthenticated access returns 401", async () => {
  process.env.DB_PATH = tmpDbPath();
  process.env.PORT = "0";
  const { httpServer, port } = await startServer();
  try {
    const res = await requestJson(port, "GET", "/api/members");
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
    assert.equal(me.status, 200);
    assert.equal(me.data.ok, true);
    assert.ok(Array.isArray(me.data.data.profiles));

    const missingProfile = await requestJson(
      port,
      "GET",
      "/api/members",
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
    const profileId = createProfile.data.data.profile.id;
    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ tag: "ART", name: "ArtsOFwar" })
    );
    assert.equal(createAlliance.status, 200);
    const profileHeaders = {
      ...headers,
      "x-profile-id": createAlliance.data.data.profile.id,
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
      "/api/signup",
      { ...profileHeaders, "Content-Type": "application/json" },
      signupBody
    );
    assert.equal(signup.status, 200);

    const remove = await requestJson(
      port,
      "DELETE",
      "/api/members/FID00001",
      profileHeaders
    );
    assert.equal(remove.status, 200);
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
    const profileId = createProfile.data.data.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": profileId },
      JSON.stringify({ tag: "XYZ", name: "Test Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    assert.equal(createAlliance.data.data.alliance.id, "xyz");
    assert.equal(createAlliance.data.data.profile.role, "alliance_admin");

    const deleteAlliance = await requestJson(
      port,
      "DELETE",
      "/api/alliances/xyz",
      { ...headers, "x-profile-id": profileId }
    );
    assert.equal(deleteAlliance.status, 200);

    const me = await requestJson(port, "GET", "/api/me", headers);
    const updated = me.data.data.profiles.find(
      (p: { id: string }) => p.id === profileId
    );
    assert.ok(updated);
    assert.equal(updated.allianceId, null);
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
    const adminProfileId = createAdminProfile.data.data.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ tag: "ADM", name: "Admin Alliance" })
    );
    const allianceId = createAlliance.data.data.alliance.id;

    const createMemberProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDMEM", kingdomId: 1459 })
    );
    const memberProfileId = createMemberProfile.data.data.profile.id;

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
      "/api/signup",
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
      "/api/signup",
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
      "/api/members/FIDOTHER",
      memberHeaders
    );
    assert.equal(memberDeleteOther.status, 403);

    const memberDeleteSelf = await requestJson(
      port,
      "DELETE",
      "/api/members/FIDMEM",
      memberHeaders
    );
    assert.equal(memberDeleteSelf.status, 200);

    const adminHeaders = { ...headers, "x-profile-id": adminProfileId };
    const adminAttempt = await requestJson(
      port,
      "POST",
      "/api/signup",
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
    const adminProfileId = createAdminProfile.data.data.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ tag: "ADM", name: "Admin Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const allianceId = createAlliance.data.data.alliance.id;

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
    const memberOneId = createMemberOne.data.data.profile.id;

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
    const memberTwoId = createMemberTwo.data.data.profile.id;

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
      "/api/members/eligible",
      memberHeaders
    );
    assert.equal(memberEligibleDenied.status, 403);

    await requestJson(
      port,
      "POST",
      "/api/signup",
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
    const memberOneProfile = profilesAfterSignup.data.data.profiles.find(
      (profile: { playerId: string }) => profile.playerId === "FIDMEM1"
    );
    assert.ok(memberOneProfile);
    assert.equal(memberOneProfile.troopCount, 1000);
    assert.equal(memberOneProfile.marchCount, 4);
    assert.equal(memberOneProfile.power, 2000000);

    const eligibleMembers = await requestJson(
      port,
      "GET",
      "/api/members/eligible",
      adminHeaders
    );
    assert.equal(eligibleMembers.status, 200);
    const eligibleIds = eligibleMembers.data.data.members.map(
      (m: { playerId: string }) => m.playerId
    );
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
    const memberOneAfterBear = profilesAfterBear.data.data.profiles.find(
      (profile: { playerId: string }) => profile.playerId === "FIDMEM1"
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
    const bearIds = eligibleBear.data.data.members.map(
      (m: { playerId: string }) => m.playerId
    );
    assert.ok(bearIds.includes("FIDMEM2"));
    assert.ok(!bearIds.includes("FIDMEM1"));
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
    const adminProfileId = createAdminProfile.data.data.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...adminHeaders, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ tag: "ADM", name: "Admin Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const allianceId = createAlliance.data.data.alliance.id;

    const addUnclaimed = await requestJson(
      port,
      "POST",
      "/api/alliance/profiles",
      { ...adminHeaders, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ playerId: "FIDCLAIM", kingdomId: 1459 })
    );
    assert.equal(addUnclaimed.status, 200);
    assert.equal(addUnclaimed.data.data.profile.userId, null);
    assert.equal(addUnclaimed.data.data.profile.status, "active");

    const memberHeaders = { Cookie: createSessionCookie(dbPath) };
    const me = await requestJson(port, "GET", "/api/me", memberHeaders);
    assert.equal(me.status, 200);
    const userId = me.data.data.user.id;

    const claim = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...memberHeaders, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDCLAIM", kingdomId: 1459 })
    );
    assert.equal(claim.status, 200);
    assert.equal(claim.data.data.profile.userId, userId);
    assert.equal(claim.data.data.profile.allianceId, allianceId);
    assert.equal(claim.data.data.profile.status, "pending");
    assert.equal(claim.data.data.profile.role, "member");
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
    const adminProfileId = createAdminProfile.data.data.profile.id;

    const createAlliance = await requestJson(
      port,
      "POST",
      "/api/alliances",
      { ...headers, "Content-Type": "application/json", "x-profile-id": adminProfileId },
      JSON.stringify({ tag: "ADM", name: "Admin Alliance" })
    );
    assert.equal(createAlliance.status, 200);
    const allianceId = createAlliance.data.data.alliance.id;

    const createMemberProfile = await requestJson(
      port,
      "POST",
      "/api/profiles",
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ playerId: "FIDMEM", kingdomId: 1459 })
    );
    assert.equal(createMemberProfile.status, 200);
    const memberProfileId = createMemberProfile.data.data.profile.id;

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
    const rejectProfileId = createRejectProfile.data.data.profile.id;

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
    assert.ok(kingdoms.data.data.kingdoms.includes(1459));

    const alliances = await requestJson(
      port,
      "GET",
      `/api/admin/alliances?kingdomId=1459`,
      headers
    );
    assert.equal(alliances.status, 200);
    assert.equal(alliances.data.data.alliances[0].id, allianceId);

    const profiles = await requestJson(
      port,
      "GET",
      `/api/admin/alliances/${allianceId}/profiles`,
      headers
    );
    assert.equal(profiles.status, 200);
    const pending = profiles.data.data.profiles.find(
      (p: { id: string }) => p.id === memberProfileId
    );
    assert.ok(pending);

    const approve = await requestJson(
      port,
      "PATCH",
      `/api/admin/alliances/${allianceId}/profiles/${memberProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ status: "active" })
    );
    assert.equal(approve.status, 200);
    assert.equal(approve.data.data.profile.status, "active");

    const reject = await requestJson(
      port,
      "PATCH",
      `/api/admin/alliances/${allianceId}/profiles/${rejectProfileId}`,
      { ...headers, "Content-Type": "application/json" },
      JSON.stringify({ action: "reject" })
    );
    assert.equal(reject.status, 200);
    assert.equal(reject.data.data.profile.allianceId, null);

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

export {};
