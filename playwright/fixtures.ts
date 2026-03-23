import { test as base } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import * as net from "node:net";
import * as path from "node:path";

type AppFixture = {
  clientUrl: string;
  serverUrl: string;
  dbPath: string;
};

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function isPortAvailableOnHost(port: number, host: string) {
  return await new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRNOTAVAIL") {
        resolve(true);
        return;
      }
      resolve(false);
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function isPortAvailable(port: number) {
  const ipv4 = await isPortAvailableOnHost(port, "127.0.0.1");
  if (!ipv4) return false;
  const ipv6 = await isPortAvailableOnHost(port, "::1");
  return ipv6;
}

async function getAvailablePort(startPort: number) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found starting at ${startPort}.`);
}

async function waitForUrl(url: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function terminateProcess(
  proc: ReturnType<typeof spawn>,
  label: string
) {
  if (proc.exitCode !== null) return;
  if (proc.pid) {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      proc.kill("SIGTERM");
    }
  } else {
    proc.kill("SIGTERM");
  }
  const exited = await Promise.race([
    once(proc, "exit").then(() => true).catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000)),
  ]);
  if (exited) return;
  console.warn(`[playwright][app] force kill ${label}`);
  if (proc.pid) {
    try {
      process.kill(-proc.pid, "SIGKILL");
    } catch {
      proc.kill("SIGKILL");
    }
  } else {
    proc.kill("SIGKILL");
  }
  await once(proc, "exit").catch(() => undefined);
}

export const test = base.extend<{ app: AppFixture }>({
  app: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const workerIndex = workerInfo.workerIndex;
      const serverPort = await getAvailablePort(3100 + workerIndex * 2);
      const clientPort = await getAvailablePort(5200 + workerIndex * 2);
      const serverUrl = `http://127.0.0.1:${serverPort}`;
      const clientUrl = `http://localhost:${clientPort}`;
      const dbPath = path.join(
        process.cwd(),
        "server",
        "data",
        `viking.playwright.${RUN_ID}.worker-${workerIndex}.sqlite`
      );

      const serverProc = spawn("npm", ["run", "dev:server"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(serverPort),
          DB_PATH: dbPath,
          APP_BASE_URL: clientUrl,
        },
        detached: true,
        stdio: "pipe",
      });

      const clientProc = spawn(
        "npm",
        [
          "run",
          "dev",
          "--workspace",
          "client",
          "--",
          "--host",
          "localhost",
          "--port",
          String(clientPort),
          "--strictPort",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            VITE_PROXY_TARGET: serverUrl,
          },
          detached: true,
          stdio: "pipe",
        }
      );

      await Promise.all([
        waitForUrl(`${serverUrl}/health`),
        waitForUrl(clientUrl),
      ]);

      await use({ clientUrl, serverUrl, dbPath });

      await Promise.all([
        terminateProcess(serverProc, `server:${workerIndex}`),
        terminateProcess(clientProc, `client:${workerIndex}`),
      ]);
      await Promise.all([
        rm(dbPath, { force: true }),
        rm(`${dbPath}-wal`, { force: true }),
        rm(`${dbPath}-shm`, { force: true }),
      ]);
    },
    { scope: "worker" },
  ],
});
