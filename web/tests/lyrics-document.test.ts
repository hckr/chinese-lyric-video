import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPatch,
  editLines,
  linesFrom,
  parseLines,
  patchIndex,
  projectDocument,
  sectionContext,
} from "../src/lyrics-document.ts";
import { lyricCount, suggestPieces, validPieces } from "../src/lyric-length.ts";
import { rawProject } from "../src/domain.ts";

test("document syntax preserves literal lines, repeated sections and ungrouped gaps", () => {
  const source =
    "  唱：貓  \r\n[Chorus]\r\n風，雨\r\n[/]\r\n間奏\r\n[Chorus]\r\n風，雨\r\n\r\n尾";
  const parsed = parseLines(linesFrom(source));
  assert.deepEqual(
    parsed.rows.map((r) => r.text),
    ["  唱：貓  ", "風，雨", "間奏", "風，雨", "尾"],
  );
  assert.deepEqual(
    parsed.groups.map((g) => [g.name, g.occurrenceIds.length]),
    [
      ["Chorus", 1],
      ["Chorus", 1],
    ],
  );
  assert.notEqual(parsed.rows[1].id, parsed.rows[3].id);
  assert.equal(parsed.rows[4].section, undefined);
  assert.equal(parsed.rows[2].section, undefined);
  assert.deepEqual(parsed.issues, []);
  for (const source of [
    "[/]",
    "[]",
    "[Verse",
    "text]",
    "[A]\n[/]",
    "[A]\n[B]\n字",
  ])
    assert.ok(parseLines(linesFrom(source)).issues.length, source);
});
test("mixed lyric limits count Han characters and whole Latin words", () => {
  assert.equal(lyricCount("我 love you 啊"), 4);
  assert.equal(
    lyricCount("An English lyric can be as long as the singer wants it to be"),
    0,
  );
  for (const n of [10, 11, 12]) {
    const text = "字".repeat(n - 2) + " don't café";
    assert.equal(lyricCount(text), n);
    assert.equal(parseLines(linesFrom(text)).issues.length, Number(n > 11));
  }
  const source = "貓，e\u0301 ²".repeat(12);
  const pieces = suggestPieces(source);
  assert.ok(pieces.length >= 3);
  assert.ok(validPieces(source, pieces));
});
test("snapshot patches target the correct repeated chorus and reject changed context", () => {
  const lines = linesFrom("[Chorus]\n甲\n乙\n[Chorus]\n甲\n乙");
  const patch = {
    label: "Section heading",
    ids: lines.slice(3).map((l) => l.id),
    before: lines.slice(3).map((l) => l.text),
    after: ["[Outro]", "甲", "乙"],
    context: sectionContext(lines, 3, 3),
  };
  const accepted = applyPatch(lines, patch);
  assert.equal(accepted[0], lines[0]);
  assert.equal(accepted[4], lines[4]);
  assert.equal(accepted[3].text, "[Outro]");
  const changed = editLines(lines, "[Chorus]\n甲\n乙\n[Chorus]\n改\n乙", 21);
  assert.equal(patchIndex(changed, patch), -1);
  assert.deepEqual(applyPatch(changed, patch), changed);
  const repeated = linesFrom("甲\n甲\n甲");
  assert.deepEqual(editLines(repeated, "甲\n甲", 0), repeated.slice(1));
});
test("existing projects round-trip trailing ungrouped lyrics and consecutive headings", () => {
  const p = rawProject("一\n二\n三\n四\n五", "", "");
  p.lyricGroups = [
    { id: "a", name: "A", occurrenceIds: ["line-0"] },
    { id: "b", name: "B", occurrenceIds: ["line-1"] },
    { id: "c", name: "C", occurrenceIds: ["line-3"] },
  ];
  const lines = projectDocument(p);
  assert.deepEqual(
    lines.map((l) => l.text),
    ["[A]", "一", "[B]", "二", "[/]", "三", "[C]", "四", "[/]", "五"],
  );
  assert.deepEqual(
    parseLines(lines).groups.map(({ line, ...g }) => g),
    p.lyricGroups,
  );
});

test("accepting the first of three adjacent AI sections leaves the later two actionable", () => {
  const lines = linesFrom("甲\n乙\n丙\n丁\n戊\n己");
  const patches = ["Verse", "Chorus", "Outro"].map((name, index) => {
    const start = index * 2;
    const target = lines.slice(start, start + 2);
    const before = target.map((line) => line.text);
    return {
      label: "Section heading",
      ids: target.map((line) => line.id),
      before,
      after: ["[" + name + "]", ...before, ...(index < 2 ? [""] : [])],
      context: sectionContext(lines, start, target.length),
    };
  });
  const accepted = applyPatch(lines, patches[0]);
  assert.ok(patchIndex(accepted, patches[1]) >= 0);
  assert.ok(patchIndex(accepted, patches[2]) >= 0);
  const sectionChanged = accepted.filter((line) => !line.generatedTerminator);
  assert.equal(patchIndex(sectionChanged, patches[1]), -1);
  const userInsertedHeading = [
    ...accepted.slice(0, 4),
    ...linesFrom("[Manual]"),
    ...accepted.slice(4),
  ];
  assert.equal(patchIndex(userInsertedHeading, patches[1]), -1);
  assert.deepEqual(
    parseLines(patches.slice(1).reduce(applyPatch, accepted)).groups.map(
      (group) => group.name,
    ),
    ["Verse", "Chorus", "Outro"],
  );
});
