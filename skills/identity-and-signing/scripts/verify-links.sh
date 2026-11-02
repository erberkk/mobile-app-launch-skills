#!/usr/bin/env bash
# Checks the .well-known files for universal links (iOS) and App Links (Android).
# Usage: verify-links.sh <domain> <TEAM_ID.bundle.id> <PLAY_APP_SIGNING_SHA256>
# Example: verify-links.sh example.com ABCDE12345.com.example.app AA:BB:...
set -u
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
DOMAIN="$1"; APP_ID="$2"; SHA="$3"
fail=0

check() { # url, needle
  local url="$1" needle="$2"
  local headers status ctype body bad=0
  headers=$(curl -sS -o "$TMP" -D - --max-redirs 0 "$url") || { echo "FAIL $url (request error)"; fail=1; return; }
  status=$(printf '%s' "$headers" | head -1 | awk '{print $2}')
  ctype=$(printf '%s' "$headers" | grep -i '^content-type:' | head -1 | tr -d '\r')
  body=$(cat "$TMP")
  [ "$status" = "200" ] || { echo "FAIL $url status $status (redirects are not allowed)"; bad=1; }
  printf '%s' "$ctype" | grep -qi 'application/json' || { echo "FAIL $url content-type: ${ctype:-none}"; bad=1; }
  printf '%s' "$body" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null || { echo "FAIL $url is not valid JSON"; bad=1; }
  printf '%s' "$body" | grep -q "$needle" || { echo "FAIL $url does not contain $needle"; bad=1; }
  if [ $bad = 0 ]; then echo "OK   $url"; else fail=1; fi
}

check "https://$DOMAIN/.well-known/apple-app-site-association" "$APP_ID"
check "https://$DOMAIN/.well-known/assetlinks.json" "$SHA"

# Google's Digital Asset Links API gives a second opinion for Android:
echo "Google check: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://$DOMAIN&relation=delegate_permission/common.handle_all_urls"
exit $fail
