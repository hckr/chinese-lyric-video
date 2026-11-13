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
    const shutdown = () => {
      void ctx.dispose().then(() => process.exit(0));
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
    await ctx.watch();
    const server = await ctx.serve({
      servedir: "web/dist",
      host: "127.0.0.1",
      port,
    });
    console.log(
      `Lyric Workbench: http://127.0.0.1:${server.port} (no browser opened)`,
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
