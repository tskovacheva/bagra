#!/bin/bash
# Deletes ONLY the redesign's test profile — the separate Chrome profile the start
# script uses. Your everyday browser and the published app are not touched.
PROFILE="$HOME/.bagra-design-test-profile"
if [ -d "$PROFILE" ]; then
  echo "Close the test Chrome window first. Delete $PROFILE ? [y/N]"; read -r a
  [ "$a" = "y" ] && rm -rf "$PROFILE" && echo "Deleted. The next start begins with an empty database."
else echo "Nothing to delete: $PROFILE does not exist."; fi
read -r -p "Press Enter to close."
