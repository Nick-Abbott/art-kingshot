import { defineConfig } from "@playwright/test";

const baseURL = process.env.SNAPSHOT_URL || "http://localhost:5173";
const executablePath = process.env.CHROME_PATH;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "playwright",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 4,
  reporter: isCI ? "github" : "list",
  snapshotPathTemplate: "snapshots/playwright/{arg}{ext}",
  retries: isCI ? 2 : 0,
  use: {
    baseURL,
    trace: isCI ? "on-first-retry" : "off",
    video: isCI ? "on-first-retry" : "off",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
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
