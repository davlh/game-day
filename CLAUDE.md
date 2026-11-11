# Game Day — project notes for Claude Code

Tap a game on an Android phone and it plays on a Roku TV. A static PWA (no build step) that
lists NFL / NBA / college football / college basketball games and hands each tap off to the
**HTTP Shortcuts** Android app, which controls the Roku over the home network.

Live site: https://davlh.github.io/game-day/ (GitHub Pages, `main` branch, repo root).
**Deploying = `git push`.** Pages republishes in ~1 minute.

## How it fits together

```
Game Day PWA (phone, Chrome)                      ← this repo
  └─ tap → http-shortcuts://<Play on TV id>?plan=<JSON>
       └─ HTTP Shortcuts "Play on TV" script       ← play-on-tv.js (pasted into the app by hand)
            └─ Roku ECP, http://<tv-ip>:8060      ← power on → /launch/<appId>?contentId=…&mediaType=…
```

A browser page can't call the Roku directly. The Roku is plain HTTP on the LAN, so an HTTPS page
runs into mixed content, missing CORS headers and Chrome's local-network blocking. That's why the
handoff goes through HTTP Shortcuts, which is a native app.

## Files

| File | Role |
|---|---|
| `index.html` | Markup + all CSS. Header has the 📺 TV picker, ⟳, ⚙; settings `<dialog>` |
| `app.js` | UI: tabs, day strip, college filter, cards, settings (shortcut ID + TV list in localStorage `gameday.settings.v1`), auto-refresh every 60s |
| `logic.js` | Pure functions (no DOM), shared by app + tests: parse ESPN events, network → route plan, favorites, sorting, `playLink`, TV-list parsing/validation |
| `config.js` | **User-editable data:** DirecTV channel IDs (`DTV`), `ROUTES` (network → ordered apps), `ALIASES`, `FALLBACK`, `FAVORITES`, `TVS` (default list), `LEAGUES` |
| `play-on-tv.js` | HTTP Shortcuts script. **Not loaded by the web page.** The owner pastes it into the app by hand |
| `sw.js` | Service worker, network-first for same-origin files, never caches ESPN |
| `manifest.webmanifest`, `icons/` | PWA install metadata |
| `tests/test.js` | Node tests (no deps): logic + end-to-end "link → Play on TV script → simulated Roku" |
| `tests/screenshot.mjs` | Playwright: renders each tab at phone size with fixture data → `tests/screenshots/` |
| `tools/roku.sh` | Poke the real Roku from this Mac (same Wi-Fi): list apps, launch with deep links, press keys |

## Commands

```bash
npm test                         # always run before pushing (no install needed)
npm install && npx playwright install chromium   # once, for screenshots
npm run shots                    # fixture data; look at tests/screenshots/*.png
npm run shots -- --live          # real ESPN data
npm run serve                    # http://localhost:8000 (SW only registers on https)
tools/roku.sh apps               # real TV: installed apps + IDs
tools/roku.sh launch 161227 <directv-channel-id> live   # try a deep link
```

After any UI change, run `npm run shots` and **look at the PNGs** before pushing.

## Data: ESPN (unofficial, no key)
`https://site.api.espn.com/apis/site/v2/sports/<path>/scoreboard?dates=YYYYMMDD[-YYYYMMDD]`
- Paths: `football/nfl`, `basketball/nba`, `football/college-football` (+`groups=80` = all FBS),
  `basketball/mens-college-basketball` (+`groups=50` = all D1). See `LEAGUES` in config.js.
- Networks come from `competitions[0].geoBroadcasts[].media.shortName` (with `market.type`
  National/Home/Away) and `competitions[0].broadcasts[].names`. ESPN's naming is inconsistent,
  so add new spellings to `ALIASES` instead of renaming `ROUTES` keys.
- Loading it from the browser works (confirmed on the phone).
- The My Teams tab requests a date range (`dates=A-B`). There's a fallback to single days if that
  fails, and range support isn't verified against live data yet.

