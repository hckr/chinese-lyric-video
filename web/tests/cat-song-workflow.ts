import assert from "node:assert/strict";
import fs from "node:fs";
import type { openBrowser } from "@remotion/renderer";
import { hanzi, phraseIssues, type Project } from "../src/domain.ts";
import { importLegacy } from "../src/legacy.ts";

type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof openBrowser>>["newPage"]>
>;
type Helpers = {
  click: (text: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  read: () => Promise<Project>;
  upload: (name: string, source: string) => Promise<void>;
};

export async function catSongWorkflow(
  page: Page,
  { click, fill, read, upload }: Helpers,
) {
  const output = "output/playwright/cat-song-workflow";
  fs.mkdirSync(output, { recursive: true });
  const waitFor = async (
    description: string,
    predicate: () => Promise<boolean>,
  ) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error(`Timed out: ${description}`);
  };
  const raw = fs.readFileSync(
    "python-src/tests/fixtures/cat-song-workflow.txt",
    "utf8",
  );
  await fill("textarea.raw", raw);
  await click("Import raw lyrics");
  await waitFor(
    "raw import",
    async () => (await read())?.occurrences.length === 73,
  );
  const imported = await read();
  assert.deepEqual(imported.metadata, { title: "做你的猫", artist: "小可乐" });
  assert.equal(imported.phrases.length, 22);
  assert.equal(imported.occurrences.length, 73);
  const expected = raw.trim().split("\n").slice(4);
  assert.deepEqual(
    imported.occurrences.map(
      (cue) => imported.phrases.find((p) => p.id === cue.phraseId)!.lyricKey,
    ),
    expected,
  );
  for (const phrase of imported.phrases) {
    assert.equal(
      phrase.words.map((word) => word.hanzi).join(""),
      hanzi(phrase.lyricKey),
    );
    assert.ok(phrase.words.length);
    assert.ok(phrase.words.every((word) => !/\s/u.test(word.pinyin)));
    assert.equal(phrase.review, "pending");
    assert.equal(phrase.segmentationApproved, false);
    assert.deepEqual(phrase.translation, { en: "", pl: "" });
    assert.ok(
      !phraseIssues(phrase).some((issue) =>
        /invalid Pinyin|syllable count/u.test(issue),
      ),
      phrase.lyricKey,
    );
  }
  assert.ok(
    imported.occurrences.every(
      (cue) => cue.startMs === null && cue.endMs === null,
    ),
  );
  assert.equal(
    imported.phrases
      .find((p) => p.lyricKey === "在你心上撒娇")!
      .words.find((w) => w.hanzi === "心")!.pinyin,
    "xīn",
  );
  assert.equal(
    await page.evaluate(
      () => !!document.querySelector(".hero, .preview, .personal-notes"),
    ),
    false,
  );
  const beforeBlank = await read();
  await click("Add word");
  const blank = (await read()).phrases[0].words.at(-1)!;
  assert.equal(blank.hanzi, "");
  assert.equal(blank.pinyin, "");
  assert.deepEqual(blank.translation, { en: "" });
  assert.equal(
    await page.evaluate(() =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent?.trim() === "Grammar note",
      ),
    ),
    false,
  );
  await click("Undo");
  assert.deepEqual(await read(), beforeBlank);
  await fill('[aria-label="English sentence"]', "Be your cat, meow meow");
  await fill('[aria-label="Polish sentence"]', "Być twoim kotem, miau miau");
  await waitFor(
    "dictionary lookup",
    async () =>
      await page.evaluate(() => !!document.querySelector(".dictionary-source")),
  );
  assert.ok(
    (await read()).phrases.every((phrase) => !("dictionaryEntries" in phrase)),
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLInputElement>('[aria-label="Pinyin 3"]')!
      .focus(),
  );
  await waitFor(
    "dictionary example",
    async () =>
      await page.evaluate(
        () => !!document.querySelector(".dictionary-example"),
      ),
  );
  assert.equal(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".dictionary-pinyin-bubble")!)
          .visibility,
    ),
    "hidden",
  );
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".dictionary-example")!.focus(),
  );
  assert.equal(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".dictionary-pinyin-bubble")!)
          .visibility,
    ),
    "visible",
  );
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector(".dictionary-pinyin-bubble")!
        .textContent!.includes("pí gé de"),
    ),
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLInputElement>('[aria-label="Pinyin 1"]')!
      .focus(),
  );
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
  const sidebar = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(
      ".workspace > .inspector",
    )!;
    const header = document.querySelector("main > header")!;
    return {
      top: panel.getBoundingClientRect().top,
      headerBottom: header.getBoundingClientRect().bottom,
      bottom: panel.getBoundingClientRect().bottom,
      viewport: innerHeight,
      scrolls: panel.scrollHeight > panel.clientHeight,
    };
  });
  assert.ok(
    sidebar.top >= sidebar.headerBottom &&
      sidebar.top <= sidebar.headerBottom + 17,
    JSON.stringify(sidebar),
  );
  assert.ok(sidebar.bottom <= sidebar.viewport - 15);
  assert.ok(sidebar.scrolls);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const shot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    `${output}/dictionary-lookup.png`,
    Buffer.from(shot.value.data, "base64"),
  );
  const edited = await read();
  await page.goto({
    url: await page.evaluate(() => location.href),
    timeout: 30000,
  });
  await waitFor(
    "saved editor",
    async () =>
      await page.evaluate(
        () => !!document.querySelector('[aria-label="English sentence"]'),
      ),
  );
  assert.deepEqual(await read(), edited);
  await click("Add lyric");
  assert.equal(
    await page.evaluate(
      () => !!document.querySelector(".lyric-structure-panel select"),
    ),
    false,
  );
  await click("Add lyric");
  await click("Timing");
  assert.equal(
    await page.evaluate(() =>
      [...document.querySelectorAll(".lyric-structure-actions button")].some(
        (button) => button.textContent?.includes("Add lyric"),
      ),
    ),
    false,
  );
  const beforeRepeat = await read();
  await click("Repeat");
  assert.ok(
    await page.evaluate(
      () =>
        document.querySelector<HTMLDialogElement>(".repeat-lyric-dialog")!.open,
    ),
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.tagName),
    "SELECT",
  );
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector(".repeat-lyric-dialog option")!
        .textContent!.includes("("),
    ),
  );
  const repeatShot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    `${output}/repeat-dialog.png`,
    Buffer.from(repeatShot.value.data, "base64"),
  );
  await click("Cancel");
  assert.deepEqual(await read(), beforeRepeat);
  await click("Repeat");
  await page.evaluate(() =>
    document
      .querySelector<HTMLDialogElement>(".repeat-lyric-dialog")!
      .dispatchEvent(new Event("cancel", { cancelable: true })),
  );
  assert.deepEqual(await read(), beforeRepeat);
  await click("Repeat");
  await click("Add repeat");
  const repeated = await read();
  assert.equal(repeated.occurrences.length, 74);
  assert.equal(repeated.occurrences[1].phraseId, edited.phrases[0].id);
  assert.deepEqual(repeated.phrases, edited.phrases);
  await click("Undo");
  assert.deepEqual(await read(), edited);
  assert.ok(
    await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLButtonElement>("[data-occurrence]"),
      ].every(
        (row) => !row.draggable && getComputedStyle(row).cursor !== "grab",
      ),
    ),
  );
  await page.evaluate(() => {
    const rows =
      document.querySelectorAll<HTMLButtonElement>("[data-occurrence]");
    const transfer = new DataTransfer();
    transfer.setData("text/plain", rows[0].dataset.occurrence!);
    rows[0].dispatchEvent(
      new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }),
    );
    rows[rows.length - 1].dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  });
  assert.deepEqual(await read(), edited);
  await click("+ Group");
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLButtonElement>("[data-occurrence]")[0]
      .click(),
  );
  await waitFor(
    "first endpoint",
    async () =>
      await page.evaluate(
        () => document.querySelectorAll(".range-selected").length === 1,
      ),
  );
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLButtonElement>("[data-occurrence]")[1]
      .click(),
  );
  await waitFor(
    "two-row range",
    async () =>
      await page.evaluate(
        () => document.querySelectorAll(".range-selected").length === 2,
      ),
  );
  await fill(".group-range-form input", "Verse");
  await click("Create");
  assert.equal((await read()).lyricGroups![0].occurrenceIds.length, 2);
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".group-header-toggle")!.click(),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll("[data-occurrence]").length,
    ),
    71,
  );
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".group-menu-trigger")!.click(),
  );
  await click("Duplicate…");
  assert.equal((await read()).occurrences.length, 73);
  await click("Create copy");
  assert.equal((await read()).occurrences.length, 75);
  await click("Undo");
  await click("Undo");
  assert.deepEqual(await read(), edited);
  await click("Lyric editor");
  await page.evaluate(() =>
    document.querySelectorAll<HTMLButtonElement>(".phrase")[18].click(),
  );
  await click("Add lyric");
  await fill(".lyric-structure-panel input", "你好");
  await click("Add new lyric");
  await waitFor(
    "missing lyric draft",
    async () => (await read()).phrases.length === 23,
  );
  const added = await read();
  assert.equal(added.occurrences.length, 74);
  assert.equal(added.phrases[19].lyricKey, "你好");
  const insertion =
    edited.occurrences.findIndex(
      (cue) => cue.phraseId === edited.phrases[18].id,
    ) + 1;
  assert.equal(added.occurrences[insertion].phraseId, added.phrases[19].id);
  await waitFor(
    "new lyric revealed",
    async () =>
      await page.evaluate(() => {
        const item = document
          .querySelector(".phrase.selected")!
          .getBoundingClientRect();
        const list = document
          .querySelector(".phrase-list")!
          .getBoundingClientRect();
        return item.top >= list.top - 1 && item.bottom <= list.bottom + 1;
      }),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector(".phrase.selected strong")!.textContent,
    ),
    "你好",
  );
  await fill('[aria-label="Hanzi 1"]', "再见");
  assert.equal((await read()).phrases[19].lyricKey, "再见");
  await click("Undo");
  assert.deepEqual(await read(), added);
  const editorShot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    `${output}/lyric-editor-sidebar.png`,
    Buffer.from(editorShot.value.data, "base64"),
  );
  await click("Timing");
  const timingShot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    `${output}/timing-sidebar.png`,
    Buffer.from(timingShot.value.data, "base64"),
  );
  const timingButtons = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".timing-reset button")].map(
      (button) => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, width: rect.width };
      },
    ),
  );
  assert.equal(timingButtons.length, 2);
  assert.deepEqual(timingButtons[0], timingButtons[1]);
  await click("Remove lyric");
  assert.ok(
    await page.evaluate(
      () => document.querySelector<HTMLDialogElement>(".remove-dialog")!.open,
    ),
  );
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector(".remove-dialog")!
        .textContent!.includes("last appearance"),
    ),
  );
  assert.equal(
    await page.evaluate(() => document.activeElement!.textContent),
    "Cancel",
  );
  await click("Cancel");
  assert.deepEqual(await read(), added);
  await click("Remove lyric");
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(".remove-dialog button:last-child")!
      .click(),
  );
  await waitFor(
    "confirmed removal",
    async () => (await read()).phrases.length === 22,
  );
  assert.equal((await read()).occurrences.length, 73);
  await click("Undo");
  assert.deepEqual(await read(), added);
  await click("Undo");
  assert.deepEqual(await read(), edited);
  await page.evaluate(() => {
    window.__downloads = [];
    HTMLAnchorElement.prototype.click = function () {
      window.__downloads.push(
        fetch(this.href)
          .then((r) => r.text())
          .then((text) => ({ name: this.download, text })),
      );
    };
  });
  await click("Save project JSON");
  const json = (await page.evaluate(() => Promise.all(window.__downloads))).at(
    -1,
  )!;
  assert.deepEqual(JSON.parse(json.text), edited);
  await upload("saved.json", json.text);
  assert.deepEqual(await read(), edited);
  await click("Export data");
  await page.evaluate(() =>
    document.querySelector<HTMLInputElement>("input[type=checkbox]")!.click(),
  );
  await click("Download legacy TypeScript");
  const ts = (await page.evaluate(() => Promise.all(window.__downloads))).at(
    -1,
  )!;
  const legacy = importLegacy(ts.text);
  assert.equal(legacy.occurrences.length, 73);
  assert.equal(legacy.phrases.length, 22);
  assert.deepEqual(
    legacy.phrases.map((p) =>
      p.words.map(({ hanzi, pinyin, translation }) => ({
        hanzi,
        pinyin,
        translation,
      })),
    ),
    edited.phrases.map((p) =>
      p.words.map(({ hanzi, pinyin, translation }) => ({
        hanzi,
        pinyin,
        translation,
      })),
    ),
  );
  assert.ok(
    legacy.occurrences.every((cue) => cue.startMs === 0 && cue.endMs === 0),
  );
  fs.writeFileSync(`${output}/song.workbench.json`, json.text);
  fs.writeFileSync(`${output}/Song.ts`, ts.text);
  fs.writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      {
        uniqueLyrics: 22,
        appearances: 73,
        checked: [
          "exact order",
          "credits",
          "dictionary drafts",
          "editing",
          "reload",
          "repeat",
          "new lyric",
          "last appearance deletion",
          "undo",
          "button alignment",
          "JSON reopen",
          "TypeScript export",
        ],
      },
      null,
      2,
    ),
  );
  await upload(
    "Macchiato.ts",
    fs.readFileSync("src/Macchiato_Special_Affection_for_You.ts", "utf8"),
  );
  await waitFor(
    "Macchiato import",
    async () => (await read()).occurrences.length === 37,
  );
  const legacyProject = await read();
  await waitFor(
    "Macchiato on-demand reference",
    async () =>
      await page.evaluate(
        () =>
          !!document.querySelector(".dictionary-source") &&
          !!document.querySelector(".dictionary-entry li"),
      ),
  );
  assert.deepEqual(await read(), legacyProject);
  assert.ok(
    legacyProject.phrases.every((phrase) => !("dictionaryEntries" in phrase)),
  );
  await click("Timing");
  await page.evaluate(() => {
    const zoom = document.querySelector<HTMLSelectElement>(
      '[aria-label="Timeline zoom"]',
    )!;
    zoom.value = "1";
    zoom.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await waitFor(
    "zoom one",
    async () =>
      await page.evaluate(
        () =>
          document.querySelector<HTMLSelectElement>(
            '[aria-label="Timeline zoom"]',
          )!.value === "1",
      ),
  );
  const rulerShot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    `${output}/ruler-alignment.png`,
    Buffer.from(rulerShot.value.data, "base64"),
  );
  assert.ok(
    await page.evaluate(() => {
      const ruler = document.querySelector<HTMLElement>(".timing-ruler")!;
      const bounds = ruler.getBoundingClientRect();
      return [...ruler.querySelectorAll<HTMLElement>("span,i")].every(
        (tick) => {
          const rect = tick.getBoundingClientRect();
          const expected =
            bounds.left + (parseFloat(tick.style.left) / 100) * bounds.width;
          return (
            Math.abs(rect.bottom - bounds.bottom) < 1 &&
            Math.abs(
              (tick.matches("span:last-child") ? rect.right : rect.left) -
                expected,
            ) < 1.1
          );
        },
      );
    }),
  );
  const lowLabels = await page.evaluate(
    () => document.querySelectorAll(".timing-ruler span").length,
  );
  assert.ok(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".timing-block")].every(
        (block) =>
          block
            .querySelector<HTMLElement>(".timing-block-label")!
            .getBoundingClientRect().width >=
          block.clientWidth * 0.5,
      ),
    ),
  );
  await page.evaluate(() => {
    const zoom = document.querySelector<HTMLSelectElement>(
      '[aria-label="Timeline zoom"]',
    )!;
    zoom.value = "32";
    zoom.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await waitFor(
    "dense ruler",
    async () =>
      await page.evaluate(
        (count) =>
          document.querySelectorAll(".timing-ruler span").length > count,
        lowLabels,
      ),
  );
}
