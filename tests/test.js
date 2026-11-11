const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const APP = path.join(__dirname, "..");
const cfg = require(path.join(APP, "config.js"));
const L = require(path.join(APP, "logic.js"));
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures.json"), "utf8"));
let n = 0; const test = (name, fn) => { fn(); n++; console.log("✓ " + name); };
const games = lg => FX[lg].events.map(e => L.parseEvent(e, lg, cfg));
const byName = (lg, s) => games(lg).find(g => g.name === s);

test("NFL: FOX game on 49ers is a favorite and routes DirecTV KTVU first, FOX One second", () => {
  const g = byName("nfl", "KC @ SF");
  assert.ok(g.favorite);
  assert.deepStrictEqual(g.plan.map(p => p.app), ["DIRECTV", "FOX One", "FOX Sports"]);
  assert.strictEqual(g.plan[0].contentId, cfg.DTV.KTVU);
  assert.strictEqual(g.label, "DIRECTV · FOX");
});
test("NFL: Bears away game is a favorite (match by team id)", () => assert.ok(byName("nfl", "CHI @ DET").favorite));
test("NFL: Prime game routes to Prime Video only", () =>
  assert.deepStrictEqual(byName("nfl", "NYJ @ NE").plan.map(p => p.app), ["Prime Video"]));
test("NFL: ESPN/ABC game tries DirecTV ESPN, then ESPN app, then DirecTV ABC", () => {
  const p = byName("nfl", "LAR @ SEA").plan;
  assert.deepStrictEqual(p.map(x => x.app + (x.contentId ? ":" + x.network : "")), ["DIRECTV:ESPN", "ESPN", "DIRECTV:ABC"]);
});
test("Sorting: favorites first, then live, then by time", () => {
  const s = L.sortGames(games("nfl")).map(g => g.name);
  assert.deepStrictEqual(s, ["CHI @ DET", "KC @ SF", "NYJ @ NE", "LAR @ SEA"]);
});
test("NBA: Warriors local game routes to NBC Sports Bay Area on DirecTV", () => {
  const g = byName("nba", "LAL @ GS");
  assert.ok(g.favorite);
  assert.strictEqual(g.plan[0].contentId, cfg.DTV.NBCSBA);
  assert.strictEqual(g.national, false);
});
test("NBA: Bulls on NBC/Peacock → DirecTV KNTV first, Peacock next", () => {
  const g = byName("nba", "CHI @ BOS");
  assert.ok(g.favorite);
  assert.deepStrictEqual(g.plan.map(p => p.app + (p.contentId ? ":" + p.network : "")), ["DIRECTV:NBC", "Peacock"]);
});
test("CBB: alias 'SEC Network' resolves; ranks parsed; featured filter", () => {
  const all = games("cbb");
  const feat = all.filter(L.isFeatured).map(g => g.name).sort();
  assert.deepStrictEqual(feat, ["AUB @ STAN", "DUKE @ UNC", "FLA @ AUB"].sort());
  const fla = all.find(g => g.name === "FLA @ AUB");
  assert.strictEqual(fla.away.rank, 12);
  assert.deepStrictEqual(fla.plan.map(p => p.app), ["ESPN", "DIRECTV"]);
});
test("CBB: unknown/no network falls back to DirecTV app", () =>
  assert.deepStrictEqual(byName("cbb", "QQQ @ RRR").plan, [{ network: "", app: "DIRECTV" }]));
test("Shortcut ID accepts bare ID or deep link, rejects junk", () => {
  assert.strictEqual(L.extractShortcutId("http-shortcuts://f943652a-5f4b-47d9-a4dd-6588292e63dd"), "f943652a-5f4b-47d9-a4dd-6588292e63dd");
  assert.strictEqual(L.extractShortcutId(" abc-123 "), "abc-123");
  assert.strictEqual(L.extractShortcutId("javascript:alert(1)"), "");
});
test("Scoreboard URL includes college params and date range", () => {
  const u = L.scoreboardUrl(cfg.LEAGUES.cbb, new Date(2026, 10, 10), new Date(2026, 10, 17));
  assert.strictEqual(u, "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&limit=500&dates=20261110-20261117");
});

