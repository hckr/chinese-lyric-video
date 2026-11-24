import { youtubeApi } from "./youtube-api.ts";
import { execFile } from "node:child_process";
import { translateLyrics } from "./translation-api.ts";
import { automaticTiming, cachedTimingModels } from "./timing-api.ts";
import { createRenderAssets } from "./render-assets.ts";
import http from "node:http";
import { importLyrics } from "./import-api.ts";
// Separate loopback-only file editor. Uses the explicitly declared esbuild development dependency.
import * as esbuild from "esbuild";
import fs from "node:fs/promises";
(async () => {
  await fs.mkdir("web/dist", { recursive: true });
  await fs.copyFile("web/index.html", "web/dist/index.html");
  const production = process.argv.includes("--build");
  const port = Number(process.env.WORKBENCH_PORT ?? 5173);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw Error("WORKBENCH_PORT must be an integer between 0 and 65535");
  const ctx = await esbuild.context({
    banner: production
      ? undefined
      : {
          js: 'new EventSource("/esbuild").addEventListener("change", () => location.reload());',
        },
    entryPoints: ["web/src/main.tsx"],
    bundle: true,
    outfile: "web/dist/app.js",
    sourcemap: true,
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        process.argv.includes("--build") ? "production" : "development",
      ),
    },
  });
  if (process.argv.includes("--build")) {
    await ctx.rebuild();
    await ctx.dispose();
  } else {
    const frontend: { server?: http.Server } = {};
    const assets = await createRenderAssets();
    const shutdown = () => {
      frontend.server?.close();
      frontend.server?.closeAllConnections();
      void Promise.all([ctx.dispose(), assets.close()]).then(() =>
        process.exit(0),
      );
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
    await ctx.watch();
    const server = await ctx.serve({
      servedir: "web/dist",
      host: "127.0.0.1",
      port: 0,
    });
    frontend.server = http.createServer((req, res) => {
      if (req.url === "/api/youtube" || req.url?.startsWith("/api/youtube/")) {
        void youtubeApi(req, res, process.cwd());
        return;
      }
      if (
        req.url === "/api/render-assets" ||
        req.url?.startsWith("/api/render-assets/")
      ) {
        void assets.serve(req, res).catch(() => res.destroy());
        return;
      }
      if (req.url === "/api/translation/providers" && req.method === "GET") {
        execFile(
          process.env.WORKBENCH_PYTHON ||
            process.cwd() + "/python-src/venv/bin/python",
          ["-m", "workbench.react_translation", "capabilities"],
          { cwd: "python-src", timeout: 15000 },
          (error, stdout) => {
            res.writeHead(error ? 503 : 200, {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            });
            res.end(error ? "{}" : stdout);
          },
        );
        return;
      }
      if (
        req.url === "/api/translation/generate" ||
        req.url === "/api/translation/revise"
      ) {
        void translateLyrics(
          req,
          res,
          process.cwd(),
          req.url.endsWith("/revise"),
        );
        return;
      }
      if (req.url === "/api/timing-models") {
        void cachedTimingModels(req, res);
        return;
      }
      if (req.url === "/api/automatic-timing") {
        void automaticTiming(req, res, process.cwd());
        return;
      }
      if (
        req.url === "/api/import-lyrics" ||
        req.url === "/api/dictionary" ||
        req.url === "/api/suggest-groups" ||
        req.url === "/api/convert-characters"
      ) {
        void importLyrics(
          req,
          res,
          process.cwd(),
          req.url === "/api/dictionary"
            ? "dictionary"
            : req.url === "/api/suggest-groups"
              ? "groups"
              : req.url === "/api/convert-characters"
                ? "convert"
                : "import",
        ).catch(() => {
          if (!res.writableEnded)
            res.writeHead(500).end(
              JSON.stringify({
                error: "Local import failed. Existing project retained.",
              }),
            );
        });
        return;
      }
      const proxy = http.request(
        {
          hostname: "127.0.0.1",
          port: server.port,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: `127.0.0.1:${server.port}` },
        },
        (upstream) => {
          res.writeHead(upstream.statusCode ?? 502, upstream.headers);
          upstream.pipe(res);
        },
      );
      proxy.on("error", () => {
        if (!res.writableEnded) res.writeHead(502).end();
      });
      req.pipe(proxy);
      res.on("close", () => proxy.destroy());
    });
    await new Promise<void>((resolve, reject) => {
      frontend.server!.once("error", reject);
      frontend.server!.listen(port, "127.0.0.1", resolve);
    });
    const address = frontend.server.address();
    if (!address || typeof address === "string")
      throw Error("Missing workbench address");
    console.log(
      `Lyric Workbench: http://127.0.0.1:${address.port} (no browser opened)`,
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
