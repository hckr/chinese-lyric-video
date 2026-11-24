import assert from "node:assert/strict";
import test from "node:test";
import { youtubeId } from "../youtube-api.ts";

test("single-video URLs share a cache key", () => {
  for (const prefix of [
    "https://www.youtube.com/watch?list=playlist&v=",
    "https://youtu.be/",
    "https://music.youtube.com/watch?v=",
    "https://www.youtube.com/shorts/",
  ])
    assert.equal(youtubeId(prefix + "abcdefghijk"), "abcdefghijk");
});
test("rejects unrelated hosts and playlists", () => {
  for (const link of [
    "https://youtube.com.example/watch?v=abcdefghijk",
    "https://youtube.com/playlist?list=abcdefghijk",
    "https://youtu.be/../../file",
  ])
    assert.throws(() => youtubeId(link));
});

import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { youtubeApi } from "../youtube-api.ts";

test("a completed cache entry serves metadata and media without a downloader", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "workbench-youtube-"));
  const dir = path.join(
    root,
    ".cache/youtube",
    Buffer.from("abcdefghijk").toString("hex"),
  );
  const server = http.createServer(
    (req, res) => void youtubeApi(req, res, root),
  );
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "source.json"),
      JSON.stringify({ id: "abcdefghijk" }),
    );
    await fs.writeFile(path.join(dir, "recording.mp4"), "fixture media");
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = "http://127.0.0.1:" + address.port + "/api/youtube";
    const result = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://youtu.be/abcdefghijk" }),
    });
    assert.deepEqual(await result.json(), { id: "abcdefghijk" });
    assert.equal(
      await (await fetch(base + "/media/abcdefghijk")).text(),
      "fixture media",
    );
    assert.equal(
      (await fetch(base, { headers: { Origin: "https://example.org" } }))
        .status,
      403,
    );
  } finally {
    server.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("concurrent requests share acquisition and rejected media leaves no partial entry", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "workbench-acquire-"));
  const bin = path.join(root, "bin");
  await fs.mkdir(bin);
  const oldPython = process.env.WORKBENCH_PYTHON,
    oldBin = process.env.WORKBENCH_FFMPEG_DIR,
    oldCache = process.env.WORKBENCH_YOUTUBE_CACHE_DIR;
  process.env.WORKBENCH_PYTHON = path.join(bin, "download");
  process.env.WORKBENCH_FFMPEG_DIR = bin;
  process.env.WORKBENCH_YOUTUBE_CACHE_DIR = path.join(root, "cache");
  const server = http.createServer(
    (req, res) => void youtubeApi(req, res, root),
  );
  try {
    await fs.writeFile(
      path.join(bin, "download"),
      '#!/bin/sh\necho run >> ../calls\nprintf fixture > recording.mp4\nprintf \'{"title":"Song","channel":"Singer"}\' > recording.info.json\n',
      { mode: 0o700 },
    );
    const probe = path.join(bin, "ffprobe");
    await fs.writeFile(probe, '#!/bin/sh\nprintf "video\\naudio\\n"\n', {
      mode: 0o700,
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const post = (id: string) =>
      fetch("http://127.0.0.1:" + address.port + "/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://youtu.be/" + id }),
      });
    const results = await Promise.all([
      post("abcdefghijk"),
      post("abcdefghijk"),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 200],
    );
    assert.deepEqual(await results[0].json(), await results[1].json());
    assert.equal(
      await fs.readFile(path.join(root, "cache/calls"), "utf8"),
      "run\n",
    );
    await fs.writeFile(probe, "#!/bin/sh\necho video\n");
    assert.equal((await post("ABCDEFGHIJK")).status, 400);
    assert.deepEqual((await fs.readdir(path.join(root, "cache"))).sort(), [
      Buffer.from("abcdefghijk").toString("hex"),
      "calls",
    ]);
  } finally {
    for (const [key, value] of Object.entries({
      WORKBENCH_PYTHON: oldPython,
      WORKBENCH_FFMPEG_DIR: oldBin,
      WORKBENCH_YOUTUBE_CACHE_DIR: oldCache,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
