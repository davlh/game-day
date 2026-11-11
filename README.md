# Game Day

Tap a game on your phone and it plays on your Roku TV.

- **Leagues:** NFL, NBA, college football, college basketball
- **My Teams tab:** 49ers, Bears, Warriors, Bulls, and Stanford football and basketball, covering the past day plus the next week
- **Routing:** TV channels tune directly in DirecTV (KTVU, KPIX, KGO, KNTV, ESPN, NBCS Bay Area, …). Streaming-only games open their app (Prime Video, Peacock, ESPN, …).

## How it works

```
Game Day (web app on your phone)
  └─ tap a game → http-shortcuts://<Play on TV id>?plan={...}
       └─ HTTP Shortcuts "Play on TV" script (on your phone, on home Wi-Fi)
            └─ Roku TV picked in the app (Home 192.168.0.109, Parents, …): power on → launch DIRECTV / app (+ channel)
```

## Files

| File | What it is |
|---|---|
| `index.html`, `app.js` | The app UI |
| `logic.js` | Parsing games, picking where they play, building the tap link |
| `config.js` | **Edit this:** favorite teams, leagues, network → app/channel routes, DirecTV channel IDs |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make it installable and open instantly |
| `play-on-tv.js` | The script to paste into HTTP Shortcuts (not used by the web page itself) |

## Setup

### 1. Put it on GitHub Pages
1. On github.com, create a new repository named `game-day`. It must be **public**, because free Pages requires that.
2. Click **Add file → Upload files**, then drag in everything from this folder (including the `icons` folder). Commit.
3. Go to **Settings → Pages**. Under "Build and deployment," choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. After about a minute your app is live at `https://<your-username>.github.io/game-day/`.

### 2. Set up "Play on TV" in HTTP Shortcuts
1. Open HTTP Shortcuts and go to **⋮ → Variables → +**, then **Static Variable**. Name it exactly `plan`, leave the value empty, and save.
2. Back on the main screen, tap **+ → Scripting Shortcut** and name it **Play on TV**. Paste all of `play-on-tv.js` into its code and save.
3. Long-press **Play on TV**, choose **Show Info**, and copy its deep link (`http-shortcuts://…`).

### 3. Install Game Day on your phone
1. Open your GitHub Pages address in **Chrome**, then go to **⋮ → Install app** (or **Add to Home screen**).
2. Open Game Day, tap **⚙**, paste the Play on TV link, and **Save**.
3. Tap a game. The first time, Chrome may ask to open HTTP Shortcuts. Allow it, and choose "always" if it offers.

## TVs (home, parents', …)
Pick the TV in the **📺** dropdown at the top of the app. Edit the list under **⚙ Settings → TVs**, one per line as `Name = Roku IP`. On each new Roku, do the one-time setup: turn on **Fast TV start**, allow **Control by mobile apps**, and ideally reserve its IP in that router. Your phone must be on that house's Wi-Fi. For safety, Play on TV only talks to home-network addresses (`192.168.x.x`, `10.x.x.x`, `172.16–31.x.x`).

## Updating
Edit files on GitHub (for example `config.js`, using the pencil icon). The phone gets the new version the next time it opens the app with internet; occasionally it takes one extra relaunch.

## Common changes
- **Add a favorite team:** add a line to `FAVORITES` in `config.js`. Use the team's ESPN `id` (the number in its espn.com team URL) and `abbr`.
- **Prefer an app over DirecTV for a network:** reorder that network's line in `ROUTES`. For example, put `app("FOX One")` before the DirecTV entry.
- **A network shows "▶ DIRECTV" but no channel:** it isn't mapped yet. Add it to `ROUTES` (and `ALIASES` if ESPN uses a different name).

## Security notes
- The page is public, but it holds no passwords. The DirecTV IDs are standard Bay Area channel identifiers, not tied to your account.
- Only a phone on your home Wi-Fi with your Play on TV shortcut can reach the TV.
- `play-on-tv.js` only accepts a short list of app names, channel-ID formats and media types, so a tampered page can't make it do anything except open an app or channel.
- Protect your GitHub account with 2-factor authentication.
