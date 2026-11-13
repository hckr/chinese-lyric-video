// Baseline existing compositions using only the cached browser. No src mutation.
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { openBrowser, getCompositions, renderStill } from "@remotion/renderer";
(async () => {
  const output = path.resolve("out/reference", String(Date.now()));
  fs.mkdirSync(output, { recursive: true });
  try {
    const serveUrl = await bundle({
      entryPoint: path.resolve("src/index.ts"),
      outDir: path.join(output, "bundle"),
      symlinkPublicDir: true,
    });
    const browser = await openBrowser("chrome", {
      browserExecutable:
        process.env.WORKBENCH_BROWSER ||
        path.resolve(
          "node_modules/.remotion/chrome-headless-shell/mac-x64/chrome-headless-shell-mac-x64/chrome-headless-shell",
        ),
    });
    try {
      const compositions = await getCompositions(serveUrl, {
        puppeteerInstance: browser,
        timeoutInMilliseconds: 120000,
      });
      fs.writeFileSync(
        path.join(output, "compositions.json"),
        JSON.stringify(compositions, null, 2),
      );
      const results: Array<
        | { id: string; frame: number; status: "passed"; file: string }
        | { id: string; frame: number; status: "failed"; error: string }
      > = [];
      for (const composition of [...compositions].sort(
        (a, b) =>
          Number(b.id.startsWith("Thumbnail")) -
          Number(a.id.startsWith("Thumbnail")),
      )) {
        // Initial representative frame per family; extended coverage is required before checkpoint D.
        const frame = composition.id.startsWith("Thumbnail")
          ? 0
          : composition.id === "LyricVideo2"
            ? 500
            : composition.id === "LyricVideoShort"
              ? 100
              : 500;
        const name = `${composition.id}-${frame}.png`;
        console.log("Rendering " + name);
        try {
          await renderStill({
            serveUrl,
            composition,
            frame,
            output: path.join(output, name),
            imageFormat: "png",
            scale: 1,
            puppeteerInstance: browser,
            timeoutInMilliseconds: 120000,
          });
          results.push({
            id: composition.id,
            frame,
            file: name,
            status: "passed",
          });
        } catch (error) {
          results.push({
            id: composition.id,
            frame,
            status: "failed",
            error: String(error),
          });
          console.error(composition.id + ": " + String(error).slice(0, 250));
        }
        fs.writeFileSync(
          path.join(output, "results.json"),
          JSON.stringify(results, null, 2),
        );
      }
      if (results.some((r) => r.status === "failed")) process.exitCode = 1;
      console.log(
        "Reference frames saved under out/reference; no equivalence claims until later comparisons.",
      );
    } finally {
      await browser.close({ silent: true });
    }
  } finally {
    fs.rmSync(path.join(output, "bundle"), { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
