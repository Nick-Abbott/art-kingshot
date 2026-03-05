import { expect, test } from "@playwright/test";
import {
  DB_PATH,
  CLIENT_URL,
  SERVER_URL,
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
  requireEnv,
} from "./utils";

const ACTION_TIMEOUT = 5000;
const WAIT_TIMEOUT = 5000;

test.use({ actionTimeout: ACTION_TIMEOUT, navigationTimeout: 10000 });

let sessionToken = "";

async function seedProfiles(request: Parameters<typeof test>[0]["request"]) {
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
  const alliance = await createAlliance(request, sessionToken, profileA.id);
  return { profileA, profileB, allianceId: alliance.alliance.id };
}

async function ensureProfileSwitcherReady(page: Parameters<typeof test>[0]["page"]) {
  await openNavMenu(page);
  const switcher = page.getByTestId("profile-switcher");
  await expect(switcher).toBeEnabled({ timeout: WAIT_TIMEOUT });
}

test("profile switcher updates selected profile", async ({ browser, request }) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH, "Playwright UI flows");
  sessionToken = createSessionToken({ dbPath: DB_PATH });
  await assertSession(request, sessionToken, SERVER_URL);
  const { profileA, profileB } = await seedProfiles(request);
  const context = await createAuthContext(browser, sessionToken, CLIENT_URL);
  const page = await context.newPage();
  await mockPlayerLookup(page, profileA.playerName, 9001);

  await openPage(page, {
    pageKey: "viking",
    selectedProfileId: profileA.id,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });
  await ensureProfileSwitcherReady(page);

  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).click();
  await expect(page.getByTestId("profile-switcher")).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("viking signup and reset", async ({ browser, request }) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH, "Playwright UI flows");
  sessionToken = createSessionToken({ dbPath: DB_PATH });
  await assertSession(request, sessionToken, SERVER_URL);
  const { profileA } = await seedProfiles(request);
  const context = await createAuthContext(browser, sessionToken, CLIENT_URL);
  const page = await context.newPage();
  await mockPlayerLookup(page, profileA.playerName, 9001);

  await openPage(page, {
    pageKey: "viking",
    selectedProfileId: profileA.id,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });

  await page.getByLabel("March count").fill("4");
  await page.getByLabel("Power").fill("33000000");
  await page.getByLabel("Troop count").fill("450000");
  await page.getByRole("button", { name: /save signup/i }).click({ timeout: WAIT_TIMEOUT });

  await expect(page.getByTestId("viking-signed-count")).toHaveText("1", {
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("viking-roster-list")).toContainText(profileA.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByRole("button", { name: /reset event/i }).click({
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

test("bear signup and reset", async ({ browser, request }) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH, "Playwright UI flows");
  sessionToken = createSessionToken({ dbPath: DB_PATH });
  await assertSession(request, sessionToken, SERVER_URL);
  const { profileA } = await seedProfiles(request);
  const context = await createAuthContext(browser, sessionToken, CLIENT_URL);
  const page = await context.newPage();
  await mockPlayerLookup(page, profileA.playerName, 9001);

  await openPage(page, {
    pageKey: "bear",
    selectedProfileId: profileA.id,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });

  const signupForm = page.locator("form").first();
  await signupForm.getByLabel("Rally size").fill("800000");
  await signupForm.getByLabel("Bear group").selectOption("bear1");
  await page.getByRole("button", { name: /register/i }).click({ timeout: WAIT_TIMEOUT });

  await expect(page.getByTestId("bear1-count")).toHaveText("1", { timeout: WAIT_TIMEOUT });
  await expect(page.getByTestId("bear1-list")).toContainText(profileA.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await page.getByRole("button", { name: /reset bear 1/i }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(page.getByTestId("bear1-count")).toHaveText("0", { timeout: WAIT_TIMEOUT });
  await expect(page.getByTestId("bear1-list")).toContainText("No signups yet.", {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("admin signup controls are only visible to alliance admins", async ({
  browser,
  request,
}) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH, "Playwright UI flows");
  sessionToken = createSessionToken({ dbPath: DB_PATH });
  await assertSession(request, sessionToken, SERVER_URL);
  const { profileA, profileB, allianceId } = await seedProfiles(request);
  await joinAlliance(request, sessionToken, profileB.id, allianceId, SERVER_URL);
  await activateAllianceProfile(request, sessionToken, profileA.id, profileB.id, SERVER_URL);

  const context = await createAuthContext(browser, sessionToken, CLIENT_URL);
  const page = await context.newPage();

  await openPage(page, {
    pageKey: "viking",
    selectedProfileId: profileA.id,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });
  await expect(page.getByLabel("Alliance member (admin)")).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });
  await ensureProfileSwitcherReady(page);
  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).click();
  await expect(page.getByLabel("Alliance member (admin)")).toHaveCount(0);

  await openPage(page, {
    pageKey: "bear",
    selectedProfileId: profileA.id,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });
  await expect(page.getByLabel("Alliance member (admin)")).toBeVisible({
    timeout: WAIT_TIMEOUT,
  });
  await ensureProfileSwitcherReady(page);
  await page.getByTestId("profile-switcher").click({ timeout: WAIT_TIMEOUT });
  await page.getByRole("menuitem", { name: profileB.playerName }).click();
  await expect(page.getByLabel("Alliance member (admin)")).toHaveCount(0);

  await context.close();
});

test("alliance admin updates applicants list immediately", async ({
  browser,
  request,
}) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH, "Playwright UI flows");
  sessionToken = createSessionToken({ dbPath: DB_PATH });
  await assertSession(request, sessionToken, SERVER_URL);
  const { profileA, profileB, allianceId } = await seedProfiles(request);
  await joinAlliance(request, sessionToken, profileB.id, allianceId, SERVER_URL);

  const context = await createAuthContext(browser, sessionToken, CLIENT_URL);
  const page = await context.newPage();

  await openPage(page, {
    pageKey: "profiles",
    selectedProfileId: profileA.id,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });

  const applicantsHeading = () => page.getByRole("heading", { name: "Applicants" });
  const applicantsList = () =>
    applicantsHeading().locator("xpath=following-sibling::div[1]");
  const membersList = () =>
    page.getByRole("heading", { name: "Members" }).locator("xpath=following-sibling::div[1]");
  const memberCard = () =>
    membersList().locator(".ui-card-muted", { hasText: profileB.playerName });

  await expect(applicantsList()).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await applicantsList().getByRole("button", { name: "Approve" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(membersList()).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsHeading()).toHaveCount(0, {
    timeout: WAIT_TIMEOUT,
  });

  await memberCard().getByRole("button", { name: "Suspend" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsList()).toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await applicantsList().getByRole("button", { name: "Approve" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await memberCard().getByRole("button", { name: "Make admin" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(
    memberCard().getByRole("button", { name: "Make member" })
  ).toBeVisible({ timeout: WAIT_TIMEOUT });

  await memberCard().getByRole("button", { name: "Suspend" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await applicantsList().getByRole("button", { name: "Reject" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsHeading()).toHaveCount(0, {
    timeout: WAIT_TIMEOUT,
  });
  await expect(membersList()).not.toContainText(profileB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});

test("admin panel updates alliances and profiles without reload", async ({
  browser,
  request,
}) => {
  test.setTimeout(30000);
  requireEnv("PLAYWRIGHT_DB_PATH", DB_PATH, "Playwright UI flows");
  sessionToken = createSessionToken({ dbPath: DB_PATH, isAppAdmin: true });
  await assertSession(request, sessionToken, SERVER_URL);

  const kingdomA = 9100 + Math.floor(Math.random() * 100);
  const kingdomB = kingdomA + 100;
  const runToken = `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;
  const profileAdminA = await createProfile(request, sessionToken, {
    playerId: `FID${runToken}A`,
    playerName: "Admin A",
    kingdomId: kingdomA,
  });
  const profileMemberA = await createProfile(request, sessionToken, {
    playerId: `FID${runToken}B`,
    playerName: "Member A",
    kingdomId: kingdomA,
  });
  const profileAdminB = await createProfile(request, sessionToken, {
    playerId: `FID${runToken}C`,
    playerName: "Admin B",
    kingdomId: kingdomB,
  });
  const allianceA = await createAlliance(request, sessionToken, profileAdminA.id);
  const allianceB = await createAlliance(request, sessionToken, profileAdminB.id);
  await joinAlliance(request, sessionToken, profileMemberA.id, allianceA.alliance.id);

  const context = await createAuthContext(browser, sessionToken, CLIENT_URL);
  const page = await context.newPage();

  await openPage(page, {
    pageKey: "profiles",
    selectedProfileId: profileAdminA.id,
    waitForMeTimeout: WAIT_TIMEOUT,
    readyTestId: "profile-switcher",
    readyState: "attached",
    readyTimeout: WAIT_TIMEOUT,
  });
  await openNavMenu(page);
  await page
    .getByRole("button", { name: "Admin", exact: true })
    .click({ timeout: WAIT_TIMEOUT });
  await page.getByLabel("Kingdom").waitFor({ timeout: WAIT_TIMEOUT });

  await page.getByLabel("Kingdom").selectOption(String(kingdomA));
  await page.getByLabel("Alliance").selectOption(allianceA.alliance.id);

  const applicantsHeading = () => page.getByRole("heading", { name: "Applicants" });
  const applicantsList = () =>
    applicantsHeading().locator("xpath=following-sibling::div[1]");
  const membersList = () =>
    page.getByRole("heading", { name: "Members" }).locator("xpath=following-sibling::div[1]");
  const adminMemberCard = () =>
    membersList().locator(".ui-card-muted", { hasText: profileMemberA.playerName });

  await expect(applicantsList()).toContainText(profileMemberA.playerName, {
    timeout: WAIT_TIMEOUT,
  });
  await applicantsList().getByRole("button", { name: "Approve" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(membersList()).toContainText(profileMemberA.playerName, {
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsHeading()).toHaveCount(0, { timeout: WAIT_TIMEOUT });

  await adminMemberCard().getByRole("button", { name: "Suspend" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(applicantsList()).toContainText(profileMemberA.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await applicantsList().getByRole("button", { name: "Approve" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await adminMemberCard().getByRole("button", { name: "Make admin" }).click({
    timeout: WAIT_TIMEOUT,
  });
  await expect(
    adminMemberCard().getByRole("button", { name: "Make member" })
  ).toBeVisible({ timeout: WAIT_TIMEOUT });

  await page.getByLabel("Kingdom").selectOption(String(kingdomB));
  await expect(page.getByLabel("Alliance")).toHaveValue("");
  await page.getByLabel("Alliance").selectOption(allianceB.alliance.id);
  await expect(membersList()).toContainText(profileAdminB.playerName, {
    timeout: WAIT_TIMEOUT,
  });

  await context.close();
});
