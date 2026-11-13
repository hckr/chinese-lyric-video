// Verify the real dev server in an isolated source tree, without editing user files.
import { openBrowser } from "@remotion/renderer";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { rawProject } from "../src/domain.ts";

const root = process.cwd();
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "lyric-reload-"));
await fs.mkdir(path.join(fixture, "web"));
await fs.cp(path.join(root, "web/src"), path.join(fixture, "web/src"), {
  recursive: true,
});
for (const file of ["index.html", "tsconfig.json", "package.json"])
  await fs.copyFile(
    path.join(root, "web", file),
    path.join(fixture, "web", file),
  );
await fs.symlink(
  path.join(root, "node_modules"),
  path.join(fixture, "node_modules"),
);
const child = spawn(process.execPath, [path.join(root, "web/dev.ts")], {
  cwd: fixture,
  env: { ...process.env, WORKBENCH_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Dev server startup timed out")),
      20000,
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error(`Dev server exited: ${code}`));
    });
    child.stdout.on("data", (data: Buffer) => {
      const match = /http:\/\/127\.0\.0\.1:\d+/.exec(data.toString());
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.stderr.on("data", (data: Buffer) => process.stderr.write(data));
  });
  await (await fetch(`${url}/app.js`)).text();
  await new Promise((resolve) => setTimeout(resolve, 300));
  browser = await openBrowser("chrome", {
    browserExecutable:
      process.env.WORKBENCH_BROWSER ||
      path.join(
        root,
        "node_modules/.remotion/chrome-headless-shell/mac-x64/chrome-headless-shell-mac-x64/chrome-headless-shell",
      ),
  });
  const page = await browser.newPage({
    context: () => null,
    logLevel: "error",
    indent: false,
    pageIndex: 0,
    onBrowserLog: () => {},
    onLog: () => {},
  });
  await page.goto({ url, timeout: 30000 });
  const project = rawProject("你好", "Saved reload project", "Test artist");
  await page.evaluate((project) => {
    localStorage.setItem("lyric-workbench-v1", JSON.stringify(project));
    localStorage.setItem("reload-proof", "saved edit");
  }, project);
  await page.goto({ url, timeout: 30000 });
  // Allow the initial build's SSE event to settle before triggering the next build.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const app = path.join(fixture, "web/src/App.tsx");
  await fs.writeFile(
    app,
    (await fs.readFile(app, "utf8")).replace(
      "Translate & review",
      "Auto-reload verified",
    ),
  );
  const deadline = Date.now() + 15000;
  let refreshed = false;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      refreshed = await page.evaluate(
        () =>
          document.body.textContent?.includes("Auto-reload verified") ?? false,
      );
    } catch {
      /* navigation in progress */
    }
    if (refreshed) break;
  }
  assert.ok(refreshed, "source edits must refresh the actual React UI");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("reload-proof")),
    "saved edit",
  );
  console.log(
    "Live reload passed: edited React source refreshed automatically; local storage survived.",
  );
} finally {
  await browser?.close({ silent: true });
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
    });
  }
  await fs.rm(fixture, { recursive: true, force: true });
}
