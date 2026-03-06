import { expect } from "@playwright/test";
import { test } from "./fixtures";
import {
  activateAllianceProfile,
  assertSession,
  createAlliance,
  createAuthContext,
  createProfile,
  createSessionToken,
  joinAlliance,
  mockPlayerLookup,
  openNavMenu,
  openPage,
  resetPlaywrightDb,
} from "./utils";

const ACTION_TIMEOUT = 5000;
const WAIT_TIMEOUT = 5000;

test.use({ actionTimeout: ACTION_TIMEOUT, navigationTimeout: 10000 });

let sessionToken = "";

test.beforeEach(async ({ app }) => {
  resetPlaywrightDb(app.dbPath);
});

async function seedProfiles(
  request: Parameters<typeof test>[0]["request"],
  serverUrl: string
) {
  const kingdomId = 9001;
  const runToken = "PW03FLOWS";
  const buildPlayerId = (suffix: number) => `FID${runToken}${suffix}`;
  const profileA = await createProfile(
    request,
    sessionToken,
    {
      playerId: buildPlayerId(1),
      playerName: "Professor Muffin",
      kingdomId,
    },
    serverUrl
  );
  const profileB = await createProfile(
    request,
    sessionToken,
    {
      playerId: buildPlayerId(2),
      playerName: "MuffinMan",
      kingdomId,
    },
    serverUrl
  );
  const alliance = await createAlliance(request, sessionToken, profileA.id, serverUrl, {
    tag: "AOA",
  });
  return { profileA, profileB, allianceId: alliance.alliance.id };
}

async function ensureProfileSwitcherReady(page: Parameters<typeof test>[0]["page"]) {
  await openNavMenu(page);
  const switcher = page.getByTestId("profile-switcher");
  await expect(switcher).toBeEnabled({ timeout: WAIT_TIMEOUT });
}

