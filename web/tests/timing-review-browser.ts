import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import type { openBrowser } from "@remotion/renderer";
import { rawProject, type Project } from "../src/domain.ts";
import { syntheticWav } from "./synthetic-wav.ts";
type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof openBrowser>>["newPage"]>
>;
declare global {
  interface Window {
    __timingMode: "normal" | "weak" | "failure" | "delay" | "mismatch";
    __timingFetch: typeof fetch;
    __finishTiming: () => void;
  }
}
export async function timingReviewAcceptance(
  page: Page,
  {
    click,
    upload,
    read,
    fill,
  }: {
    click: (text: string) => Promise<void>;
    upload: (name: string, text: string) => Promise<void>;
    read: () => Promise<Project>;
    fill: (selector: string, value: string) => Promise<void>;
  },
) {
  const wait = async (fn: () => Promise<boolean>, label: string) => {
    const end = Date.now() + 12000;
    while (Date.now() < end) {
      if (await fn()) return;
      await new Promise((r) => setTimeout(r, 40));
    }
    throw Error(`Timed out: ${label}`);
  };
  const select = async (id: string) => {
    await page.evaluate(
      (id) =>
        document
          .querySelector<HTMLButtonElement>(`[data-occurrence="${id}"]`)!
          .click(),
      id,
    );
  };
  const loadAudio = async (name = "review.wav", seconds = 6) => {
    await page.evaluate(
      (bytes, name) => {
        const input = document.querySelector<HTMLInputElement>(
            '[aria-label="Local audio file"]',
          )!,
          data = new DataTransfer();
        data.items.add(
          new File([new Uint8Array(bytes)], name, { type: "audio/wav" }),
        );
        input.files = data.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      [...syntheticWav(seconds)],
      name,
    );
    await wait(
      () =>
        page.evaluate(() => document.querySelector("audio")!.readyState >= 2),
      "audio metadata",
    );
  };
  const transcript = async (text = '{"segments":[]}') => {
    await page.evaluate((text) => {
      const input = document.querySelector<HTMLInputElement>(
          ".automatic-timing input[type=file]",
        )!,
        data = new DataTransfer();
      data.items.add(
        new File([text], "matching.json", {
          type: "application/json",
        }),
      );
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, text);
    await new Promise((r) => setTimeout(r, 80));
  };
  const revealTiming = async () => {
    await page.evaluate(() => {
      const toggle = document.querySelector<HTMLButtonElement>(
        '[aria-controls="automatic-timing-content"][aria-expanded="false"]',
      );
      toggle?.click();
    });
  };
  const showSetup = revealTiming;
  const generate = async (confirmPending = true) => {
    await showSetup();
    await click("Generate timings");
    if (
      confirmPending &&
      (await page.evaluate(() =>
        document
          .querySelector("dialog[open]")
          ?.textContent?.includes("Replace pending detected passages?"),
      ))
    )
      await click("Regenerate and replace passages");
  };
  const capture = async (name: string, selector: string) => {
    if (!process.argv.includes("--capture-timing-ux")) return;
    await page.evaluate(
      (selector) =>
        document
          .querySelector(selector)
          ?.scrollIntoView({ block: "center", behavior: "instant" }),
      selector,
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    const screenshot = await page
      ._client()
      .send("Page.captureScreenshot", { format: "png" });
    mkdirSync("out/workbench/timing-ux", { recursive: true });
    writeFileSync(
      `out/workbench/timing-ux/${name}.png`,
      Buffer.from(screenshot.value.data, "base64"),
    );
  };
  const installFake = async () =>
    page.evaluate(() => {
      window.__timingMode = "normal";
      window.__timingFetch = window.fetch;
      window.fetch = async (input, init) => {
        if (!String(input).includes("/api/automatic-timing"))
          return window.__timingFetch(input, init);
        const text = await (init!.body as Blob).text(),
          request = JSON.parse(text.slice(0, text.indexOf("\n")));
        const hash = {
          sha256: (window.__timingMode === "mismatch" ? "b" : "a").repeat(64),
          encoding: "mono-f32le-16000",
        };
        const mode = window.__timingMode;
        const packet = request.identityOnly
          ? { audioIdentity: hash }
          : mode === "failure"
            ? { error: "synthetic failure" }
            : {
                audioIdentity: hash,
                result: {
                  lines: request.project.occurrences.map(
                    (o: { id: string; phraseId: string }, i: number) => ({
                      id: o.id,
                      text: request.project.phrases.find(
                        (p: { id: string }) => p.id === o.phraseId,
                      ).lyricKey,
                      reasons: ["synthetic"],
                      ...(mode === "weak" && i === 1
                        ? { weakEstimate: { startMs: 2200, endMs: 2600 } }
                        : {
                            observedStartMs: 1000 + i * 1000,
                            observedEndMs: 1500 + i * 1000,
                          }),
                    }),
                  ),
                  additions: [
                    "intro-a",
                    "intro-b",
                    "intro-c",
                    "intro-d",
                    "intro-e",
                    "intro-f",
                    "intro-g",
                  ]
                    .map((id, i) => ({
                      ...(i === 2
                        ? {
                            timedWords: [
                              {
                                text: "今天大家一起",
                                startMs: 300,
                                endMs: 370,
                              },
                              {
                                text: "来听我们的歌",
                                startMs: 400,
                                endMs: 500,
                              },
                            ],
                          }
                        : {}),
                      phrase: {
                        ...request.project.phrases[0],
                        id: id + "-phrase",
                        words:
                          i === 0
                            ? [
                                {
                                  id: "intro-word-1",
                                  hanzi: "小哥哥",
                                  pinyin: "xiǎogēge",
                                  translation: { en: "" },
                                },
                                {
                                  id: "intro-word-2",
                                  hanzi: "小哥哥",
                                  pinyin: "xiǎogēge",
                                  translation: { en: "" },
                                },
                              ]
                            : [],

                        lyricKey:
                          i === 0
                            ? "小哥哥小哥哥"
                            : i === 1
                              ? "你好"
                              : i === 2
                                ? "今天大家一起来听我们的歌"
                                : "This unusually long detected passage must wrap without hiding its timestamps or actions. ".repeat(
                                    3,
                                  ),
                      },
                      occurrence: {
                        id,
                        phraseId: id + "-phrase",
                        detectedFromAudio: true,
                        startMs: 100 + i * 100,
                        endMs: 300 + i * 100,
                      },
                    }))
                    .filter(
                      (a: { occurrence: { id: string } }) =>
                        !request.project.occurrences.some(
                          (o: { id: string }) => o.id === a.occurrence.id,
                        ),
                    ),
                },
              };
        return new Response(
          new ReadableStream({
            start(controller) {
              const finish = () => {
                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(packet) + "\n"),
                );
                controller.close();
              };
              if (mode === "delay") window.__finishTiming = finish;
              else finish();
            },
          }),
          { headers: { "Content-Type": "application/x-ndjson" } },
        );
      };
    });
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  const p = rawProject("你好\n世界\n你好", "Review browser", "Test");
  p.phrases[0].translation.en = "Preserve this annotation";
  p.lyricGroups = [
    { id: "chorus", name: "Chorus", occurrenceIds: ["line-1", "line-2"] },
  ];
  await upload("review.json", JSON.stringify(p));
  await click("Timing");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll(".automatic-timing input[type=number]")
          .length,
    ),
    0,
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLDetailsElement>(".timing-advanced")!.open,
    ),
    false,
  );
  await capture("1440-first-run", ".automatic-timing");
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".timing-advanced summary")!.click(),
  );
  await transcript("null");
  await wait(
    () =>
      page.evaluate(() =>
        document
          .querySelector(".automatic-timing [role=status]")!
          .textContent!.includes("word timestamps"),
      ),
    "invalid transcript rejected",
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLButtonElement>(
          "#automatic-timing-setup .primary",
        )!.disabled,
    ),
    true,
  );
  await click("Clear transcript");
  // Choosing the transcript before the first audio must survive metadata arrival.
  await transcript();
  await capture("1440-advanced", ".automatic-timing");
  await loadAudio();
  await installFake();
  await generate();
  await wait(async () => !!(await read()).timingRun, "atomic generation");
  let saved = await read();
  assert.deepEqual(
    saved.occurrences.map((o) => o.id),
    p.occurrences.map((o) => o.id),
  );
  assert.ok(saved.occurrences.every((o) => o.timingReview === "needs-review"));
  assert.deepEqual(saved.phrases, p.phrases);
  assert.equal(saved.timingRun!.candidates.length, 7);
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLElement>("#automatic-timing-content")!
          .hidden &&
        !document.querySelector<HTMLDetailsElement>(".timing-candidates")!
          .open &&
        !!document.querySelector(".timing-candidates summary")?.getClientRects()
          .length,
    ),
    true,
  );
  await wait(
    () =>
      page.evaluate(() => {
        const r = document
            .querySelector('[data-cue="line-0"]')!
            .getBoundingClientRect(),
          viewport = document
            .querySelector(".timing-scroll")!
            .getBoundingClientRect();
        return r.left >= viewport.left - 1 && r.right <= viewport.right + 1;
      }),
    "initial generated cue visible",
  );
  await capture("1440-summary", ".automatic-timing");
  assert.equal(saved.timingRun!.transcriptProvenance, "external-unverified");
  await click("Undo");
  assert.ok((await read()).occurrences.every((o) => o.startMs === null));
  await click("Redo");
  await select("line-0");
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[aria-label="Collapse Chorus"]')!
      .click(),
  );
  assert.equal(
    await page.evaluate(() =>
      document.querySelector('[data-occurrence="line-1"]'),
    ),
    null,
  );
  await click("Mark reviewed → Next");
  await wait(
    () =>
      page.evaluate(
        () =>
          document
            .querySelector('[data-occurrence="line-1"]')!
            .getAttribute("aria-pressed") === "true",
      ),
    "auto-advance",
  );
  assert.equal(
    (await read()).occurrences.find((o) => o.id === "line-0")!.reviewedTiming!
      .startMs,
    1000,
  );
  // Settings keep the waveform available, with Escape and focus restoration.
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        '.timing-board-toolbar [aria-haspopup="dialog"]',
      )!
      .click(),
  );
  assert.equal(
    await page.evaluate(
      () => !document.querySelector<HTMLElement>(".timing-settings")!.hidden,
    ),
    true,
  );
  await capture("1440-settings", ".timing-board-toolbar");
  await fill(".timing-settings input[type=number]", "0");
  await page.evaluate(() => {
    const input = [
      ...document.querySelectorAll<HTMLLabelElement>(".timing-settings label"),
    ]
      .find((l) => l.textContent?.includes("Auto-advance"))!
      .querySelector<HTMLInputElement>("input")!;
    input.click();
  });
  // Native Escape behavior via CDP rather than a synthetic key event.
  const client = (await page.target().createCDPSession()) as unknown as {
    send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
  };
  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await wait(
    () =>
      page.evaluate(
        () => document.querySelector<HTMLElement>(".timing-settings")!.hidden,
      ),
    "Escape closes settings",
  );
  await wait(
    () =>
      page.evaluate(
        () =>
          document.activeElement?.getAttribute("aria-haspopup") === "dialog",
      ),
    "settings close returns focus to its trigger",
  );
  assert.equal((await read()).timingSettings!.preRollMs, 0);
  await select("line-1");
  await click("Mark reviewed");
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector('[data-occurrence="line-1"]')!
        .getAttribute("aria-pressed"),
    ),
    "true",
  );
  await fill('[aria-label="Start milliseconds"]', "2100");
  await click("Apply timing");
  assert.equal(
    (await read()).occurrences.find((o) => o.id === "line-1")!.timingReview,
    "needs-review",
  );
  await click("Reset to last reviewed");
  assert.equal(
    (await read()).occurrences.find((o) => o.id === "line-1")!.startMs,
    2000,
  );
  await click("Use latest automatic suggestion");
  assert.equal(
    (await read()).occurrences.find((o) => o.id === "line-1")!.timingReview,
    "needs-review",
  );
  // Padded one-shot uses the native media clock and stops without editing bounds.
  const beforeReplay = (await read()).occurrences;
  await page.evaluate(() => {
    document.querySelector("audio")!.playbackRate = 1.25;
  });
  await click("Play lyric");
  await wait(
    () =>
      page.evaluate(() => {
        const a = document.querySelector("audio")!;
        return a.paused && a.currentTime >= 2.74 && a.currentTime < 2.85;
      }),
    "padded one-shot stop",
  );
  assert.deepEqual((await read()).occurrences, beforeReplay);
  await page.evaluate(() => {
    const checkbox = [...document.querySelectorAll<HTMLLabelElement>("label")]
      .find((l) => l.textContent?.trim() === "Loop selected")!
      .querySelector<HTMLInputElement>("input")!;
    checkbox.click();
  });
  await new Promise((r) => setTimeout(r, 1300));
  assert.equal(
    await page.evaluate(() => document.querySelector("audio")!.paused),
    false,
  );
  // Global playback cancels bounded stop conditions.
  await click("Pause");
  await page.evaluate(() => {
    document.querySelector("audio")!.currentTime = 3.8;
  });
  await click("Play");
  await new Promise((r) => setTimeout(r, 200));
  await click("Pause");
  assert.ok(
    await page.evaluate(
      () => document.querySelector("audio")!.currentTime > 3.8,
    ),
  );
  // Generation preserves reviewed rows; weak estimates require an explicit row action.
  await page.evaluate(() => {
    window.__timingMode = "weak";
  });
  const beforePendingCancel = await read();
  await generate(false);
  await click("Cancel");
  assert.deepEqual(await read(), beforePendingCancel);
  await generate();
  await wait(
    async () =>
      !!(await read()).occurrences.find((o) => o.id === "line-1")!.weakTiming,
    "weak persisted",
  );
  saved = await read();
  assert.equal(
    saved.occurrences.find((o) => o.id === "line-0")!.timingReview,
    "reviewed",
  );
  await select("line-1");
  await click("Use estimate anyway");
  assert.equal(
    (await read()).occurrences.find((o) => o.id === "line-1")!.startMs,
    2200,
  );
  assert.equal(
    (await read()).occurrences.find((o) => o.id === "line-1")!.reviewedTiming!
      .startMs,
    2000,
  );
  await click("Undo");
  // Open and inspect seven candidates at the minimum supported review width.
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".timing-candidates summary")!.click(),
  );
  await capture("1024-seven-candidates", ".timing-candidates");
  await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".timing-candidate-list")!;
    list.focus({ preventScroll: true });
    list.scrollTop = 0;
  });
  for (let i = 0; i < 17; i++) {
    await client.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
  }
  assert.ok(
    await page.evaluate(
      () =>
        document.activeElement?.getAttribute("data-add-candidate") ===
          "intro-g" &&
        document.querySelector(".timing-candidate-list")!.scrollTop > 0,
    ),
    "Tab reaches and scrolls to the last Timing candidate",
  );

  const beforeSplits = await read();
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector('[data-workspace="Import lyrics"] b')
          ?.textContent,
    ),
    "!",
  );
  assert.ok(
    await page.evaluate(
      () => !document.querySelector('[data-add-candidate="intro-c"]'),
    ),
  );
  await click("Import lyrics");
  await wait(
    () =>
      page.evaluate(() => {
        const preview = document.querySelector(".import-audio-splits");
        const input = preview?.querySelector(".document-input");
        const gutter = preview?.querySelector(".editor-gutter");
        return (
          !!preview?.querySelector(".editor-line-issue [data-reading]") &&
          input?.getBoundingClientRect().height === 200 &&
          gutter?.getBoundingClientRect().height === 200
        );
      }),
    "loaded project insertion preview aligned with Pinyin",
  );
  await capture("pending-audio-split", ".import-audio-splits");
  const openSplits = () => click("Review splits");
  await openSplits();
  await wait(
    () =>
      page.evaluate(() => !!document.querySelector('[aria-label="endMs 1"]')),
    "split editor",
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLInputElement>('[aria-label="endMs 1"]')!
          .value,
    ),
    "370",
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLInputElement>('[aria-label="startMs 2"]')!
          .value,
    ),
    "400",
  );
  await fill(
    ".import-audio-splits fieldset textarea",
    "今天大家一\n起来听我们的歌",
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLInputElement>('[aria-label="endMs 1"]')!
          .value,
    ),
    "",
  );
  await fill('[aria-label="endMs 1"]', "350");
  await fill('[aria-label="startMs 2"]', "350");
  await click("Cancel");
  assert.deepEqual(await read(), beforeSplits);
  await openSplits();
  await click("Add reviewed lines");
  await wait(
    async () =>
      (await read()).occurrences.length === beforeSplits.occurrences.length + 2,
    "atomic split add",
  );
  const progress = () =>
    page.evaluate(() =>
      document
        .querySelector('[data-workspace="Timing"] small')!
        .textContent!.trim(),
    );
  const withIntro = await read();
  assert.equal(
    (await progress()).split("/")[1],
    String(withIntro.occurrences.length),
  );
  const intro = withIntro.occurrences.filter(
    (o) => !beforeSplits.occurrences.some((b) => b.id === o.id),
  );
  assert.deepEqual(
    intro.map((o) => [o.startMs, o.endMs, o.detectedFromAudio, o.timingReview]),
    [
      [300, 370, true, "needs-review"],
      [400, 500, true, "needs-review"],
    ],
  );
  await wait(
    () =>
      page.evaluate(() =>
        (document.querySelector("#lyrics-document") instanceof
        HTMLTextAreaElement
          ? document.querySelector<HTMLTextAreaElement>("#lyrics-document")!
              .value
          : (document.querySelector("#lyrics-document")?.textContent ?? "")
        ).includes("今天大家一起"),
      ),
    "open structure refreshes after audio insertion",
  );
  await click("Timing");
  await select(intro[0].id);
  const pausedAt = await page.evaluate(
    () => document.querySelector("audio")!.currentTime,
  );
  await click("Edit song structure");
  const sourceDoc = () =>
    page.evaluate(() =>
      (() => {
        const field = document.querySelector("#lyrics-document");
        return field instanceof HTMLTextAreaElement
          ? field.value
          : (field?.textContent ?? "");
      })(),
    );
  const opening = intro
    .map((o) => withIntro.phrases.find((p) => p.id === o.phraseId)!.lyricKey)
    .join("\n");
  const originalText = await sourceDoc();
  await fill(
    "#lyrics-document",
    originalText.replace(
      opening,
      "[Spoken intro]\n" +
        opening +
        (originalText.split(opening)[1]?.trimStart().startsWith("[")
          ? ""
          : "\n[/]"),
    ),
  );
  await click("Apply and return to Timing");
  const grouped = await read();
  assert.deepEqual(
    grouped.lyricGroups?.find((g) => g.name === "Spoken intro")?.occurrenceIds,
    intro.map((o) => o.id),
  );
  assert.deepEqual(grouped.occurrences, withIntro.occurrences);
  assert.deepEqual(grouped.phrases, withIntro.phrases);
  assert.equal(
    await page.evaluate(() => document.querySelector("audio")!.currentTime),
    pausedAt,
  );
  await page.setViewport({ width: 1640, height: 1050, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    document.querySelector<HTMLDetailsElement>(".timing-candidates")!.open =
      false;
    document
      .querySelector(".group-sidebar-wrapper")!
      .scrollIntoView({ block: "center", behavior: "instant" });
  });
  const returnShot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  mkdirSync("output/playwright/import-workflow", { recursive: true });
  writeFileSync(
    "output/playwright/import-workflow/return-to-timing.png",
    Buffer.from(returnShot.value.data, "base64"),
  );
  await page.evaluate(() => {
    document.querySelector<HTMLDetailsElement>(".timing-candidates")!.open =
      true;
  });
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await click("Undo");
  assert.deepEqual(await read(), withIntro);
  await click("Undo");
  assert.deepEqual(await read(), beforeSplits);
  assert.equal(
    (await progress()).split("/")[1],
    String(beforeSplits.occurrences.length),
  );
  const beforeAdd = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-add-candidate="intro-a"]',
    )!;
    button.scrollIntoView({ block: "center", behavior: "instant" });
    button.focus({ preventScroll: true });
    return window.scrollY;
  });
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-add-candidate="intro-a"]',
    )!;
    button.click();
    button.click();
  });
  saved = await read();
  assert.equal(saved.occurrences.filter((o) => o.id === "intro-a").length, 1);
  assert.equal(saved.phrases.length, 3);
  assert.equal(
    saved.occurrences.find((o) => o.id === "intro-a")!.timingReview,
    "needs-review",
  );
  await wait(
    () =>
      page.evaluate(
        () =>
          document.activeElement?.getAttribute("data-add-candidate") ===
            "intro-b" &&
          document
            .querySelector('[data-occurrence="line-1"]')
            ?.getAttribute("aria-pressed") === "true",
      ),
    "next candidate gets focus without changing occurrence selection",
  );
  assert.ok(
    Math.abs((await page.evaluate(() => window.scrollY)) - beforeAdd) < 90,
    "candidate addition stays near the current list",
  );
  await click("View lyric");
  await wait(
    () =>
      page.evaluate(
        () =>
          document
            .querySelector('[data-cue="intro-a"]')
            ?.classList.contains("selected") === true &&
          document
            .querySelector(".timing-inspector .lyric-reading")
            ?.textContent?.includes("小哥哥") === true,
      ),
    "new lyric selected with visible text",
  );
  await wait(
    () =>
      page.evaluate(
        () =>
          document
            .querySelector('[data-playing-lyric="intro-a"]')
            ?.textContent?.includes("xiǎogēge") === true,
      ),
    "new lyric visible in playback preview",
  );
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.closest("[data-cue]")?.getAttribute("data-cue"),
    ),
    "intro-a",
  );
  await capture("1024-detected-inspector", ".timing-inspector");
  await click("Translate");
  assert.equal(
    await page.evaluate(
      () => document.querySelector(".phrase-list .phrase strong")?.textContent,
    ),
    "小哥哥小哥哥",
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLInputElement>('[aria-label="Pinyin 1"]')
          ?.value,
    ),
    "xiǎogēge",
  );
  await click("Timing");

  await click("Undo");
  assert.equal((await read()).occurrences.length, 3);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  // Replace-all requires explicit confirmation and preserves last-reviewed reset.
  await select("line-0");
  await fill('[aria-label="Start milliseconds"]', "1050");
  await click("Apply timing");
  await click("Mark reviewed");
  await showSetup();
  await page.evaluate(() => {
    const select = [
      ...document.querySelectorAll<HTMLSelectElement>(
        ".automatic-timing select",
      ),
    ].at(-1)!;
    select.value = "replace-all";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    window.__timingMode = "normal";
  });
  const beforeReplace = await read();
  await generate();
  await wait(
    () => page.evaluate(() => document.activeElement?.textContent === "Cancel"),
    "replace dialog focuses Cancel",
  );
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector("dialog[open]")
        ?.textContent?.includes("pending detected passages"),
    ),
  );
  await capture("1440-replace-dialog", "dialog[open]");
  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await wait(
    () =>
      page.evaluate(
        () => document.activeElement?.textContent === "Generate timings",
      ),
    "cancel restores focus",
  );
  assert.deepEqual(await read(), beforeReplace);
  await generate();
  await click("Replace and regenerate");
  await wait(
    async () =>
      (await read()).occurrences.find((o) => o.id === "line-0")!.startMs ===
      1000,
    "confirmed replacement",
  );
  const replacement = (await read()).occurrences.find(
    (o) => o.id === "line-0",
  )!;
  assert.equal(replacement.timingReview, "needs-review");
  assert.equal(replacement.reviewedTiming!.startMs, 1050);
  await click("Undo");
  assert.deepEqual((await read()).occurrences, beforeReplace.occurrences);
  await page.evaluate(() => {
    const select = [
      ...document.querySelectorAll<HTMLSelectElement>(
        ".automatic-timing select",
      ),
    ].at(-1)!;
    select.value = "preserve-reviewed";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await select("line-1");
  // Cancel, failure and a late result after an edit must leave project data unchanged.
  const before = await read();
  await page.evaluate(() => {
    window.__timingMode = "failure";
  });
  await generate();
  await wait(
    () =>
      page.evaluate(() =>
        document
          .querySelector(".automatic-timing [role=status]")!
          .textContent!.includes("synthetic failure"),
      ),
    "failed generation",
  );
  assert.deepEqual(await read(), before);
  await page.evaluate(() => {
    window.__timingMode = "delay";
  });
  await generate();
  await click("Cancel timing");
  await page.evaluate(() => window.__finishTiming());
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(await read(), before);
  await generate();
  await fill('[aria-label="Start milliseconds"]', "2150");
  await click("Apply timing");
  const afterEdit = await read();
  await page.evaluate(() => window.__finishTiming());
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(await read(), afterEdit);
  // Reload retains compact candidates/weak estimates/settings, requires audio identity check.
  await page.evaluate(() => {
    window.fetch = window.__timingFetch;
  });
  await page.goto({
    url: await page.evaluate(() => location.href),
    timeout: 30000,
  });
  await click("Timing");
  assert.deepEqual(await read(), afterEdit);
  await loadAudio("renamed.wav");
  await installFake();
  await select("line-1");
  assert.equal(
    await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLButtonElement>("button")].find(
          (b) => b.textContent === "Use estimate anyway",
        )!.disabled,
    ),
    true,
  );
  await revealTiming();
  await click("Check linked audio");
  await wait(
    () =>
      page.evaluate(
        () =>
          ![...document.querySelectorAll<HTMLButtonElement>("button")].find(
            (b) => b.textContent === "Use estimate anyway",
          )!.disabled,
      ),
    "matching normalized audio",
  );
  // Different media keeps pending data but requires explicit reuse.
  const pendingBeforeRelink = (await read()).timingRun;
  await loadAudio("different.wav");
  await page.evaluate(() => {
    window.__timingMode = "mismatch";
  });
  await revealTiming();
  await click("Check linked audio");
  await wait(
    () =>
      page.evaluate(() =>
        document
          .querySelector(".automatic-timing")!
          .textContent!.includes("audio differs"),
      ),
    "mismatched audio",
  );
  assert.deepEqual((await read()).timingRun, pendingBeforeRelink);
  await click("Reuse with this audio…");
  await click("Cancel");
  await click("Reuse with this audio…");
  await click("Reuse timings");
  assert.equal(
    await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLButtonElement>("button")].find(
          (b) => b.textContent === "Use estimate anyway",
        )!.disabled,
    ),
    false,
  );
  // Bulk review uses explicit approval and a single history entry.
  await click("Select multiple");
  await select("line-1");
  await select("line-2");
  const beforeBulk = await read();
  await click("Mark selected reviewed…");
  assert.deepEqual(await read(), beforeBulk);
  await click("Mark selected reviewed");
  assert.equal(
    (await read()).occurrences.filter((o) => o.timingReview === "reviewed")
      .length,
    3,
  );
  await click("Undo");
  assert.deepEqual((await read()).occurrences, beforeBulk.occurrences);
  await click("Finish selection");
  // A detected intro exercises pre-roll clipping at the beginning of the media.
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        '.timing-board-toolbar [aria-haspopup="dialog"]',
      )!
      .click(),
  );
  await fill(".timing-settings input[type=number]", "250");
  await click("Done");
  const beforeIntro = (await read()).occurrences;
  await revealTiming();
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".timing-candidates summary")!.click(),
  );

  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[data-candidate="intro-a"] button')!
      .click(),
  );
  assert.ok(
    await page.evaluate(
      () => document.querySelector("audio")!.currentTime < 0.2,
    ),
  );
  await wait(
    () =>
      page.evaluate(() => {
        const a = document.querySelector("audio")!;
        return a.paused && a.currentTime >= 0.54 && a.currentTime <= 0.6;
      }),
    "clipped media start",
  );
  assert.deepEqual((await read()).occurrences, beforeIntro);
  // Padding clips to media boundaries and leaving Timing cancels replay.
  await select("line-2");
  await fill('[aria-label="Start milliseconds"]', "5800");
  await fill('[aria-label="End milliseconds"]', "5950");
  await click("Apply timing");
  const padded = (await read()).occurrences;
  await click("Play lyric");
  await wait(
    () =>
      page.evaluate(() => {
        const a = document.querySelector("audio")!;
        return a.paused && a.currentTime >= 5.99;
      }),
    "clipped media end",
  );
  assert.deepEqual((await read()).occurrences, padded);
  await click("Play lyric");
  await click("Lyric editor");
  assert.equal(
    await page.evaluate(() => document.querySelector("audio")!.paused),
    true,
  );
  await click("Timing");
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.evaluate(() => {
    const trigger = document.querySelector<HTMLButtonElement>(
      ".timing-settings-trigger",
    )!;
    trigger.scrollIntoView({ block: "center", behavior: "instant" });
    trigger.click();
  });
  await capture("1024-settings", ".timing-board-toolbar");
  assert.equal(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".timing-settings")!).position,
    ),
    "fixed",
  );
  await click("Done");
  await page.evaluate(() => {
    window.fetch = window.__timingFetch;
  });
  await click("Clear detected passages");
  const remaining = (await read()).timingRun!.candidates;
  assert.ok(remaining.length > 0);
  await click("Import lyrics");
  await click("Dismiss passage");
  assert.equal(
    (await read()).timingRun!.candidates.length,
    remaining.length - 1,
  );
  await click("Undo");
  assert.ok((await read()).timingRun!.candidates.length > 0);
  const final = rawProject("时序\n未定", "Completion", "Test");
  final.occurrences[0] = {
    ...final.occurrences[0],
    detectedFromAudio: true,
    startMs: 100,
    endMs: 200,
    timingReview: "needs-review",
  };
  await upload("completion.json", JSON.stringify(final));
  await click("Timing");
  await loadAudio();
  await select("line-1");
  assert.equal(
    await page.evaluate(() =>
      document.querySelector("#timing-play-hint")?.textContent?.trim(),
    ),
    "Set a valid start and end to play this lyric.",
  );
  await click("Play");
  await click("Pause");
  await select("line-0");
  await click("Mark reviewed");
  await wait(
    () =>
      page.evaluate(
        () =>
          document.querySelector(".timing-completion")?.textContent?.trim() ===
          "Timed lyrics reviewed. 1 untimed.",
      ),
    "review completion with an untimed cue",
  );
  await capture("1024-review-complete", ".timing-inspector");
  const beforeRepair = await read();
  await click("Translate");
  await click("Draft words and Pinyin");
  await wait(
    async () => (await read()).phrases[0].words.some((word) => !!word.pinyin),
    "local dictionary repairs a saved detected lyric",
  );
  assert.deepEqual((await read()).occurrences, beforeRepair.occurrences);
  assert.equal(
    (await read()).phrases[0].lyricKey,
    beforeRepair.phrases[0].lyricKey,
  );
  await click("Undo");
  assert.deepEqual(await read(), beforeRepair);
  const resetFixture = rawProject("你好", "Shorter relink", "Test");
  resetFixture.occurrences[0] = {
    ...resetFixture.occurrences[0],
    startMs: 100,
    endMs: 200,
    timingReview: "needs-review",
    reviewedTiming: { startMs: 2000, endMs: 2500 },
  };
  await upload("shorter-relink.json", JSON.stringify(resetFixture));
  await click("Timing");
  await loadAudio("short.wav", 1);
  await wait(
    () =>
      page.evaluate(() => {
        const reset = document.querySelector<HTMLButtonElement>(
          '[aria-label="Reset timing for this lyric"]',
        );
        return (
          !!reset?.disabled &&
          reset.textContent?.trim() === "Reset reference outside loaded audio"
        );
      }),
    "shorter audio disables reset and explains why",
  );
  await loadAudio("long.wav");
  await click("Reset to last reviewed");
  assert.equal((await read()).occurrences[0].endMs, 2500);
  await upload("groq-timing.json", JSON.stringify(p));
  await click("Timing");
  await loadAudio("groq.wav");
  await installFake();
  await wait(
    () =>
      page.evaluate(
        () =>
          !!document.querySelector<HTMLOptionElement>(
            'option[value="groq"]:enabled',
          ),
      ),
    "Groq configured",
  );
  await page.evaluate(() => {
    const selector = document.querySelector<HTMLOptionElement>(
      'option[value="groq"]',
    )!.parentElement as HTMLSelectElement;
    selector.value = "groq";
    selector.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(
    () =>
      page.evaluate(
        () =>
          document.querySelector<HTMLOptionElement>(
            'option[value="whisper-large-v3-turbo"]',
          )?.selected === true,
      ),
    "Groq Turbo default",
  );
  await generate();
  await wait(
    async () => (await read()).timingRun?.provider === "groq",
    "Groq timing run saved",
  );
  assert.equal((await read()).timingRun!.model, "whisper-large-v3-turbo");
  await page.evaluate(() => {
    window.fetch = window.__timingFetch;
  });
  await page.setViewport({ width: 1640, height: 1050, deviceScaleFactor: 1 });
  await upload("spoken-intro.workbench.json", JSON.stringify(grouped));
  assert.deepEqual(await read(), grouped);
  await click("Timing");
  await click("Edit song structure");
  const splitSection = (await sourceDoc()).replace(
    "[Spoken intro]\n" + opening,
    "[Opening line]\n" + opening.replace("\n", "\n[Spoken intro]\n"),
  );
  await fill("#lyrics-document", splitSection);
  await click("Cancel");
  assert.deepEqual(await read(), grouped);
  await click("Edit song structure");
  await fill("#lyrics-document", splitSection);
  await click("Apply and return to Timing");
  const transferred = await read();
  assert.deepEqual(
    transferred.lyricGroups
      ?.filter((g) => g.name === "Spoken intro" || g.name === "Opening line")
      .map((g) => g.occurrenceIds),
    intro.map((o) => [o.id]),
  );
  assert.deepEqual(
    transferred.lyricGroups?.filter(
      (g) => !["Spoken intro", "Opening line"].includes(g.name),
    ),
    grouped.lyricGroups?.filter((g) => g.name !== "Spoken intro"),
  );
  assert.deepEqual(transferred.occurrences, grouped.occurrences);
  await click("Undo");
  assert.deepEqual(await read(), grouped);
}
