// These two directories belong exclusively to workbench tests.
// Never clear out/ itself: it also contains the user's rendered videos.
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

for (const directory of ["out/workbench/", "out/reference/"]) {
  await rm(fileURLToPath(new URL(`../${directory}`, import.meta.url)), {
    recursive: true,
    force: true,
  });
  console.log(`Removed test artifacts: ${directory}`);
}
