const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

type ServerHandle = {
  httpServer: import("node:http").Server;
  port: number;
};

function startServer(): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    delete require.cache[require.resolve("./index")];
    delete require.cache[require.resolve("./config")];
    const app = require("./index");
    if (!app) {
      reject(new Error("Server did not export app."));
      return;
    }
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
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
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

test("unauthenticated access returns 401", async () => {
  delete process.env.DEV_BYPASS_TOKEN;
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

test("dev bypass allows auth and enforces profile requirement", async () => {
  const dbPath = tmpDbPath();
  process.env.DB_PATH = dbPath;
  process.env.PORT = "0";
  process.env.DEV_BYPASS_TOKEN = "test-bypass";
  const { httpServer, port } = await startServer();
  try {
    const headers = { "x-dev-bypass": "test-bypass" };
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
  process.env.DEV_BYPASS_TOKEN = "test-bypass";
  const { httpServer, port } = await startServer();
  try {
    const headers = { "x-dev-bypass": "test-bypass" };
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
  process.env.DEV_BYPASS_TOKEN = "test-bypass";
  const { httpServer, port } = await startServer();
  try {
    const headers = { "x-dev-bypass": "test-bypass" };
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
    const updated = me.data.data.profiles.find((p) => p.id === profileId);
    assert.ok(updated);
    assert.equal(updated.allianceId, null);
  } finally {
    httpServer.close();
  }
});

export {};
