import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { test } from "./fixtures";
import {
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
  resetPlaywrightDb,
  setPendingJoin,
  waitForSnapshotReady,
} from "./utils";

let sessionToken = "";

test.beforeEach(async ({ app }) => {
  resetPlaywrightDb(app.dbPath);
});

async function snapshotPage(
  page: Parameters<typeof test>[0]["page"],
  name: string,
  clientUrl: string,
  options: {
    pageKey?: string;
    selectedProfileId?: string;
    openProfileMenu?: boolean;
    openNav?: boolean;
    loggedOut?: boolean;
  }
) {
  await openPage(page, {
    pageKey: options.pageKey,
    selectedProfileId: options.selectedProfileId,
    clientUrl,
    waitForMe: true,
    waitForMeTimeout: 10000,
    readySelector: ".app-shell",
    readyTimeout: 10000,
  });

  await waitForSnapshotReady(page, {
    pageKey: options.pageKey,
    loggedOut: options.loggedOut,
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

  await expect(page).toHaveScreenshot(`${name}-${test.info().project.name}.png`, {
    fullPage: true,
    animations: "allow",
    scale: "device",
    mask: await buildSnapshotMask(page),
  });
}

async function buildSnapshotMask(page: Parameters<typeof test>[0]["page"]) {
  const masks: Locator[] = [];
  const snapshotMask = page.locator("[data-snapshot-mask='true']");
  if ((await snapshotMask.count()) > 0) {
    masks.push(snapshotMask);
  }
  return masks;
}

test("ui snapshots", async ({ app, browser, request }, testInfo) => {
  sessionToken = createSessionToken({ dbPath: app.dbPath });
  await assertSession(request, sessionToken, app.serverUrl);

  const kingdomId = 9002;
  const runToken = "PW03SNAP";
  const buildPlayerId = (suffix: number) => `FID${runToken}${suffix}`;

  const profileA = await createProfile(
    request,
    sessionToken,
    {
      playerId: buildPlayerId(1),
      playerName: "Professor Muffin",
      kingdomId,
    },
    app.serverUrl
  );
  const profileB = await createProfile(
    request,
    sessionToken,
    {
      playerId: buildPlayerId(2),
      playerName: "MuffinMan",
      kingdomId,
    },
    app.serverUrl
  );
  const profileC = await createProfile(
    request,
    sessionToken,
    {
      playerId: buildPlayerId(3),
      playerName: "StaleMuffin",
      kingdomId,
    },
    app.serverUrl
  );

  const alliance = await createAlliance(
    request,
    sessionToken,
    profileA.id,
    app.serverUrl,
    { tag: "AOS" }
  );
  await setPendingJoin(
    request,
    sessionToken,
    profileB.id,
    alliance.alliance.id,
    app.serverUrl
  );

  const contextWithAuth = await createAuthContext(
    browser,
    sessionToken,
    app.clientUrl
  );

  const runSnapshot = async (
    page: Parameters<typeof snapshotPage>[0],
    name: string,
    options: Parameters<typeof snapshotPage>[3]
  ) => {
    await test.step(`snapshot:${name}`, async () => {
      await snapshotPage(page, name, app.clientUrl, options);
    });
  };

  try {
    const contextLoggedOut = await browser.newContext({ baseURL: app.clientUrl });
    const loggedOutPage = await contextLoggedOut.newPage();
    await runSnapshot(loggedOutPage, "profiles-logged-out", {
      pageKey: "profiles",
      loggedOut: true,
    });
    await loggedOutPage.close();
    await contextLoggedOut.close();

    const loggedInPage = await contextWithAuth.newPage();
    await runSnapshot(loggedInPage, "profiles-logged-in", {
      pageKey: "profiles",
      selectedProfileId: profileA.id,
    });
    await loggedInPage.close();

    const pendingPage = await contextWithAuth.newPage();
    await runSnapshot(pendingPage, "profiles-pending", {
      pageKey: "profiles",
      selectedProfileId: profileB.id,
    });
    await pendingPage.close();

    await approveProfile(request, sessionToken, profileA.id, profileB.id, app.serverUrl);

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
      profileA.playerName,
      app.serverUrl
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
      profileA.playerName,
      app.serverUrl
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
