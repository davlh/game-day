(function () {
  "use strict";
  const cfg = GAME_DAY_CONFIG;
  const L = GameDayLogic;
  const $ = s => document.querySelector(s);

  const STORE_KEY = "gameday.settings.v1";
  const settings = Object.assign({ shortcutId: "", tab: "mine", collegeAll: false, hideBlackout: false, tvIndex: 0 }, readStore());
  if (!Array.isArray(settings.tvs) || !settings.tvs.length) settings.tvs = (cfg.TVS || []).map(t => Object.assign({}, t));
  if (!(settings.tvIndex < settings.tvs.length)) settings.tvIndex = 0;
  const currentTv = () => settings.tvs[settings.tvIndex] || { name: "TV", ip: "" };
  const state = { tab: settings.tab, dayOffset: 0, loading: false, error: "", games: [], lastLoaded: 0 };

  function readStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; } }
  function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  // ---------- data ----------
  const cache = {};
  async function getJson(url) {
    const hit = cache[url];
    if (hit && Date.now() - hit.t < 30000) return hit.data;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("ESPN returned " + res.status);
    const data = await res.json();
    cache[url] = { t: Date.now(), data };
    return data;
  }

  function dayAt(offset) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; }
  function sameLocalDay(iso, d) { const x = new Date(iso); return x.toDateString() === d.toDateString(); }

  async function loadLeagueDay(league, offset) {
    const d = dayAt(offset);
    const data = await getJson(L.scoreboardUrl(cfg.LEAGUES[league], d));
    return (data.events || []).map(ev => L.parseEvent(ev, league, cfg));
  }

  async function loadMyTeams() {
    const leagues = Array.from(new Set(cfg.FAVORITES.map(f => f.league)));
    const start = dayAt(-1), end = dayAt(7);
    const results = await Promise.all(leagues.map(async league => {
      try {
        const data = await getJson(L.scoreboardUrl(cfg.LEAGUES[league], start, end));
        return (data.events || []).map(ev => L.parseEvent(ev, league, cfg));
      } catch (e) {
        // Fallback if date ranges aren't accepted: today + next 2 days.
        const days = await Promise.all([0, 1, 2].map(o => loadLeagueDay(league, o).catch(() => [])));
        return [].concat.apply([], days);
      }
    }));
    const all = [].concat.apply([], results).filter(g => g.favorite);
    const cutoff = Date.now() - 12 * 3600 * 1000;
    return all.filter(g => g.state !== "post" || Date.parse(g.date) > cutoff);
  }

  async function load() {
    state.loading = true; state.error = ""; render();
    try {
      state.games = state.tab === "mine" ? await loadMyTeams() : await loadLeagueDay(state.tab, state.dayOffset);
      state.lastLoaded = Date.now();
    } catch (e) {
      state.error = "Couldn't load games (" + (e.message || e) + "). Pull to retry.";
      state.games = [];
    }
    state.loading = false; render();
  }

  // ---------- formatting ----------
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function timeStr(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function dayLabel(d, offset) {
    if (offset === 0) return "Today";
    if (offset === 1) return "Tmrw";
    if (offset === -1) return "Yday";
    return DAYS[d.getDay()] + " " + d.getDate();
  }
  function longDay(iso) {
    const d = new Date(iso), today = dayAt(0), tmrw = dayAt(1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tmrw.toDateString()) return "Tomorrow";
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- rendering ----------
  function teamRow(t, g) {
    const showScore = g.state !== "pre";
    const lost = g.state === "post" && !t.winner;
    return `<div class="team${lost ? " lost" : ""}">
      ${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy">` : `<span class="logo-ph"></span>`}
      <span class="tname">${t.rank ? `<span class="rank">${t.rank}</span>` : ""}${esc(t.short)}</span>
      <span class="rec">${esc(t.record)}</span>
      ${showScore ? `<span class="score">${esc(t.score)}</span>` : ""}
    </div>`;
  }

  function card(g, idx) {
    const status = g.state === "in" ? `<span class="live">LIVE</span> ${esc(g.detail)}`
                 : g.state === "post" ? esc(g.detail || "Final")
                 : esc(timeStr(g.date));
    const nets = g.networks.map(n => esc(n.name)).join(" · ") || "TBD";
    const leagueTag = state.tab === "mine" ? `<span class="ltag">${esc(cfg.LEAGUES[g.league].label)}</span>` : "";
    const blocked = g.access.status === "blackout";
    return `<button class="card${g.favorite ? " fav" : ""}${g.state === "in" ? " is-live" : ""}${blocked ? " blocked" : ""}" data-idx="${idx}">
      <div class="status">${leagueTag}${status}${g.favorite ? '<span class="star" aria-label="favorite">★</span>' : ""}</div>
      ${teamRow(g.away, g)}${teamRow(g.home, g)}
      <div class="where"><span class="nets">${nets}</span><span class="target">▶ ${esc(g.label)}</span></div>
      ${blocked ? `<div class="why">Likely blacked out here · ${esc(g.access.reason)}</div>` : ""}
    </button>`;
  }

  // Blacked-out games the "Hide blacked out" chip would hide (favorites are always shown).
  const hideable = g => !g.favorite && g.access.status === "blackout";

  function visibleGames() {
    let games = state.games;
    if (state.tab !== "mine" && cfg.LEAGUES[state.tab].college && !settings.collegeAll) {
      games = games.filter(L.isFeatured);
    }
    if (state.tab !== "mine" && settings.hideBlackout) games = games.filter(g => !hideable(g));
    return state.tab === "mine"
      ? games.slice().sort((a, b) => ((a.state === "in" ? 0 : 1) - (b.state === "in" ? 0 : 1)) || (Date.parse(a.date) - Date.parse(b.date)))
      : L.sortGames(games);
  }

  function renderTvPicker() {
    const sel = $("#tv");
    sel.innerHTML = settings.tvs.map((t, i) =>
      `<option value="${i}"${i === settings.tvIndex ? " selected" : ""}>📺 ${esc(t.name)}${t.ip ? "" : " (set up)"}</option>`).join("");
  }

  function render() {
    renderTvPicker();
    // tabs
    const tabs = [["mine", "My Teams"]].concat(Object.keys(cfg.LEAGUES).map(k => [k, cfg.LEAGUES[k].label]));
    $("#tabs").innerHTML = tabs.map(([k, label]) =>
      `<button class="tab${state.tab === k ? " on" : ""}" data-tab="${k}">${label}</button>`).join("");

    // day strip / filters
    const isLeague = state.tab !== "mine";
    let sub = "";
    if (isLeague) {
      sub += `<div class="days">` + [-1, 0, 1, 2, 3, 4, 5, 6].map(o =>
        `<button class="day${state.dayOffset === o ? " on" : ""}" data-day="${o}">${dayLabel(dayAt(o), o)}</button>`).join("") + `</div>`;
      const college = cfg.LEAGUES[state.tab].college;
      const pool = college && !settings.collegeAll ? state.games.filter(L.isFeatured) : state.games;
      const nBlack = pool.filter(hideable).length;
      sub += `<div class="filter">`;
      if (college) {
        sub += `<button class="chip${!settings.collegeAll ? " on" : ""}" data-college="0">Top 25 · TV · Faves</button>` +
               `<button class="chip${settings.collegeAll ? " on" : ""}" data-college="1">All games</button>`;
      }
      sub += `<button class="chip${settings.hideBlackout ? " on" : ""}" data-hideblk>Hide blacked out${nBlack ? " (" + nBlack + ")" : ""}</button></div>`;
    }
    $("#sub").innerHTML = sub;

    // list
    const list = $("#list");
    if (!settings.shortcutId) {
      list.innerHTML = `<div class="notice">Finish setup: add your <b>Play on TV</b> shortcut ID in <a href="#" data-open-settings>Settings</a>.</div>`;
    } else list.innerHTML = "";
    if (state.loading && !state.games.length) { list.innerHTML += `<div class="empty">Loading games…</div>`; return; }
    if (state.error) { list.innerHTML += `<div class="empty err">${esc(state.error)}</div>`; return; }

    const games = visibleGames();
    state.shown = games;
    if (!games.length) {
      list.innerHTML += `<div class="empty">${state.tab === "mine" ? "No games for your teams this week." : "No games."}</div>`;
      return;
    }
    let html = "", lastGroup = null;
    games.forEach((g, i) => {
      const group = state.tab === "mine" ? (g.state === "in" ? "Live now" : longDay(g.date))
                  : (g.favorite ? "Your teams" : g.state === "in" ? "Live now" : g.state === "pre" ? "Upcoming" : "Final");
      if (group !== lastGroup) { html += `<h2>${esc(group)}</h2>`; lastGroup = group; }
      html += card(g, i);
    });
    list.innerHTML += html;
    $("#updated").textContent = state.lastLoaded ? "Updated " + timeStr(new Date(state.lastLoaded).toISOString()) : "";
  }

  // ---------- actions ----------
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2500);
  }

  function play(g) {
    const tv = currentTv();
    if (!settings.shortcutId) { openSettings(); return; }
    if (!tv.ip) { openSettings("Add the Roku address for “" + tv.name + "” first."); return; }
    toast((g.access.status === "blackout" ? "Trying anyway: " : "Sending ") + g.away.abbr + " @ " + g.home.abbr + " to " + tv.name + " → " + g.label);
    window.location.href = L.playLink(settings.shortcutId, g, tv);
  }

  function openSettings(note) {
    $("#sid").value = settings.shortcutId;
    $("#tvlist").value = L.formatTvList(settings.tvs);
    $("#sid-err").textContent = typeof note === "string" ? note : "";
    $("#settings").showModal();
  }

  document.addEventListener("click", e => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { state.tab = tab.dataset.tab; settings.tab = state.tab; saveStore(); state.games = []; load(); return; }
    const day = e.target.closest("[data-day]");
    if (day) { state.dayOffset = parseInt(day.dataset.day, 10); state.games = []; load(); return; }
    const col = e.target.closest("[data-college]");
    if (col) { settings.collegeAll = col.dataset.college === "1"; saveStore(); render(); return; }
    if (e.target.closest("[data-hideblk]")) { settings.hideBlackout = !settings.hideBlackout; saveStore(); render(); return; }
    const c = e.target.closest(".card");
    if (c) { play(state.shown[parseInt(c.dataset.idx, 10)]); return; }
    if (e.target.closest("[data-open-settings]")) { e.preventDefault(); openSettings(); }
  });

  $("#gear").addEventListener("click", openSettings);
  $("#refresh").addEventListener("click", () => { Object.keys(cache).forEach(k => delete cache[k]); load(); });
  $("#save").addEventListener("click", e => {
    e.preventDefault();
    const id = L.extractShortcutId($("#sid").value);
    if (!id && $("#sid").value.trim()) { $("#sid-err").textContent = "That doesn't look like a shortcut ID or link."; return; }
    const parsed = L.parseTvList($("#tvlist").value);
    if (parsed.errors.length) { $("#sid-err").textContent = parsed.errors[0]; return; }
    if (!parsed.tvs.length) { $("#sid-err").textContent = "Add at least one TV."; return; }
    const prevName = currentTv().name;
    settings.tvs = parsed.tvs;
    const keep = settings.tvs.findIndex(t => t.name === prevName);
    settings.tvIndex = keep >= 0 ? keep : 0;
    settings.shortcutId = id; saveStore(); $("#sid-err").textContent = ""; $("#settings").close(); render();
  });
  $("#tv").addEventListener("change", e => {
    settings.tvIndex = parseInt(e.target.value, 10) || 0; saveStore(); renderTvPicker();
    const tv = currentTv();
    if (!tv.ip) openSettings("Add the Roku address for “" + tv.name + "”.");
    else toast("Games will play on " + tv.name);
  });
  $("#close").addEventListener("click", e => { e.preventDefault(); $("#settings").close(); });

  // Auto-refresh while open (live scores).
  setInterval(() => { if (!document.hidden && !state.loading) load(); }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - state.lastLoaded > 30000) load();
  });

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  load();
})();
