// Render a generated edited Macchiato export with the original composition via a bundle-only replacement.
// Never overwrite the source song or execute imported user TS in the importer.
import fs from "node:fs";
import path from "node:path";
import webpack from "webpack";
import { importLegacy, exportLegacy } from "../src/legacy.ts";
import { bundle } from "@remotion/bundler";
import { openBrowser, getCompositions, renderStill } from "@remotion/renderer";
(async () => {
  fs.mkdirSync("out/workbench", { recursive: true });
  const output = fs.mkdtempSync(path.resolve("out/workbench/export-check-"));
  const songArgument = process.argv.indexOf("--song");
  const source =
    songArgument < 0
      ? "src/Macchiato_Special_Affection_for_You.ts"
      : process.argv[songArgument + 1];
  if (!source) throw Error("--song requires a TypeScript song file");
  const project = importLegacy(fs.readFileSync(source, "utf8"));
  if (songArgument < 0)
    project.phrases[0].translation.en = "Workbench export verified";
  const song = path.join(output, "Song.ts");
  fs.writeFileSync(song, exportLegacy(project));
  try {
    const serveUrl = await bundle({
      entryPoint: path.resolve("src/index.ts"),
      outDir: path.join(output, "bundle"),
      symlinkPublicDir: true,
      webpackOverride: (config) => ({
        ...config,
        plugins: [
          ...(config.plugins ?? []),
          new webpack.NormalModuleReplacementPlugin(
            /^\.\/Macchiato_Special_Affection_for_You$/,
            (resource) => {
              resource.request = song;
            },
          ),
        ],
      }),
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
      const composition = compositions.find((c) => c.id === "LyricVideo2");
      if (!composition) throw Error("LyricVideo2 composition is missing");
      const cue = project.occurrences[1] ?? project.occurrences[0];
      const frame =
        songArgument < 0
          ? 100
          : Math.round((((cue?.startMs ?? 0) + 100) / 1000) * composition.fps);
      await renderStill({
        serveUrl,
        composition,
        frame,
        output: path.join(output, "edited.png"),
        imageFormat: "png",
        scale: 1,
        puppeteerInstance: browser,
        timeoutInMilliseconds: 120000,
      });
      fs.writeFileSync(
        path.join(output, "result.json"),
        JSON.stringify(
          {
            composition: composition.id,
            source,
            occurrences: project.occurrences,
            frame,
            export: song,
            translation: project.phrases[0].translation.en,
          },
          null,
          2,
        ),
      );
      console.log(
        "Edited legacy export rendered by unchanged LyricVideo2: " +
          path.join(output, "edited.png"),
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
