import assert from "node:assert/strict";
import type { openBrowser } from "@remotion/renderer";
import { rawProject, type Project } from "../src/domain.ts";
type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof openBrowser>>["newPage"]>
>;
export async function detectedAudioAcceptance(
  page: Page,
  helpers: {
    upload: (name: string, text: string) => Promise<void>;
    click: (text: string) => Promise<void>;
    read: () => Promise<Project>;
  },
) {
  const { upload, click, read } = helpers;
  const project = rawProject("你好\n世界\n你好", "Audio origin", "Test");
  project.phrases[0].translation = { en: "Hello", pl: "Cześć" };
  project.phrases[0].words = [
    {
      id: "hello",
      hanzi: "你好",
      pinyin: "nǐhǎo",
      translation: { en: "hello" },
    },
  ];
  project.phrases[0].segmentationApproved = true;
  project.occurrences[0].detectedFromAudio = true;
  project.occurrences[2].detectedFromAudio = false;
  await upload("origin.json", JSON.stringify(project));
  await click("Timing");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll("[data-occurrence] .detected-audio-badge")
          .length,
    ),
    1,
  );
  assert.equal(
    await page.evaluate(() =>
      document.querySelector(
        '[data-occurrence="line-2"] .detected-audio-badge',
      ),
    ),
    null,
  );
  await click("Repeat");
  await click("Add repeat");
  assert.equal(
    (await read()).occurrences.filter((o) => o.detectedFromAudio).length,
    2,
  );
  await click("Undo");
  assert.equal(
    (await read()).occurrences.filter((o) => o.detectedFromAudio).length,
    1,
  );
  await click("Translate");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll(".lyric-timing-list .detected-audio-badge")
          .length,
    ),
    1,
  );
  await page.evaluate(() => {
    window.__downloads = [];
    HTMLAnchorElement.prototype.click = function () {
      const name = this.download;
      window.__downloads.push(
        fetch(this.href)
          .then((r) => r.text())
          .then((text) => ({ name, text })),
      );
    };
  });
  await click("Download project JSON");
  const saved = JSON.parse(
    (await page.evaluate(() => Promise.all(window.__downloads))).at(-1)!.text,
  ) as Project;
  assert.equal(saved.occurrences[0].detectedFromAudio, true);
  assert.ok(
    !("detectedFromAudio" in saved.occurrences.find((o) => o.id === "line-2")!),
  );
  await page.goto({
    url: await page.evaluate(() => location.href),
    timeout: 30000,
  });
  await click("Timing");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll("[data-occurrence] .detected-audio-badge")
          .length,
    ),
    1,
  );
  assert.equal((await read()).occurrences[0].detectedFromAudio, true);
  assert.equal((await read()).phrases[0].review, "pending");
  // Reload clears the test's download interception too.
  await page.evaluate(() => {
    window.__downloads = [];
    HTMLAnchorElement.prototype.click = function () {
      const name = this.download;
      window.__downloads.push(
        fetch(this.href)
          .then((r) => r.text())
          .then((text) => ({ name, text })),
      );
    };
  });
  await click("Translate");
  await click("Mark phrase reviewed");
  assert.equal((await read()).phrases[0].review, "reviewed");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll(".lyric-timing-list .detected-audio-badge")
          .length,
    ),
    0,
  );
  await click("Timing");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll("[data-occurrence] .detected-audio-badge")
          .length,
    ),
    0,
  );
  assert.equal((await read()).occurrences[0].detectedFromAudio, true);
  await click("Download project JSON");
  const reviewed = JSON.parse(
    (await page.evaluate(() => Promise.all(window.__downloads))).at(-1)!.text,
  ) as Project;
  assert.equal(reviewed.occurrences[0].detectedFromAudio, true);
  await click("Undo");
  assert.equal((await read()).phrases[0].review, "pending");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll("[data-occurrence] .detected-audio-badge")
          .length,
    ),
    1,
  );
  await click("Redo");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll("[data-occurrence] .detected-audio-badge")
          .length,
    ),
    0,
  );
  await click("Translate");
  await page.evaluate(() => {
    const input = document.querySelector<HTMLTextAreaElement>(
      '[aria-label="English sentence"]',
    )!;
    Object.getOwnPropertyDescriptor(
      input.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "Edited hello");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal((await read()).phrases[0].review, "pending");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll(".lyric-timing-list .detected-audio-badge")
          .length,
    ),
    1,
  );
  assert.equal((await read()).occurrences[0].detectedFromAudio, true);
  console.log(
    "Detected audio acceptance passed: independent badges, repeat/undo, false omission, download/reload, hide after review, reappear after undo/edit, and retained origin.",
  );
}
