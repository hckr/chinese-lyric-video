import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import { selectedFiles } from "./format-changes.mts";

export interface FormattingProblem {
  file: string;
  message: string;
}

// Check Git blobs, not working-tree copies: partial staging must remain reliable.
export async function checkStagedFormatting(
  root: string,
  python = path.join(
    root,
    "python-src",
    "venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  ),
): Promise<FormattingProblem[]> {
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  const files = selectedFiles(root, "staged");
  const entries = new Map<string, { mode: string; oid: string }>();
  for (const entry of git(["ls-files", "--stage", "-z"]).split("\0")) {
    const match = /^(\d+) ([0-9a-f]+) 0\t([\s\S]+)$/.exec(entry);
    if (match) entries.set(match[3], { mode: match[1], oid: match[2] });
  }
  // Require working-tree formatter settings to match the index, including
  // untracked configuration files and nested overrides.
  if (files.length) {
    const candidates = git([
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ]).split("\0");
    for (const file of new Set(candidates)) {
      const name = path.posix.basename(file);
      if (
        !/^(?:\.prettierignore|\.prettierrc(?:\..+)?|prettier\.config\..+|\.editorconfig|package\.json|\.?ruff\.toml|pyproject\.toml)$/.test(
          name,
        )
      )
        continue;
      const entry = entries.get(file);
      let local: string | undefined;
      try {
        local = readFileSync(path.join(root, file), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const staged = entry ? git(["cat-file", "blob", entry.oid]) : undefined;
      if (local !== staged)
        return [
          {
            file,
            message:
              "Formatter configuration differs from the index; stage the intended configuration or restore its working copy before checking staged formatting",
          },
        ];
    }
  }
  const problems: FormattingProblem[] = [];
  for (const file of files) {
    const entry = entries.get(file);
    if (!entry || !["100644", "100755"].includes(entry.mode)) continue;
    if (/\.pyi?$/.test(file)) {
      const source = git(["cat-file", "blob", entry.oid]);
      const result = spawnSync(
        python,
        [
          "-m",
          "ruff",
          "format",
          "--check",
          "--output-format",
          "concise",
          "--stdin-filename",
          file,
          "-",
        ],
        {
          cwd: root,
          input: source,
          encoding: "utf8",
        },
      );
      if (result.error || result.status !== 0)
        problems.push({
          file,
          message:
            result.error?.message ||
            result.stdout.trim() ||
            result.stderr.trim() ||
            "Ruff could not check this staged file",
        });
      continue;
    }
    const filename = path.join(root, file);
    try {
      const info = await prettier.getFileInfo(filename, {
        ignorePath: path.join(root, ".prettierignore"),
      });
      if (info.ignored || !info.inferredParser) continue;
      const source = git(["cat-file", "blob", entry.oid]);
      const config = await prettier.resolveConfig(filename, {
        editorconfig: true,
      });
      if (!(await prettier.check(source, { ...config, filepath: filename })))
        problems.push({
          file,
          message: "Staged content needs Prettier formatting",
        });
    } catch (error) {
      problems.push({
        file,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return problems;
}

async function main(): Promise<void> {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  const problems = await checkStagedFormatting(root);
  if (!problems.length) {
    console.log("Staged formatting check passed.");
    return;
  }
  for (const problem of problems)
    console.error(`${JSON.stringify(problem.file)}: ${problem.message}`);
  console.error(
    "\nCommit blocked by formatting. Run npm run format:staged, review the changes, and re-stage the intended files.",
  );
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
