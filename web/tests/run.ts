import { spawnSync } from "node:child_process";
import path from "node:path";
import { readdirSync } from "node:fs";

// Native TypeScript execution on Node 22.20+. Keep the child on the same runtime.
const root = path.resolve(import.meta.dirname, "../..");
const result = spawnSync(
  process.execPath,
  [
    "--test",
    ...readdirSync(import.meta.dirname)
      .filter((name) => name.endsWith(".test.ts"))
      .map((name) => path.join(import.meta.dirname, name)),
  ],
  { stdio: "inherit", cwd: root, env: process.env },
);
process.exitCode = result.status ?? 1;
