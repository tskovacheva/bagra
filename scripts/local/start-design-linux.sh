#!/bin/sh
# Bagra — run the redesign locally, with its own test database (see the macOS script).
cd "$(dirname "$0")/../.." || exit 1
PORT=8799; PROFILE="$HOME/.bagra-design-test-profile"; URL="http://localhost:$PORT/index.html"
python3 -m http.server "$PORT" --bind 127.0.0.1 & SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT INT
sleep 1
for c in google-chrome chromium chromium-browser; do
  command -v "$c" >/dev/null && { "$c" --user-data-dir="$PROFILE" --no-first-run "$URL" >/dev/null 2>&1 & break; }
done
echo "Serving at $URL — test profile $PROFILE. Ctrl+C to stop."
wait $SERVER
