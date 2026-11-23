declare global {
  interface Window {
    lyricTestText: (field: HTMLElement | null) => string;
    lyricTestOffset: (field: HTMLElement) => number;
    lyricTestSelect: (field: HTMLElement, start: number, end: number) => void;
  }
}
import { syntheticWav } from "./synthetic-wav.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { openBrowser } from "@remotion/renderer";
import { hanzi, phraseIssues, type Project } from "../src/domain.ts";
import { exportLegacy, importLegacy } from "../src/legacy.ts";

type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof openBrowser>>["newPage"]>
>;
type Helpers = {
  click: (text: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  read: () => Promise<Project>;
  upload: (name: string, source: string) => Promise<void>;
};

export async function importWorkflow(
  page: Page,
  { click, fill, read, upload }: Helpers,
) {
  const output = "output/playwright/import-workflow";
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
  const installFieldHelpers = () =>
    page.evaluate(() => {
      window.lyricTestText = (field) =>
        field instanceof HTMLTextAreaElement
          ? field.value
          : (field?.textContent ?? "");
      window.lyricTestOffset = (field) => {
        if (field instanceof HTMLTextAreaElement) return field.selectionStart;
        const selection = document.getSelection();
        if (!selection?.anchorNode || !field.contains(selection.anchorNode))
          return 0;
        const range = document.createRange();
        range.selectNodeContents(field);
        range.setEnd(selection.anchorNode, selection.anchorOffset);
        return range.toString().length;
      };
      window.lyricTestSelect = (field, start, end) => {
        if (field instanceof HTMLTextAreaElement)
          return field.setSelectionRange(start, end);
        const point = (offset: number): [Node, number] => {
          const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const length = node.textContent?.length ?? 0;
            if (offset <= length) return [node, offset];
            offset -= length;
          }
          return [field, field.childNodes.length];
        };
        document
          .getSelection()
          ?.setBaseAndExtent(...point(start), ...point(end));
      };
    });
  await installFieldHelpers();
  const raw = fs.readFileSync(
    "python-src/tests/fixtures/import-workflow.txt",
    "utf8",
  );
  await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 1 });
  const lyricLines = raw.trim().split("\n").slice(4);
  const marked = lyricLines
    .flatMap((text, i) =>
      i % 18 === 0 ? [`[${i % 36 === 0 ? "Verse" : "Chorus"}]`, text] : [text],
    )
    .join("\n");
  async function capture(name: string, fullPage = false) {
    const clip = fullPage
      ? await page.evaluate(() => ({
          x: 0,
          y: 0,
          width: innerWidth,
          height: document.documentElement.scrollHeight,
          scale: 1,
        }))
      : undefined;
    const image = await page._client().send("Page.captureScreenshot", {
      format: "png",
      ...(clip && { clip, captureBeyondViewport: true }),
    });
    fs.writeFileSync(
      output + "/" + name + ".png",
      Buffer.from(image.value.data, "base64"),
    );
  }
  const bilingualSample =
    "《做你的猫》\n演唱：小可乐\n[Verse]\n我 love you 啊\nThis English line can be as long as the singer wants it to be\n印下梅花记号\n向全世界宣告";
  await fill(".document-metadata label:first-child input", "");
  await fill(".document-metadata label:last-child input", "");
  await fill(".raw", bilingualSample);
  assert.ok(
    await page.evaluate(() => {
      const field = document.querySelector(".editor-body div.document-input")!;
      const han = field.querySelector(".editor-han")!;
      return (
        ["normal", "0px"].includes(getComputedStyle(field).letterSpacing) &&
        parseFloat(getComputedStyle(han).letterSpacing) > 0
      );
    }),
  );
  await page.evaluate(() => {
    const field = document.querySelector<HTMLElement>(".raw")!;
    field.focus();
    window.lyricTestSelect(field, 4, 1);
    document
      .querySelector<HTMLInputElement>(".editor-pinyin-toggle input")!
      .click();
  });
  assert.ok(
    await page.evaluate(() => {
      const field = document.querySelector<HTMLTextAreaElement>("textarea.raw");
      const correct =
        field?.selectionStart === 1 &&
        field.selectionEnd === 4 &&
        field.selectionDirection === "backward";
      document
        .querySelector<HTMLInputElement>(".editor-pinyin-toggle input")!
        .click();
      return correct;
    }),
  );
  assert.equal(
    await page.evaluate(() => document.getSelection()?.toString()),
    "做你的",
  );
  await waitFor("Pinyin on Chinese, plain English", () =>
    page.evaluate(() => {
      const rows = document.querySelectorAll(".editor-decoration > div");
      return (
        !!rows[3]?.querySelector("[data-reading]") &&
        !rows[4]?.querySelector("[data-reading]") &&
        !rows[2]?.querySelector("[data-reading]")
      );
    }),
  );
  assert.ok(
    await page.evaluate(() => {
      const number = document
        .querySelector(".editor-gutter > div > :first-child")!
        .getBoundingClientRect();
      const row = document
        .querySelector(".editor-decoration > div")!
        .getBoundingClientRect();
      return Math.abs(number.top - row.top) < 1;
    }),
  );
  await page.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>(
      ".editor-text-size select",
    )!;
    select.value = "2";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.ok(
    await page.evaluate(() => {
      const font = (selector: string) =>
        parseFloat(
          getComputedStyle(document.querySelector(selector)!).fontSize,
        );
      return (
        font(".raw") === 32 &&
        font(".editor-reading i") === 20 &&
        document
          .querySelector(".editor-decoration > div")!
          .getBoundingClientRect().height === 68 &&
        document
          .querySelector(".editor-gutter > div > :first-child")!
          .getBoundingClientRect().height === 68
      );
    }),
  );
  assert.ok(
    await page.evaluate(() => {
      const row = document.querySelector(
        ".editor-decoration > div:last-child",
      )!;
      const readings = [...row.querySelectorAll(".editor-reading i")].map(
        (el) => el.getBoundingClientRect(),
      );
      return (
        readings.length >= 5 &&
        readings.every((r, i) => i === 0 || r.left - readings[i - 1].right >= 2)
      );
    }),
    "adjacent syllables in 向全世界宣告 have visible gaps",
  );
  await fill(
    ".raw",
    [
      "词：陈大创",
      "曲：陈大创",
      ...Array(30).fill("做你的猫"),
      "远方的歌",
    ].join("\n"),
  );
  await page.evaluate(() => {
    document.querySelector<HTMLTextAreaElement>(".raw")!.scrollTop = 0;
  });
  await waitFor("offscreen Pinyin prepared after paste", () =>
    page.evaluate(
      () =>
        !!document.querySelector(
          ".editor-decoration > div:last-child [data-reading]",
        ),
    ),
  );
  assert.ok(
    await page.evaluate(() => {
      const last = [
        ...document.querySelectorAll<HTMLElement>(
          ".editor-decoration > div:first-child [data-reading]",
        ),
      ].at(-1);
      return (
        !!last &&
        last.closest(".annotated-character")?.textContent === "创" &&
        last.getBoundingClientRect().width / last.offsetWidth > 0.94
      );
    }),
    "chuàng uses space next to dà and beyond the last character",
  );
  await capture("editor-pinyin-credits", true);
  await fill(".raw", bilingualSample);
  await waitFor("sample readings restored", () =>
    page.evaluate(
      () =>
        !!document.querySelector(
          ".editor-decoration > div:last-child [data-reading]",
        ),
    ),
  );
  await capture("editor-large-text", true);
  await page.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>(
      ".editor-text-size select",
    )!;
    select.value = "1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await capture("bilingual-import", true);
  await captureMobile("bilingual-import-mobile");
  await fill(".document-metadata label:first-child input", "词句导入练习");
  await fill(".document-metadata label:last-child input", "测试歌手");
  const longEnglish = "This English phrase continues ".repeat(12);
  await fill(".raw", "行\n" + longEnglish);
  await page.evaluate(() => {
    const field = document.querySelector<HTMLTextAreaElement>(".raw")!;
    field.focus();
    window.lyricTestSelect(field, 0, 0);
    document.querySelector<HTMLElement>(".word-inspector summary")!.click();
  });
  await waitFor("default polyphonic reading", () =>
    page.evaluate(
      () =>
        document.querySelector(".word-inspector .reading-status")
          ?.textContent === "Default",
    ),
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(".dictionary-entry button")!
      .click(),
  );
  await waitFor("saved pronunciation selected", () =>
    page.evaluate(
      () =>
        document.querySelector(".word-inspector .reading-status")
          ?.textContent === "Selected",
    ),
  );
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".word-inspector summary")!.click(),
  );
  for (const visible of [true, false]) {
    await page.evaluate((visible) => {
      const toggle = document.querySelector<HTMLInputElement>(
        ".editor-pinyin-toggle input",
      )!;
      if (toggle.checked !== visible) toggle.click();
      const field = document.querySelector<HTMLTextAreaElement>(".raw")!;
      field.scrollLeft = visible ? 70 : 120;
    }, visible);
    await waitFor("horizontal overlay synchronization", () =>
      page.evaluate(() => {
        const field = document.querySelector<HTMLTextAreaElement>(".raw")!;
        return (
          field.scrollLeft > 0 &&
          document.querySelector(".editor-decoration")!.scrollLeft ===
            field.scrollLeft
        );
      }),
    );
  }
  await page.evaluate(() =>
    document
      .querySelector<HTMLInputElement>(".editor-pinyin-toggle input")!
      .click(),
  );
  await fill(".raw", "你好世界\n你好世界");
  await page.evaluate(() => {
    const field = document.querySelector<HTMLTextAreaElement>(".raw")!;
    field.focus();
    window.lyricTestSelect(field, 2, 4);
  });
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".word-inspector summary")!.click(),
  );
  await waitFor("dictionary follows selection", () =>
    page.evaluate(
      () =>
        [
          ...document.querySelectorAll(
            ".word-inspector .dictionary-word strong",
          ),
        ]
          .map((el) => el.textContent)
          .join("") === "世界",
    ),
  );
  await waitFor("visible repeated lyrics have word boundaries", () =>
    page.evaluate(() => {
      const lines = document.querySelectorAll(".editor-decoration > div");
      return !!lines[1]?.querySelector("[data-segment]");
    }),
  );
  await page.evaluate(() =>
    document.querySelector<HTMLTextAreaElement>(".raw")!.focus(),
  );
  assert.ok(
    await page.evaluate(
      () => !!document.querySelector(".editor-reading [data-reading]"),
    ),
  );
  const togglePinyin = () =>
    page.evaluate(() =>
      document
        .querySelector<HTMLInputElement>(".editor-pinyin-toggle input")!
        .click(),
    );
  await togglePinyin();
  assert.ok(
    await page.evaluate(() => !document.querySelector(".editor-reading")),
  );
  await capture("editor-pinyin-off", true);
  await captureMobile("editor-pinyin-off-mobile");
  await togglePinyin();
  await capture("dictionary-editor-focused", true);
  await captureMobile("dictionary-editor-focused-mobile");
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".word-inspector summary")!.focus(),
  );
  assert.ok(
    await page.evaluate(() => {
      const lines = document.querySelectorAll(".editor-decoration > div");
      return (
        lines[0].hasAttribute("data-current-line") &&
        [...lines[0].querySelectorAll("[data-inspected]")]
          .map((el) => el.textContent)
          .join("") === "世界" &&
        !lines[1].querySelector("[data-inspected]")
      );
    }),
  );
  await capture("contextual-dictionary", true);
  await captureMobile("contextual-dictionary-mobile");
  await page.evaluate(() => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = async (input, init) => {
      if (input !== "/api/suggest-groups") return original(input, init);
      if (++calls === 1)
        return Response.json(
          { error: "Check the selected model." },
          { status: 400 },
        );
      window.fetch = original;
      return Response.json({ explanation: "**World** in this lyric." });
    };
  });
  await click("Explain with AI");
  await waitFor("word advice error", () =>
    page.evaluate(
      () =>
        document.querySelector(".dictionary-lookup [role=status]")
          ?.textContent === "Check the selected model.",
    ),
  );
  await click("Explain with AI");
  await waitFor("word advice retry", () =>
    page.evaluate(
      () =>
        document.querySelector(".dictionary-lookup [role=status]")
          ?.textContent === "World in this lyric.",
    ),
  );

  await page.evaluate(async () => {
    const panel =
      document.querySelector<HTMLDetailsElement>(".word-inspector")!;
    const summary = panel.querySelector("summary")!;
    summary.click();
    await new Promise(requestAnimationFrame);
    summary.click();
    await new Promise(requestAnimationFrame);
  });
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector(".word-inspector .word-explanation strong")
          ?.textContent,
    ),
    "World",
  );
  await capture("dictionary-ai-explanation", true);
  await click("Use selection as word");
  await page.evaluate(() => {
    const field = document.querySelector<HTMLTextAreaElement>(".raw")!;
    field.focus();
    window.lyricTestSelect(field, 0, 2);
    field.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await waitFor("dictionary follows updated selection", () =>
    page.evaluate(
      () =>
        [
          ...document.querySelectorAll(
            ".word-inspector .dictionary-word strong",
          ),
        ]
          .map((el) => el.textContent)
          .join("") === "你好",
    ),
  );
  await page.evaluate(() => {
    const field = document.querySelector<HTMLTextAreaElement>(".raw")!;
    field.focus();
    window.lyricTestSelect(field, 1, 1);
    field.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await click("Split at cursor");
  const segments = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".editor-decoration > div:first-child [data-segment]",
        ),
      ].map((el) => el.textContent),
    );
  assert.deepEqual(await segments(), ["你", "好", "世界"]);
  await click("Merge with next");
  assert.deepEqual(await segments(), ["你", "好世界"]);
  await click("Undo");
  assert.deepEqual(await segments(), ["你", "好", "世界"]);
  await click("Undo");
  assert.deepEqual(await segments(), ["你好", "世界"]);
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".word-inspector summary")!.click(),
  );
  await fill(".raw", marked);
  await page.setViewport({ width: 1600, height: 560, deviceScaleFactor: 1 });
  assert.ok(
    await page.evaluate(() => {
      const pane = document.querySelector(".document-import .editor-pane")!;
      const rail = document.querySelector(
        ".document-import .structure-preview",
      )!;
      const start = rail.getBoundingClientRect();
      window.scrollTo({ top: 220, behavior: "instant" });
      const sticky =
        Math.abs(
          rail.getBoundingClientRect().top -
            parseFloat(getComputedStyle(rail).top),
        ) < 1;
      window.scrollTo({ top: 0, behavior: "instant" });
      return (
        !pane.contains(rail) &&
        start.left > pane.getBoundingClientRect().right &&
        sticky
      );
    }),
  );
  async function captureMobile(name: string) {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok(
      await page.evaluate(() => {
        const rail = document.querySelector(
          '.structure-preview[data-reviewing="true"]',
        );
        if (!rail) return true;
        const controls = rail.querySelector(".proposal-actions")!;
        return (
          controls.getBoundingClientRect().bottom <=
          rail.getBoundingClientRect().bottom
        );
      }),
    );
    await capture(name, true);
    await page.setViewport({ width: 1600, height: 1050, deviceScaleFactor: 1 });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

  assert.ok(
    await page.evaluate(() => {
      const pane = document.querySelector(".document-import .editor-pane")!;
      const rail = document.querySelector(
        ".document-import .structure-preview",
      )!;
      return (
        getComputedStyle(rail).position !== "sticky" &&
        rail.getBoundingClientRect().top >= pane.getBoundingClientRect().bottom
      );
    }),
  );
  const keys = (await page.target().createCDPSession()) as unknown as {
    send: (
      method: string,
      args: Record<string, unknown>,
    ) => Promise<{
      value: {
        nodes?: { role?: { value: string }; name?: { value: string } }[];
      };
    }>;
  };
  async function activate(selector: string) {
    await page.evaluate(
      (sel) => document.querySelector<HTMLElement>(sel)!.focus(),
      selector,
    );
    for (const type of ["keyDown", "keyUp"])
      await keys.send("Input.dispatchKeyEvent", {
        type,
        key: "Enter",
        text: type === "keyDown" ? "\r" : undefined,
        code: "Enter",
        windowsVirtualKeyCode: 13,
      });
  }
  await activate(".preview-sections details:nth-child(4) summary");
  await waitFor("keyboard-expanded chorus", () =>
    page.evaluate(
      () =>
        !!document.querySelector(".preview-sections details:nth-child(4) a"),
    ),
  );
  await activate(".preview-sections details:nth-child(4) a");
  assert.equal(
    await page.evaluate(() => {
      const el = document.querySelector<HTMLTextAreaElement>(".raw")!;
      return window
        .lyricTestText(el)
        .slice(0, window.lyricTestOffset(el))
        .split("\n").length;
    }),
    59,
  );
  const tree = await keys.send("Accessibility.getFullAXTree", {});
  assert.ok(
    tree.value.nodes?.some(
      (n) => n.role?.value === "textbox" && n.name?.value === "Lyrics editor",
    ),
  );
  await fill(".raw", marked + "\n" + "天".repeat(12));
  await activate('[aria-label="Next issue"]');
  await click("Show suggested split");
  await click("Dismiss");
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector("#document-summary")!
        .textContent!.includes("1 issue"),
    ),
  );
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      if (input !== "/api/suggest-groups") return original(input, init);
      window.fetch = original;
      return Response.json({
        groups: [
          { name: "Final chorus", start: 69, end: 72 },
          { name: "Earlier chorus", start: 5, end: 8 },
        ],
        phrases: [],
      });
    };
  });
  await click("Review with AI");
  await waitFor("automatic suggestion focus and scroll", () =>
    page.evaluate(() => {
      const field = document.querySelector<HTMLTextAreaElement>(".raw")!;
      const proposal = document.querySelector(
        ".structure-preview .document-patch",
      );
      return (
        document.activeElement === field &&
        field.scrollTop > 0 &&
        !!proposal?.textContent?.includes("[Final chorus]")
      );
    }),
  );
  await waitFor("inline suggestion hit target", () =>
    page.evaluate(() => {
      const hint = [
        ...document.querySelectorAll<HTMLButtonElement>(".proposal-hint"),
      ].find((button) => button.textContent?.includes("[Final chorus]"));
      if (!hint) return false;
      const { left, top, width, height } = hint.getBoundingClientRect();
      const hit = document.elementFromPoint(left + width / 2, top + height / 2);
      if (!hit || !hint.contains(hit)) return false;
      hint.click();
      return true;
    }),
  );
  await waitFor("editor follows next actionable suggestion", () =>
    page.evaluate(() => {
      const field = document.querySelector<HTMLTextAreaElement>(".raw")!;
      const card = document.querySelector(".structure-preview .document-patch");
      const caretLine = window
        .lyricTestText(field)
        .slice(0, window.lyricTestOffset(field))
        .split("\n").length;
      return (
        document.activeElement === field &&
        !!card?.textContent?.includes("[Earlier chorus]") &&
        card
          .querySelector("small")
          ?.textContent?.endsWith("Line " + caretLine) === true
      );
    }),
  );
  await click("Dismiss suggestion");
  await fill(".raw", marked);
  await page.evaluate(() => {
    const el = document.querySelector<HTMLTextAreaElement>(".raw")!;
    window.lyricTestSelect(el, 0, 0);
    el.scrollTop = 0;
    window.scrollTo(0, 0);
  });

  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 1 });
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLDetailsElement>(".preview-sections details")
      .forEach((d) => (d.open = false)),
  );
  // Restore the ungrouped fixture for the Timing group-creation regressions.
  await fill(".raw", lyricLines.join("\n"));
  const attachAudio = () =>
    page.evaluate(
      (base64) => {
        const input = document.querySelector<HTMLInputElement>(
          ".document-import input[type=file]",
        )!;
        const bytes = Uint8Array.from(atob(base64), (char) =>
          char.charCodeAt(0),
        );
        const data = new DataTransfer();
        data.items.add(
          new File([bytes], "import-track.wav", { type: "audio/wav" }),
        );
        input.files = data.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      Buffer.from(syntheticWav(3)).toString("base64"),
    );
  await attachAudio();
  await page.evaluate(() => {
    const editor = document.querySelector<HTMLTextAreaElement>(".raw")!;
    editor.blur();
    editor.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await capture("paste", true);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await capture("document-mobile", true);
  await page.setViewport({ width: 1600, height: 1050, deviceScaleFactor: 1 });
  await click("Import document");
  await waitFor(
    "raw import",
    async () => (await read())?.occurrences.length === 73,
  );
  await waitFor(
    "imported audio metadata",
    async () => (await read())?.audio?.name === "import-track.wav",
  );
  await click("Timing");
  await click("Play");
  await waitFor("imported audio playback", async () =>
    page.evaluate(() => document.querySelector("audio")!.currentTime > 0),
  );
  const originalProject = await read();
  await click("Import lyrics");
  await click("Import another song…");
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      if (input === "/api/translation/providers") {
        window.fetch = original;
        return Response.json({});
      }
      return original(input, init);
    };
  });
  await click("Discard project and start import");
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>(
      '[aria-label="Song file"]',
    )!;
    const data = new DataTransfer();
    data.items.add(new File(["测试歌词"], "replacement.txt"));
    input.files = data.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await waitFor("text file fills draft", async () =>
    page.evaluate(
      () => window.lyricTestText(document.querySelector(".raw")) === "测试歌词",
    ),
  );

  assert.equal(await read(), null);
  await click("Timing");
  await click("Import lyrics");
  assert.equal(
    await page.evaluate(() =>
      window.lyricTestText(document.querySelector(".raw")),
    ),
    "测试歌词",
  );
  assert.ok(
    await page.evaluate(
      () =>
        [...document.querySelectorAll("button")].find(
          (b) => b.textContent === "Review with AI",
        )!.disabled,
    ),
  );
  await attachAudio();
  await page.evaluate(() => {
    const previous = window.fetch;
    window.fetch = async (input, init) => {
      if (input === "/api/timing-models")
        return Response.json({ models: ["medium"] });
      if (input !== "/api/automatic-timing") return previous(input, init);
      const req = JSON.parse(
        (await (init!.body as Blob).text()).split("\n")[0],
      );
      return new Response(
        new ReadableStream({
          start(controller) {
            const send = (obj: unknown) =>
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(obj) + "\n"),
              );
            send({ progress: "Transcribing", transcriptionPercent: 42 });
            window.addEventListener(
              "finish-comparison",
              () => {
                send({
                  audioIdentity: {
                    sha256: "a".repeat(64),
                    encoding: "mono-f32le-16000",
                  },
                  result: {
                    lines: [
                      {
                        id: req.ids[0],
                        text: "测试歌词",
                        observedStartMs: 1000,
                        observedEndMs: 2000,
                        reasons: [],
                      },
                    ],
                    additions: [
                      {
                        phrase: {
                          ...req.project.phrases[0],
                          id: "extra-phrase",
                          lyricKey: "今天大家一起来听我们的歌",
                          words: [],
                        },
                        timedWords: [
                          { text: "今天大家一起", startMs: 100, endMs: 270 },
                          { text: "来听我们的歌", startMs: 330, endMs: 500 },
                        ],
                        occurrence: {
                          id: "intro",
                          phraseId: "extra-phrase",
                          startMs: 100,
                          endMs: 500,
                          detectedFromAudio: true,
                        },
                      },
                    ],
                  },
                });
                controller.close();
                window.fetch = previous;
              },
              { once: true },
            );
          },
        }),
      );
    };
  });
  await click("Compare with lyrics");
  await click("Transcribe and compare");
  await waitFor("inline audio comparison progress", () =>
    page.evaluate(
      () =>
        document
          .querySelector(".inline-audio-review [role=status]")
          ?.textContent?.includes("42%") ?? false,
    ),
  );
  await click("Timing");
  const badge = () =>
    page.evaluate(
      () =>
        document.querySelector('[data-workspace="Import lyrics"] b')
          ?.textContent,
    );
  await waitFor(
    "background import progress",
    async () => (await badge()) === "42%",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("finish-comparison")),
  );
  await waitFor(
    "background import attention",
    async () => (await badge()) === "!",
  );
  await click("Import lyrics");
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector(".inline-audio-review")
        ?.textContent?.includes("1 matched"),
    ),
  );
  await capture("inline-audio-verification", true);
  assert.ok(
    await page.evaluate(
      () => !!document.querySelector(".import-audio-splits .editor-line-issue"),
    ),
  );
  await waitFor("pending passage Pinyin", () =>
    page.evaluate(
      () =>
        !!document.querySelector(
          ".import-audio-splits .editor-line-issue [data-reading]",
        ),
    ),
  );
  assert.ok(
    await page.evaluate(() => {
      const preview = document.querySelector(".import-audio-splits")!;
      const heights = [
        ".document-input",
        ".editor-gutter",
        ".editor-decoration",
      ].map(
        (selector) =>
          preview.querySelector(selector)!.getBoundingClientRect().height,
      );
      return (
        heights[0] === 200 && heights.every((height) => height === heights[0])
      );
    }),
  );
  await capture("import-audio-split-pending", true);
  await click("Dismiss passage");
  assert.ok(
    await page.evaluate(() => !document.querySelector(".import-audio-splits")),
  );
  await click("Undo");
  await waitFor("undo restores dismissed audio passage", () =>
    page.evaluate(
      () => !!document.querySelector(".import-audio-splits .editor-line-issue"),
    ),
  );
  const reviewIntro = async () => {
    if (
      await page.evaluate(
        () => !!document.querySelector(".comparison-card:not([hidden])"),
      )
    )
      await click("Back to lyrics editor");
    await click("Review splits");
    await click("Add reviewed lines");
    await waitFor("split insertion preview", () =>
      page.evaluate(
        () => !!document.querySelector(".insertion-controls input"),
      ),
    );
  };
  await reviewIntro();
  await fill(".insertion-controls input", "Spoken intro");
  assert.ok(
    await page.evaluate(() => {
      const candidate = document.querySelector(
        ".comparison-findings [data-selected=true]",
      );
      const matched = document.querySelector<HTMLDetailsElement>(
        ".comparison-other details:last-child",
      );
      return !candidate && matched?.open === false;
    }),
  );

  await waitFor("audio passage Pinyin", () =>
    page.evaluate(
      () => !!document.querySelector(".passage-pinyin [lang=zh-Latn]"),
    ),
  );
  await waitFor("real passage waveform", () =>
    page.evaluate(() => !!document.querySelector(".passage-waveform")),
  );
  await capture("audio-insertion", true);
  await captureMobile("audio-insertion-mobile");
  await click("Cancel insertion");
  await reviewIntro();
  await page.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>(
      ".insertion-controls select",
    )!;
    select.value = "after:1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await click("Confirm insertion");
  assert.ok(
    await page.evaluate(() =>
      window
        .lyricTestText(document.querySelector(".raw"))
        .startsWith("测试歌词\n"),
    ),
  );
  await click("Undo insertion");
  assert.equal(
    await page.evaluate(() =>
      window.lyricTestText(document.querySelector(".raw")),
    ),
    "测试歌词",
  );
  await reviewIntro();
  await fill(".insertion-controls input", "Spoken intro");
  await click("Confirm insertion");
  await click("View in editor");
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector("[data-inserted-highlight=true]")
        ?.textContent?.includes("今天"),
    ),
  );
  await page.evaluate(() => {
    const el = document.querySelector<HTMLTextAreaElement>(".raw")!;
    el.focus();
    window.lyricTestSelect(el, 1, 1 + "Spoken intro".length);
    document.execCommand("insertText", false, "Opening");
  });
  await click("Review alignment");
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector(".document-import")!
        .textContent!.includes("matched occurrences"),
    ),
  );
  await click("Back to lyrics editor");
  await click("Import document");
  await waitFor(
    "accepted timed split",
    async () => (await read())?.occurrences.length === 3,
  );
  const audioProject = await read();
  assert.deepEqual(
    audioProject.occurrences
      .slice(0, 2)
      .map((o) => [o.startMs, o.endMs, o.detectedFromAudio]),
    [
      [100, 270, true],
      [330, 500, true],
    ],
  );
  assert.deepEqual(
    audioProject.lyricGroups?.[0].occurrenceIds,
    audioProject.occurrences.slice(0, 2).map((o) => o.id),
  );
  await click("Timing");
  await waitFor("compared audio stays attached after import", () =>
    page.evaluate(() => {
      const transport = document.querySelector(
        '[aria-label="Audio transport"]',
      );
      const audio = transport?.querySelector("audio");
      return (
        audio?.currentSrc.startsWith("blob:") === true &&
        audio.duration === 3 &&
        transport?.querySelector(".timing-file-button")?.textContent ===
          "Replace audio"
      );
    }),
  );
  await upload("original.json", JSON.stringify(originalProject));
  const imported = await read();
  assert.deepEqual(imported.metadata, {
    title: "词句导入练习",
    artist: "测试歌手",
  });
  assert.equal(imported.phrases.length, 22);
  assert.equal(imported.occurrences.length, 73);
  assert.ok(
    await page.evaluate(() => {
      const primary = document.querySelector<HTMLButtonElement>(
        ".translation-toolbar button.primary",
      );
      return (
        primary?.textContent?.trim() === "Translate whole song" &&
        !primary.disabled &&
        primary.getBoundingClientRect().height > 0
      );
    }),
  );
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
    assert.ok(phrase.words.every((word) => word.translation.en === ""));
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
      .find((p) => p.lyricKey === "在纸上画个心")!
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
  await fill('[aria-label="English sentence"]', "Open your schoolbag");
  await fill('[aria-label="Polish sentence"]', "Otwórz swój plecak");
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
  // A deliberately shorter viewport exercises overflow even with synthetic lines.
  await page.setViewport({ width: 1640, height: 600, deviceScaleFactor: 1 });
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
  await page.setViewport({ width: 1640, height: 1050, deviceScaleFactor: 1 });
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
  await installFieldHelpers();
  await waitFor(
    "saved editor",
    async () =>
      await page.evaluate(
        () => !!document.querySelector('[aria-label="English sentence"]'),
      ),
  );
  assert.deepEqual(await read(), edited);
  await click("Timing");
  assert.ok(
    await page.evaluate(() => {
      const source = document.querySelector(".timing-source")!.textContent!;
      return (
        source.includes("import-track.wav") &&
        source.includes("Relink audio") &&
        !document.querySelector("audio")!.getAttribute("src")
      );
    }),
  );
  await click("Lyric editor");
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
  assert.ok(
    await page.evaluate(() => {
      const reset = document.querySelector<HTMLButtonElement>(
        ".timing-reset button",
      )!;
      const remove = document.querySelector<HTMLButtonElement>(
        ".timing-remove button",
      )!;
      return (
        reset.disabled &&
        reset.textContent?.includes("No reset reference") &&
        remove.getBoundingClientRect().top >
          reset.getBoundingClientRect().bottom
      );
    }),
    "Remove lyric sits separately below the disabled reset action",
  );
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
  await click("Download project JSON");
  const json = (await page.evaluate(() => Promise.all(window.__downloads))).at(
    -1,
  )!;
  assert.deepEqual(JSON.parse(json.text), edited);
  await click("Import lyrics");
  const structureShown = () =>
    page.evaluate(
      () =>
        document.querySelector("h1")?.textContent === "Song structure" &&
        !!document.querySelector("#lyrics-document:not(:disabled)") &&
        !document.querySelector('[aria-label="Song file"]') &&
        !document.querySelector(".import-fields"),
    );
  assert.ok(await structureShown());
  assert.ok(
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["invalid"], "bad.json"));
      return !document.querySelector("#lyrics-document")!.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    }),
  );
  assert.deepEqual(await read(), edited);
  await click("Import another song…");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Keep project",
  );
  await click("Keep project");
  assert.ok(await structureShown());
  assert.deepEqual(await read(), edited);
  await upload("invalid.json", "{}");
  assert.ok(
    await page.evaluate(() => !!document.querySelector(".content > .error")),
  );
  assert.equal(await read(), null);
  await page.evaluate(() => {
    // Hold a valid file read until after the import visit ends.
    const input = document.querySelector<HTMLInputElement>(
      '[aria-label="Song file"]',
    )!;
    const transfer = new DataTransfer();
    transfer.items.add(new File([""], "late.json"));
    input.files = transfer.files;
    const file = input.files![0];
    file.text = () =>
      new Promise((resolve) => {
        window.addEventListener(
          "finish-test-import",
          () => resolve(localStorage.getItem("lyric-workbench-v1")!),
          { once: true },
        );
      });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await click("Timing");
  await click("Import lyrics");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("finish-test-import")),
  );
  assert.ok(
    await page.evaluate(
      () => !!document.querySelector('[aria-label="Song file"]:enabled'),
    ),
  );
  assert.equal(await read(), null);
  await upload("saved.json", json.text);
  assert.deepEqual(await read(), edited);
  await click("Export data");
  await page.evaluate(() =>
    document
      .querySelector<HTMLInputElement>(
        ".warnings + label input[type=checkbox]",
      )!
      .click(),
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
    async () => (await read())?.occurrences.length === 37,
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
      return [
        ...ruler.querySelectorAll<HTMLElement>(":scope > span, :scope > i"),
      ].every((tick) => {
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
      });
    }),
  );
  const lowLabels = await page.evaluate(
    () => document.querySelectorAll(".timing-ruler > span").length,
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
          document.querySelectorAll(".timing-ruler > span").length > count,
        lowLabels,
      ),
  );
  await click("Import lyrics");
  await click("Import another song…");
  await click("Discard project and start import");
  const disabled = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll("button")].find(
          (b) => b.textContent === "Import document",
        )!.disabled,
    );
  await fill(".raw", "[Verse]");
  assert.ok(await disabled());
  const long = "天".repeat(25);
  await fill(".raw", long + "\n風，雨\n風，雨");
  await capture("document-length");
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[aria-label="Next issue"]')!
      .click(),
  );
  await click("Show suggested split");
  await capture("document-split");
  await click("Accept split");
  assert.ok(!(await disabled()));
  await page.evaluate(() => {
    const fallback = window.fetch;
    window.fetch = async (input, init) => {
      if (input !== "/api/suggest-groups") return fallback(input, init);
      const [first] = JSON.parse(String(init?.body)).occurrences;
      if (first === "限流")
        return Response.json(
          { error: "Provider quota (HTTP 429)." },
          { status: 429 },
        );
      if (first === "等待")
        await new Promise<void>((resolve) =>
          window.addEventListener("release-structural-ai", () => resolve(), {
            once: true,
          }),
        );
      return Response.json({
        groups: [{ name: "Chorus", start: 4, end: 5 }],
        phrases: [],
      });
    };
  });
  const splitDocument = await page.evaluate(() =>
    window.lyricTestText(document.querySelector(".raw")),
  );
  await fill(".raw", "限流");
  await click("Review with AI");
  await waitFor("provider diagnostic", () =>
    page.evaluate(() =>
      document
        .querySelector(".import-suggestions")!
        .textContent!.includes("429"),
    ),
  );
  await fill(".raw", "等待\n甲\n乙\n重\n重");
  await click("Review with AI");
  await click("Cancel review");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("release-structural-ai")),
  );
  await click("Review with AI");
  await fill(".raw", "等待\n甲\n乙\n改\n重");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("release-structural-ai")),
  );
  await waitFor("stale proposal", () =>
    page.evaluate(
      () => !!document.querySelector('[aria-label="Next suggestion"]'),
    ),
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[aria-label="Next suggestion"]')!
      .click(),
  );
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector(".document-patch")!
        .textContent!.includes("Outdated"),
    ),
  );
  await click("Dismiss suggestion");
  await fill(".raw", splitDocument);
  await click("Review with AI");
  await waitFor("proposal", () =>
    page.evaluate(
      () => !!document.querySelector('[aria-label="Next suggestion"]'),
    ),
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[aria-label="Next suggestion"]')!
      .click(),
  );
  await page.evaluate(() =>
    document
      .querySelector(".document-patch")!
      .scrollIntoView({ block: "nearest" }),
  );
  await page.setViewport({ width: 1600, height: 1050, deviceScaleFactor: 1 });
  await capture("document-proposed-heading", true);
  await captureMobile("document-suggestions-mobile");
  const sourcePosition = await page.evaluate(() =>
    window.lyricTestOffset(document.querySelector<HTMLElement>(".raw")!),
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(".review-tabs button:last-child")!
      .click(),
  );
  assert.ok(
    await page.evaluate(
      () => !!document.querySelector(".structure-preview .preview-sections"),
    ),
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(".review-tabs button:first-child")!
      .click(),
  );
  assert.equal(
    await page.evaluate(() =>
      window.lyricTestOffset(document.querySelector<HTMLElement>(".raw")!),
    ),
    sourcePosition,
  );
  await click("Accept suggestion");
  await capture("document-accepted-heading");
  const value = () =>
    page.evaluate(() => window.lyricTestText(document.querySelector(".raw")));
  const accepted = await value();
  assert.ok(accepted.includes("[Chorus]\n風，雨\n風，雨"));
  await click("Undo");
  assert.ok(!(await value()).includes("[Chorus]"));
  await click("Redo");
  assert.equal(await value(), accepted);
  const english = "I want to be your cat even when you are far from home";
  const mixed = "我 love you 啊";
  const withHeaders =
    "歌名：測試\n演唱：小貓\n作詞：林\n" +
    accepted +
    "\n[/]\n" +
    [english, mixed, english, "  唱：小貓  "].join("\n");
  await fill(".raw", withHeaders);
  await click("Review with AI");
  await waitFor("metadata remains available after AI", () =>
    page.evaluate(
      () =>
        !!document.querySelector(".document-patch") &&
        !!document.querySelector('[aria-label="Apply Title: 測試"]'),
    ),
  );
  await activate('[aria-label="Apply Title: 測試"]');
  await activate('[aria-label="Apply Performer: 小貓"]');
  assert.equal(await value(), withHeaders);
  await click("Import document");
  await waitFor(
    "exact document import",
    async () => !!(await read())?.lyricGroups?.length,
  );
  const reviewed = await read();
  assert.deepEqual(reviewed.metadata, {
    title: "測試",
    artist: "小貓",
  });
  assert.equal(reviewed.lyricGroups?.[0].occurrenceIds.length, 2);
  assert.equal(reviewed.phrases.at(-1)?.lyricKey, "  唱：小貓  ");
  for (const project of [reviewed, importLegacy(exportLegacy(reviewed))]) {
    const englishPhrase = project.phrases.find((p) => p.lyricKey === english)!;
    assert.equal(englishPhrase.translation.en, english);
    assert.equal(
      project.occurrences.filter((o) => o.phraseId === englishPhrase.id).length,
      2,
    );
    const phrase = project.phrases.find((p) => p.lyricKey === mixed)!;
    assert.deepEqual(
      phrase.words.map((w) => w.hanzi || w.translation.en),
      ["我", "love", "you", "啊"],
    );
    assert.ok(phrase.words.filter((w) => !w.hanzi).every((w) => !w.pinyin));
  }
  await page.evaluate((text) => {
    const heading = [...document.querySelectorAll(".phrase strong")].find(
      (element) => element.textContent === text,
    );
    heading?.closest("button")?.click();
  }, mixed);
  await fill('[aria-label="Gloss 1"]', "I");
  const mixedId = reviewed.phrases.find(
    (phrase) => phrase.lyricKey === mixed,
  )!.id;
  const editedMixed = (await read()).phrases.find(
    (phrase) => phrase.id === mixedId,
  )!;
  assert.equal(editedMixed.words[0].translation.en, "I");
  assert.equal(editedMixed.lyricKey, mixed);
  await upload("reviewed.json", JSON.stringify(reviewed));
  assert.deepEqual(await read(), reviewed);
  const keyboard = (await page.target().createCDPSession()) as unknown as {
    send(
      method: "Input.dispatchKeyEvent",
      event: {
        type: "keyDown" | "keyUp";
        key: string;
        code: string;
        windowsVirtualKeyCode: number;
        text?: string;
      },
    ): Promise<unknown>;
  };
  const press = async (key: string, windowsVirtualKeyCode: number) => {
    for (const type of ["keyDown", "keyUp"] as const)
      await keyboard.send("Input.dispatchKeyEvent", {
        type,
        key,
        code: key,
        text: key === "Enter" && type === "keyDown" ? "\r" : undefined,
        windowsVirtualKeyCode,
      });
  };
  for (const width of [1640, 390]) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    for (const name of [
      "Import lyrics",
      "Lyric editor",
      "Timing",
      "Video settings",
      "Export data",
    ]) {
      if (width === 390)
        await page.evaluate((name) => {
          const select = document.querySelector<HTMLSelectElement>(
            ".workspace-picker select",
          )!;
          if (!select.getBoundingClientRect().height)
            throw Error("Workspace selector hidden");
          select.focus();
          select.value = name;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }, name);
      else {
        await page.evaluate(
          (name) =>
            document
              .querySelector<HTMLButtonElement>(
                '[data-workspace="' + name + '"]',
              )!
              .focus(),
          name,
        );
        await press("Enter", 13);
      }
      await waitFor("active workspace " + name + " at " + width, async () =>
        page.evaluate(
          (name) =>
            document.querySelector<HTMLElement>(".workflow-tabs [aria-current]")
              ?.dataset.workspace === name,
          name,
        ),
      );
    }
    if (width === 390) {
      await press("Tab", 9);
      assert.ok(
        await page.evaluate(
          () => !!document.activeElement?.closest("header .actions"),
        ),
        "Tab moves from workspace selector to global actions",
      );
    }
    const headerFits = await page.evaluate(() => {
      const header = document.querySelector("main > header")!;
      return [...header.querySelectorAll("button, select")].every((el) => {
        const box = el.getBoundingClientRect();
        return !box.width || (box.left >= 0 && box.right <= innerWidth);
      });
    });
    assert.ok(headerFits, "Global actions fit at " + width);
  }
}
