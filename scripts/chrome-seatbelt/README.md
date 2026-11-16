# Codex Seatbelt browser workaround (experimental)

This workaround is only for the Intel macOS Codex Seatbelt sandbox. It does not alter Codex's filesystem permissions. The dynamic library interposes on `sysctlbyname("kern.hv_vmm_present")` and reports `0` for a physical Mac; other sysctl calls are forwarded. The wrapper also launches Chromium with `--single-process --in-process-gpu` because Codex currently denies the Mach rendezvous registration needed for normal multiprocess startup.

## Build

```sh
npm run workbench:seatbelt:build
```

The build script uses the installed Apple Clang and writes `patched_sysctlbyname.dylib` and `sysctl_probe` to `.cache/chrome-seatbelt/`. No installation or download is performed. Commit the two C files, shell scripts, and this README—not the generated binaries.

Build **outside the Codex sandbox** if compiler/SDK access is restricted there. Rebuild after changing the C source. The wrapper deliberately does not compile automatically.

## Verify interception

From the repository root, run:

```sh
codex sandbox --permission-profile local-development --cd "$PWD" -- \
  env DYLD_INSERT_LIBRARIES="$PWD/.cache/chrome-seatbelt/patched_sysctlbyname.dylib" \
  "$PWD/.cache/chrome-seatbelt/sysctl_probe"
```

Expected on the physical Mac: `kern.hv_vmm_present=0`. A probe failure without `DYLD_INSERT_LIBRARIES` is expected inside the restrictive sandbox. A passing probe demonstrates interposition for that probe executable, not necessarily Chromium.

## Run

`web/tests/browser.ts` automatically selects `scripts/chrome-seatbelt.sh` when `process.platform === "darwin"`,
`process.arch === "x64"`, and `CODEX_SANDBOX === "seatbelt"`, unless `WORKBENCH_BROWSER` is explicitly set.

```sh
codex sandbox --permission-profile local-development --cd "$PWD" -- \
  npm run workbench:test:browser
```

The workaround activates automatically inside Codex Seatbelt on Intel macOS; ordinary terminal tests use unmodified Chromium.
Because the shim always reports “not a VM,” use it only on a physical Intel Mac. An explicit `WORKBENCH_BROWSER` takes precedence.

## Sandbox permissions

Chromium requires read access to certain macOS system resources, particularly appearance assets and fonts, which may be restricted by Codex's Seatbelt sandbox.

Missing appearance resources can prevent browser startup. Missing fonts can affect text measurements and cause otherwise valid layout tests to fail.

Configure the necessary read permissions in your local Codex permission profile. The exact configuration is host-specific and intentionally not included in this repository.

The workaround does not require unrestricted filesystem access.

### Diagnosing sandbox failures

If Chromium fails inside Codex's Seatbelt sandbox, inspect recent macOS sandbox denials from a regular terminal:

```sh
/usr/bin/log show --last 5m --style compact \
  --predicate 'eventMessage CONTAINS "Sandbox:" AND eventMessage CONTAINS "deny("'
```

Run this shortly after reproducing the failure. The output identifies denied operations, such as filesystem reads, Mach service lookups, and network access.

Not every denial indicates a problem. macOS frequently logs harmless denials, so correlate relevant entries with the failing process and observed behavior before changing permissions.

## Limitations

- Verified on the current physical Intel Mac in Codex Seatbelt: all 86 unit tests and the complete browser suite passed with the Seatbelt workaround enabled. Tooling TypeScript and shell syntax checks also passed. The standalone probe, individual C buffer/error cases and a fresh compiler build were not exercised in this review.
- `--single-process` is an unsupported Chromium mode and reduces browser process isolation. Use only for trusted local application tests; the outer Codex filesystem sandbox remains in effect.
- Dynamic-library injection may fail because of macOS protections, even though the existing Chrome Headless Shell binary was reported unsigned.
- If Codex fixes the missing macOS Seatbelt permissions, remove this workaround and use standard multiprocess Chromium again.
- The shim intentionally reports `0` for `kern.hv_vmm_present`; do not use it on a machine where that is untrue.
