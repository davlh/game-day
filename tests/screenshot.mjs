// Renders Game Day in a phone-sized headless browser with sample games
// (tests/fixtures.json) and saves screenshots to tests/screenshots/.
//
//   npm install            (first time; installs Playwright)
//   npx playwright install chromium
//   npm run shots          (or: npm run shots -- --live   to use real ESPN data)
//
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(here, "screenshots");
const live = process.argv.includes("--live");
const FX = JSON.parse(fs.readFileSync(path.join(here, "fixtures.json"), "utf8"));
const ICON = fs.readFileSync(path.join(root, "icons", "icon-192.png"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".webmanifest": "application/manifest+json", ".png": "image/png", ".md": "text/plain" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, timezoneId: "America/Los_Angeles" });
if (!live) {
  await ctx.route("https://site.api.espn.com/**", route => {
    const u = route.request().url();
    const lg = u.includes("football/nfl") ? "nfl" : u.includes("basketball/nba") ? "nba"
             : u.includes("mens-college") ? "cbb" : "cfb";
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FX[lg]) });
  });
  await ctx.route("https://a.espncdn.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: ICON }));
}
await ctx.addInitScript(() => localStorage.setItem("gameday.settings.v1",
  JSON.stringify({ shortcutId: "test-shortcut", tab: "mine" })));

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(live ? 3000 : 800);

const shot = async name => { await page.screenshot({ path: path.join(outDir, name + ".png") }); console.log("saved", name + ".png"); };
await shot("my-teams");
for (const tab of ["nfl", "nba", "cfb", "cbb"]) {
  await page.click(`[data-tab=${tab}]`);
  await page.waitForTimeout(live ? 2500 : 500);
  await shot(tab);
}
await page.click("#gear");
await page.waitForTimeout(200);
await shot("settings");

await browser.close();
server.close();
if (errors.length) { console.error("Page errors:\n" + errors.join("\n")); process.exit(1); }
console.log("No page errors.");
