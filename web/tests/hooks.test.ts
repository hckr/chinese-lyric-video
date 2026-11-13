import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkStagedFormatting } from "../../scripts/check-staged-format.mts";

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lyric-hook-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "--quiet");
  await fs.writeFile(path.join(root, ".prettierignore"), "published.ts\n");
  git("add", "--", ".prettierignore");
  return {
    root,
    git,
    cleanup: () => fs.rm(root, { recursive: true, force: true }),
  };
}

test("staged check catches bad index content even when the working copy is formatted", async () => {
  const { root, git, cleanup } = await fixture();
  try {
    await fs.writeFile(
      path.join(root, "word with spaces.ts"),
      "const word={a:1}\n",
    );
    git("add", "--", "word with spaces.ts");
    const staged = git("show", ":word with spaces.ts");
    await fs.writeFile(
      path.join(root, "word with spaces.ts"),
      "const word = { a: 1 };\n",
    );
    assert.equal((await checkStagedFormatting(root)).length, 1);
    assert.equal(git("show", ":word with spaces.ts"), staged);
    assert.equal(
      await fs.readFile(path.join(root, "word with spaces.ts"), "utf8"),
      "const word = { a: 1 };\n",
    );
  } finally {
    await cleanup();
  }
});

test("staged check accepts good index content despite unstaged edits or a missing working copy", async () => {
  const { root, git, cleanup } = await fixture();
  try {
    await fs.writeFile(path.join(root, "word.ts"), "const word = { a: 1 };\n");
    git("add", "--", "word.ts");
    await fs.writeFile(path.join(root, "word.ts"), "const word={a:2}\n");
    assert.deepEqual(await checkStagedFormatting(root), []);
    assert.equal(
      await fs.readFile(path.join(root, "word.ts"), "utf8"),
      "const word={a:2}\n",
    );
    await fs.unlink(path.join(root, "word.ts"));
    assert.deepEqual(await checkStagedFormatting(root), []);
    await fs.writeFile(
      path.join(root, "published.ts"),
      "const published={a:1}\n",
    );
    git("add", "--", "published.ts");
    assert.deepEqual(await checkStagedFormatting(root), []);
  } finally {
    await cleanup();
  }
});

test("installed hook blocks an unformatted commit and permits a formatted commit in a temporary repository", async () => {
  const { root, git, cleanup } = await fixture();
  try {
    await fs.mkdir(path.join(root, ".githooks"));
    await fs.mkdir(path.join(root, "scripts"));
    await fs.copyFile(
      path.join(sourceRoot, ".githooks/pre-commit"),
      path.join(root, ".githooks/pre-commit"),
    );
    await fs.chmod(path.join(root, ".githooks/pre-commit"), 0o755);
    await fs.symlink(
      path.join(sourceRoot, "scripts/check-staged-format.mts"),
      path.join(root, "scripts/check-staged-format.mts"),
    );
    git("config", "core.hooksPath", ".githooks");
    await fs.writeFile(path.join(root, "word.ts"), "const word={a:1}\n");
    git("add", "--", "word.ts");
    const commit = () =>
      spawnSync(
        "git",
        [
          "-c",
          "user.name=Hook test",
          "-c",
          "user.email=hook@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "-m",
          "fixture",
        ],
        { cwd: root, encoding: "utf8" },
      );
    const blocked = commit();
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /Commit blocked by formatting/);
    await fs.writeFile(path.join(root, "word.ts"), "const word = { a: 1 };\n");
    git("add", "--", "word.ts");
    await fs.writeFile(path.join(root, "word.ts"), "const word={a:2}\n");
    const allowed = commit();
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(git("show", "HEAD:word.ts"), "const word = { a: 1 };\n");
    assert.equal(
      await fs.readFile(path.join(root, "word.ts"), "utf8"),
      "const word={a:2}\n",
    );
  } finally {
    await cleanup();
  }
});

const python = path.join(sourceRoot, "python-src/venv/bin/python");
test(
  "Ruff checks staged Python text instead of a differently formatted working copy",
  { skip: !existsSync(python) },
  async () => {
    const { root, git, cleanup } = await fixture();
    try {
      await fs.writeFile(path.join(root, "word.py"), "value={'a':1}\n");
      git("add", "--", "word.py");
      await fs.writeFile(path.join(root, "word.py"), 'value = {"a": 1}\n');
      assert.equal((await checkStagedFormatting(root, python)).length, 1);
      git("add", "--", "word.py");
      await fs.writeFile(path.join(root, "word.py"), "value={'a':2}\n");
      assert.deepEqual(await checkStagedFormatting(root, python), []);
    } finally {
      await cleanup();
    }
  },
);

for (const [name, config] of [
  [".prettierignore", "word.ts\n"],
  [".prettierrc", '{"semi": false}\n'],
  [".editorconfig", "root = true\n[*]\nindent_size = 8\n"],
  ["ruff.toml", "line-length = 120\n"],
])
  test(`staged checks reject unstaged configuration changes: ${name}`, async () => {
    const { root, git, cleanup } = await fixture();
    try {
      await fs.writeFile(path.join(root, "word.ts"), "const word={a:1}\n");
      git("add", "--", "word.ts");
      await fs.writeFile(path.join(root, name), config);
      const problems = await checkStagedFormatting(root);
      assert.equal(problems[0].file, name);
      assert.match(problems[0].message, /configuration differs from the index/);
      if (name === ".prettierignore") {
        git("add", "--", name);
        assert.deepEqual(await checkStagedFormatting(root), []);
      }
    } finally {
      await cleanup();
    }
  });

test("staged checks reject nested config edits and deleted working-tree configuration", async () => {
  const { root, git, cleanup } = await fixture();
  try {
    await fs.mkdir(path.join(root, "nested"));
    await fs.writeFile(path.join(root, "nested/.prettierrc"), "{}\n");
    await fs.writeFile(path.join(root, "nested/word.ts"), "const word = 1;\n");
    git("add", "--", "nested");
    await fs.writeFile(
      path.join(root, "nested/.prettierrc"),
      '{"semi":false}\n',
    );
    assert.match(
      (await checkStagedFormatting(root))[0].message,
      /configuration differs/,
    );
    await fs.unlink(path.join(root, "nested/.prettierrc"));
    assert.match(
      (await checkStagedFormatting(root))[0].message,
      /configuration differs/,
    );
  } finally {
    await cleanup();
  }
});