// ---- Availability in your TV market (informational only) ----
test("Blackout: Bulls home game only on CHSN is flagged, still a favorite, still playable via DirecTV", () => {
  const g = byName("nba", "MIA @ CHI");
  assert.ok(g.favorite);
  assert.strictEqual(g.access.status, "blackout");
  assert.ok(g.access.reason.includes("CHSN (CHI)"), g.access.reason);
  assert.deepStrictEqual(g.plan.map(p => p.app), ["DIRECTV"]);   // the plan is unchanged by the flag
});
test("Blackout: a national broadcast alongside a local one makes the game watchable", () =>
  assert.strictEqual(byName("nba", "PHI @ CHI").access.status, "ok"));
test("Blackout: NBC Sports California (a Bay Area network) is watchable for a non-Bay team", () =>
  assert.strictEqual(byName("nba", "DEN @ SAC").access.status, "ok"));
test("Blackout: a home-market team's local broadcast is watchable even on an unmapped channel", () =>
  assert.strictEqual(byName("nba", "GS @ POR").access.status, "ok"));
test("Blackout: national games are ok; a game with no listing is unknown, not blacked out", () => {
  ["nfl", "nba", "cbb"].forEach(lg => games(lg).filter(g => g.networks.every(n => n.national))
    .forEach(g => assert.strictEqual(g.access.status, g.networks.length ? "ok" : "unknown", g.name)));
  assert.strictEqual(byName("nba", "LAL @ GS").access.status, "ok");
  assert.strictEqual(byName("cbb", "QQQ @ RRR").access.status, "unknown");
});

