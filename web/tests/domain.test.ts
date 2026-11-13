import {
  chineseRedirect,
  resolveWiktionary,
  wiktionaryUrl,
} from "../src/wiktionary.ts";
import { alignedReadings, splitSuggestions } from "../src/split-suggestions.ts";
import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import {
  type Project,
  type Phrase,
  rawProject,
  parseProject,
  projectSchema,
  linePinyin,
  phraseIssues,
  validatePinyinWords,
  fixSpacing,
  mergeAdjacentTokens,
  splitToken,
  commit,
  undo,
  redo,
  type History,
} from "../src/domain.ts";
import { importLegacy, exportLegacy, extractLegacy } from "../src/legacy.ts";
import ts from "typescript";
const root = process.cwd();
const paths = [
  "src/Angela_Zhang_Keep_Walking.ts",
  "src/Macchiato_Special_Affection_for_You.ts",
];
for (const path of paths) {
  test(`${path}: complete semantic legacy round trip`, () => {
    const text = readFileSync(path, "utf8");
    const original = extractLegacy(text);
    const p = importLegacy(text, path);
    assert.deepEqual(extractLegacy(exportLegacy(p)), original);
    assert.deepEqual(parseProject(JSON.stringify(p)), p);
    assert.ok(p.occurrences.length > p.phrases.length);
    assert.ok(p.phrases.every((v) => v.review === "pending"));
    const changed = {
      ...p,
      phrases: p.phrases.map((v, i) =>
        i === 0 ? { ...v, translation: { en: "Edited", pl: "Poprawione" } } : v,
      ),
    };
    const again = importLegacy(exportLegacy(changed));
    assert.deepEqual(again.occurrences, p.occurrences);
    assert.equal(again.phrases[0].translation.en, "Edited");
  });
}
function sample(): Project {
  const p = rawProject("漂亮\n漂亮", "Test", "Artist");
  p.phrases[0] = {
    ...p.phrases[0],
    translation: { en: "Beautiful", pl: "Piękny" },
    review: "reviewed",
    segmentationApproved: true,
    words: [
      { id: "a", hanzi: "漂", pinyin: "piào", translation: { en: "float" } },
      { id: "b", hanzi: "亮", pinyin: "liang", translation: { en: "bright" } },
      { id: "note", hanzi: "", pinyin: "", translation: { en: "[if]" } },
    ],
  };
  p.occurrences[0].startMs = 12345;
  p.occurrences[0].endMs = 12789;
  p.occurrences[1].startMs = 45000;
  p.occurrences[1].endMs = 48000;
  return p;
}
test("merge/split keep stable IDs, notes, translations, occurrences and round trip", () => {
  const p = sample(),
    phrase = p.phrases[0];
  const merged = mergeAdjacentTokens(phrase, "a", {
    pinyin: "piàoliang",
    glossOverride: "beautiful",
  });
  assert.equal(merged.words.length, 2);
  assert.equal(merged.words[0].id, "a");
  assert.equal(merged.words[0].hanzi, "漂亮");
  assert.equal(merged.words[0].pinyin, "piàoliang");
  assert.deepEqual(merged.words[1], phrase.words[2]);
  assert.equal(merged.review, "pending");
  assert.equal(merged.segmentationApproved, false);
  assert.deepEqual(merged.translation, phrase.translation);
  const round = importLegacy(exportLegacy({ ...p, phrases: [merged] }));
  assert.equal(round.phrases[0].words[0].pinyin, "piàoliang");
  assert.deepEqual(round.occurrences, p.occurrences);
  const split = splitToken(
    merged,
    "a",
    {
      hanziBoundary: 1,
      leftPinyin: "piào",
      rightPinyin: "liang",
      leftGloss: "float",
      rightGloss: "bright",
    },
    "right",
  );
  assert.deepEqual(
    split.words.map((w) => w.id),
    ["a", "right", "note"],
  );
  assert.equal(split.lyricKey, phrase.lyricKey);
  assert.deepEqual(split.translation, phrase.translation);
  assert.deepEqual(
    importLegacy(exportLegacy({ ...p, phrases: [split] })).phrases[0].words.map(
      ({ hanzi, pinyin, translation }) => ({ hanzi, pinyin, translation }),
    ),
    phrase.words.map(({ hanzi, pinyin, translation }) => ({
      hanzi,
      pinyin,
      translation,
    })),
  );
  assert.throws(
    () => mergeAdjacentTokens(merged, "a", { pinyin: "", glossOverride: "" }),
    /grammar/,
  );
  assert.throws(
    () =>
      splitToken(merged, "a", {
        hanziBoundary: 0,
        leftPinyin: "",
        rightPinyin: "",
        leftGloss: "",
        rightGloss: "",
      }),
    /boundary/,
  );
});
test("Unicode-safe split and explicit readings; unmodified words retain identities", () => {
  const p: Phrase = {
    ...sample().phrases[0],
    lyricKey: "𠀀人",
    words: [
      {
        id: "a",
        hanzi: "𠀀人",
        pinyin: "hēnrén",
        translation: { en: "draft" },
      },
    ],
  };
  const split = splitToken(
    p,
    "a",
    {
      hanziBoundary: 1,
      leftPinyin: "hēn",
      rightPinyin: "rén",
      leftGloss: "draft",
      rightGloss: "person",
    },
    "b",
  );
  assert.deepEqual(
    split.words.map((w) => w.hanzi),
    ["𠀀", "人"],
  );
});
test("undo/redo restores selection, approved segmentation and review status", () => {
  const p = sample(),
    present = { project: p, phraseId: p.phrases[0].id, tokenId: "b" };
  const h: History = { present, past: [], future: [] };
  const merged = mergeAdjacentTokens(p.phrases[0], "a", {
    pinyin: "piàoliang",
    glossOverride: "beautiful",
  });
  const edited = commit(h, {
    project: { ...p, phrases: [merged] },
    phraseId: p.phrases[0].id,
    tokenId: "a",
  });
  assert.deepEqual(undo(edited).present, present);
  assert.deepEqual(redo(undo(edited)), edited);
});
test("Pinyin spacing preserved on import, explicit corrections preserve apostrophes/tones", () => {
  const p = importLegacy(readFileSync(paths[0], "utf8"));
  const word = p.phrases
    .flatMap((v) => v.words)
    .find((w) => w.pinyin === "bù qīng");
  assert.ok(word);
  assert.ok(
    p.phrases.some((v) =>
      validatePinyinWords(v).some((s) => s.includes("Fix spacing")),
    ),
  );
  assert.equal(fixSpacing("piào liang"), "piàoliang");
  assert.equal(fixSpacing("nǚ ér"), "nǚ'ér");
  assert.equal(fixSpacing("xī'ān"), "xī'ān");
  assert.deepEqual(
    extractLegacy(exportLegacy(p)),
    extractLegacy(readFileSync(paths[0], "utf8")),
  );
  const phrase = {
    ...sample().phrases[0],
    words: [
      { id: "a", hanzi: "我", pinyin: "wǒ", translation: { en: "I" } },
      { id: "b", hanzi: "喜欢", pinyin: "xǐhuan", translation: { en: "like" } },
    ],
  };
  assert.equal(linePinyin(phrase), "wǒ xǐhuan");
  assert.ok(
    phraseIssues({
      ...phrase,
      lyricKey: "我喜欢",
      words: [{ ...phrase.words[0], pinyin: "pinyin" }],
    }).length,
  );
});
test("raw import strips sections, retains all repeats with nullable timing and shared translation", () => {
  const p = rawProject(
    "[Verse]\n我喜欢你\n漂亮的梦\n我喜欢你",
    "Title",
    "Artist",
  );
  assert.equal(p.phrases.length, 2);
  assert.equal(p.occurrences.length, 3);
  assert.equal(p.occurrences[0].phraseId, p.occurrences[2].phraseId);
  assert.equal(p.occurrences[0].startMs, null);
  assert.equal(importLegacy(exportLegacy(p)).occurrences[0].startMs, 0);
});
test("JSON rejects broken references, duplicate IDs, malformed fields and unknown version", () => {
  const p = sample();
  assert.throws(() => projectSchema.parse({ ...p, schemaVersion: 2 }));
  assert.throws(() =>
    projectSchema.parse({
      ...p,
      occurrences: [{ ...p.occurrences[0], phraseId: "missing" }],
    }),
  );
  assert.throws(() =>
    projectSchema.parse({
      ...p,
      occurrences: [p.occurrences[0], p.occurrences[0]],
    }),
  );
  assert.throws(() =>
    projectSchema.parse({
      ...p,
      occurrences: [{ ...p.occurrences[0], startMs: 10.5 }],
    }),
  );
  assert.throws(() =>
    projectSchema.parse({ ...p, metadata: { title: 42, artist: "a" } }),
  );
});
for (const [name, source] of Object.entries({
  call: 'const X = alert("bad");',
  cycle: "const A = B; const B = A;",
  import: 'import "evil";',
  getter: "const X = {get evil(){return 1}};",
  assignment: "let X = [];",
  computed: 'const X = {[alert("bad")]: 1};',
})) {
  test(`static importer rejects ${name} without execution`, () => {
    const valid = readFileSync(paths[1], "utf8");
    assert.throws(() => importLegacy(source + "\n" + valid));
  });
}
test("unsupported lines getter fails instead of silently discarding behavior", () => {
  const valid = readFileSync(paths[1], "utf8");
  assert.throws(
    () => importLegacy(valid.replace("return TIMELINE.map", "return evil.map")),
    /Unsupported lines getter/,
  );
});
test("generated exports typecheck against actual consumer line types and original song getter type", () => {
  // Consumer blocks read directly from the checked-out renderer, not mirrored test types.
  const consumers = [
    "src/LyricVideo.tsx",
    "src/LyricVideoOnlyPinin.tsx",
    "src/LyricVideoShort.tsx",
    "src/LyricVideo2.tsx",
  ];
  for (const path of paths) {
    const output = exportLegacy(importLegacy(readFileSync(path, "utf8")));
    const lineTypes = consumers
      .map((path, i) =>
        readFileSync(path, "utf8")
          .match(/type LineData = \{[\s\S]*?\n\};/)![0]
          .replace("LineData", `Consumer${i}`),
      )
      .join("\n");
    const code =
      output.replace("export default {", "const song = {") +
      "\n" +
      lineTypes +
      "\n" +
      consumers
        .map((_, i) => `const consumer${i}: Consumer${i}[] = song.lines;`)
        .join("\n");
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    };
    const host = ts.createCompilerHost(options),
      original = host.getSourceFile.bind(host);
    host.getSourceFile = (file, languageVersion, ...rest) =>
      file === "/virtual.ts"
        ? ts.createSourceFile(file, code, languageVersion, true)
        : original(file, languageVersion, ...rest);
    const diagnostics = ts.getPreEmitDiagnostics(
      ts.createProgram(["/virtual.ts"], options, host),
    );
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (s) => s,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      }),
    );
  }
});

