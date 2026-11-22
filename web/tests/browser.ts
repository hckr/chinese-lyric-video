import { rawProject } from "../src/domain.ts";
import { automaticTiming, cachedTimingModels } from "../timing-api.ts";
import { detectedAudioAcceptance } from "./detected-audio-browser.ts";
import { waveformMedia } from "./waveform-media.ts";
import { browserExecutable } from "./browser-executable.ts";
import { lyricsGrouping } from "./lyrics-grouping.ts";
import { importLyrics } from "../import-api.ts";
import { build } from "esbuild";
import { withTimingBaseline } from "../src/timing.ts";
import { importWorkflow } from "./import-workflow.ts";
import { timingReviewAcceptance } from "./timing-review-browser.ts";
import { timingAcceptance } from "./timing-browser.ts";
// Uses the browser already cached by Remotion; never downloads a browser.
import { openBrowser } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import type { Project } from "../src/domain.ts";

type Download = { name: string; text: string };
declare global {
  interface Window {
    __downloads: Promise<Download>[];
    __wikiCalls: string[];
    __openedTabs: number;
    __restoreWiki: () => void;
  }
}

const executable = browserExecutable(
  process.platform,
  process.arch,
  process.env,
);

// Build in memory so an open dev server cannot replace test assets with its
// live-reload bundle while this suite runs.
const built = await build({
  entryPoints: ["web/src/main.tsx"],
  bundle: true,
  write: false,
  outfile: "app.js",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
const assets = new Map(
  built.outputFiles.map((file) => [path.basename(file.path), file.contents]),
);
const translationCalls: {
  route: string;
  body: {
    jobs: Record<string, string[]>;
    model: string;
    vocabularyMode: string;
    thinkingEffort?: string;
    revision?: { wordIndex?: number };
    timeline: { lyricKey: string }[];
    phrases: {
      id: string;
      text: string;
      translation: { en: string; pl: string };
      words: { hanzi: string }[];
    }[];
  };
}[] = [];
const idiom = {
  hanzi: "一丝一毫",
  pinyin: "yī sī yī háo",
  translation: { en: "the slightest bit" },
};
let releaseTranslation: (() => void) | undefined;
const server = http.createServer((req, res) => {
  const requestPath = req.url ?? "/";
  if (requestPath === "/api/translation/providers") {
    res.end(
      JSON.stringify({
        Groq: ["qwen/qwen3.8-27b"],
        Gemini: ["gemma-4-26b-a4b-it", "gemma-4-31b-it"],
      }),
    );
    return;
  }
  if (requestPath.startsWith("/api/translation/")) {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", async () => {
      const body = JSON.parse(raw) as (typeof translationCalls)[number]["body"];
      translationCalls.push({ route: requestPath, body });
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      if (translationCalls.length === 1) {
        for (let index = 0; index < 30; index++)
          res.write(
            JSON.stringify({
              kind: "notice",
              message: `Fixture message ${index}`,
            }) + "\n",
          );
        res.write('{"kind":"retry","code":429,"delay":9}\n');
        await new Promise<void>((resolve) => {
          releaseTranslation = resolve;
        });
      }
      for (const [stage, ids] of Object.entries<string[]>(body.jobs)) {
        res.write(
          JSON.stringify({
            kind: "request",
            stage,
            count: ids.length,
            prompt: "debug fixture prompt",
          }) + "\n",
        );
        res.write(
          JSON.stringify({ kind: "response", text: "debug fixture response" }) +
            "\n",
        );
        if (translationCalls.length === 1 && stage === "pl") {
          res.write(
            JSON.stringify({
              kind: "issue",
              reason: "rate_limit",
              stage,
              ids,
            }) + "\n",
          );
          continue;
        }
        for (const id of ids) {
          const word =
            body.phrases.find((phrase) => phrase.id === id)?.text ===
            idiom.hanzi
              ? idiom
              : {
                  hanzi: "有梦",
                  pinyin: "yǒumèng",
                  translation: { en: "have a dream" },
                };
          const value =
            stage === "vocabulary"
              ? [
                  body.revision
                    ? { ...word, translation: { en: "an iota" } }
                    : word,
                ]
              : body.revision
                ? stage === "en"
                  ? "Even a little."
                  : "Choć odrobinę."
                : stage === "en"
                  ? "The slightest bit."
                  : "Ani odrobiny.";
          res.write(
            JSON.stringify({
              kind: "draft",
              id,
              stage,
              value,
              support: stage === "vocabulary" ? null : [word],
              dictionary: stage === "vocabulary" ? ["dictionary evidence"] : [],
              promptVersion: "offline-test",
            }) + "\n",
          );
        }
      }
      res.end('{"kind":"done"}\n');
    });
    return;
  }
  if (req.url === "/api/timing-models") {
    void cachedTimingModels(req, res);
    return;
  }
  if (requestPath === "/api/automatic-timing") {
    void automaticTiming(req, res, process.cwd());
    return;
  }
  if (
    requestPath === "/api/import-lyrics" ||
    requestPath === "/api/dictionary"
  ) {
    void importLyrics(
      req,
      res,
      process.cwd(),
      req.url === "/api/dictionary" ? "dictionary" : "import",
    ).catch(() => {
      if (!res.writableEnded)
        res.writeHead(500).end(JSON.stringify({ error: "Import failed" }));
    });
    return;
  }
  const name = requestPath === "/" ? "index.html" : requestPath.slice(1);
  if (!["index.html", "app.js", "app.css"].includes(name)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader(
    "Content-Type",
    name.endsWith(".js")
      ? "text/javascript"
      : name.endsWith(".css")
        ? "text/css"
        : "text/html",
  );
  res.end(
    name === "index.html"
      ? fs.readFileSync("web/index.html")
      : assets.get(name),
  );
});
(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  let browser;
  try {
    browser = await openBrowser("chrome", { browserExecutable: executable });
    const errors: string[] = [];
    const page = await browser.newPage({
      context: () => null,
      logLevel: "error",
      indent: false,
      pageIndex: 0,
      onBrowserLog: (log) => {
        if (log.type === "error") errors.push(log.text);
      },
      onLog: () => {},
    });
    await page.setViewport({ width: 1640, height: 1050, deviceScaleFactor: 1 });
    const address = server.address();
    if (!address || typeof address === "string")
      throw Error("Expected a TCP server address");
    const url = `http://127.0.0.1:${address.port}`;
    await page.goto({ url, timeout: 30000 });
    const settle = () =>
      page.evaluate(() => new Promise((r) => setTimeout(r, 100)));
    const click = async (text: string) => {
      const deadline = Date.now() + 10000;
      let clicked = false;
      while (!clicked && Date.now() < deadline) {
        clicked = await page.evaluate((text) => {
          const button =
            [...document.querySelectorAll<HTMLButtonElement>("button")].find(
              (b) => b.dataset.workspace === text,
            ) ??
            [...document.querySelectorAll<HTMLButtonElement>("button")].find(
              (b) =>
                b.textContent?.trim() === text &&
                b.getBoundingClientRect().height > 0,
            );
          if (!button || button.disabled) return false;
          button.click();
          return true;
        }, text);
        if (!clicked) await settle();
      }
      if (!clicked) throw Error("Button unavailable: " + text);
      await settle();
    };
    const upload = async (name: string, source: string) => {
      await click("Import lyrics");
      if (
        await page.evaluate(
          () => !!document.querySelector(".import-replacement"),
        )
      ) {
        await click("Import another song…");
        await click("Discard project and start import");
      }
      await page.evaluate(
        (name, source) => {
          const input = document.querySelector<HTMLInputElement>(
            '[aria-label="Song file"]',
          )!;
          const data = new DataTransfer();
          data.items.add(new File([source], name, { type: "text/plain" }));
          input.files = data.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        },
        name,
        source,
      );
      if (name.endsWith(".txt")) {
        await click("Import document");
      }
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const finished = await page.evaluate(
          () =>
            document.querySelector("h1")?.textContent !== "Import lyrics" ||
            !!document.querySelector(".content > .error"),
        );
        if (finished) break;
        await settle();
      }
      await settle();
    };
    const read = () =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("lyric-workbench-v1") ?? "null",
          ) as Project,
      );
    const fill = async (selector: string, value: string) => {
      await page.evaluate(
        (selector, value) => {
          const el = document.querySelector<
            HTMLInputElement | HTMLTextAreaElement
          >(selector)!;
          if (!el) throw Error("Missing input " + selector);
          const proto =
            el.tagName === "TEXTAREA"
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        },
        selector,
        value,
      );
      await settle();
    };
    if (process.argv.includes("--timing-review")) {
      await timingReviewAcceptance(page, { click, upload, read, fill });
      assert.deepEqual(
        errors.filter((error) => !error.includes("ERR_BLOCKED_BY_CLIENT")),
        [],
      );
      return;
    }
    if (process.argv.includes("--detected-audio")) {
      await detectedAudioAcceptance(page, { click, upload, read });
      assert.deepEqual(
        errors.filter((error) => !error.includes("ERR_BLOCKED_BY_CLIENT")),
        [],
      );
      return;
    }
    if (process.argv.includes("--waveform-media")) {
      await upload("waveform.txt", "测试音频");
      await click("Timing");
      await waveformMedia(page);
      assert.deepEqual(
        errors.filter((error) => !error.includes("ERR_BLOCKED_BY_CLIENT")),
        [],
      );
      return;
    }
    if (process.argv.includes("--translation")) {
      const fixture = rawProject("一丝一毫\n一丝一毫\n有梦", "Offline", "Test");
      fixture.phrases[0].words = [];
      fixture.phrases[1].words = [
        {
          id: "existing-dictionary-row",
          hanzi: "有梦",
          pinyin: "yǒumèng",
          translation: { en: "" },
        },
      ];
      fixture.occurrences = fixture.occurrences.map((cue, i) => ({
        ...cue,
        startMs: 1000 * i,
        endMs: 1000 * i + 500,
      }));
      await upload("translation.json", JSON.stringify(fixture));
      assert.equal(translationCalls.length, 0);
      assert.equal(
        await page.evaluate(
          () =>
            document.querySelector<HTMLDetailsElement>(".translation-options")!
              .open,
        ),
        false,
      );
      assert.equal(
        await page.evaluate(
          () => !!document.querySelector('textarea[maxlength="4000"]'),
        ),
        false,
      );
      await page.evaluate(() => {
        const effort = [
          ...document.querySelectorAll(".translation-toolbar label"),
        ]
          .find((label) => label.textContent?.includes("Thinking effort"))!
          .querySelector("select")!;
        effort.value = "medium";
        effort.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await click("Translate whole song");
      try {
        let status = "";
        const until = Date.now() + 5000;
        while (Date.now() < until) {
          status = await page.evaluate(
            () =>
              document.querySelector(".translation-toolbar [role=status]")
                ?.textContent ?? "",
          );
          if (
            status.includes("temporarily limiting requests") &&
            status.includes("retry in")
          )
            break;
          await settle();
        }
        assert.match(
          status,
          /Groq.*0\/6 drafts.*temporarily limiting requests.*retry in.*0%/,
        );
        await click("Timing");
        assert.equal(
          await page.evaluate(
            () =>
              !!document
                .querySelector(".translation-toolbar")
                ?.closest("[hidden]"),
          ),
          true,
        );
      } finally {
        releaseTranslation?.();
      }
      const waitForDrafts = async (count: number) => {
        const deadline = Date.now() + 10000;
        while (
          (await read()).translationWork?.drafts.length !== count &&
          Date.now() < deadline
        )
          await settle();
        assert.equal((await read()).translationWork?.drafts.length, count);
      };
      await waitForDrafts(4);
      await click("Lyric editor");
      assert.equal(translationCalls.length, 1);
      assert.equal(translationCalls[0].body.thinkingEffort, "medium");
      assert.equal(translationCalls[0].body.model, "qwen/qwen3.8-27b");
      assert.deepEqual(
        translationCalls[0].body.timeline.map((cue) => cue.lyricKey),
        ["一丝一毫", "一丝一毫", "有梦"],
      );
      assert.deepEqual(
        translationCalls[0].body.jobs.vocabulary,
        fixture.phrases.map((phrase) => phrase.id),
      );
      assert.ok(
        await page.evaluate(() => {
          const details = document.querySelector<HTMLDetailsElement>(
            ".translation-run-details",
          );
          return (
            details &&
            !details.open &&
            details.textContent?.includes("reached a usage limit") &&
            document
              .querySelector(".translation-toolbar [role=status]")
              ?.textContent?.includes("Vocabulary ready for 2 of 2")
          );
        }),
      );
      await page.evaluate(() => {
        document
          .querySelector<HTMLElement>(".translation-run-details > summary")!
          .click();
      });
      await settle();
      assert.ok(
        await page.evaluate(() => {
          const list = document.querySelector(".translation-run-details > ul")!;
          return (
            list.scrollHeight > list.clientHeight &&
            list.scrollHeight - list.clientHeight - list.scrollTop <= 8
          );
        }),
      );
      await page.evaluate(() => {
        const provider = document.querySelector<HTMLSelectElement>(
          ".translation-toolbar select",
        )!;
        provider.value = "Gemini";
        provider.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.evaluate(() => {
        const select = document.querySelector<HTMLSelectElement>(
          ".translation-toolbar label:nth-of-type(2) select",
        )!;
        select.value = "gemma-4-31b-it";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await click("Retry unfinished");
      await waitForDrafts(6);
      assert.equal(translationCalls[1].body.thinkingEffort, undefined);
      assert.equal(translationCalls[1].body.model, "gemma-4-31b-it");
      assert.deepEqual(translationCalls[1].body.jobs, {
        pl: fixture.phrases.map((phrase) => phrase.id),
      });
      assert.deepEqual(
        translationCalls[1].body.phrases.map((item) => item.words[0].hanzi),
        ["一丝一毫", "有梦"],
      );
      assert.ok(
        await page.evaluate(() => {
          const fields = Array.from(
            document.querySelectorAll<HTMLTextAreaElement>(
              ".translation-exchange textarea",
            ),
          );
          return (
            fields.some((field) => field.value === "debug fixture prompt") &&
            fields.some((field) => field.value === "debug fixture response") &&
            !localStorage
              .getItem("lyric-workbench-v1")
              ?.includes("debug fixture")
          );
        }),
      );
      await click("Revise lyric…");
      await page.evaluate(() =>
        document
          .querySelector<HTMLInputElement>(
            ".translation-review-actions form input[type=checkbox]",
          )!
          .click(),
      );
      await fill('textarea[maxlength="4000"]', "Keep the original speaker");
      await click("Generate revision");
      assert.deepEqual(Object.keys(translationCalls[2].body.jobs).sort(), [
        "en",
        "pl",
      ]);
      assert.ok(
        await page.evaluate(() => {
          const buttons = Array.from(
            document.querySelectorAll<HTMLButtonElement>(
              ".translation-toolbar button",
            ),
          );
          return (
            !buttons.some((button) =>
              /Resume translation|Translate remaining lyrics|Retry unfinished/.test(
                button.textContent ?? "",
              ),
            ) &&
            buttons.some(
              (button) =>
                button.textContent?.trim() === "Draft replacements" &&
                !button.disabled,
            )
          );
        }),
      );
      const source = translationCalls[2].body.phrases[0];
      assert.equal(source.words[0].hanzi, idiom.hanzi);
      assert.equal(source.translation.en, "The slightest bit.");
      assert.equal(source.translation.pl, "Ani odrobiny.");
      assert.deepEqual(
        await page.evaluate(() =>
          ["English", "Polish"].map(
            (label) =>
              document.querySelector<HTMLInputElement>(
                `[aria-label="${label} sentence"]`,
              )?.value,
          ),
        ),
        ["Even a little.", "Choć odrobinę."],
      );
      assert.match(
        await page.evaluate(
          () =>
            document.querySelector(".translation-review-actions [role=status]")
              ?.textContent ?? "",
        ),
        /ready for review.*English, Polish/,
      );
      await click("Timing");
      await click("Lyric editor");
      assert.ok(
        await page.evaluate(
          () => !!document.querySelector(".translation-exchange"),
        ),
      );
      await page.evaluate(() => {
        const raw = localStorage.getItem("lyric-workbench-v1")!;
        const saved = JSON.parse(raw);
        saved.phrases[0].translation.en = "Human edit";
        localStorage.setItem("lyric-workbench-v1", JSON.stringify(saved));
      });
      await page.goto({ url, timeout: 30000 });
      assert.equal(
        await page.evaluate(
          () => !!document.querySelector(".translation-exchange"),
        ),
        false,
      );
      await click("Review drafts for 2 lyrics");
      assert.ok(
        await page.evaluate(
          () =>
            document.querySelectorAll(".editor .tokens .token:not(.headings)")
              .length === 1 &&
            document.querySelector(".editor .token [data-draft]") &&
            document
              .querySelector(".translation-review-actions")
              ?.textContent?.includes("A draft is stale"),
        ),
      );
      await click("Revise lyric…");
      assert.ok(
        await page.evaluate(() => {
          const form = document.querySelector(
            ".translation-review-actions form",
          )!;
          const parts = form.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"]',
          );
          if (parts.length !== 3) return false;
          parts[0].click();
          return (
            !parts[0].checked &&
            parts[1].checked &&
            parts[2].checked &&
            form.textContent?.includes("gemma-4-31b-it")
          );
        }),
      );
      await click("Cancel revision");
      await click("Revise this word");
      assert.ok(
        await page.evaluate(() =>
          document
            .querySelector(".translation-review-actions form label")
            ?.textContent?.includes("一丝一毫"),
        ),
      );
      await click("Cancel revision");
      await fill('textarea[aria-label="Gloss 1"]', "a tiny bit");
      assert.equal((await read()).phrases[0].words.length, 0);
      await click("Apply all drafts for this lyric");
      assert.equal(
        (await read()).phrases[0].words[0].translation.en,
        "a tiny bit",
      );
      assert.equal((await read()).phrases[0].translation.en, "Human edit");
      assert.equal((await read()).phrases[0].words[0].pinyin, "yī sī yī háo");
      assert.deepEqual((await read()).occurrences, fixture.occurrences);
      await click("Undo");
      assert.equal((await read()).phrases[0].words.length, 0);
      await click("Redo");
      await click("Revise this word");
      await fill('textarea[maxlength="4000"]', "Use a more literal gloss");
      await click("Generate revision");
      await click("Apply all drafts for this lyric");
      assert.equal(
        (await read()).phrases[0].words[0].translation.en,
        "an iota",
      );
      assert.equal(translationCalls[3].route, "/api/translation/revise");
      assert.equal(translationCalls[3].body.revision?.wordIndex, 0);
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
      await click("Next draft");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.ok(
        await page.evaluate(() => {
          const button = [
            ...document.querySelectorAll<HTMLButtonElement>(
              ".translation-toolbar button",
            ),
          ].find((item) =>
            item.textContent?.includes("Fill missing fields with"),
          );
          return button?.getClientRects().length && !button.closest("details");
        }),
      );
      await click("Fill missing fields with 3 drafts");
      assert.equal((await read()).phrases[1].translation.pl, "Ani odrobiny.");
      assert.equal(
        (await read()).phrases[1].words[0].id,
        "existing-dictionary-row",
      );
      assert.equal(translationCalls.length, 4);
      assert.match(
        await page.evaluate(
          () =>
            document.querySelector(".translation-toolbar")?.textContent ?? "",
        ),
        /replacement drafts? needs? individual review on 1 lyric/,
      );
      await click("Review drafts for 1 lyric");
      await page.evaluate(() =>
        document
          .querySelector<HTMLElement>(".translation-options > summary")!
          .click(),
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await click("Draft replacement glosses");
      await waitForDrafts(3);
      assert.equal(translationCalls[4].body.vocabularyMode, "glosses");
      assert.deepEqual(translationCalls[4].body.jobs, {
        vocabulary: [fixture.phrases[0].id],
      });
      assert.equal(
        (await read()).phrases[0].words[0].translation.en,
        "an iota",
      );
      assert.ok(
        await page.evaluate(
          () =>
            document.querySelector<HTMLInputElement>('[aria-label="Pinyin 1"]')
              ?.readOnly,
        ),
      );
      await click("Apply all drafts for this lyric");
      assert.equal(
        (await read()).phrases[0].words[0].translation.en,
        "the slightest bit",
      );

      await page.evaluate(() => {
        const field = document
          .querySelector('[aria-label="English sentence"]')!
          .closest("label")!.parentElement!;
        const dismiss = field.querySelector<HTMLButtonElement>(
          '[aria-label="Dismiss English draft"]',
        );
        if (!dismiss?.getClientRects().length)
          throw new Error("Dismiss must be visible beside the English draft");
        dismiss.click();
      });
      await settle();
      assert.equal((await read()).phrases[0].translation.en, "Human edit");
      assert.deepEqual(errors, []);
      console.log("Translation browser acceptance passed.");
      return;
    }
    if (process.argv.includes("--lyrics-grouping")) {
      await lyricsGrouping(page, { click, fill, read, upload });
      assert.deepEqual(errors, []);
      console.log("Lyrics grouping acceptance passed.");
      return;
    }
    if (process.argv.includes("--import-workflow")) {
      await importWorkflow(page, { click, fill, read, upload });
      assert.deepEqual(
        errors.filter((error) => !error.includes("ERR_BLOCKED_BY_CLIENT")),
        [],
      );
      console.log("Synthetic import workflow passed.");
      return;
    }
    await upload(
      "Macchiato.ts",
      fs.readFileSync("src/Macchiato_Special_Affection_for_You.ts", "utf8"),
    );
    let p = await read();
    assert.equal(p.occurrences.length, 37);
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector<HTMLElement>('.phrase span[lang="en"]')!
            .textContent,
      ),
      p.phrases[0].translation.en,
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector<HTMLElement>('.phrase span[lang="pl"]')!
            .textContent,
      ),
      p.phrases[0].translation.pl,
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector<HTMLElement>(
            '[aria-label="English sentence"]',
          )!.tagName,
      ),
      "INPUT",
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector<HTMLElement>('[aria-label="Polish sentence"]')!
            .tagName,
      ),
      "INPUT",
    );
    assert.equal(
      await page.evaluate(() =>
        document.body.textContent?.includes("SHARED LYRIC PHRASE"),
      ),
      false,
    );
    assert.equal(
      await page.evaluate(
        () =>
          document
            .querySelector<HTMLElement>(".inspector")!
            .getBoundingClientRect().width,
      ),
      360,
    );
    await fill('[aria-label="English sentence"]', "Browser-edited English");
    assert.equal(
      (await read()).phrases[0].translation.en,
      "Browser-edited English",
    );
    const times = (await read()).occurrences;
    await page.evaluate(() =>
      document
        .querySelector<HTMLInputElement>('[aria-label="Pinyin 3"]')!
        .focus(),
    );
    await settle();
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector<HTMLInputElement>(
            '.token.selected [aria-label="Hanzi 3"]',
          )!.value,
      ),
      "专属",
    );
    await click("Split word");
    assert.deepEqual(
      await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLInputElement>("[role=dialog] input"),
        ].map((e) => e.value),
      ),
      ["zhuān", "shǔ"],
    );
    await click("Cancel");
    await fill('[aria-label="Gloss 3"]', "one\ntwo\nthree");
    const tall = await page.evaluate(
      () =>
        document
          .querySelector<HTMLTextAreaElement>('[aria-label="Gloss 3"]')!
          .getBoundingClientRect().height,
    );
    await fill('[aria-label="Gloss 3"]', "one");
    const short = await page.evaluate(
      () =>
        document
          .querySelector<HTMLTextAreaElement>('[aria-label="Gloss 3"]')!
          .getBoundingClientRect().height,
    );
    assert.ok(
      tall > short + 20,
      "Gloss grows for multiline content and shrinks again",
    );
    await fill('[aria-label="Gloss 3"]', "one\ntwo\nthree\nfour");
    const capped = await page.evaluate(
      () =>
        document
          .querySelector<HTMLTextAreaElement>('[aria-label="Gloss 3"]')!
          .getBoundingClientRect().height,
    );
    assert.ok(
      Math.abs(capped - tall) < 1,
      "More than three lines scroll within the three-line cap (allow subpixel rounding)",
    );
    await page.evaluate(() =>
      document
        .querySelector<HTMLInputElement>('[aria-label="Hanzi 1"]')!
        .focus(),
    );
    await settle();

    await click("Merge with next");
    await fill("[role=dialog] textarea", "Merged meaning");
    await click("Confirm merge draft");
    p = await read();
    assert.equal(p.phrases[0].words[0].hanzi, "对你");
    assert.equal(p.phrases[0].words[0].pinyin, "duìnǐ");
    assert.deepEqual(p.occurrences, times);
    await click("Undo");
    assert.equal((await read()).phrases[0].words[0].hanzi, "对");
    await click("Redo");
    await click("Split word");
    await fill("[role=dialog] input", "duì");
    await fill("[role=dialog] textarea", "partial");
    await page.evaluate(() => {
      const fields = document.querySelectorAll<HTMLInputElement>(
        "[role=dialog] input",
      );
      const proto = HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(
        fields[1],
        "nǐ",
      );
      fields[1].dispatchEvent(new Event("input", { bubbles: true }));
      const areas = document.querySelectorAll<HTMLTextAreaElement>(
        "[role=dialog] textarea",
      );
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(areas[1], "love");
      areas[1].dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
    await click("Confirm split draft");
    p = await read();
    assert.equal(p.phrases[0].words[0].pinyin, "duì");
    assert.equal(p.phrases[0].words[1].pinyin, "nǐ");
    assert.deepEqual(p.occurrences, times);
    await upload("unsupported.ts", 'import "evil";');
    assert.equal(await read(), null);
    await upload("resume.json", JSON.stringify(p));
    await page.goto({ url, timeout: 30000 });
    await settle();
    await click("Lyric editor");
    assert.equal(
      (await read()).phrases[0].translation.en,
      "Browser-edited English",
    );
    await page.evaluate(() => {
      window.__wikiCalls = [];
      window.__openedTabs = 0;
      const originalFetch = window.fetch,
        originalOpen = window.open;
      window.__restoreWiki = () => {
        window.fetch = originalFetch;
        window.open = originalOpen;
      };
      window.open = () => {
        window.__openedTabs++;
        return null;
      };
      window.fetch = async (url, options) => {
        if (!String(url).startsWith("https://en.wiktionary.org/w/api.php"))
          return originalFetch(url, options);
        window.__wikiCalls.push(String(url));
        return new Response(
          JSON.stringify({
            parse: {
              wikitext:
                new URL(String(url)).searchParams.get("page") === "对"
                  ? "==Chinese==\n{{zh-see|對|s}}"
                  : "==Chinese==\nDefinitions",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      };
    });
    // Remotion's CDP declarations omit this standard Chrome command.
    const client = page._client();
    const blockRequests = client.send as unknown as (
      method: "Network.setBlockedURLs",
      parameters: { urls: string[] },
    ) => Promise<unknown>;
    await blockRequests.call(client, "Network.setBlockedURLs", {
      urls: ["https://en.wiktionary.org/wiki/*"],
    });
    await click("Wiktionary");
    const redirectDeadline = Date.now() + 5000;
    while (
      !(await page.evaluate(
        () =>
          document.querySelector<HTMLIFrameElement>(
            ".dictionary-dialog[open] iframe",
          )?.src === "https://en.wiktionary.org/wiki/%E5%B0%8D#Chinese",
      )) &&
      Date.now() < redirectDeadline
    ) {
      await settle();
    }

    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector<HTMLIFrameElement>(
            ".dictionary-dialog[open] iframe",
          )!.src,
      ),
      "https://en.wiktionary.org/wiki/%E5%B0%8D#Chinese",
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector<HTMLIFrameElement>(
            ".dictionary-dialog iframe",
          )!.title,
      ),
      "Wiktionary entry: 对",
    );
    assert.equal(await page.evaluate(() => window.__openedTabs), 0);
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector<HTMLAnchorElement>(
            ".dictionary-dialog footer a",
          )!.href,
      ),
      "https://en.wiktionary.org/wiki/%E5%B0%8D#Chinese",
    );
    await click("Close");
    assert.equal(
      await page.evaluate(() =>
        Boolean(document.querySelector<HTMLElement>(".dictionary-dialog")!),
      ),
      false,
    );
    await page.evaluate(() => window.__restoreWiki());
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
    let downloads = await page.evaluate(() => Promise.all(window.__downloads));
    assert.equal(
      JSON.parse(downloads[0].text).phrases[0].translation.en,
      "Browser-edited English",
    );
    await click("Export data");
    await page.evaluate(() =>
      document
        .querySelector<HTMLInputElement>(
          ".warnings + label input[type=checkbox]",
        )!
        .click(),
    );
    await settle();
    await click("Download legacy TypeScript");
    downloads = await page.evaluate(() => Promise.all(window.__downloads));
    assert.ok(downloads[1].text.includes("Browser-edited English"));
    await upload("roundtrip.ts", downloads[1].text);
    assert.deepEqual((await read()).occurrences, times);
    await upload(
      "KeepWalking.ts",
      fs.readFileSync("src/Angela_Zhang_Keep_Walking.ts", "utf8"),
    );
    assert.ok(
      (await page.evaluate(() =>
        [...document.querySelectorAll<HTMLButtonElement>("button")].some(
          (b) => b.textContent === "Fix spacing",
        ),
      )) === false,
    ); // Spaced word is in another phrase, never auto-corrected.
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLButtonElement>(".phrase")]
        .find((b) => b.textContent?.includes("雨泼进眼里看不清"))!
        .click(),
    );
    await settle();
    assert.ok(
      await page.evaluate(() =>
        [...document.querySelectorAll<HTMLButtonElement>("button")].some(
          (b) => b.textContent === "Fix spacing",
        ),
      ),
    );
    await click("Fix spacing");
    assert.ok(
      (await read()).phrases
        .flatMap((p) => p.words)
        .some((w) => w.hanzi === "不清" && w.pinyin === "bùqīng"),
    );
    fs.mkdirSync("out/workbench", { recursive: true });
    const shot = await page
      ._client()
      .send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "out/workbench/review.png",
      Buffer.from(shot.value.data, "base64"),
    );
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await settle();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const mobile = await page
      ._client()
      .send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "out/workbench/mobile.png",
      Buffer.from(mobile.value.data, "base64"),
    );
    // TEST_PLAN M1: exact segmentation example, approved JSON recovery,
    // shared occurrences and raw ingestion through the actual React controls.
    await page.setViewport({ width: 1640, height: 1050, deviceScaleFactor: 1 });
    let fixture: Project = {
      schemaVersion: 1,
      format: "lyric-workbench",
      source: "acceptance-fixture",
      metadata: { title: "Acceptance", artist: "Test" },
      phrases: [
        {
          id: "phrase-0",
          lyricKey: "漂亮",
          translation: { en: "Beautiful", pl: "Piękne" },
          review: "reviewed",
          segmentationApproved: true,
          words: [
            {
              id: "pretty-left",
              hanzi: "漂",
              pinyin: "piào",
              translation: { en: "float" },
            },
            {
              id: "pretty-right",
              hanzi: "亮",
              pinyin: "liang",
              translation: { en: "bright" },
            },
            {
              id: "pretty-note",
              hanzi: "",
              pinyin: "",
              translation: { en: "[if]" },
            },
          ],
        },
      ],
      occurrences: [
        {
          id: "first-chorus",
          phraseId: "phrase-0",
          startMs: 12345,
          endMs: 12789,
        },
        {
          id: "repeat-chorus",
          phraseId: "phrase-0",
          startMs: 45000,
          endMs: 48000,
        },
      ],
    };
    fixture = withTimingBaseline(fixture);
    await upload("acceptance.json", JSON.stringify(fixture));
    assert.deepEqual(await read(), withTimingBaseline(fixture));
    await click("Merge with next");
    await fill("[role=dialog] textarea", "beautiful");
    await click("Confirm merge draft");
    p = await read();
    assert.equal(p.phrases[0].words[0].hanzi, "漂亮");
    assert.equal(p.phrases[0].words[0].pinyin, "piàoliang");
    assert.equal(p.phrases[0].words[0].id, "pretty-left");
    assert.deepEqual(p.phrases[0].words[1], fixture.phrases[0].words[2]);
    assert.deepEqual(p.phrases[0].translation, fixture.phrases[0].translation);
    assert.deepEqual(p.occurrences, fixture.occurrences);
    assert.equal(p.phrases[0].review, "pending");
    assert.equal(p.phrases[0].segmentationApproved, false);
    assert.equal(
      await page.evaluate(() => document.querySelector(".hero")),
      null,
    );
    await click("Undo");
    assert.deepEqual((await read()).phrases, fixture.phrases);
    await click("Redo");
    await click("Mark phrase reviewed");
    const approved = await read();
    assert.equal(approved.phrases[0].segmentationApproved, true);
    const beforeJson = await page.evaluate(() => window.__downloads.length);
    await click("Download project JSON");
    downloads = await page.evaluate(() => Promise.all(window.__downloads));
    await upload("reopened.json", downloads[beforeJson].text);
    assert.deepEqual(await read(), approved);
    const beforeTs = await page.evaluate(() => window.__downloads.length);
    await click("Export data");
    await click("Download legacy TypeScript");
    downloads = await page.evaluate(() => Promise.all(window.__downloads));
    await upload("merged.ts", downloads[beforeTs].text);
    p = await read();
    assert.equal(p.phrases[0].words.filter((w) => w.hanzi).length, 1);
    assert.equal(p.phrases[0].words[0].pinyin, "piàoliang");
    assert.deepEqual(p.occurrences, fixture.occurrences);
    await click("Split word");
    assert.deepEqual(
      await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLInputElement>("[role=dialog] input"),
        ].map((e) => e.value),
      ),
      ["piào", "liang"],
    );
    await fill("[role=dialog] textarea", "float");
    await fill("[role=dialog] label:nth-last-of-type(1) textarea", "bright");
    await click("Confirm split draft");
    const split = await read();
    assert.deepEqual(
      split.phrases[0].words.map((w) => ({
        hanzi: w.hanzi,
        pinyin: w.pinyin,
        translation: w.translation,
      })),
      fixture.phrases[0].words.map((w) => ({
        hanzi: w.hanzi,
        pinyin: w.pinyin,
        translation: w.translation,
      })),
    );
    assert.deepEqual(split.occurrences, fixture.occurrences);
    assert.deepEqual(
      split.phrases[0].translation,
      fixture.phrases[0].translation,
    );
    await fill('[aria-label="English sentence"]', "Edited shared chorus");
    p = await read();
    assert.deepEqual(
      p.occurrences.map(
        (o) => p.phrases.find((v) => v.id === o.phraseId)!.translation.en,
      ),
      ["Edited shared chorus", "Edited shared chorus"],
    );
    await upload("raw.txt", "[Verse]\n我喜欢你\n漂亮的梦\n我喜欢你");
    const raw = await read();
    assert.equal(raw.phrases.length, 2);
    assert.equal(raw.occurrences.length, 3);
    assert.equal(raw.occurrences[0].phraseId, raw.occurrences[2].phraseId);
    assert.ok(
      raw.occurrences.every((o) => o.startMs === null && o.endMs === null),
    );
    await click("Export data");
    assert.ok(
      await page.evaluate(() =>
        document
          .querySelector<HTMLElement>(".warnings")!
          .textContent?.includes("unassigned"),
      ),
    );
    console.log(
      "M1 acceptance passed: 漂亮 merge/split, note/ID/timing preservation, review undo/redo, approved JSON reopen, TS reimport, shared chorus edits, raw repetitions/unassigned timing.",
    );
    await timingAcceptance(page, { click, fill, read, upload });
    await timingReviewAcceptance(page, { click, fill, read, upload });
    assert.deepEqual(
      errors.filter((e) => !String(e).includes("ERR_BLOCKED_BY_CLIENT")),
      [],
    );
    console.log(
      "Browser checks passed: both TS imports, shared editing, merge/split, undo/redo, failed import retention, reload, JSON/TS downloads, explicit spacing correction, mobile width.",
    );
  } finally {
    if (browser) await browser.close({ silent: true });
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
