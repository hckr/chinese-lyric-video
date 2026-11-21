import assert from "node:assert/strict";
import fs from "node:fs";
import type { openBrowser } from "@remotion/renderer";
import { rawProject, type Project } from "../src/domain.ts";
import { reviewTiming } from "../src/timing.ts";
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
export async function timingAcceptance(
  page: Page,
  { click, fill, read, upload }: Helpers,
) {
  let fixture = rawProject(
    "你好\n你好\n你好",
    "Timing acceptance",
    "Local test",
  );
  fixture.phrases[0] = {
    ...fixture.phrases[0],
    translation: { en: "Hello", pl: "Cześć" },
    words: [
      {
        id: "hello",
        hanzi: "你好",
        pinyin: "nǐhǎo",
        translation: { en: "hello" },
      },
    ],
    review: "reviewed",
    segmentationApproved: true,
  };
  fixture.occurrences = fixture.occurrences.map((o, i) => ({
    ...o,
    startMs: i === 0 ? 12345 : i === 1 ? 25000 : 45000,
    endMs: i === 0 ? 12789 : i === 1 ? 28000 : 47000,
  }));
  fixture = reviewTiming(
    fixture,
    new Set(fixture.occurrences.map((o) => o.id)),
    true,
  );
  await upload("timing.json", JSON.stringify(fixture));
  await click("Timing");
  await click("Translate");
  assert.equal(
    await page.evaluate(() => document.querySelector("h1")!.textContent),
    "Translate & review",
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[data-timing-id="line-2"]')!
      .click(),
  );
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector('[data-occurrence="line-2"]')!
        .getAttribute("aria-pressed"),
    ),
    "true",
  );

  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLSelectElement>(
          '[aria-label="Timeline zoom"]',
        )!.value,
    ),
    "8",
  );

  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLSelectElement>('[aria-label="Timing snap"]')!
          .value,
    ),
    "edges",
  );

  const wait = async (predicate: () => Promise<boolean>, label: string) => {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error(`Timed out: ${label}`);
  };
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".timing-occurrence-list button").length,
    ),
    3,
  );
  assert.equal(
    await page.evaluate(() => document.querySelectorAll("audio").length),
    1,
  );
  const select = async (id: string) => {
    await page.evaluate(
      (id) =>
        document
          .querySelector<HTMLButtonElement>(`[data-occurrence="${id}"]`)!
          .click(),
      id,
    );
  };
  await select("line-1");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Reset timing for this lyric"]',
        )!.disabled,
    ),
    true,
  );
  await fill('[aria-label="Start milliseconds"]', "23000");
  await fill('[aria-label="End milliseconds"]', "24750");
  await click("Apply timing");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Reset timing for this lyric"]',
        )!.disabled,
    ),
    false,
  );
  let saved = await read();
  assert.deepEqual(saved.occurrences[0], fixture.occurrences[0]);
  assert.deepEqual(saved.occurrences[2], fixture.occurrences[2]);
  assert.deepEqual(saved.phrases, fixture.phrases);
  await click("Undo");
  assert.equal((await read()).occurrences[1].startMs, 25000);
  await click("Redo");
  assert.equal((await read()).occurrences[1].startMs, 23000);
  await fill('[aria-label="End milliseconds"]', "23000");
  await click("Apply timing");
  assert.equal((await read()).occurrences[1].endMs, 24750);
  assert.match(
    await page.evaluate(
      () => document.querySelector('[role="alert"]')?.textContent ?? "",
    ),
    /later than start/,
  );
  // A transcript chosen before the first audio file must survive audio loading.
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>(
      ".automatic-timing input[type=file]",
    )!;
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(
        [JSON.stringify({ segments: [] })],
        "selected-before-audio.json",
        { type: "application/json" },
      ),
    );
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  // Loading metadata must not reveal the selected lyric or scroll the page.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 400)));
  await page.evaluate(() => {
    document
      .querySelector(".timing-scroll")!
      .scrollTo({ left: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  // A real, small PCM WAV: no mocked HTMLMediaElement or synthetic clock.
  await page.evaluate(() => {
    const rate = 8000,
      frames = rate * 60,
      bytes = new Uint8Array(44 + frames * 2),
      view = new DataView(bytes.buffer);
    const text = (offset: number, value: string) =>
      [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    text(0, "RIFF");
    view.setUint32(4, 36 + frames * 2, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, frames * 2, true);
    for (let i = 0; i < frames; i++)
      view.setInt16(
        44 + i * 2,
        Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 8000),
        true,
      );
    const input = document.querySelector<HTMLInputElement>(
        '[aria-label="Local audio file"]',
      )!,
      data = new DataTransfer();
    data.items.add(
      new File([bytes], "timing-test.wav", {
        type: "audio/wav",
        lastModified: 1,
      }),
    );
    input.files = data.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(
    () => page.evaluate(() => document.querySelector("audio")!.readyState >= 2),
    "real WAV loaded",
  );

  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 400)));
  assert.equal(
    await page.evaluate(
      () => document.querySelector(".timing-scroll")!.scrollLeft,
    ),
    0,
  );
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLInputElement>(
          ".automatic-timing input[type=file]",
        )!.files?.[0]?.name,
    ),
    "selected-before-audio.json",
  );
  // Playback preview follows the media clock, not the selected occurrence.
  const previewIds = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-playing-lyric]")].map(
        (el) => el.dataset.playingLyric,
      ),
    );
  await page.evaluate(() => {
    document.querySelector("audio")!.currentTime = 12.5;
  });
  await wait(
    async () => (await previewIds()).join() === "line-0",
    "preview seek",
  );
  assert.match(
    await page.evaluate(
      () =>
        document.querySelector('[aria-label="Current lyrics"]')!.textContent!,
    ),
    /nǐhǎo.*你好.*Hello.*Cześć/,
  );
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector('[data-occurrence="line-1"]')!
        .getAttribute("aria-pressed"),
    ),
    "true",
  );
  await click("Play");
  await wait(
    async () => (await previewIds()).length === 0,
    "preview clears after lyric ends during playback",
  );
  await click("Pause");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  assert.equal(
    await page.evaluate(() => {
      const preview = document
        .querySelector(".timing-live-preview")!
        .getBoundingClientRect();
      const controls = document
        .querySelector(".timing-transport > .timing-controls")!
        .getBoundingClientRect();
      const seek = document
        .querySelector(".timing-scrub")!
        .getBoundingClientRect();
      return (
        preview.top >= controls.bottom &&
        preview.top >= seek.bottom &&
        document.documentElement.scrollWidth <= innerWidth
      );
    }),
    true,
  );
  await page.setViewport({ width: 1640, height: 1050, deviceScaleFactor: 1 });
  await wait(
    () =>
      page.evaluate(
        () => document.querySelectorAll(".timing-wave svg line").length > 0,
      ),
    "decoded waveform",
  );
  await page.evaluate(() => {
    const zoom = document.querySelector<HTMLSelectElement>(
      '[aria-label="Timeline zoom"]',
    )!;
    zoom.value = "8";
    zoom.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("audio")!.currentTime = 40;
  });
  await click("Play");
  await wait(
    () =>
      page.evaluate(() => document.querySelector("audio")!.currentTime > 0.15),
    "real playback advances",
  );
  await wait(
    () =>
      page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(".timing-scroll")!,
          line = document.querySelector(".timing-playhead")!;
        const a = panel.getBoundingClientRect(),
          b = line.getBoundingClientRect();
        return panel.scrollLeft > 0 && b.left >= a.left && b.left < a.right;
      }),
    "playing timeline follows the media playhead",
  );
  assert.equal(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".timing-scroll")!).overflowX,
    ),
    "hidden",
  );
  await click("Pause");
  await page.evaluate(() => {
    document.querySelector(".timing-scroll")!.scrollLeft = 0;
  });
  await wait(
    () =>
      page.evaluate(
        () => document.querySelector(".timing-scroll")!.scrollLeft === 0,
      ),
    "manual scrolling restored on pause",
  );
  // The selected cue is near the beginning, but the paused clock is at 40s.
  // Zoom must reveal the clock rather than anchor on the selected cue.
  await page.evaluate(() => {
    const zoom = document.querySelector<HTMLSelectElement>(
      '[aria-label="Timeline zoom"]',
    )!;
    zoom.value = "4";
    zoom.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(
    () =>
      page.evaluate(() => {
        const a = document
          .querySelector(".timing-scroll")!
          .getBoundingClientRect();
        const b = document
          .querySelector(".timing-playhead")!
          .getBoundingClientRect();
        return b.left >= a.left && b.left < a.right;
      }),
    "zoom retains the paused playhead even when the selected cue is elsewhere",
  );
  const paused = await page.evaluate(
    () => document.querySelector("audio")!.currentTime,
  );
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(
    await page.evaluate(() => document.querySelector("audio")!.currentTime),
    paused,
  );
  const key = async (value: string, selector?: string) => {
    await page.evaluate(
      (value, selector) => {
        const target = selector
          ? document.querySelector<HTMLElement>(selector)!
          : document.body;
        if (!selector) (document.activeElement as HTMLElement)?.blur();
        else target.focus();
        target.dispatchEvent(
          new KeyboardEvent("keydown", { key: value, bubbles: true }),
        );
      },
      value,
      selector ?? "",
    );
    await new Promise((r) => setTimeout(r, 60));
  };
  const seek = async (seconds: number) => {
    await page.evaluate(async (seconds) => {
      const audio = document.querySelector("audio")!;
      await new Promise<void>((resolve) => {
        audio.addEventListener("seeked", () => resolve(), { once: true });
        audio.currentTime = seconds;
      });
    }, seconds);
  };
  await seek(23);
  const selectedStart = (await read()).occurrences.find(
    (cue) => cue.id === "line-1",
  )!.startMs!;
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[aria-label="Move line-1"]')!
      .click(),
  );
  await wait(
    () =>
      page.evaluate(
        (start) =>
          Math.abs(
            document.querySelector("audio")!.currentTime * 1000 - start,
          ) < 50,
        selectedStart,
      ),
    "paused timeline selection seeks to lyric start",
  );
  await page.evaluate(async () => {
    await document.querySelector("audio")!.play();
  });
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[aria-label="Move line-1"]')!
      .click(),
  );
  await wait(
    () =>
      page.evaluate((start) => {
        const audio = document.querySelector("audio")!;
        return (
          !audio.paused && Math.abs(audio.currentTime * 1000 - start) < 500
        );
      }, selectedStart),
    "playing timeline selection seeks and continues playback",
  );
  await page.evaluate(() => document.querySelector("audio")!.pause());
  await fill('[aria-label="Audio seek"]', "23000");
  await wait(
    () =>
      page.evaluate(
        () =>
          Math.round(document.querySelector("audio")!.currentTime * 1000) ===
          23000,
      ),
    "audio seek slider sets the master clock",
  );
  await key("s");
  await fill('[aria-label="Audio seek"]', "24750");
  await wait(
    () =>
      page.evaluate(
        () =>
          Math.round(document.querySelector("audio")!.currentTime * 1000) ===
          24750,
      ),
    "second precise seek",
  );
  await key("e");
  saved = await read();
  assert.equal(saved.occurrences[1].startMs, 23000);
  assert.equal(saved.occurrences[1].endMs, 24750);
  await page.evaluate(() =>
    document
      .querySelector<HTMLInputElement>(".timing-controls input[type=checkbox]")!
      .click(),
  );
  await seek(24.99);
  await wait(
    () =>
      page.evaluate(() => {
        const time = document.querySelector("audio")!.currentTime;
        return time >= 23 && time < 24;
      }),
    "selected loop wraps using the media clock",
  );
  await click("Pause");
  await page.evaluate(() =>
    document
      .querySelector<HTMLInputElement>(".timing-controls input[type=checkbox]")!
      .click(),
  );
  const beforeTyping = JSON.stringify(saved.occurrences);
  await key("s", '[aria-label="Start milliseconds"]');
  await key("e", '[aria-label="End milliseconds"]');
  assert.equal(JSON.stringify((await read()).occurrences), beforeTyping);
  // Zoom short cues before pointer editing so both handles and body are reachable.
  await page.evaluate(() => {
    const zoom = document.querySelector<HTMLSelectElement>(
      '[aria-label="Timeline zoom"]',
    )!;
    zoom.value = "4";
    zoom.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  // Drag using actual browser pointer capture, then trim with the keyboard.
  await page.evaluate(() =>
    document
      .querySelector<HTMLElement>('[aria-label="Move line-1"]')!
      .scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const box = await page.evaluate(() => {
    const r = document
      .querySelector('[aria-label="Move line-1"]')!
      .getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  // Remotion exposes CDP but its command typings omit browser input methods.
  const pointer = page._client() as unknown as {
    send(
      method: "Input.dispatchMouseEvent",
      params: {
        type: string;
        x: number;
        y: number;
        button?: string;
        buttons?: number;
        clickCount?: number;
      },
    ): Promise<unknown>;
  };
  await pointer.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: box.x,
    y: box.y,
  });
  await pointer.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  await pointer.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: box.x + 30,
    y: box.y,
    button: "left",
    buttons: 1,
  });
  await pointer.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: box.x + 30,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  await wait(
    async () => (await read()).occurrences[1].startMs !== 23000,
    "block drag commits",
  );
  const dragged = (await read()).occurrences[1];
  assert.equal(dragged.endMs! - dragged.startMs!, 1750);
  await click("Undo");
  assert.equal((await read()).occurrences[1].startMs, 23000);
  await click("Redo");
  assert.deepEqual((await read()).occurrences[1], dragged);
  await key("ArrowRight", '[aria-label="Trim start line-1"]');
  assert.equal((await read()).occurrences[1].startMs, dragged.startMs! + 10);
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        '[aria-label="Reset timing for this lyric"]',
      )!
      .click(),
  );
  assert.deepEqual((await read()).occurrences[1], fixture.occurrences[1]);
  await click("Undo");
  assert.equal((await read()).occurrences[1].startMs, dragged.startMs! + 10);
  // Create a touching pair, then verify one-step history for linked keyboard trims.
  await select("line-0");
  await fill(
    '[aria-label="End milliseconds"]',
    String((await read()).occurrences[1].startMs),
  );
  await click("Apply timing");
  const touching = await read();
  const toggle = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLLabelElement>("label")]
        .find((el) => el.textContent?.trim() === "Link touching edges")!
        .querySelector<HTMLInputElement>("input")!
        .click(),
    );
  assert.equal(
    await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLLabelElement>("label")]
          .find((el) => el.textContent?.trim() === "Link touching edges")!
          .querySelector<HTMLInputElement>("input")!.checked,
    ),
    false,
  );
  await toggle();
  await key("ArrowRight", '[aria-label="Trim end line-0"]');
  const linked = await read();
  assert.equal(
    linked.occurrences[0].endMs,
    touching.occurrences[0].endMs! + 10,
  );
  assert.equal(linked.occurrences[1].startMs, linked.occurrences[0].endMs);
  await click("Undo");
  assert.deepEqual((await read()).occurrences, touching.occurrences);
  await click("Redo");
  assert.deepEqual((await read()).occurrences, linked.occurrences);
  await click("Undo");
  // Actual pointer capture previews both edges, cancellation changes neither.
  await page.evaluate(() =>
    document
      .querySelector('[aria-label="Trim end line-0"]')!
      .scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const sharedBox = await page.evaluate(() => {
    const r = document
      .querySelector('[aria-label="Trim end line-0"]')!
      .getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const beginSharedDrag = async () => {
    await pointer.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      ...sharedBox,
    });
    await pointer.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...sharedBox,
      button: "left",
      clickCount: 1,
    });
    await pointer.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: sharedBox.x + 20,
      y: sharedBox.y,
      button: "left",
      buttons: 1,
    });
  };
  await beginSharedDrag();
  const preview = await page.evaluate(() => {
    const left = document
      .querySelector('[data-cue="line-0"]')!
      .getBoundingClientRect();
    const right = document
      .querySelector('[data-cue="line-1"]')!
      .getBoundingClientRect();
    return { end: left.right, start: right.left };
  });
  assert.ok(Math.abs(preview.end - preview.start) < 1);
  assert.deepEqual((await read()).occurrences, touching.occurrences);
  await key("Escape");
  await pointer.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: sharedBox.x + 20,
    y: sharedBox.y,
    button: "left",
    clickCount: 1,
  });
  assert.deepEqual((await read()).occurrences, touching.occurrences);
  await beginSharedDrag();
  await pointer.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: sharedBox.x + 20,
    y: sharedBox.y,
    button: "left",
    clickCount: 1,
  });
  const sharedDrag = await read();
  assert.ok(sharedDrag.occurrences[0].endMs! > touching.occurrences[0].endMs!);
  assert.equal(
    sharedDrag.occurrences[0].endMs,
    sharedDrag.occurrences[1].startMs,
  );
  await click("Undo");
  assert.deepEqual((await read()).occurrences, touching.occurrences);
  await toggle();
  await click("Undo");
  await select("line-1");
  // Restore the reviewed first interval; settings now have their own undo entries.
  await select("line-0");
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        '[aria-label="Reset timing for this lyric"]',
      )!
      .click(),
  );
  await select("line-1");
  // Keyboard capture was verified above. Set exact bounds for the export fixture.
  await fill('[aria-label="Start milliseconds"]', "23000");
  await fill('[aria-label="End milliseconds"]', "24750");
  await click("Apply timing");
  await page.evaluate(() => window.scrollTo(0, 0));
  const activeShot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    "out/workbench/timing.png",
    Buffer.from(activeShot.value.data, "base64"),
  );
  await click("Download project JSON");
  const download = await page.evaluate(async () =>
    Promise.all(window.__downloads),
  );
  const json = [...download]
    .reverse()
    .find((d) => d.name === "song.workbench.json");
  assert.ok(json);
  saved = JSON.parse(json.text) as Project;
  assert.equal(saved.occurrences[0].startMs, 12345);
  assert.equal(saved.occurrences[0].endMs, 12789);
  assert.equal(saved.occurrences[1].startMs, 23000);
  assert.equal(saved.occurrences[1].endMs, 24750);
  assert.deepEqual(saved.phrases, fixture.phrases);
  await click("Export data");
  if (
    await page.evaluate(
      () =>
        document.querySelector<HTMLInputElement>(".two .check input")
          ?.checked === false,
    )
  )
    await page.evaluate(() =>
      document.querySelector<HTMLInputElement>(".two .check input")!.click(),
    );
  await click("Download legacy TypeScript");
  const downloads = await page.evaluate(async () =>
    Promise.all(window.__downloads),
  );
  const ts = [...downloads].reverse().find((d) => d.name === "Song.ts");
  assert.ok(ts);
  assert.deepEqual(
    importLegacy(ts.text).occurrences.map(
      ({ id, phraseId, startMs, endMs }) => ({ id, phraseId, startMs, endMs }),
    ),
    saved.occurrences.map(({ id, phraseId, startMs, endMs }) => ({
      id,
      phraseId,
      startMs,
      endMs,
    })),
  );
  fs.writeFileSync("out/workbench/timed-export.ts", ts.text);
  const reloadUrl = await page.evaluate(() => location.href);
  await page.goto({ url: reloadUrl, timeout: 30000 });
  await wait(
    () =>
      page.evaluate(
        () =>
          document.querySelector("h1")?.textContent === "Translate & review",
      ),
    "saved project reload",
  );
  await click("Timing");
  assert.match(
    await page.evaluate(
      () => document.querySelector(".timing-media-status")!.textContent ?? "",
    ),
    /No audio selected/,
  );
  assert.equal(
    await page.evaluate(() =>
      document.querySelector("audio")!.getAttribute("src"),
    ),
    null,
  );
  assert.deepEqual((await read()).occurrences, saved.occurrences);
  const beforeFailure = JSON.stringify((await read()).occurrences);
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>(
        '[aria-label="Local audio file"]',
      )!,
      data = new DataTransfer();
    data.items.add(
      new File(["unplayable media"], "broken.wav", { type: "audio/wav" }),
    );
    input.files = data.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(
    () =>
      page.evaluate(
        () =>
          document
            .querySelector('[role="alert"]')
            ?.textContent?.includes("could not be played") ?? false,
      ),
    "unplayable audio feedback",
  );
  assert.equal(JSON.stringify((await read()).occurrences), beforeFailure);
  // Mobile timing workspace must scroll its timeline, not the entire page.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.setViewport({ width: 1640, height: 1050, deviceScaleFactor: 1 });
  const shot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    "out/workbench/timing-media-error.png",
    Buffer.from(shot.value.data, "base64"),
  );
  console.log(
    "M2 acceptance passed: real local WAV playback/waveform, exact capture, repeated occurrence independence, drag/trim, undo/redo/reset, export/reimport, reload/relink and mobile layout.",
  );
}
