// =====================================================================
//  Game Day config — edit this file to change teams, leagues, and where
//  each network plays on your Roku.
// =====================================================================

const DIRECTV = "DIRECTV";

// DirecTV channel IDs (from your DirecTV guide, Bay Area market, HD feeds).
// A route with a DirecTV channel ID tunes straight to that channel.
const DTV = {
  KTVU:  "26708c87-dfaa-453c-bceb-a165b1b90087", // 2   FOX (KTVU)
  KPIX:  "2b45510f-62d1-473c-90da-7a6f968132e1", // 5   CBS (KPIX)
  KGO:   "05cf8bea-a1c4-4f97-b1b8-6c67b4383588", // 7   ABC (KGO)
  KNTV:  "53d381bd-ed74-49ed-9602-fd73f1845b3e", // 11  NBC (KNTV)
  ESPN:  "d1f76753-8507-4df5-bdeb-77ce20690d9d", // 206
  ESPNEWS:"c7385ebe-0068-4c7a-8c84-2146862d2694", // 207
  ESPNU: "78a8f90a-df4f-4fcf-be56-df27539c5ac4", // 208
  ESPN2: "fa09c7bf-b0bd-4976-9bab-c7e2c5021ade", // 209
  NFLRZ: "1f16d48c-530d-446f-a759-2d7c7a8a527a", // 211 NFL RedZone
  NFLN:  "b9b1b688-8d78-4580-8913-e98fe3bd9b05", // 212 NFL Network
  NBATV: "10627bc1-89a2-4c00-bf92-8851d96e1b98", // 216 NBA TV
  FS1:   "f86aec47-ea18-4de2-8f67-38384c91102a", // 219
  CBSSN: "2945210e-6289-4402-be3a-6704b027ec50", // 221 CBS Sports Network
  TNT:   "fb089f4f-0b1a-481c-adb1-d624884f51f2", // 245 TNT West
  TRUTV: "1b10de5e-3e3b-488f-9740-bec197244114", // 246
  TBS:   "385801f7-606a-457d-8116-e1a73cf77484", // 247 TBS West
  BTN:   "9a1380bd-3201-4fdd-a46e-c71a0453c87a", // 610 Big Ten Network
  ACCN:  "4adb6040-f730-4e88-be8c-742a12943915", // 612 ACC Network
  FS2:   "c710ec79-d8e0-4100-ae61-ab296cbb1fc0", // 618
  NBCSBA:"b0b06816-dd9f-41be-8004-4b2c39065d19", // 696 NBC Sports Bay Area (Warriors)
  NBCSCA:"1d6aba71-5282-4f56-8acf-2a2aff938b0f", // 698 NBC Sports California
};

const dtv = id => ({ app: DIRECTV, contentId: id, mediaType: "live" });
const app = name => ({ app: name });

// Network (as ESPN names it) → Roku apps to try, in order. The "Play on TV"
// shortcut uses the first one installed on your TV.
const ROUTES = {
  "FOX":         [dtv(DTV.KTVU), app("FOX One"), app("FOX Sports")],
  "CBS":         [dtv(DTV.KPIX), app("Paramount+")],
  "ABC":         [dtv(DTV.KGO), app("ESPN")],
  "NBC":         [dtv(DTV.KNTV), app("Peacock")],
  "ESPN":        [dtv(DTV.ESPN), app("ESPN")],
  "ESPN2":       [dtv(DTV.ESPN2), app("ESPN")],
  "ESPNU":       [dtv(DTV.ESPNU), app("ESPN")],
  "ESPNEWS":     [dtv(DTV.ESPNEWS), app("ESPN")],
  "FS1":         [dtv(DTV.FS1), app("FOX One"), app("FOX Sports")],
  "FS2":         [dtv(DTV.FS2), app("FOX One"), app("FOX Sports")],
  "NFL Net":     [dtv(DTV.NFLN), app("NFL")],
  "NFL RedZone": [dtv(DTV.NFLRZ), app("NFL")],
  "NBA TV":      [dtv(DTV.NBATV), app("NBA")],
  "CBSSN":       [dtv(DTV.CBSSN), app("Paramount+")],
  "TNT":         [dtv(DTV.TNT), app("HBO Max")],
  "TBS":         [dtv(DTV.TBS), app("HBO Max")],
  "truTV":       [dtv(DTV.TRUTV), app("HBO Max")],
  "BTN":         [dtv(DTV.BTN), app("FOX One")],
  "ACCN":        [dtv(DTV.ACCN), app("ESPN")],
  "NBCS-BA":     [dtv(DTV.NBCSBA), app("NBC Sports")],
  "NBCS-CA":     [dtv(DTV.NBCSCA), app("NBC Sports")],
  "SECN":        [app("ESPN"), app(DIRECTV)],
  "ACCNX":       [app("ESPN")],
  "SECN+":       [app("ESPN")],
  "ESPN+":       [app("ESPN")],
  "ESPN Unlmtd": [app("ESPN")],
  "Peacock":     [app("Peacock")],
  "Prime Video": [app("Prime Video")],
  "Netflix":     [app("Netflix")],
  "YouTube":     [app("YouTube")],
  "Paramount+":  [app("Paramount+")],
  "HBO Max":     [app("HBO Max")],
  "NBA League Pass": [app("NBA")],
};

