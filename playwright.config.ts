import { defineConfig } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.SNAPSHOT_URL || "http://localhost:5173";
const executablePath = process.env.CHROME_PATH;
const dbPath = path.join(process.cwd(), "server", "data", "viking.playwright.sqlite");

export default defineConfig({
  testDir: "playwright",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "off",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: [
    {
      command: "npm run dev:server",
      url: "http://127.0.0.1:3002/health",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: "3002",
        DB_PATH: dbPath,
        APP_BASE_URL: "http://localhost:5174"
      }
    },
    {
      command: "npm run dev --workspace client -- --host localhost --port 5174 --strictPort",
      url: "http://localhost:5174",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_PROXY_TARGET: "http://127.0.0.1:3002"
      }
    }
  ],
  projects: [
    {
      name: "flows-desktop",
      testMatch: /ui-flows\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" },
    },
    {
      name: "flows-mobile",
      testMatch: /ui-flows\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 }, colorScheme: "light" },
    },
    {
      name: "snapshots-desktop-light",
      testMatch: /ui-snapshots\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" },
    },
    {
      name: "snapshots-desktop-dark",
      testMatch: /ui-snapshots\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 }, colorScheme: "dark" },
    },
    {
      name: "snapshots-mobile-light",
      testMatch: /ui-snapshots\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 }, colorScheme: "light" },
    },
    {
      name: "snapshots-mobile-dark",
      testMatch: /ui-snapshots\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 }, colorScheme: "dark" },
    },
  ],
});
