import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
const idPattern = /^[A-Za-z0-9_-]{11}$/;
export function youtubeId(input: string) {
  const url = new URL(input);
  const host = url.hostname;
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw Error("Enter an HTTPS YouTube video link.");
  const id =
    host === "youtu.be"
      ? url.pathname.slice(1)
      : [
            "www.youtube.com",
            "youtube.com",
            "music.youtube.com",
            "m.youtube.com",
          ].includes(host)
        ? url.pathname === "/watch"
          ? url.searchParams.get("v")
          : /^\/shorts\/([^/]+)$/.exec(url.pathname)?.[1]
        : null;
  if (!id || !idPattern.test(id))
    throw Error("Enter a single YouTube video link.");
  return id;
}

async function cacheDirectory(root: string) {
  const dest = path.resolve(
    root,
    process.env.WORKBENCH_YOUTUBE_CACHE_DIR || ".cache/youtube",
  );
  // Resolve the nearest existing ancestor before creating anything.
  let parent = dest;
  while (!(await fs.stat(parent).catch(() => undefined)))
    parent = path.dirname(parent);
  const resolved = path.resolve(
    await fs.realpath(parent),
    path.relative(parent, dest),
  );
  for (const served of ["public", "web/dist"]) {
    const dir = path.resolve(await fs.realpath(root), served);
    if (resolved === dir || resolved.startsWith(dir + path.sep))
      throw Error("Choose a private cache directory.");
  }
  await fs.mkdir(resolved, { recursive: true });
  return resolved;
}

async function acquire(
  root: string,
  cache: string,
  id: string,
  signal: AbortSignal,
) {
  const target = path.join(cache, Buffer.from(id).toString("hex"));
  const manifest = path.join(target, "source.json");
  try {
    await fs.access(path.join(target, "recording.mp4"));
    return JSON.parse(await fs.readFile(manifest, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temp = await fs.mkdtemp(path.join(cache, ".fetch-"));
  try {
    const python =
      process.env.WORKBENCH_PYTHON ||
      path.join(
        root,
        "python-src/venv",
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
      );
    const url = "https://www.youtube.com/watch?v=" + id;
    const bin = process.env.WORKBENCH_FFMPEG_DIR;
    const options = {
      signal,
      cwd: temp,
      timeout: 600000,
      maxBuffer: 8 * 1024 * 1024,
    };
    await execute(
      python,
      [
        "-m",
        "yt_dlp",
        "--ignore-config",
        "--no-playlist",
        "--js-runtimes",
        "node:" + process.execPath,
        ...(bin ? ["--ffmpeg-location", bin] : []),
        "--match-filter",
        "!is_live & availability=public",
        "-f",
        "bv[vcodec^=avc1][height<=1080]+ba[acodec^=mp4a]/b[vcodec^=avc1][acodec^=mp4a]",
        "--merge-output-format",
        "mp4",
        "--write-info-json",
        "-o",
        "recording.%(ext)s",
        url,
      ],
      options,
    ).catch(() => {
      throw Error(
        "Download failed. Check yt-dlp, FFmpeg, and public video availability.",
      );
    });
    const media = path.join(temp, "recording.mp4");
    const probe = await execute(
      bin ? path.join(bin, "ffprobe") : "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
        media,
      ],
      options,
    );
    const tracks = probe.stdout.trim().split(/\s+/);
    if (!tracks.includes("audio") || !tracks.includes("video"))
      throw Error("Recording needs both audio and video.");
    const infoFile = path.join(temp, "recording.info.json");
    const info = JSON.parse(await fs.readFile(infoFile, "utf8"));
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(media)) hash.update(chunk);
    const source = {
      id,
      url,
      fingerprint: hash.digest("hex"),
      fetchedAt: new Date().toISOString(),
      ...Object.fromEntries(
        [
          "title",
          "channel",
          "channel_url",
          "track",
          "artist",
          "album",
          "duration",
          "upload_date",
          "license",
        ]
          .filter(
            (k) => typeof info[k] === "string" || typeof info[k] === "number",
          )
          .map((k) => [k, info[k]]),
      ),
    };
    await fs.unlink(infoFile);
    await fs.writeFile(path.join(temp, "source.json"), JSON.stringify(source));
    await fs.rename(temp, target);
    return source;
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

const active = new Map<
  string,
  {
    job: ReturnType<typeof acquire>;
    controller: AbortController;
    users: number;
  }
>();
export async function youtubeApi(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
) {
  if (
    req.headers.origin &&
    req.headers.origin !== "http://" + req.headers.host
  ) {
    res.writeHead(403).end();
    return;
  }
  try {
    const cache = await cacheDirectory(root);
    const media = /^\/api\/youtube\/media\/([A-Za-z0-9_-]{11})$/.exec(
      req.url || "",
    );
    if (media && req.method === "GET") {
      const file = path.join(
        cache,
        Buffer.from(media[1]).toString("hex"),
        "recording.mp4",
      );
      const stat = await fs.stat(file);
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": stat.size,
        "Cache-Control": "no-store",
      });
      await pipeline(createReadStream(file), res);
      return;
    }
    if (
      req.url !== "/api/youtube" ||
      req.method !== "POST" ||
      req.headers["content-type"] !== "application/json"
    ) {
      res.writeHead(400).end();
      return;
    }
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 8192) {
        res.writeHead(413).end();
        return;
      }
    }
    const id = youtubeId(JSON.parse(body).url);
    const key = path.join(cache, id);
    let transfer = active.get(key);
    if (!transfer || transfer.controller.signal.aborted) {
      const controller = new AbortController();
      const job = acquire(root, cache, id, controller.signal).finally(() => {
        if (active.get(key)?.controller === controller) active.delete(key);
      });
      transfer = { job, controller, users: 0 };
      active.set(key, transfer);
    }
    const pending = transfer;
    pending.users++;
    const release = () => {
      if (--pending.users === 0) pending.controller.abort();
    };
    res.once("close", release);
    const source = await pending.job;
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(source));
  } catch (error) {
    if (!res.headersSent)
      res
        .writeHead(
          (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 400,
          { "Content-Type": "application/json" },
        )
        .end(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : "YouTube import failed.",
          }),
        );
  }
}