test("static importer bounds expanding array spreads", () => {
  const arrays = Array.from({ length: 19 }, (_, i) =>
    i === 0
      ? "const expand0 = [1, 2];"
      : `const expand${i} = [...expand${i - 1}, ...expand${i - 1}];`,
  ).join("\n");
  assert.throws(
    () => importLegacy(arrays + readFileSync(paths[1], "utf8")),
    /Expanded array exceeds import limit/,
  );
});

test("split suggestions align existing readings without guessing ambiguous syllables or meanings", () => {
  const w = (hanzi: string, pinyin: string) => ({
    id: "reading",
    hanzi,
    pinyin,
    translation: { en: "compound" },
  });
  assert.deepEqual(alignedReadings(w("确信", "quèxìn")), ["què", "xìn"]);
  assert.deepEqual(alignedReadings(w("漂亮", "piàoliang")), ["piào", "liang"]);
  assert.deepEqual(alignedReadings(w("女儿", "nǚ'ér")), ["nǚ", "ér"]);
  assert.equal(alignedReadings(w("西安", "xian")), null);
  assert.equal(alignedReadings(w("确信", "unknown")), null);
  const suggestion = splitSuggestions(w("确信", "quèxìn"), 1, []);
  assert.deepEqual(suggestion, {
    leftPinyin: "què",
    rightPinyin: "xìn",
    leftGloss: "",
    rightGloss: "",
  });
  const p = sample().phrases[0];
  assert.equal(
    splitSuggestions(w("漂亮", "piàoliang"), 1, [p]).leftGloss,
    "float",
  );
});

