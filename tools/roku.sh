#!/usr/bin/env bash
# Talk to a Roku on the home network (ECP, port 8060). Must run on the same Wi-Fi.
#
#   tools/roku.sh info                         device info (power-mode, model, …)
#   tools/roku.sh apps                         installed apps with their IDs
#   tools/roku.sh active                       app currently on screen
#   tools/roku.sh on                           power on
#   tools/roku.sh key Home|Select|Up|...       press a remote button
#   tools/roku.sh launch <appId> [contentId] [mediaType]
#                                              e.g. launch 161227 26708c87-dfaa-453c-bceb-a165b1b90087 live
#
# Set ROKU_IP to target another TV (default: home TV).
set -euo pipefail
IP="${ROKU_IP:-192.168.0.109}"
BASE="http://$IP:8060"
cmd="${1:-}"; shift || true
case "$cmd" in
  info)   curl -fsS "$BASE/query/device-info" ;;
  apps)   curl -fsS "$BASE/query/apps" | sed -n 's/.*<app id="\([^"]*\)"[^>]*>\([^<]*\)<\/app>.*/\1\t\2/p' ;;
  active) curl -fsS "$BASE/query/active-app" ;;
  on)     curl -fsS -d '' "$BASE/keypress/PowerOn" && echo "sent PowerOn" ;;
  key)    curl -fsS -d '' "$BASE/keypress/${1:?key name}" && echo "sent $1" ;;
  launch)
    app="${1:?appId}"; cid="${2:-}"; mt="${3:-live}"
    url="$BASE/launch/$app"
    if [[ -n "$cid" ]]; then
      url="$url?contentId=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$cid")&mediaType=$mt"
    fi
    curl -fsS -d '' "$url" && echo "launched: $url" ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
