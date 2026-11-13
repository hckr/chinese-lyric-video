import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { formatFiles, selectedFiles } from "../../scripts/format-changes.mts";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lyric-format-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "--quiet");
  await fs.writeFile(path.join(root, ".gitignore"), "ignored/\n");
  await fs.writeFile(path.join(root, ".prettierignore"), "published.ts\n");
  await fs.writeFile(path.join(root, "staged.ts"), "const value={a:1}\n");
  git("add", "--", ".gitignore", ".prettierignore", "staged.ts");
  return {
    root,
    git,
    cleanup: () => fs.rm(root, { recursive: true, force: true }),
  };
}

test("format selection includes staged, unstaged and untracked files; handles spaces and skips Git-ignored files", async () => {
  const { root, git, cleanup } = await fixture();
  try {
    await fs.writeFile(path.join(root, "staged.ts"), "const value={a:2}\n");
    await fs.writeFile(path.join(root, "new file.ts"), "const another=1\n");
    await fs.mkdir(path.join(root, "ignored"));
    await fs.writeFile(path.join(root, "ignored", "local.ts"), "private\n");
    assert.deepEqual(selectedFiles(root, "staged"), [
      ".gitignore",
      ".prettierignore",
      "staged.ts",
    ]);
    assert.deepEqual(selectedFiles(root, "changed"), [
      ".gitignore",
      ".prettierignore",
      "new file.ts",
      "staged.ts",
    ]);
    assert.ok(git("diff", "--name-only").includes("staged.ts"));
  } finally {
    await cleanup();
  }
});

test("formatting staged paths formats the working copy without changing staged content; respects Prettier exclusions", async () => {
  const { root, git, cleanup } = await fixture();
  try {
    const staged = git("show", ":staged.ts");
    await fs.writeFile(path.join(root, "staged.ts"), "const value={a:2}\n");
    await fs.writeFile(path.join(root, "published.ts"), "const keep={a:1}\n");
    const result = await formatFiles(
      root,
      ["staged.ts", "published.ts"],
      false,
    );
    assert.deepEqual(result.formatted, ["staged.ts"]);
    assert.equal(
      await fs.readFile(path.join(root, "staged.ts"), "utf8"),
      "const value = { a: 2 };\n",
    );
    assert.equal(git("show", ":staged.ts"), staged);
    assert.equal(
      await fs.readFile(path.join(root, "published.ts"), "utf8"),
      "const keep={a:1}\n",
    );
  } finally {
    await cleanup();
  }
});

test("format check reports differences without writing; formatting is idempotent", async () => {
  const { root, cleanup } = await fixture();
  try {
    const before = await fs.readFile(path.join(root, "staged.ts"), "utf8");
    const check = await formatFiles(root, ["staged.ts"], true);
    assert.deepEqual(check.unformatted, ["staged.ts"]);
    assert.equal(
      await fs.readFile(path.join(root, "staged.ts"), "utf8"),
      before,
    );
    await formatFiles(root, ["staged.ts"], false);
    assert.deepEqual(
      (await formatFiles(root, ["staged.ts"], true)).unformatted,
      [],
    );
  } finally {
    await cleanup();
  }
});
