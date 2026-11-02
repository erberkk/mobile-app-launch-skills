#!/usr/bin/env bash
# Starts Chrome with a dedicated automation profile and a CDP port (localhost only).
# Sign in to the consoles once in this window; the profile keeps the session.
# Usage: start-chrome.sh [port] [profile-dir]
PORT="${1:-9333}"
PROFILE="${2:-$HOME/.store-automation/chrome-profile}"
mkdir -p "$PROFILE"
case "$(uname -s)" in
  Darwin) CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ;;
  Linux)  CHROME="$(command -v google-chrome || command -v chromium)" ;;
  *)      CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe" ;;  # Git Bash on Windows
esac
"$CHROME" --remote-debugging-port="$PORT" --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check >/dev/null 2>&1 &
echo "Chrome on 127.0.0.1:$PORT with profile $PROFILE"
