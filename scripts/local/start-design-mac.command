#!/bin/bash
# Bagra — run the redesign locally, with its own test database.
# Double-click in Finder. Stop with Ctrl+C in this window, or close it.
#
# The database belongs to the address. http://localhost:8799 is its own origin:
# nothing is shared with the published app on GitHub Pages or with any other port.
# Chrome is opened with a separate test profile as well, so nothing touches your
# everyday browser. Delete that profile folder to start again from empty.
cd "$(dirname "$0")/../.." || exit 1
PORT=8799
PROFILE="$HOME/.bagra-design-test-profile"
URL="http://localhost:$PORT/index.html"
command -v python3 >/dev/null || { echo "python3 is needed (macOS: xcode-select --install)"; read -r; exit 1; }
echo "Serving $(pwd) at $URL"
python3 -m http.server "$PORT" --bind 127.0.0.1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check "$URL"
else
  echo "Chrome not found; opening the default browser (the database is still separate — it belongs to this address)."
  open "$URL"
fi
echo "Test profile: $PROFILE"
echo "Press Ctrl+C to stop."
wait $SERVER