test("Pinyin whitespace produces one actionable warning, without a duplicate character warning", () => {
  const p = {
    ...sample().phrases[0],
    words: [
      {
        id: "a",
        hanzi: "所在",
        pinyin: "suǒ zài",
        translation: { en: "location" },
      },
    ],
  };
  const issues = validatePinyinWords(p);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /Fix spacing/);
});
test("Wiktionary soft redirects are restricted to one unambiguous Chinese target", () => {
  assert.equal(chineseRedirect("==Chinese==\n{{zh-see|確信|s}}"), "確信");
  assert.equal(
    chineseRedirect("==Chinese==\n{{zh-see|乾}}\n{{zh-see|幹}}"),
    null,
  );
  assert.equal(chineseRedirect("==Japanese==\n{{zh-see|確信}}"), null);
  assert.equal(
    chineseRedirect("==Chinese==\n{{zh-see|javascript:evil}}"),
    null,
  );
});
test("Wiktionary follows the actual soft redirect and falls back on network failure", async () => {
  const calls: string[] = [];
  const mock = (async (url: RequestInfo | URL) => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        parse: {
          wikitext:
            calls.length === 1
              ? "==Chinese==\n{{zh-see|確信|s}}"
              : "==Chinese==\nDefinitions",
        },
      }),
    } as Response;
  }) as typeof fetch;
  assert.equal(await resolveWiktionary("确信", mock), wiktionaryUrl("確信"));
  assert.equal(calls.length, 2);
  const fail = (async () => {
    throw Error("offline");
  }) as typeof fetch;
  assert.equal(await resolveWiktionary("简", fail), wiktionaryUrl("简"));
});

