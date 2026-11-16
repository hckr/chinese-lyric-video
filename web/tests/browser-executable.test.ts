import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { browserExecutable } from "./browser-executable.ts";

test("automatically selects the shim on Intel macOS inside Codex Seatbelt", () => {
  const env = { CODEX_SANDBOX: "seatbelt" };
  const wrapper = path.resolve("scripts/chrome-seatbelt.sh");
  assert.equal(browserExecutable("darwin", "x64", env), wrapper);
  for (const [platform, arch, config] of [
    ["darwin", "arm64", env],
    ["linux", "x64", env],
    ["darwin", "x64", {}],
    ["darwin", "x64", { CODEX_SANDBOX: "none" }],
  ] as const)
    assert.notEqual(browserExecutable(platform, arch, config), wrapper);
});
test("an explicit browser override takes precedence over the experimental shim", () => {
  assert.equal(
    browserExecutable("darwin", "x64", {
      CODEX_SANDBOX: "seatbelt",
      WORKBENCH_BROWSER: "/custom/chrome",
    }),
    "/custom/chrome",
  );
});