test("profile switcher updates selected profile", async ({ app, browser, request }) => {
  test.setTimeout(30000);
  sessionToken = createSessionToken({ dbPath: app.dbPath });
  await assertSession(request, sessionToken, app.serverUrl);
  const { profileA, profileB, allianceId } = await seedProfiles(request, app.serverUrl);
  await joinAlliance(request, sessionToken, profileB.id, allianceId, app.serverUrl);
  await activateAllianceProfile(
    request,
    sessionToken,
    profileA.id,
    profileB.id,
    app.serverUrl
  );
  const context = await createAuthContext(browser, sessionToken, app.clientUrl);
  const page = await context.newPage();
  await mockPlayerLookup(page, profileA.playerName, 9001);

  await openPage(page, {
    pageKey: "viking",
    selectedProfileId: profileA.id,
    clientUrl: app.clientUrl,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });
  await ensureProfileSwitcherReady(page);

  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).first().click();
  await expect(page.getByTestId("profile-switcher")).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("viking signup and reset", async ({ app, browser, request }) => {
  test.setTimeout(30000);
  sessionToken = createSessionToken({ dbPath: app.dbPath });
  await assertSession(request, sessionToken, app.serverUrl);
  const { profileA, profileB, allianceId } = await seedProfiles(request, app.serverUrl);
  await joinAlliance(request, sessionToken, profileB.id, allianceId, app.serverUrl);
  await activateAllianceProfile(
    request,
    sessionToken,
    profileA.id,
    profileB.id,
    app.serverUrl
  );
  const context = await createAuthContext(browser, sessionToken, app.clientUrl);
  const page = await context.newPage();
  await mockPlayerLookup(page, profileA.playerName, 9001);

  await openPage(page, {
    pageKey: "viking",
    selectedProfileId: profileA.id,
    clientUrl: app.clientUrl,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });

  await page.getByTestId("viking-march-count").fill("4");
  await page.getByTestId("viking-power").fill("33000000");
  await page.getByTestId("viking-troop-count").fill("450000");
  await page.getByTestId("viking-save-signup").click({ timeout: WAIT_TIMEOUT });

  await ensureProfileSwitcherReady(page);
  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).first().click();
  await expect(page.getByTestId("profile-switcher")).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });
  await mockPlayerLookup(page, profileB.playerName, 9001);

  await page.getByTestId("viking-march-count").fill("4");
  await page.getByTestId("viking-power").fill("30000000");
  await page.getByTestId("viking-troop-count").fill("420000");
  await page.getByTestId("viking-save-signup").click({ timeout: WAIT_TIMEOUT });

  await ensureProfileSwitcherReady(page);
  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileA.playerName }).first().click();
  await expect(page.getByTestId("profile-switcher")).toContainText(profileA.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await expect(page.getByTestId("viking-signed-count")).toHaveText("2", {
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("viking-roster-list")).toContainText(profileA.playerName, {
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("viking-roster-list")).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByTestId("viking-run-assignments").click({ timeout: WAIT_TIMEOUT });
  await expect(
    page.getByTestId(`viking-assignment-${profileA.playerId}`)
  ).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });
  await expect(
    page.getByTestId(`viking-assignment-${profileB.playerId}`)
  ).toHaveCount(0);

  await page.getByTestId("viking-show-all").click({ timeout: WAIT_TIMEOUT });
  await expect(
    page.getByTestId(`viking-assignment-${profileB.playerId}`)
  ).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });

  await page.getByTestId("viking-reset-event").click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("viking-signed-count")).toHaveText("0", {
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("viking-roster-list")).toContainText("No signups yet.", {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("bear signup and reset", async ({ app, browser, request }) => {
  test.setTimeout(30000);
  sessionToken = createSessionToken({ dbPath: app.dbPath });
  await assertSession(request, sessionToken, app.serverUrl);
  const { profileA } = await seedProfiles(request, app.serverUrl);
  const context = await createAuthContext(browser, sessionToken, app.clientUrl);
  const page = await context.newPage();
  await mockPlayerLookup(page, profileA.playerName, 9001);

  await openPage(page, {
    pageKey: "bear",
    selectedProfileId: profileA.id,
    clientUrl: app.clientUrl,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });

  await page.getByTestId("bear-rally-size").fill("800000");
  await page.getByTestId("bear-group").selectOption("bear1");
  await page.getByTestId("bear-register").click({ timeout: WAIT_TIMEOUT });

  await expect(page.getByTestId("bear1-count")).toHaveText("1", { timeout: WAIT_TIMEOUT });
  await expect(page.getByTestId("bear1-list")).toContainText(profileA.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByTestId("bear-reset-bear1").click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("bear1-count")).toHaveText("0", { timeout: WAIT_TIMEOUT });
  await expect(page.getByTestId("bear1-list")).toContainText("No signups yet.", {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("admin signup controls are only visible to alliance admins", async ({
  app,
  browser,
  request,
}) => {
  test.setTimeout(30000);
  sessionToken = createSessionToken({ dbPath: app.dbPath });
  await assertSession(request, sessionToken, app.serverUrl);
  const { profileA, profileB, allianceId } = await seedProfiles(request, app.serverUrl);
  await joinAlliance(request, sessionToken, profileB.id, allianceId, app.serverUrl);
  await activateAllianceProfile(
    request,
    sessionToken,
    profileA.id,
    profileB.id,
    app.serverUrl
  );

  const context = await createAuthContext(browser, sessionToken, app.clientUrl);
  const page = await context.newPage();

  await openPage(page, {
    pageKey: "viking",
    selectedProfileId: profileA.id,
    clientUrl: app.clientUrl,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("viking-admin-member-select")).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });
  await ensureProfileSwitcherReady(page);
  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).click();
  await expect(page.getByTestId("viking-admin-member-select")).toHaveCount(0);

  await openPage(page, {
    pageKey: "bear",
    selectedProfileId: profileA.id,
    clientUrl: app.clientUrl,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("bear-admin-member-select")).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });
  await ensureProfileSwitcherReady(page);
  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).click();
  await expect(page.getByTestId("bear-admin-member-select")).toHaveCount(0);

  await context.close();
});

test("alliance admin updates applicants list immediately", async ({
  app,
  browser,
  request,
}) => {
  test.setTimeout(30000);
  sessionToken = createSessionToken({ dbPath: app.dbPath });
  await assertSession(request, sessionToken, app.serverUrl);
  const { profileA, profileB, allianceId } = await seedProfiles(request, app.serverUrl);
  await joinAlliance(request, sessionToken, profileB.id, allianceId, app.serverUrl);

  const context = await createAuthContext(browser, sessionToken, app.clientUrl);
  const page = await context.newPage();

  await openPage(page, {
    pageKey: "profiles",
    selectedProfileId: profileA.id,
    clientUrl: app.clientUrl,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });

  const applicantsList = () => page.getByTestId("profiles-applicants-list");
  const membersList = () => page.getByTestId("profiles-members-list");

  await expect(applicantsList()).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByTestId(`profiles-approve-${profileB.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(membersList()).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsList()).toHaveCount(0, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByTestId(`profiles-suspend-${profileB.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsList()).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByTestId(`profiles-approve-${profileB.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await page.getByTestId(`profiles-make-admin-${profileB.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId(`profiles-make-member-${profileB.id}`)).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });

  await page.getByTestId(`profiles-suspend-${profileB.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await page.getByTestId(`profiles-reject-${profileB.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsList()).toHaveCount(0, {
    timeout: WAIT_TIMEOUT,
  });
  await expect(membersList()).not.toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("admin panel updates alliances and profiles without reload", async ({
  app,
  browser,
  request,
}) => {
  test.setTimeout(30000);
  sessionToken = createSessionToken({ dbPath: app.dbPath, isAppAdmin: true });
  await assertSession(request, sessionToken, app.serverUrl);

  const kingdomA = 9101;
  const kingdomB = 9201;
  const runToken = "PW03ADMIN";
  const profileAdminA = await createProfile(
    request,
    sessionToken,
    {
      playerId: `FID${runToken}A`,
      playerName: "Admin A",
      kingdomId: kingdomA,
    },
    app.serverUrl
  );
  const profileMemberA = await createProfile(
    request,
    sessionToken,
    {
      playerId: `FID${runToken}B`,
      playerName: "Member A",
      kingdomId: kingdomA,
    },
    app.serverUrl
  );
  const profileAdminB = await createProfile(
    request,
    sessionToken,
    {
      playerId: `FID${runToken}C`,
      playerName: "Admin B",
      kingdomId: kingdomB,
    },
    app.serverUrl
  );
  const allianceA = await createAlliance(
    request,
    sessionToken,
    profileAdminA.id,
    app.serverUrl,
    { tag: "AOB" }
  );
  const allianceB = await createAlliance(
    request,
    sessionToken,
    profileAdminB.id,
    app.serverUrl,
    { tag: "AOC" }
  );
  await joinAlliance(
    request,
    sessionToken,
    profileMemberA.id,
    allianceA.alliance.id,
    app.serverUrl
  );

  const context = await createAuthContext(browser, sessionToken, app.clientUrl);
  const page = await context.newPage();

  await openPage(page, {
    pageKey: "profiles",
    selectedProfileId: profileAdminA.id,
    clientUrl: app.clientUrl,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });
  await openNavMenu(page);
  await page.getByTestId("nav-admin").click({ timeout: WAIT_TIMEOUT });
  await page.getByTestId("admin-kingdom-select").waitFor({ timeout: WAIT_TIMEOUT });

  await page.getByTestId("admin-kingdom-select").selectOption(String(kingdomA));
  await page.getByTestId("admin-alliance-select").selectOption(allianceA.alliance.id);

  const applicantsList = () => page.getByTestId("admin-applicants-list");
  const membersList = () => page.getByTestId("admin-members-list");

  await expect(applicantsList()).toContainText(profileMemberA.playerName, {
    timeout: WAIT_TIMEOUT,
  });
  await page.getByTestId(`admin-approve-${profileMemberA.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(membersList()).toContainText(profileMemberA.playerName, {
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsList()).toHaveCount(0, { timeout: WAIT_TIMEOUT });

  await page.getByTestId(`admin-suspend-${profileMemberA.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsList()).toContainText(profileMemberA.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByTestId(`admin-approve-${profileMemberA.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await page.getByTestId(`admin-make-admin-${profileMemberA.id}`).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId(`admin-make-member-${profileMemberA.id}`)).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });

  await page.getByTestId("admin-kingdom-select").selectOption(String(kingdomB));
  await expect(page.getByTestId("admin-alliance-select")).toHaveValue("");
  await page.getByTestId("admin-alliance-select").selectOption(allianceB.alliance.id);
  await expect(membersList()).toContainText(profileAdminB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});
