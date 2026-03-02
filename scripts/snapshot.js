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
        const fileBase = `snapshot-${viewport.name}-${scheme}`;
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
  } finally {
    await browser.close();
  }
})();
