#!/bin/sh
set -eu

if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != x86_64 ]; then
  echo >&2 "Chrome Seatbelt shim is currently configured for Intel macOS only."
  exit 1
fi

root="$(CDPATH= cd "$(dirname "$0")/../.." && pwd)"
source_dir="$root/scripts/chrome-seatbelt"
output_dir="$root/.cache/chrome-seatbelt"
mkdir -p "$output_dir"

build_dir="$(mktemp -d "$output_dir/.build.XXXXXXXX")"
trap 'rm -rf "$build_dir"' 0
trap 'exit 1' 1 2 3 15

clang -std=c11 -O2 -Wall -Wextra -Werror -dynamiclib \
  -o "$build_dir/patched_sysctlbyname.dylib" \
  "$source_dir/patched_sysctlbyname.c"
clang -std=c11 -O2 -Wall -Wextra -Werror \
  -o "$build_dir/sysctl_probe" \
  "$source_dir/sysctl_probe.c"

mv "$build_dir/patched_sysctlbyname.dylib" "$output_dir/"
mv "$build_dir/sysctl_probe" "$output_dir/"
printf 'Built Chrome Seatbelt shim and probe in %s\n' "$output_dir"