// ---- End to end: web app link → Play on TV script on a simulated Roku ----
const PLAY = fs.readFileSync(path.join(APP, "play-on-tv.js"), "utf8");
const APPS_XML = `<apps><app id="161227" type="appl">DIRECTV</app><app id="13" type="appl">Prime Video</app>
<app id="593099" type="appl">Peacock TV</app><app id="34376" type="appl">ESPN</app></apps>`;
function runPlay(link, { tvOn = false, apps = APPS_XML, noVar = false } = {}) {
  const log = { posts: [], dialogs: [], toasts: [], opened: [], hosts: new Set() }; const tv = { on: tvOn };
  const planParam = new URL(link.replace("http-shortcuts://", "https://x/")).searchParams.get("plan");
  vm.runInNewContext(PLAY, {
    getVariable: name => { if (noVar || name !== "plan") throw new Error("no var"); return planParam; },
    sendHttpRequest(url, o = {}) {
      const m = o.method || "GET", p = url.replace(/^http:\/\/[^/]+/, ""); log.hosts.add(url.split("/")[2]);
      if (m === "POST") { log.posts.push(p); if (p === "/keypress/PowerOn") tv.on = true; return { status: "success", response: { body: "" } }; }
      if (p === "/query/device-info") return { status: "success", response: { body: `<power-mode>${tv.on ? "PowerOn" : "Ready"}</power-mode>` } };
      if (p === "/query/apps") return { status: "success", response: { body: apps } };
      return { status: "httpError", response: { statusCode: 404 } };
    },
    showDialog: (m, t) => log.dialogs.push(t + ": " + m), showToast: m => log.toasts.push(m),
    wait() {}, openApp: p => log.opened.push(p), JSON, encodeURIComponent, String, Array, Error,
  });
  return log;
}
test("E2E: tap 49ers FOX game with TV off → power on, DirecTV tuned to KTVU, Roku app opened", () => {
  const log = runPlay(L.playLink("abc-123", byName("nfl", "KC @ SF")));
  assert.deepStrictEqual(log.posts, ["/keypress/PowerOn", "/launch/161227?contentId=" + cfg.DTV.KTVU + "&mediaType=live"]);
  assert.deepStrictEqual(log.opened, ["com.roku.remote"]);
  assert.ok(log.toasts[0].includes("KC @ SF"));
});
test("E2E: Bulls on NBC with DirecTV not installed → falls back to Peacock TV", () => {
  const noDtv = APPS_XML.replace('<app id="161227" type="appl">DIRECTV</app>', "");
  const log = runPlay(L.playLink("abc", byName("nba", "CHI @ BOS")), { tvOn: true, apps: noDtv });
  assert.deepStrictEqual(log.posts, ["/launch/593099"]);
});
test("E2E: tampered link (bad content id / unknown media type) is rejected, nothing sent", () => {
  const bad = { label: "x", options: [{ app: "DIRECTV", contentId: "../../keypress/PowerOff", mediaType: "live" },
                                      { app: "ESPN", contentId: "ok", mediaType: "hack" }] };
  const log = runPlay("http-shortcuts://id?plan=" + encodeURIComponent(JSON.stringify(bad)), { tvOn: true });
  assert.deepStrictEqual(log.posts, []);
  assert.ok(log.dialogs[0].includes("safety check"));
});
test("E2E: missing plan variable gives setup hint", () => {
  const log = runPlay(L.playLink("abc", byName("nfl", "KC @ SF")), { noVar: true });
  assert.ok(log.dialogs[0].includes('Static Variable named plan'));
});
test("TV list parsing: names, private IPs only, blank IP allowed", () => {
  const r = L.parseTvList("Home = 192.168.0.109\nParents=192.168.1.50\n\nCabin =");
  assert.deepStrictEqual(r.tvs, [{ name: "Home", ip: "192.168.0.109" }, { name: "Parents", ip: "192.168.1.50" }, { name: "Cabin", ip: "" }]);
  assert.deepStrictEqual(r.errors, []);
  assert.ok(L.parseTvList("Bad = 8.8.8.8").errors[0].includes("home-network"));
  assert.ok(L.parseTvList("just text").errors.length === 1);
  assert.strictEqual(L.formatTvList(r.tvs), "Home = 192.168.0.109\nParents = 192.168.1.50\nCabin = ");
  assert.ok(L.isPrivateIp("10.0.0.5") && L.isPrivateIp("172.20.1.1") && !L.isPrivateIp("172.32.0.1") && !L.isPrivateIp("192.168.1.300"));
});
test("E2E: Parents TV selected → commands go to the parents' Roku", () => {
  const link = L.playLink("abc", byName("nfl", "KC @ SF"), { name: "Parents", ip: "192.168.1.50" });
  const log = runPlay(link, { tvOn: true });
  assert.deepStrictEqual([...log.hosts], ["192.168.1.50:8060"]);
  assert.ok(log.toasts[0].includes("(Parents)"));
  assert.deepStrictEqual(log.posts, ["/launch/161227?contentId=" + cfg.DTV.KTVU + "&mediaType=live"]);
});
test("E2E: no TV in link → default home Roku", () => {
  const log = runPlay(L.playLink("abc", byName("nfl", "KC @ SF")), { tvOn: true });
  assert.deepStrictEqual([...log.hosts], ["192.168.0.109:8060"]);
});
test("E2E: tapping a blacked-out game still tries to play it (DirecTV app opens)", () => {
  const log = runPlay(L.playLink("abc", byName("nba", "MIA @ CHI")), { tvOn: true });
  assert.deepStrictEqual(log.posts, ["/launch/161227"]);
});
test("E2E: public/odd TV address in a tampered link is refused", () => {
  const bad = { label: "x", tv: "8.8.8.8", options: [{ app: "DIRECTV" }] };
  const log = runPlay("http-shortcuts://id?plan=" + encodeURIComponent(JSON.stringify(bad)), { tvOn: true });
  assert.strictEqual(log.hosts.size, 0);
  assert.ok(log.dialogs[0].includes("home-network"));
});

console.log(`\n${n} tests passed`);