// Other names ESPN uses for the same networks.
const ALIASES = {
  "NFL Network": "NFL Net", "NFLN": "NFL Net",
  "CBS Sports Network": "CBSSN", "CBS Sports Net": "CBSSN",
  "Big Ten Network": "BTN", "B1G Network": "BTN",
  "ACC Network": "ACCN", "ACC Network Extra": "ACCNX",
  "SEC Network": "SECN", "SEC Network+": "SECN+",
  "NBC Sports Bay Area": "NBCS-BA", "NBCSBA": "NBCS-BA", "NBCS Bay Area": "NBCS-BA",
  "NBC Sports California": "NBCS-CA", "NBCSCA": "NBCS-CA",
  "Amazon Prime Video": "Prime Video", "Prime": "Prime Video",
  "ESPN Unlimited": "ESPN Unlmtd", "Max": "HBO Max",
};

// Used when a game's network isn't listed above (e.g. a local station).
const FALLBACK = [app(DIRECTV)];

// Favorite teams: pinned at the top and collected on the "My Teams" tab.
// id = ESPN team id; abbr is a backup match.
const FAVORITES = [
  { league: "nfl", id: "25", abbr: "SF",   name: "49ers" },
  { league: "nfl", id: "3",  abbr: "CHI",  name: "Bears" },
  { league: "nba", id: "9",  abbr: "GS",   name: "Warriors" },
  { league: "nba", id: "4",  abbr: "CHI",  name: "Bulls" },
  { league: "cfb", id: "24", abbr: "STAN", name: "Stanford" },
  { league: "cbb", id: "24", abbr: "STAN", name: "Stanford" },
];

// Your TV market, used only to mark games that are probably blacked out here.
// It never stops a game from playing.
//  networks: regional sports networks you get (a local broadcast on these is watchable)
//  teams:    home-market teams (their local broadcasts are watchable), by ESPN abbreviation
const HOME_MARKET = {
  name: "Bay Area",
  networks: ["NBCS-BA", "NBCS-CA"],
  teams: {
    nfl: ["SF"],
    nba: ["GS"],
    cfb: ["STAN", "CAL", "SJSU"],
    cbb: ["STAN", "CAL", "SJSU", "SCU", "SMC", "USF"],
  },
};

// TVs you can send games to (pick one in the app's header). These are just the
// starting list — you can edit names/addresses in the app under ⚙ Settings.
// Roku IP: Roku Settings → Network → About. Leave ip "" until you know it.
const TVS = [
  { name: "Home",    ip: "192.168.0.109" },
  { name: "Parents", ip: "" },
];

const LEAGUES = {
  nfl: { label: "NFL", path: "football/nfl",                       params: "", college: false },
  nba: { label: "NBA", path: "basketball/nba",                     params: "", college: false },
  cfb: { label: "CFB", path: "football/college-football",          params: "groups=80&limit=400", college: true },
  cbb: { label: "CBB", path: "basketball/mens-college-basketball", params: "groups=50&limit=500", college: true },
};

const GAME_DAY_CONFIG = { DTV, ROUTES, ALIASES, FALLBACK, FAVORITES, LEAGUES, TVS, HOME_MARKET };
if (typeof module !== "undefined") module.exports = GAME_DAY_CONFIG;
