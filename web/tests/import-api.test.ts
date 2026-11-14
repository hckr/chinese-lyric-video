import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { importLyrics } from "../import-api.ts";
import { parseProject } from "../src/domain.ts";

test(
  "local import endpoint returns word drafts and reports request/configuration failures",
  { skip: !existsSync("python-src/venv/bin/python") },
  async () => {
    const server = http.createServer((req, res) => {
      void importLyrics(req, res, process.cwd());
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}`;
    const previous = process.env.WORKBENCH_PYTHON;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: url },
        body: JSON.stringify({
          raw: "做你的猫\n唱：小可乐\n词：陈大创\n曲：陈大创\n做你的猫 喵喵\n在你怀里睡着\n做你的猫 喵喵",
        }),
      });
      const text = await response.text();
      assert.equal(response.status, 200, text);
      const p = parseProject(text);
      assert.equal(p.phrases.length, 2);
      assert.equal(p.occurrences.length, 3);
      assert.equal(p.metadata.title, "做你的猫");
      assert.ok(
        p.phrases.every(
          (v) =>
            v.words.length > 0 && v.words.every((w) => !w.pinyin.includes(" ")),
        ),
      );
      assert.equal((await fetch(url)).status, 405);
      assert.equal(
        (
          await fetch(url, {
            method: "POST",
            headers: { Origin: "https://example.invalid" },
            body: "{}",
          })
        ).status,
        403,
      );
      assert.equal(
        (await fetch(url, { method: "POST", body: "not json" })).status,
        400,
      );
      process.env.WORKBENCH_PYTHON = "/missing/python";
      const missing = await fetch(url, { method: "POST", body: "{}" });
      assert.equal(missing.status, 503);
    } finally {
      if (previous === undefined) delete process.env.WORKBENCH_PYTHON;
      else process.env.WORKBENCH_PYTHON = previous;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