test("legacy getters accept both callback parameter forms without accepting calls", () => {
  const source = exportLegacy(sample());
  const bare = source.replace("map((item) =>", "map(item =>");
  assert.deepEqual(extractLegacy(bare), extractLegacy(source));
  assert.throws(() =>
    importLegacy(bare.replace("map(item =>", "map(item => evil(")),
  );
  assert.throws(
    () => importLegacy(bare.replace("id: item.id", "id: evil(item.id)")),
    /Unsupported lines getter/,
  );
});
const python = path.join(root, "python-src/venv/bin/python");
test(
  "actual Python workbench TS export imports into React with all song data preserved",
  {
    skip:
      !existsSync(python) && "Set up the Python venv to run the interop check",
  },
  () => {
    const result = spawnSync(
      python,
      [
        "-c",
        "from workbench.songs import import_song, export_ts; print(export_ts(import_song()))",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PYTHONPATH: path.join(root, "python-src") },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /TIMELINE\.map\(item =>/);
    const imported = importLegacy(result.stdout);
    assert.deepEqual(
      extractLegacy(exportLegacy(imported)),
      extractLegacy(readFileSync(paths[1], "utf8")),
    );
  },
);

test("split without an explicit right ID uses Web Crypto from the test runtime", () => {
  const phrase = mergeAdjacentTokens(sample().phrases[0], "a", {
    pinyin: "piàoliang",
    glossOverride: "beautiful",
  });
  const split = splitToken(phrase, "a", {
    hanziBoundary: 1,
    leftPinyin: "piào",
    rightPinyin: "liang",
    leftGloss: "float",
    rightGloss: "bright",
  });
  assert.match(
    split.words[1].id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.notEqual(split.words[1].id, split.words[0].id);
});

test("Pinyin review validates syllable sequences and Hanzi counts", () => {
  const issues = (hanzi: string, pinyin: string) =>
    validatePinyinWords({
      ...sample().phrases[0],
      words: [{ id: "reading", hanzi, pinyin, translation: { en: "gloss" } }],
    });
  for (const pinyin of [
    "hello",
    "---",
    "nǐhǎo",
    "pinyin",
    "ni3",
    "nǐ̌",
    "ni!",
  ]) {
    assert.ok(issues("你", pinyin).length, pinyin);
  }
  for (const [hanzi, pinyin] of [
    ["你", "nǐ"],
    ["嗯", "n̄"],
    ["嗯", "ń"],
    ["呣", "ḿ"],
    ["漂亮", "piàoliang"],
    ["喜欢", "xǐhuan"],
    ["女儿", "nǚ'ér"],
    ["女兒", "nǚ’ér"],
    ["花儿", "huār"],
    ["花兒", "huār"],
    ["不清", "(bùqīng)"],
    ["西安", "xī'ān"],
  ])
    assert.deepEqual(issues(hanzi, pinyin), [], `${hanzi}: ${pinyin}`);
});

test("Chinese section headings are excluded from phrases, occurrences and exports", () => {
  const project = rawProject("主歌\n你好\n副歌\n你好", "Title", "Artist");
  assert.deepEqual(
    project.phrases.map((p) => p.lyricKey),
    ["你好"],
  );
  assert.equal(project.occurrences.length, 2);
  assert.equal(
    project.occurrences[0].phraseId,
    project.occurrences[1].phraseId,
  );
  const exported = exportLegacy(project);
  assert.ok(!exported.includes("主歌"));
  assert.ok(!exported.includes("副歌"));
  assert.equal(
    rawProject("主歌是故事\n副歌声响起", "Title", "Artist").phrases.length,
    2,
  );
});
