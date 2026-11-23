import { execFileSync } from "node:child_process";
import { ESLint } from "eslint";
import { selectedFiles } from "./format-changes.mts";

const cwd = process.cwd();
const files = selectedFiles(cwd, "staged").filter((file) =>
  /^(src|web|scripts)\/.*\.(?:tsx?|mts|[cm]?jsx?)$/.test(file),
);

if (files.length) {
  const eslint = new ESLint({ cwd });
  const results = [];
  for (const file of files) {
    const source = execFileSync("git", ["show", `:${file}`], {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    results.push(...(await eslint.lintText(source, { filePath: file })));
  }
  const formatter = await eslint.loadFormatter("stylish");
  process.stdout.write(await formatter.format(results));
  if (results.some(({ errorCount }) => errorCount > 0)) process.exitCode = 1;
}

if (!process.exitCode) console.log("Staged lint check passed.");
