const fs = require("node:fs");
const path = require("node:path");

(async () => {
  let puppeteer;
  try {
    puppeteer = require("puppeteer-core");
  } catch (error) {
    console.error("puppeteer-core is not installed. Run: npm i -D puppeteer-core");
    process.exit(1);
  }

  const chromeCandidates = [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ].filter(Boolean);
  const chromePath = chromeCandidates.find((candidate) =>
    fs.existsSync(candidate)
  );
  if (!chromePath) {
    console.error(
      "Chrome executable not found. Set CHROME_PATH to your Chrome binary."
    );
    process.exit(1);
  }

  const baseUrl = process.env.SNAPSHOT_URL || "http://localhost:5173";
  const devBypassToken = process.env.DEV_BYPASS_TOKEN || "";
  const snapshotMode = process.env.SNAPSHOT_PROFILE_MODE || "both";
  const snapshotPlayerId =
    process.env.SNAPSHOT_PLAYER_ID || "243656992";
  const outputDir = path.join(__dirname, "..", "snapshots");
  fs.mkdirSync(outputDir, { recursive: true });

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];
  const colorSchemes = ["light", "dark"];

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: "new",
  });
  try {
    async function requestJson(pathname, options = {}) {
      const res = await fetch(`${baseUrl}${pathname}`, options);
      const data = await res.json().catch(() => null);
      return { res, data };
    }

    let hasProfiles = false;
    if (devBypassToken) {
      const me = await requestJson("/api/me", {
        headers: { "x-dev-bypass": devBypassToken },
      });
      hasProfiles = (me.data?.data?.profiles || []).length > 0;
    }

    async function ensureProfile() {
      if (hasProfiles) return;
      let playerName = "";
      let playerAvatar = "";
      let lookupOk = false;
      let kingdomId = null;
      if (devBypassToken) {
        const lookup = await requestJson("/api/player-lookup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-dev-bypass": devBypassToken,
          },
          body: JSON.stringify({ fid: snapshotPlayerId }),
        });
        if (lookup.res.ok) {
          lookupOk = true;
          const data = lookup.data?.data ?? lookup.data;
          playerName =
            data?.data?.data?.name ??
            data?.data?.data?.nickname ??
            data?.data?.data?.player_name ??
            data?.data?.data?.role_name ??
            data?.data?.name ??
            data?.data?.nickname ??
            data?.data?.player_name ??
            data?.data?.role_name ??
            data?.data?.info?.name ??
            data?.data?.info?.nickname ??
            data?.data?.info?.player_name ??
            data?.data?.info?.role_name ??
            data?.info?.name ??
            data?.info?.nickname ??
            data?.info?.player_name ??
            data?.info?.role_name ??
            "";
          playerAvatar =
            data?.data?.data?.avatar ??
            data?.data?.data?.avatar_url ??
            data?.data?.data?.avatar_image ??
            data?.data?.data?.headimg ??
            data?.data?.data?.headimgurl ??
            data?.data?.data?.icon ??
            data?.data?.data?.profile?.avatar ??
            data?.data?.avatar ??
            data?.data?.avatar_url ??
            data?.data?.avatar_image ??
            data?.data?.headimg ??
            data?.data?.headimgurl ??
            data?.data?.icon ??
            data?.data?.profile?.avatar ??
            data?.avatar ??
            data?.avatar_url ??
            data?.headimg ??
            data?.headimgurl ??
            data?.icon ??
            data?.profile?.avatar ??
            "";
          const rawKingdom =
            data?.data?.data?.kid ??
            data?.data?.kid ??
            data?.kid ??
            null;
          kingdomId = Number.isFinite(Number(rawKingdom))
            ? Number(rawKingdom)
            : null;
        }
      }
      if (!lookupOk) {
        console.error("Player lookup failed; skipping profile creation.");
        return;
      }
      const created = await requestJson("/api/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(devBypassToken ? { "x-dev-bypass": devBypassToken } : {}),
        },
        body: JSON.stringify({
          playerId: snapshotPlayerId,
          playerName: playerName || null,
          playerAvatar: playerAvatar || null,
          kingdomId,
        }),
      });
      if (created.res.ok) {
        hasProfiles = true;
      }
    }

    async function captureSet(suffix) {
      for (const scheme of colorSchemes) {
        for (const viewport of viewports) {
          const page = await browser.newPage();
          if (devBypassToken) {
            await page.setExtraHTTPHeaders({ "x-dev-bypass": devBypassToken });
          }
          await page.emulateMediaFeatures([
            { name: "prefers-color-scheme", value: scheme },
          ]);
          await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: 2,
          });
          await page.goto(baseUrl, { waitUntil: "networkidle2" });
          await new Promise((resolve) => setTimeout(resolve, 500));
          const fileBase = `snapshot-${suffix}-${viewport.name}-${scheme}`;
          const filePath = path.join(outputDir, `${fileBase}.png`);
          const fullPage = viewport.name === "desktop";
          await page.screenshot({ path: filePath, fullPage });
          const htmlPath = path.join(outputDir, `${fileBase}.html`);
          await fs.promises.writeFile(htmlPath, await page.content(), "utf8");
          console.log(`Saved ${htmlPath}`);
          await page.close();
          console.log(`Saved ${filePath}`);
        }
      }
    }

    if (snapshotMode === "both") {
      if (!hasProfiles) {
        await captureSet("no-profile");
      }
      await ensureProfile();
      await captureSet("profile");
    } else if (snapshotMode === "no-profile") {
      await captureSet("no-profile");
    } else {
      await ensureProfile();
      await captureSet("profile");
    }

    if (devBypassToken) {
      await requestJson("/api/dev/delete-user", {
        method: "POST",
        headers: { "x-dev-bypass": devBypassToken },
      }).catch(() => null);
    }
  } finally {
    await browser.close();
  }
})();