## Routing model
`ROUTES[network]` = ordered list of `{app, contentId?, mediaType?}`. `planFor()` concatenates routes
for all of a game's networks (national first) and de-duplicates them. Play on TV launches the
**first app actually installed** on the selected TV. Unknown networks → `FALLBACK` (DirecTV app).

### DirecTV deep links (verified working)
- Roku app name `DIRECTV`, Roku app id `161227` on the home TV.
- `launch/161227?contentId=<channel resourceId>&mediaType=live` tunes straight to the channel.
- Channel IDs come from the DirecTV web player's channel list:
  `api.cld.dtvce.com/discovery/metadata/channel/v5/service/allchannels` → `channelInfoList[].resourceId`
  (use the HD entry where `augmentation.constraints.isLiveStreamEnabled` is true).
  IDs are for the SF Bay Area market (DMA 807). The owner's parents are in the same market, so the same IDs work there.
- **Never commit HAR files.** They contain login session tokens (`*.har` is in .gitignore).

### Other apps
FOX One, Prime Video, Peacock etc. open to their home screen. Per-game deep links for those are
unknown. Roku supports `mediaType=sportsevent|livefeed` and apps choose their own `contentId`s.
Ideas not tried yet: capture what the official Roku phone app sends (PCAPdroid), or IDs from the
apps' web URLs. Test candidates with `tools/roku.sh launch`.

## Play on TV contract (`play-on-tv.js`)
- Requires a **global Static Variable named `plan`** in HTTP Shortcuts. The deep link's `?plan=`
  fills it for one run.
- `plan` JSON: `{ label, tv?, tvName?, options: [{ app, contentId?, mediaType? }, …] }`
- **Security validation is deliberate. Keep it or tighten it, never loosen it:**
  - `tv` must be a private IPv4 (10/8, 172.16/12, 192.168/16). Otherwise refuse.
  - `app`/`label`/`tvName` must match `SAFE_TEXT`. `contentId` must match `SAFE_ID`. `mediaType` must be in `ALLOWED_MEDIA_TYPES`. Max 8 options.
  - The script only ever does: query device-info/apps, keypress `PowerOn`, `launch`, and open the Roku phone app (`com.roku.remote`).
- The site is **public**, so treat the `plan` param as untrusted input.
- If you change `play-on-tv.js`, tell the owner to **re-paste it into HTTP Shortcuts**. Pushing doesn't update the phone copy.
- HTTP Shortcuts scripting API used: `sendHttpRequest`, `getVariable`, `showDialog`, `showToast`, `wait`, `openApp`. Docs: https://http-shortcuts.rmy.ch/scripting

## Environment facts
- Phone: Android, Chrome, HTTP Shortcuts (`ch.rmy.android.http_shortcuts`, by Waboodoo). It needed the
  Android **Nearby devices** permission to reach the TV.
- Home TV: Hisense Roku TV at `192.168.0.109` (DHCP reservation in a TP-Link router). Needs **Fast TV start** on
  (so PowerOn works from standby) and **Control by mobile apps** allowed.
- TV list is editable in the app (⚙ → TVs, `Name = IP` per line). `config.js` `TVS` is just the default.
- The owner subscribes to DirecTV. Favorites: 49ers, Bears, Warriors, Bulls, Stanford (football and basketball).

## Conventions
- Plain ES2017+ JavaScript, no framework, no bundler, no dependencies at runtime.
- `logic.js` stays DOM-free and testable in Node. Add tests in `tests/test.js` for new logic.
- Keep the UI phone-first (412px wide), dark theme, CSS variables at the top of `index.html`.
- When you add or rename a file the app shell needs, update `SHELL` in `sw.js` and bump `CACHE` (`gameday-vN`).
- No secrets, tokens or personal info in the repo. It's public.

## Ideas / backlog
- Auto-pick the TV by Wi-Fi network name (HTTP Shortcuts may expose the SSID, which needs location permission).
- Per-game deep links for FOX One / Peacock / Prime / ESPN (see "Other apps").
- NBA local channels for the Bulls (CHSN) are blacked out outside Chicago. League Pass channels (751–764) aren't subscribed.
- Home-screen widget / notifications would need a native app or a small server. Out of scope for now.
