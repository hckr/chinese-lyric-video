import { orderGroupedProject } from "../src/lyric-groups.ts";
import { parseLines, projectDocument } from "../src/import/lyrics-document.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  detectStructure,
  groupsOf,
  replaceGroups,
  reviseSource,
} from "../src/import/import-structure.ts";
test("headings and stanzas map source segments and preserve repeated appearances", () => {
  const draft = detectStructure(
    "歌\n作詞：人\n独\n[Verse 2]\n風，雨。\n[Pre-chorus]\n一\n[Chorus]\n風，雨。",
  );
  assert.deepEqual(draft.rows[2], { line: 4, segment: 1, text: "雨" });
  assert.deepEqual(
    groupsOf(draft).map((g) => [g.name, g.occurrenceIds]),
    [
      ["Verse 2", ["line-1", "line-2"]],
      ["Chorus", ["line-4", "line-5"]],
    ],
  );
  assert.equal(groupsOf(detectStructure("甲\n乙")).length, 0);
  assert.deepEqual(
    groupsOf(detectStructure("甲\n乙\n\n丙")).map((g) => g.name),
    ["Stanza 1"],
  );
});
test("manual ranges and removals survive unrelated edits and flag ambiguous repeats", () => {
  const raw = "[Verse]\n甲，乙\n[Chorus]\n丙，丁";
  let d = detectStructure(raw);
  const [verse, chorus] = groupsOf(d);
  d = replaceGroups(d, [verse], {
    ...verse,
    id: "custom",
    name: "Opening",
    occurrenceIds: ["line-0"],
  });
  d = replaceGroups(d, [chorus]);
  d = reviseSource(d, "先\n" + raw);
  assert.deepEqual(groupsOf(d), [
    { id: "custom", name: "Opening", occurrenceIds: ["line-1"] },
  ]);
  assert.deepEqual(d.needsReview, []);
  assert.ok(reviseSource(d, "先\n" + raw + "\n甲，乙").needsReview.length);
});

import { lyricCount, suggestPieces, validPieces } from "../src/lyric-length.ts";
import { changeBoundaries } from "../src/import/import-structure.ts";
import {
  addReviewedPieces,
  proposedIntervals,
  type Candidate,
} from "../src/timing/automatic-timing.ts";
import { rawProject } from "../src/domain.ts";

test("NFC letter and digit counts and multi-piece review preserve source", () => {
  for (const n of [10, 11, 12]) assert.equal(lyricCount("字".repeat(n)), n);
  assert.equal(lyricCount("我， A e\u0301! ３4"), 5);
  assert.equal(lyricCount("é"), lyricCount("e\u0301"));
  const text = "我 比 谁 都 明 了".repeat(5),
    pieces = suggestPieces(text);
  assert.ok(pieces.length >= 3);
  assert.ok(validPieces(text, pieces));
  assert.equal(validPieces(text, pieces.slice(1)), false);
  const initial = detectStructure("[Verse]\n" + text + "\n尾声");
  const split = changeBoundaries(initial, 0, 1, pieces);
  assert.equal(groupsOf(split)[0].occurrenceIds.length, pieces.length + 1);
  const joined = changeBoundaries(split, 0, 2, [pieces[0] + pieces[1]]);
  assert.ok(lyricCount(joined.rows[0].text) > 11);
});

test("reviewed discoveries use both sides of a pause and require manual intra-token times", () => {
  const c: Candidate = {
    id: "intro",
    text: "甲乙丙丁戊己庚辛壬癸子丑",
    startMs: 0,
    endMs: 5500,
    timedWords: [
      { text: "甲乙丙丁戊己", startMs: 0, endMs: 2000 },
      { text: "庚辛壬癸子丑", startMs: 2600, endMs: 5500 },
    ],
  };
  const pieces = c.timedWords!.map((w) => w.text);
  assert.deepEqual(proposedIntervals(c, pieces), c.timedWords);
  assert.equal(
    proposedIntervals(c, ["甲", c.text.slice(1)])[0].endMs,
    undefined,
  );
  assert.equal(
    proposedIntervals({ ...c, timedWords: undefined }, pieces)[1].startMs,
    undefined,
  );
  const project = rawProject("你好", "Review", "");
  project.timingRun = {
    id: "run",
    model: "test",
    transcriptProvenance: "external-unverified",
    candidates: [c],
  };
  assert.throws(() =>
    addReviewedPieces(project, c.id, [
      { text: c.text, startMs: 0, endMs: 100 },
    ]),
  );
  assert.throws(() =>
    addReviewedPieces(project, c.id, [
      c.timedWords![0],
      { ...c.timedWords![1], startMs: 1900 },
    ]),
  );
  const result = addReviewedPieces(project, c.id, c.timedWords!);
  assert.deepEqual(result.timingRun?.candidates, []);
  assert.equal(project.timingRun.candidates.length, 1);
  assert.equal(
    result.occurrences.filter(
      (o) => o.detectedFromAudio && o.timingReview === "needs-review",
    ).length,
    2,
  );
});

test("split audio between two members joins their section in timeline order", () => {
  const project = rawProject("你好\n再见", "Review", "");
  project.occurrences = project.occurrences.map((cue, index) => ({
    ...cue,
    startMs: index * 3000,
    endMs: index * 3000 + 500,
  }));
  project.lyricGroups = [
    { id: "intro", name: "Intro", occurrenceIds: ["line-0", "line-1"] },
  ];
  const pieces = [
    { text: "今天大家一起", startMs: 500, endMs: 1200 },
    { text: "来听我们的歌", startMs: 1300, endMs: 2000 },
  ];
  project.timingRun = {
    id: "run",
    model: "test",
    transcriptProvenance: "external-unverified",
    candidates: [
      {
        id: "detected",
        text: pieces.map((piece) => piece.text).join(""),
        startMs: 500,
        endMs: 2000,
      },
    ],
  };
  const result = addReviewedPieces(project, "detected", pieces);
  const ids = result.occurrences.map((cue) => cue.id);
  assert.deepEqual(
    result.occurrences.map((cue) => cue.startMs),
    [0, 500, 1300, 3000],
  );
  assert.deepEqual(result.lyricGroups?.[0].occurrenceIds, ids);
  assert.deepEqual(
    parseLines(projectDocument(result)).groups[0].occurrenceIds,
    ids,
  );
  assert.deepEqual(
    orderGroupedProject(result).occurrences.map((cue) => cue.id),
    ids,
  );
  assert.deepEqual(project.lyricGroups[0].occurrenceIds, ["line-0", "line-1"]);
});

test("project structure document handles Traditional to Simplified conversion with preserved identities", () => {
  const project = rawProject("美麗的花\n[Chorus]\n可愛的貓", "Title", "");
  const baseLines = projectDocument(project);
  const parsedBase = parseLines(baseLines);
  assert.equal(parsedBase.rows.length, 2);

  const convertedTexts = new Map([
    ["美麗的花", "美丽的花"],
    ["可愛的貓", "可爱的猫"],
  ]);
  const convertedLines = baseLines.map((l) => ({
    ...l,
    text: convertedTexts.get(l.text) ?? l.text,
  }));
  const parsedConverted = parseLines(convertedLines);

  assert.equal(parsedConverted.rows.length, parsedBase.rows.length);
  assert.ok(
    parsedConverted.rows.every(
      (r, i) => r.text === convertedTexts.get(parsedBase.rows[i].text),
    ),
  );
  assert.equal(parsedConverted.groups.length, parsedBase.groups.length);
});
