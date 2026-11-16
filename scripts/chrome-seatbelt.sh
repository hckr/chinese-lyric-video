#!/bin/sh
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
shim="$root/.cache/chrome-seatbelt/patched_sysctlbyname.dylib"
chrome="$root/node_modules/.remotion/chrome-headless-shell/mac-x64/chrome-headless-shell-mac-x64/chrome-headless-shell"

if [ ! -f "$shim" ]; then
  echo >&2 "Missing $shim. Run: npm run workbench:seatbelt:build"
  exit 1
fi
if [ ! -x "$chrome" ]; then
  echo >&2 "Chrome Headless Shell not found: $chrome"
  exit 1
fi

export DYLD_INSERT_LIBRARIES="$shim"
exec "$chrome" --single-process --in-process-gpu "$@"
