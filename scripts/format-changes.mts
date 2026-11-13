import { execFileSync, spawnSync } from "node:child_process";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

export type Scope = "changed" | "staged";

export function selectedFiles(root: string, scope: Scope): string[] {
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
  const staged = git([
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
    "-z",
    "--",
  ]);
  if (scope === "staged") return staged.sort();
  return [
    ...new Set([
      ...staged,
      ...git(["diff", "--name-only", "--diff-filter=ACMR", "-z", "--"]),
      ...git(["ls-files", "--others", "--exclude-standard", "-z", "--"]),
    ]),
  ].sort();
}

export interface FormatResult {
  formatted: string[];
  unformatted: string[];
  skipped: string[];
  pythonStatus: number;
}

// Formatting intentionally writes only working-tree files, never the Git index.
export async function formatFiles(
  root: string,
  files: string[],
  check: boolean,
): Promise<FormatResult> {
  const result: FormatResult = {
    formatted: [],
    unformatted: [],
    skipped: [],
    pythonStatus: 0,
  };
  const pythonFiles: string[] = [];
  for (const filename of files) {
    const absolute = path.join(root, filename);
    const stat = await lstat(absolute).catch(() => null);
    // Do not follow symlinks or recreate a file deleted after Git listed it.
    if (!stat?.isFile()) {
      result.skipped.push(filename);
      continue;
    }
    if (/\.pyi?$/.test(filename)) {
      pythonFiles.push(filename);
      continue;
    }
    const info = await prettier.getFileInfo(absolute, {
      ignorePath: path.join(root, ".prettierignore"),
    });
    if (info.ignored || !info.inferredParser) {
      result.skipped.push(filename);
      continue;
    }
    const source = await readFile(absolute, "utf8");
    const config = await prettier.resolveConfig(absolute, {
      editorconfig: true,
    });
    const formatted = await prettier.format(source, {
      ...config,
      filepath: absolute,
    });
    if (source === formatted) continue;
    if (check) result.unformatted.push(filename);
    else {
      await writeFile(absolute, formatted);
      result.formatted.push(filename);
    }
  }
  if (pythonFiles.length) {
    const python = path.join(
      root,
      "python-src",
      "venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
    const args = ["-m", "ruff", "format"];
    if (check) args.push("--check", "--output-format", "concise");
    // Use argument arrays and -- so spaces, newlines and leading dashes are safe.
    const execution = spawnSync(python, [...args, "--", ...pythonFiles], {
      cwd: root,
      stdio: "inherit",
    });
    if (execution.error) throw execution.error;
    result.pythonStatus = execution.status ?? 1;
  }
  return result;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--staged", "--check"].includes(arg))) {
    throw Error("Usage: node scripts/format-changes.mts [--staged] [--check]");
  }
  const root = fileURLToPath(new URL("../", import.meta.url));
  const scope: Scope = args.includes("--staged") ? "staged" : "changed";
  const check = args.includes("--check");
  const files = selectedFiles(root, scope);
  if (!files.length) {
    console.log(`No ${scope} files to format.`);
    return;
  }
  const result = await formatFiles(root, files, check);
  for (const file of result.formatted) console.log(`Formatted: ${file}`);
  for (const file of result.unformatted)
    console.error(`Needs formatting: ${file}`);
  console.log(
    `${files.length} ${scope} paths checked; ${result.skipped.length} ignored or unsupported. Git index unchanged.`,
  );
  if (result.unformatted.length || result.pythonStatus) process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
