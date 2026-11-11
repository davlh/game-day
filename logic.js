// Pure logic shared by the app and the tests (no DOM here).
(function (root) {
  "use strict";

  function norm(s) {
    return String(s || "").toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");
  }

  // Map an ESPN network name to a key in ROUTES (or null).
  function canonicalNetwork(name, cfg) {
    const n = norm(name);
    if (!n) return null;
    for (const k in cfg.ROUTES) if (norm(k) === n) return k;
    for (const a in cfg.ALIASES) if (norm(a) === n) return cfg.ALIASES[a];
    return null;
  }

  // Networks for a game, national first, de-duplicated.
  function gameNetworks(comp, cfg) {
    const out = [];
    const seen = {};
    const add = (name, national) => {
      const k = norm(name);
      if (!k) return;
      if (seen[k]) { if (national) seen[k].national = true; return; }
      seen[k] = { name: String(name), key: canonicalNetwork(name, cfg), national: !!national };
      out.push(seen[k]);
    };
    (comp.geoBroadcasts || []).forEach(g => {
      const mkt = ((g.market || {}).type || "").toLowerCase();
      add((g.media || {}).shortName, mkt === "national");
    });
    (comp.broadcasts || []).forEach(b => {
      const national = String(b.market || "").toLowerCase() === "national";
      (b.names || []).forEach(n => add(n, national));
    });
    return out.filter(x => x.national).concat(out.filter(x => !x.national));
  }

  // Ordered list of {app, contentId?, mediaType?, network} for the Play shortcut.
  function planFor(networks, cfg) {
    const plan = [];
    const seen = {};
    networks.forEach(net => {
      const routes = net.key ? cfg.ROUTES[net.key] : null;
      (routes || []).forEach(r => {
        const sig = r.app + "|" + (r.contentId || "");
        if (seen[sig]) return;
        seen[sig] = 1;
        plan.push(Object.assign({ network: net.key || net.name }, r));
      });
    });
    if (!plan.length) {
      cfg.FALLBACK.forEach(r => plan.push(Object.assign({ network: (networks[0] || {}).name || "" }, r)));
    }
    return plan;
  }

  function planLabel(plan) {
    const p = plan[0];
    if (!p) return "";
    return p.contentId ? p.app + " · " + p.network : p.app;
  }

  function isFavorite(team, league, cfg) {
    if (!team) return false;
    return cfg.FAVORITES.some(f => f.league === league &&
      ((f.id && String(team.id) === String(f.id)) || (f.abbr && team.abbr === f.abbr)));
  }

  function parseTeam(c) {
    const t = c.team || {};
    const rank = ((c.curatedRank || {}).current) || 99;
    return {
      id: t.id, abbr: t.abbreviation || "?", name: t.displayName || t.name || "",
      short: t.shortDisplayName || t.name || t.abbreviation || "",
      logo: t.logo || "", color: t.color || "", score: c.score,
      rank: rank && rank <= 25 ? rank : null,
      record: ((c.records || [])[0] || {}).summary || "",
      winner: !!c.winner,
    };
  }

  function parseEvent(ev, league, cfg) {
    const comp = (ev.competitions || [])[0] || {};
    const side = {};
    (comp.competitors || []).forEach(c => { side[c.homeAway] = parseTeam(c); });
    const st = (ev.status || comp.status || {}).type || {};
    const networks = gameNetworks(comp, cfg);
    const plan = planFor(networks, cfg);
    const away = side.away || parseTeam({});
    const home = side.home || parseTeam({});
    return {
      id: String(ev.id), league, date: ev.date, name: ev.shortName || ev.name || "",
      state: st.state || "pre", detail: st.shortDetail || st.detail || "", completed: !!st.completed,
      away, home, networks, plan, label: planLabel(plan),
      favorite: isFavorite(away, league, cfg) || isFavorite(home, league, cfg),
      ranked: !!(away.rank || home.rank),
      national: networks.some(n => n.national && n.key),
      onTv: plan.some(p => p.contentId),   // on a real TV channel you get (has a DirecTV channel)
      neutral: !!comp.neutralSite,
    };
  }

  // For the college "Featured" view: favorites, ranked teams, games on a TV channel you get.
  function isFeatured(g) { return g.favorite || g.ranked || g.onTv; }

  // Sort: favorites, then live, then upcoming by time, then finals.
  function sortGames(games) {
    const rank = g => (g.state === "in" ? 0 : g.state === "pre" ? 1 : 2);
    return games.slice().sort((a, b) =>
      (b.favorite - a.favorite) || (rank(a) - rank(b)) || (Date.parse(a.date) - Date.parse(b.date)));
  }

  function ymd(d) {
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  }

  function scoreboardUrl(leagueCfg, startDate, endDate) {
    const q = [];
    if (leagueCfg.params) q.push(leagueCfg.params);
    q.push("dates=" + ymd(startDate) + (endDate ? "-" + ymd(endDate) : ""));
    return "https://site.api.espn.com/apis/site/v2/sports/" + leagueCfg.path + "/scoreboard?" + q.join("&");
  }

  // Accepts a bare shortcut ID or a full http-shortcuts:// link.
  function extractShortcutId(text) {
    const s = String(text || "").trim();
    const m = /^http-shortcuts:\/\/([^/?#]+)/i.exec(s);
    const id = m ? m[1] : s;
    return /^[A-Za-z0-9._-]{1,64}$/.test(id) ? id : "";
  }

  // Home-network IPv4 only (10.x, 172.16–31.x, 192.168.x).
  function isPrivateIp(ip) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || "").trim());
    if (!m) return false;
    const o = m.slice(1).map(Number);
    if (o.some(x => x > 255)) return false;
    return o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168);
  }

  // "Home = 192.168.0.109" lines ⇄ [{name, ip}]
  function parseTvList(text) {
    const tvs = [], errors = [];
    String(text || "").split(/\n/).forEach((line, i) => {
      const s = line.trim();
      if (!s) return;
      const m = /^(.{1,24}?)\s*[=:]\s*(\S*)$/.exec(s);
      if (!m) { errors.push("Line " + (i + 1) + ': use "Name = IP"'); return; }
      const name = m[1].trim(), ip = m[2].trim();
      if (!/^[A-Za-z0-9 '’.&_-]{1,24}$/.test(name)) { errors.push("Line " + (i + 1) + ": name can only use letters, numbers and spaces"); return; }
      if (ip && !isPrivateIp(ip)) { errors.push("Line " + (i + 1) + ": " + ip + " isn't a home-network address (e.g. 192.168.1.50)"); return; }
      tvs.push({ name, ip });
    });
    return { tvs, errors };
  }
  function formatTvList(tvs) { return (tvs || []).map(t => t.name + " = " + (t.ip || "")).join("\n"); }

  function playLink(shortcutId, game, tv) {
    const payload = {
      label: game.away.abbr + " @ " + game.home.abbr,
      tv: tv && tv.ip ? tv.ip : undefined,
      tvName: tv && tv.ip ? tv.name : undefined,
      options: game.plan.map(p => {
        const o = { app: p.app };
        if (p.contentId) { o.contentId = p.contentId; o.mediaType = p.mediaType || "live"; }
        return o;
      }),
    };
    return "http-shortcuts://" + shortcutId + "?plan=" + encodeURIComponent(JSON.stringify(payload));
  }

  const api = { norm, canonicalNetwork, gameNetworks, planFor, planLabel, isFavorite, parseEvent,
                isFeatured, sortGames, ymd, scoreboardUrl, extractShortcutId, playLink,
                isPrivateIp, parseTvList, formatTvList };
  if (typeof module !== "undefined") module.exports = api;
  else root.GameDayLogic = api;
})(this);
