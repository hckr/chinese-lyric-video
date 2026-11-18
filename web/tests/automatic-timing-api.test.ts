import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { automaticTiming } from "../timing-api.ts";
import { syntheticWav } from "./synthetic-wav.ts";
import { rawProject } from "../src/domain.ts";

test("local timing endpoint aligns a supplied transcript without loading Whisper", async () => {
  const server = http.createServer(
    (req, res) => void automaticTiming(req, res, process.cwd()),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const project = rawProject("你好", "Test", "Test");
    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: "POST",
      body: new Blob([
        JSON.stringify({
          project,
          durationMs: 5000,
          transcript: {
            segments: [{ words: [{ word: "你好", start: 1, end: 2 }] }],
          },
        }) + "\n",
        syntheticWav(5),
      ]),
    });
    const messages = (await response.text())
      .trim()
      .split("\n")
      .map((s) => JSON.parse(s));
    assert.equal(messages.at(-1).result.lines[0].observedStartMs, 1000);
    assert.equal(project.occurrences[0].startMs, null);
    const denied = await fetch(`http://127.0.0.1:${address.port}`, {
      method: "POST",
      headers: { origin: "http://elsewhere" },
    });
    assert.equal(denied.status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("disconnect terminates the worker and releases the timing slot for retry", async () => {
  const { mkdtemp, writeFile, chmod, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const directory = await mkdtemp(path.join(tmpdir(), "timing-cancel-test-"));
  const worker = path.join(directory, "worker");
  await writeFile(
    worker,
    `#!${path.resolve("python-src/venv/bin/python")}\nimport os,json,time\nprint(json.dumps({'progress':str(os.getpid())}),flush=True)\ntime.sleep(60)\n`,
  );
  await chmod(worker, 0o755);
  const previous = process.env.WORKBENCH_PYTHON;
  process.env.WORKBENCH_PYTHON = worker;
  const server = http.createServer(
    (req, res) => void automaticTiming(req, res, process.cwd()),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const body =
    JSON.stringify({
      project: rawProject("你好", "Test", "Test"),
      durationMs: 5000,
    }) + "\n";
  try {
    const abort = new AbortController();
    const response = await fetch(url, {
      method: "POST",
      body,
      signal: abort.signal,
    });
    const reader = response.body!.getReader();
    const chunk = await reader.read();
    const pid = Number(
      JSON.parse(new TextDecoder().decode(chunk.value)).progress,
    );
    abort.abort();
    const deadline = Date.now() + 5000;
    let alive = true;
    while (alive && Date.now() < deadline) {
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
      }
      if (alive) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(alive, false, "cancelled worker must exit");
    if (previous === undefined) delete process.env.WORKBENCH_PYTHON;
    else process.env.WORKBENCH_PYTHON = previous;
    const retry = await fetch(url, {
      method: "POST",
      body: new Blob([
        JSON.stringify({
          project: rawProject("你好", "Test", "Test"),
          durationMs: 5000,
          transcript: { segments: [] },
        }) + "\n",
        syntheticWav(5),
      ]),
    });
    assert.equal(retry.status, 200);
    assert.ok((await retry.text()).includes('"result"'));
  } finally {
    if (previous === undefined) delete process.env.WORKBENCH_PYTHON;
    else process.env.WORKBENCH_PYTHON = previous;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("Whisper frame progress reports processed audio without pretending lyrics are matched", async () => {
  const { whisperProgress } = await import("../timing-api.ts");
  assert.deepEqual(
    whisperProgress(" 50%|##### | 1500/3000 [00:10<00:10, 150.00frames/s]"),
    { percent: 50, processedSeconds: 15, totalSeconds: 30 },
  );
  assert.equal(whisperProgress("Loading model 100/200 bytes"), null);
  assert.equal(whisperProgress("0/0 frames"), null);
  assert.equal(whisperProgress("a diagnostic warning"), null);
});

test("stderr progress cannot split stdout JSON result packets", async () => {
  const { mkdtemp, writeFile, chmod, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const directory = await mkdtemp(path.join(tmpdir(), "timing-progress-test-"));
  const worker = path.join(directory, "worker");
  await writeFile(
    worker,
    `#!${path.resolve("python-src/venv/bin/python")}\nimport sys,time,json\nsys.stdout.write('{"progress":"Lo');sys.stdout.flush()\nsys.stderr.write('\\r 0%| | 0/3000 [00:00<?, ?frames/s]\\r 50%|##### | 1500/3000 [00:10<00:10, 150frames/s]');sys.stderr.flush()\ntime.sleep(0.02)\nsys.stdout.write('ading"}\\n');sys.stdout.flush()\nprint(json.dumps({'result':{'lines':[],'additions':[]}}),flush=True)\n`,
  );
  await chmod(worker, 0o755);
  const previous = process.env.WORKBENCH_PYTHON;
  process.env.WORKBENCH_PYTHON = worker;
  const server = http.createServer(
    (req, res) => void automaticTiming(req, res, process.cwd()),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      {
        method: "POST",
        body:
          JSON.stringify({
            project: rawProject("你好", "Test", "Test"),
            durationMs: 30000,
          }) + "\n",
      },
    );
    const messages = (await response.text())
      .trim()
      .split("\n")
      .map((s) => JSON.parse(s));
    assert.equal(
      messages.find((m) => m.transcriptionPercent !== undefined)
        ?.transcriptionPercent,
      50,
    );
    assert.ok(messages.some((m) => m.progress === "Loading"));
    assert.equal(
      messages.some((m) => m.transcriptionPercent === 0),
      false,
    );
    assert.ok(messages.at(-1).result);
  } finally {
    if (previous === undefined) delete process.env.WORKBENCH_PYTHON;
    else process.env.WORKBENCH_PYTHON = previous;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("ETA waits for a useful speed sample and includes a ten-second alignment allowance", async () => {
  const { timingEta } = await import("../timing-api.ts");
  assert.equal(
    timingEta(
      { processedSeconds: 0, at: 0 },
      { processedSeconds: 30, totalSeconds: 120 },
      5000,
    ),
    undefined,
  );
  assert.equal(
    timingEta(
      { processedSeconds: 0, at: 0 },
      { processedSeconds: 1, totalSeconds: 120 },
      10000,
    ),
    undefined,
  );
  assert.equal(
    timingEta(
      { processedSeconds: 0, at: 0 },
      { processedSeconds: 30, totalSeconds: 120 },
      60000,
    ),
    190,
  );
  assert.equal(
    timingEta(
      { processedSeconds: 30, at: 60000 },
      { processedSeconds: 60, totalSeconds: 120 },
      120000,
    ),
    130,
  );
  assert.equal(
    timingEta(
      { processedSeconds: 0, at: 0 },
      { processedSeconds: 120, totalSeconds: 120 },
      240000,
    ),
    10,
  );
});
