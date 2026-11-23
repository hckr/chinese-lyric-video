import assert from "node:assert/strict";
import http from "node:http";
import { build } from "esbuild";
import { openBrowser } from "@remotion/renderer";
import { browserExecutable } from "./browser-executable.ts";

declare global {
  interface Window {
    verifyLoop: () => Promise<{ frames: string[]; rms: number }>;
  }
}

const bundle = await build({
  entryPoints: ["web/tests/loop-web-render-fixture.tsx"],
  bundle: true,
  write: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
const server = http.createServer((request, response) => {
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "application/javascript");
    response.end(bundle.outputFiles[0].contents);
  } else response.end('<script src="/fixture.js"></script>');
});
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
let browser;
try {
  browser = await openBrowser("chrome", {
    browserExecutable: browserExecutable(
      process.platform,
      process.arch,
      process.env,
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
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Expected local TCP address");
  await page.goto({ url: "http://127.0.0.1:" + address.port, timeout: 30000 });
  const result = await page.evaluate(() => window.verifyLoop());
  assert.deepEqual(result.frames, [
    "100",
    "010",
    "001",
    "110",
    "001",
    "010",
    "100",
    "010",
    "001",
    "110",
  ]);
  // The fixture's 2000-amplitude PCM sine wave has an expected RMS of 0.043.
  assert(
    result.rms > 0.035 && result.rms < 0.05,
    "Unexpected soundtrack level: " + result.rms,
  );
  console.log(
    "Web-rendered ping-pong passed both turnarounds and the single soundtrack level check.",
  );
} finally {
  await browser?.close({ silent: true });
  server.close();
}
