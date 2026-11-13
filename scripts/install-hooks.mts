import { execFileSync, spawnSync } from "node:child_process";
import { chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const current = spawnSync(
  "git",
  ["config", "--local", "--get", "core.hooksPath"],
  { cwd: root, encoding: "utf8" },
);
if (current.error) throw current.error;
if (current.status !== 0 && current.status !== 1)
  throw Error(current.stderr.trim());
const configured = current.stdout.trim();
if (configured && configured !== ".githooks")
  throw Error(
    `This checkout already uses hooks at ${configured}; integrate the project hook there instead of overwriting it.`,
  );
await chmod(
  fileURLToPath(new URL("../.githooks/pre-commit", import.meta.url)),
  0o755,
);
execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
  cwd: root,
});
console.log("Project pre-commit formatting hook enabled for this checkout.");
