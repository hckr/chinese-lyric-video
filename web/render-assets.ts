import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export async function createRenderAssets() {
  const directory = await mkdtemp(path.join(tmpdir(), "lyric-render-"));
  const types = new Map<string, string>();
  return {
    close: () => rm(directory, { recursive: true, force: true }),
    async serve(req: IncomingMessage, res: ServerResponse) {
      const route = req.url ?? "";
      const origin = req.headers.origin;
      if (req.method === "POST" && route === "/api/render-assets") {
        if (
          (origin !== `http://127.0.0.1:${req.socket.localPort}` &&
            origin !== `http://localhost:${req.socket.localPort}`) ||
          req.headers["x-workbench-upload"] !== "1"
        ) {
          res.writeHead(403).end();
          return;
        }
        const id = randomUUID();
        const file = path.join(directory, id);
        try {
          await pipeline(
            req,
            createWriteStream(file, { flags: "wx", mode: 0o600 }),
          );
          const type = req.headers["content-type"] ?? "";
          types.set(
            id,
            /^(audio|image|video)\/[a-z0-9.+-]+$/i.test(type)
              ? type
              : "application/octet-stream",
          );
          res.writeHead(201, { "Content-Type": "application/json" }).end(
            JSON.stringify({
              url: `http://127.0.0.1:${req.socket.localPort}/api/render-assets/${id}`,
            }),
          );
        } catch {
          await rm(file, { force: true });
          res.writeHead(400).end();
        }
        return;
      }
      const id = route.slice("/api/render-assets/".length);
      const type = types.get(id);
      if (!type || !["GET", "HEAD", "OPTIONS"].includes(req.method ?? "")) {
        res.writeHead(404).end();
        return;
      }
      if (origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader(
          "Access-Control-Expose-Headers",
          "Accept-Ranges, Content-Range, Content-Length",
        );
        res.setHeader("Vary", "Origin");
      }
      if (req.method === "OPTIONS") {
        res
          .writeHead(204, {
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range",
          })
          .end();
        return;
      }
      const file = path.join(directory, id);
      const { size } = await stat(file);
      let start = 0,
        end = size - 1;
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match) {
          start = match[1]
            ? Number(match[1])
            : Math.max(0, size - Number(match[2]));
          end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
        }
        if (!match || start > end || (!match[1] && !match[2])) {
          res.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
          return;
        }
        res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      }
      res.writeHead(range ? 206 : 200, {
        "Accept-Ranges": "bytes",
        "Content-Type": type,
        "Content-Length": end - start + 1,
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      if (req.method === "HEAD" || !size) res.end();
      else await pipeline(createReadStream(file, { start, end }), res);
    },
  };
}
