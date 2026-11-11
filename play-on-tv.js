// =====================================================================
//  "Play on TV" — HTTP Shortcuts script used by the Game Day web app.
//  Game Day opens  http-shortcuts://<this shortcut's ID>?plan=<JSON>
//  and this script turns the TV on and opens the right app/channel.
//
//  Setup: create a GLOBAL variable of type "Static Variable" named  plan
//  (Variables screen → +). The link fills it in for each tap.
// =====================================================================

// Used only if the app doesn't send a TV (the app's 📺 picker normally does).
const DEFAULT_ROKU_IP = "192.168.0.109";
const OPEN_PHONE_REMOTE_APP = "com.roku.remote"; // "" to turn off

// Safety limits: the web page can only ask for these things.
const MAX_OPTIONS = 8;
const ALLOWED_MEDIA_TYPES = ["live", "livefeed", "sportsevent", "special", "episode", "movie", "series"];
const SAFE_TEXT = /^[A-Za-z0-9 .:+&'@_-]{1,40}$/;  // app names, labels
const SAFE_ID = /^[A-Za-z0-9._:|-]{1,128}$/;        // content IDs

let ROKU_IP = DEFAULT_ROKU_IP;
let ROKU = "http://" + ROKU_IP + ":8060";

// Home-network IPv4 only (10.x, 172.16–31.x, 192.168.x).
function isPrivateIp(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || ""));
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some(x => x > 255)) return false;
  return o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168);
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");
}

function roku(method, path) {
  const opts = { method: method };
  if (method === "POST") opts.body = "";
  const res = sendHttpRequest(ROKU + path, opts);
  if (res.status === "success") return res.response.body;
  const why = res.status === "httpError" ? "HTTP " + res.response.statusCode : res.networkError;
  throw new Error("Roku " + method + " " + path + " failed: " + why);
}

function powerMode() {
  const m = /<power-mode>([^<]*)<\/power-mode>/.exec(roku("GET", "/query/device-info"));
  return m ? m[1] : "";
}

function installedApps() {
  const xml = roku("GET", "/query/apps");
  const apps = [];
  const re = /<app\s+id="([^"]+)"[^>]*>([^<]*)<\/app>/g;
  let m;
  while ((m = re.exec(xml))) {
    apps.push({ id: m[1], name: m[2].replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim() });
  }
  return apps;
}

function findApp(apps, wanted) {
  const w = norm(wanted);
  return apps.find(a => norm(a.name) === w)
      || apps.find(a => norm(a.name).startsWith(w))
      || apps.find(a => norm(a.name).includes(w))
      || null;
}

function ensureOn() {
  if (powerMode() === "PowerOn") return;
  roku("POST", "/keypress/PowerOn");
  for (let i = 0; i < 20; i++) {
    wait(500);
    try { if (powerMode() === "PowerOn") break; } catch (e) { /* waking up */ }
  }
  wait(1500);
}

// Read and validate what the web page sent.
function readPlan() {
  let raw;
  try { raw = getVariable("plan"); } catch (e) {
    throw new Error('Missing global variable "plan". Create a Static Variable named plan.');
  }
  let p;
  try { p = JSON.parse(raw); } catch (e) { throw new Error("Open this from the Game Day app."); }
  if (!p || !Array.isArray(p.options) || !p.options.length) throw new Error("No game was sent.");
  const label = typeof p.label === "string" && SAFE_TEXT.test(p.label) ? p.label : "game";
  const options = p.options.slice(0, MAX_OPTIONS).filter(o =>
    o && typeof o.app === "string" && SAFE_TEXT.test(o.app) &&
    (o.contentId === undefined || (typeof o.contentId === "string" && SAFE_ID.test(o.contentId))) &&
    (o.mediaType === undefined || ALLOWED_MEDIA_TYPES.indexOf(o.mediaType) !== -1));
  if (!options.length) throw new Error("The game info didn't pass the safety check.");
  if (p.tv !== undefined && !isPrivateIp(p.tv)) throw new Error("The TV address isn't a home-network address.");
  const tvName = typeof p.tvName === "string" && SAFE_TEXT.test(p.tvName) ? p.tvName : "TV";
  return { label: label, options: options, tv: p.tv || DEFAULT_ROKU_IP, tvName: tvName };
}

function main() {
  const plan = readPlan();
  ROKU_IP = plan.tv;
  ROKU = "http://" + ROKU_IP + ":8060";
  try { roku("GET", "/query/device-info"); } catch (e) {
    showDialog("Can't reach the <b>" + plan.tvName + "</b> Roku at <b>" + ROKU_IP + "</b>. Is your phone on that Wi-Fi, and is the TV picker in Game Day set right?<br><br><b>Details:</b> " +
               String(e.message).replace(/</g, "&lt;"), "TV not found");
    return;
  }
  const apps = installedApps();
  let choice = null, app = null;
  for (const o of plan.options) {
    app = findApp(apps, o.app);
    if (app) { choice = o; break; }
  }
  if (!choice) {
    showDialog("None of these apps are installed on the TV: " +
               plan.options.map(o => o.app).join(", ").replace(/</g, "&lt;"), "No app for this game");
    return;
  }
  showToast("▶ " + plan.label + " on " + app.name + " (" + plan.tvName + ")");
  ensureOn();
  let query = "";
  if (choice.contentId) {
    query = "?contentId=" + encodeURIComponent(choice.contentId) +
            "&mediaType=" + encodeURIComponent(choice.mediaType || "live");
  }
  roku("POST", "/launch/" + encodeURIComponent(app.id) + query);
  if (OPEN_PHONE_REMOTE_APP) {
    try { openApp(OPEN_PHONE_REMOTE_APP); } catch (e) { /* not installed */ }
  }
}

try {
  main();
} catch (e) {
  showDialog(String(e && e.message || e).replace(/</g, "&lt;"), "Something went wrong");
}
