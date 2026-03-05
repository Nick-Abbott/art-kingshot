import { test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CLIENT_URL,
  DB_PATH,
  SERVER_URL,
  approveProfile,
  assertSession,
  createAlliance,
  createAuthContext,
  createBearSignup,
  createProfile,
  createSessionToken,
  createVikingSignup,
  openNavMenu,
  openPage,
  requireEnv,
  setPendingJoin,
} from "./utils";

let sessionToken = "";

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

  await openPage(page, {
    pageKey: options.pageKey,
    selectedProfileId: options.selectedProfileId,
    clientUrl: CLIENT_URL,
    waitForMe: true,
    waitForMeTimeout: 10000,
    readySelector: ".app-shell",
    readyTimeout: 10000,
  });

  if (options.openNav) {
    await openNavMenu(page, { force: true });
  }

  if (options.openProfileMenu) {
    const trigger = page.getByTestId("profile-switcher");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await page.getByRole("menu").waitFor({ state: "visible" });
  }

  const fileName = `${name}-${test.info().project.name}.png`;
  await page.screenshot({
    path: path.join(outputDir, fileName),
    fullPage: true,
  });
}

test("ui snapshots", async ({ browser, request }, testInfo) => {
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH, "Playwright UI snapshots");
  sessionToken = createSessionToken({ dbPath: DB_PATH });
  await assertSession(request, sessionToken, SERVER_URL);

  const kingdomId = 9000 + Math.floor(Math.random() * 1000);
  const runToken = `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;
  const buildPlayerId = (suffix: number) => `FID${runToken}${suffix}`;

  const profileA = await createProfile(request, sessionToken, {
    playerId: buildPlayerId(1),
    playerName: "Professor Muffin",
    kingdomId,
  });
  const profileB = await createProfile(request, sessionToken, {
    playerId: buildPlayerId(2),
    playerName: "MuffinMan",
    kingdomId,
  });
  const profileC = await createProfile(request, sessionToken, {
    playerId: buildPlayerId(3),
    playerName: "StaleMuffin",
    kingdomId,
  });

  const alliance = await createAlliance(request, sessionToken, profileA.id);
  await setPendingJoin(request, sessionToken, profileB.id, alliance.alliance.id);

  const contextWithAuth = await createAuthContext(browser, sessionToken, CLIENT_URL);

  const runSnapshot = async (
    page: Parameters<typeof snapshotPage>[0],
    name: string,
    options: Parameters<typeof snapshotPage>[2]
  ) => {
    await test.step(`snapshot:${name}`, async () => {
      await snapshotPage(page, name, options);
    });
  };

  try {
    const contextLoggedOut = await browser.newContext({ baseURL: CLIENT_URL });
    const loggedOutPage = await contextLoggedOut.newPage();
    await runSnapshot(loggedOutPage, "profiles-logged-out", { pageKey: "profiles" });
    await loggedOutPage.close();
    await contextLoggedOut.close();

    const loggedInPage = await contextWithAuth.newPage();
    await runSnapshot(loggedInPage, "profiles-logged-in", {
      pageKey: "profiles",
      selectedProfileId: profileC.id,
    });
    await loggedInPage.close();

    const pendingPage = await contextWithAuth.newPage();
    await runSnapshot(pendingPage, "profiles-pending", {
      pageKey: "profiles",
      selectedProfileId: profileB.id,
    });
    await pendingPage.close();

    await approveProfile(request, sessionToken, profileA.id, profileB.id);

    const activePage = await contextWithAuth.newPage();
    await runSnapshot(activePage, "profiles-active", {
      pageKey: "profiles",
      selectedProfileId: profileB.id,
    });
    await activePage.close();

    const dropdownPage = await contextWithAuth.newPage();
    await runSnapshot(dropdownPage, "profiles-dropdown-open", {
      pageKey: "profiles",
      selectedProfileId: profileC.id,
      openProfileMenu: true,
      openNav: testInfo.project.name.includes("mobile"),
    });
    await dropdownPage.close();

    const navPage = await contextWithAuth.newPage();
    await runSnapshot(navPage, "profiles-nav-open", {
      pageKey: "profiles",
      selectedProfileId: profileC.id,
      openNav: testInfo.project.name.includes("mobile"),
    });
    await navPage.close();

    const vikingNoAlliance = await contextWithAuth.newPage();
    await runSnapshot(vikingNoAlliance, "viking-no-alliance", {
      pageKey: "viking",
      selectedProfileId: profileC.id,
    });
    await vikingNoAlliance.close();

    const vikingNoSignup = await contextWithAuth.newPage();
    await runSnapshot(vikingNoSignup, "viking-active-nosignup", {
      pageKey: "viking",
      selectedProfileId: profileA.id,
    });
    await vikingNoSignup.close();

    const bearNoAlliance = await contextWithAuth.newPage();
    await runSnapshot(bearNoAlliance, "bear-no-alliance", {
      pageKey: "bear",
      selectedProfileId: profileC.id,
    });
    await bearNoAlliance.close();

    const bearNoSignup = await contextWithAuth.newPage();
    await runSnapshot(bearNoSignup, "bear-active-nosignup", {
      pageKey: "bear",
      selectedProfileId: profileA.id,
    });
    await bearNoSignup.close();

    await createVikingSignup(
      request,
      sessionToken,
      profileA.id,
      profileA.playerId,
      profileA.playerName
    );

    const vikingSignup = await contextWithAuth.newPage();
    await runSnapshot(vikingSignup, "viking-active-signup", {
      pageKey: "viking",
      selectedProfileId: profileA.id,
    });
    await vikingSignup.close();

    await createBearSignup(
      request,
      sessionToken,
      profileA.id,
      profileA.playerId,
      profileA.playerName
    );

    const bearSignup = await contextWithAuth.newPage();
    await runSnapshot(bearSignup, "bear-active-signup", {
      pageKey: "bear",
      selectedProfileId: profileA.id,
    });
    await bearSignup.close();
  } finally {
    await contextWithAuth.close();
  }
});
