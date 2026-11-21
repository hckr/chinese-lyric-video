import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import test from "node:test";
import { translateLyrics } from "../translation-api.ts";

test(
  "loopback translation bridge handles empty jobs and sanitizes bad requests",
  {
    skip: !existsSync("python-src/venv/bin/python"),
  },
  async () => {
    const server = http.createServer(
      (req, res) =>
        void translateLyrics(req, res, process.cwd(), req.url === "/revise"),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const url = `http://127.0.0.1:${address.port}`;
      const headers = { "Content-Type": "application/json" };
      const payload = {
        model: "offline",
        structured: true,
        notes: "",
        phrases: [],
        timeline: [],
        jobs: {},
      };
      const send = (route: string, value: unknown) =>
        fetch(url + route, {
          method: "POST",
          headers,
          body: JSON.stringify(value),
        });
      const response = await send("/generate", payload);
      assert.equal(response.status, 200);
      assert.deepEqual(JSON.parse(await response.text()), { kind: "done" });
      const mismatch = await send("/revise", payload);
      assert.equal(mismatch.status, 400);
      const invalid = await send("/generate", {
        ...payload,
        model: "x".repeat(151),
      });
      assert.deepEqual(JSON.parse(await invalid.text()), {
        kind: "error",
        message:
          "Invalid translation request. Review the selected lyrics and settings.",
      });
      const crossOrigin = await fetch(url + "/generate", {
        method: "POST",
        headers: { ...headers, Origin: "https://example.invalid" },
        body: JSON.stringify(payload),
      });
      assert.equal(crossOrigin.status, 403);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);

test("disconnect terminates the local worker after a streamed draft", async () => {
  const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { setTimeout: delay } = await import("node:timers/promises");
  const directory = await mkdtemp(join(tmpdir(), "translation-cancel-"));
  const marker = join(directory, "terminated");
  const executable = join(directory, "worker");
  await writeFile(
    executable,
    `#!${process.execPath}
const { renameSync, writeFileSync } = require("node:fs");
process.once("SIGTERM", () => {
  const marker = ${JSON.stringify(marker)};
  writeFileSync(marker + ".tmp", "terminated");
  renameSync(marker + ".tmp", marker);
  process.exit(0);
});
process.stdout.write('{"kind":"draft"}\\n');
setInterval(() => {}, 1000);
`,
    { mode: 0o700 },
  );
  const previous = process.env.WORKBENCH_PYTHON;
  process.env.WORKBENCH_PYTHON = executable;
  const server = http.createServer(
    (req, res) => void translateLyrics(req, res, process.cwd(), false),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const controller = new AbortController();
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    assert.equal(
      Buffer.from((await reader.read()).value!).toString(),
      '{"kind":"draft"}\n',
    );
    controller.abort();
    for (let i = 0; i < 100 && !existsSync(marker); i++) await delay(20);
    assert.equal(await readFile(marker, "utf8"), "terminated");
  } finally {
    controller.abort();
    if (previous === undefined) delete process.env.WORKBENCH_PYTHON;
    else process.env.WORKBENCH_PYTHON = previous;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
