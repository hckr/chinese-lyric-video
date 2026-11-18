import { projectSchema } from "./src/domain.ts";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

export function whisperProgress(record: string) {
  if (!record.includes("frames")) return null;
  const match = record.match(/\b(\d+)\/(\d+)\b/);
  if (!match || Number(match[2]) <= 0) return null;
  const done = Number(match[1]),
    total = Number(match[2]);
  return {
    percent: Math.min(100, Math.max(0, Math.floor((done / total) * 100))),
    processedSeconds: Math.round(done / 100),
    totalSeconds: Math.round(total / 100),
  };
}

export function timingEta(
  first: { processedSeconds: number; at: number },
  current: { processedSeconds: number; totalSeconds: number },
  now: number,
): number | undefined {
  const elapsed = (now - first.at) / 1000;
  const advanced = current.processedSeconds - first.processedSeconds;
  if (elapsed < 10 || advanced <= 0 || advanced < current.totalSeconds * 0.05)
    return undefined;
  const remaining = Math.max(
    0,
    current.totalSeconds - current.processedSeconds,
  );
  // Round to ten seconds: inference speed varies, and alignment is an allowance.
  return Math.ceil(((remaining * elapsed) / advanced + 10) / 10) * 10;
}

let running: symbol | undefined;

export async function automaticTiming(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
) {
  if (
    req.method !== "POST" ||
    (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
  ) {
    res.writeHead(403).end();
    return;
  }
  if (running) {
    res.writeHead(409, { "Content-Type": "application/x-ndjson" }).end(
      JSON.stringify({
        error:
          "Another timing job is running; cancel it or wait for completion.",
      }) + "\n",
    );
    return;
  }
  const job = Symbol("timing");
  running = job;
  let directory: string;
  try {
    directory = await mkdtemp(path.join(tmpdir(), "lyric-timing-"));
  } catch {
    if (running === job) running = undefined;
    res
      .writeHead(500)
      .end(
        JSON.stringify({ error: "Unable to create temporary audio storage" }) +
          "\n",
      );
    return;
  }
  let child: ReturnType<typeof spawn> | undefined;
  let cancelled = false;
  const deadline = setTimeout(
    () => {
      abort();
      if (!res.destroyed)
        res.end(
          JSON.stringify({ error: "Timing exceeded the 30-minute limit." }) +
            "\n",
        );
    },
    30 * 60 * 1000,
  );
  const abort = () => {
    cancelled = true;
    child?.kill("SIGTERM");
  };
  res.on("close", abort);
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 250_000_000) throw Error("Audio upload limit is 250 MB");
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    const separator = body.indexOf(10);
    if (separator < 0 || separator > 5_000_000)
      throw Error("Invalid timing request");
    const metadata = JSON.parse(body.subarray(0, separator).toString());
    metadata.project = projectSchema.parse(metadata.project);
    const audioPath = path.join(directory, "audio.media");
    await writeFile(audioPath, body.subarray(separator + 1));
    res.writeHead(200, {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    });
    if (cancelled || res.destroyed) return;
    res.flushHeaders();
    child = spawn(
      process.env.WORKBENCH_PYTHON ||
        path.join(root, "python-src/venv/bin/python"),
      ["-u", "-m", "workbench.automatic_timing"],
      {
        cwd: path.join(root, "python-src"),
        env: { ...process.env, NUMBA_THREADING_LAYER: "workqueue" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    // Emit complete JSON lines so stderr progress cannot split a result packet.
    let stdout = "";
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => {
      stdout += chunk;
      let newline: number;
      while ((newline = stdout.indexOf("\n")) >= 0) {
        if (!res.destroyed) res.write(stdout.slice(0, newline + 1));
        stdout = stdout.slice(newline + 1);
      }
    });
    let firstProgress: { processedSeconds: number; at: number } | undefined;
    let stderr = "",
      progressBuffer = "",
      lastPercent = -1;
    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000);
      progressBuffer += chunk;
      const records = progressBuffer.split(/[\r\n]/);
      progressBuffer = records.pop()!.slice(-4000);
      // tqdm prefixes a refresh with CR; its current line has no terminator.
      // Inspect that line now rather than waiting for the next audio window.
      for (const record of [...records, progressBuffer]) {
        const progress = whisperProgress(record);
        if (progress && progress.percent > lastPercent && !res.destroyed) {
          lastPercent = progress.percent;
          firstProgress ??= {
            processedSeconds: progress.processedSeconds,
            at: Date.now(),
          };
          if (progress.percent === 0) continue;
          const eta = timingEta(firstProgress, progress, Date.now());
          res.write(
            JSON.stringify({
              progress: `Transcribing audio: ${progress.percent}% · ${progress.processedSeconds} / ${progress.totalSeconds} seconds · ${metadata.ids?.length ?? metadata.project.occurrences.length} lyrics to align`,
              transcriptionPercent: progress.percent,
              etaSeconds: eta,
            }) + "\n",
          );
        }
      }
    });
    child.stdin!.on("error", () => {});
    child.stdin!.end(JSON.stringify({ ...metadata, audioPath }));
    await new Promise<void>((resolve, reject) => {
      child!.on("error", reject);
      child!.on("close", (code) => {
        if (code && !res.destroyed)
          res.write(
            JSON.stringify({ error: stderr || "Timing worker failed" }) + "\n",
          );
        resolve();
      });
    });
    if (running === job) running = undefined;
    res.end();
  } catch (error) {
    if (!res.destroyed) {
      if (!res.headersSent)
        res.writeHead(400, { "Content-Type": "application/x-ndjson" });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }) + "\n",
      );
    }
  } finally {
    clearTimeout(deadline);
    if (running === job) running = undefined;
    res.off("close", abort);
    await rm(directory, { recursive: true, force: true });
  }
}

export async function cachedTimingModels(
  _req: IncomingMessage,
  res: ServerResponse,
) {
  const names = ["base", "small", "medium", "large-v3-turbo"];
  const found = await Promise.all(
    names.map(async (name) => {
      try {
        return (
          await stat(path.join(homedir(), ".cache/whisper", name + ".pt"))
        ).isFile()
          ? name
          : null;
      } catch {
        return null;
      }
    }),
  );
  res
    .writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    })
    .end(JSON.stringify({ models: found.filter(Boolean) }));
}
