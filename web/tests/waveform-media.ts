import assert from "node:assert/strict";
import path from "node:path";
import type { openBrowser } from "@remotion/renderer";
type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof openBrowser>>["newPage"]>
>;
export async function attachTimingMedia(page: Page, name: string) {
  // Remotion's minimal CDP type map omits these standard DOM-domain commands.
  const client = page._client() as unknown as {
    send(
      method: "DOM.getDocument",
    ): Promise<{ value: { root: { nodeId: number } } }>;
    send(
      method: "DOM.querySelector",
      params: { nodeId: number; selector: string },
    ): Promise<{ value: { nodeId: number } }>;
    send(
      method: "DOM.setFileInputFiles",
      params: { nodeId: number; files: string[] },
    ): Promise<unknown>;
  };

  const doc = await client.send("DOM.getDocument");
  const node = await client.send("DOM.querySelector", {
    nodeId: doc.value.root.nodeId,
    selector: '[aria-label="Local audio file"]',
  });
  await client.send("DOM.setFileInputFiles", {
    nodeId: node.value.nodeId,
    files: [path.resolve(name)],
  });
}
export async function waveformMedia(page: Page) {
  async function wave() {
    const deadline = Date.now() + 65000;
    while (Date.now() < deadline) {
      if (
        await page.evaluate(
          () =>
            document.querySelectorAll(".timing-wave svg line").length === 1600,
        )
      )
        return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw Error(
      await page.evaluate(
        () =>
          document.querySelector(".timing-wave")?.textContent ??
          "Waveform timeout",
      ),
    );
  }
  // Deliberately forbid whole-File reads; bounded slices remain allowed.
  await page.evaluate(() => {
    File.prototype.arrayBuffer = () =>
      Promise.reject(
        Error("Whole-file arrayBuffer forbidden by regression test"),
      );
  });
  await attachTimingMedia(page, "public/Angela_Zhang_Keep_Walking.mp4");
  await wave();
  assert.ok(
    await page.evaluate(() =>
      [...document.querySelectorAll(".timing-wave svg line")].some(
        (l) => l.getAttribute("y1") !== l.getAttribute("y2"),
      ),
    ),
  );
  await page.evaluate(async () => {
    await document.querySelector("audio")!.play();
  });
  assert.equal(
    await page.evaluate(() => document.querySelector("audio")!.paused),
    false,
  );
  await page.evaluate(() => document.querySelector("audio")!.pause());
  // Replace an analysis immediately; old work must never publish over the new file.
  await attachTimingMedia(page, "public/Angela_Zhang_Keep_Walking.mp4");
  await attachTimingMedia(
    page,
    "public/Macchiato_Special_Affection_for_You.mp4",
  );
  await wave();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("lyric-workbench-v1")!).audio.name,
    ),
    "Macchiato_Special_Affection_for_You.mp4",
  );
  console.log(
    "Large-video waveform passed: real 83 MB MP4, no whole-file arrayBuffer, nonzero peaks, playback and replacement.",
  );
}
