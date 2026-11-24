import test from "node:test";
import assert from "node:assert/strict";
import {
  rawProject,
  serializeProject,
  parseProject,
  type Project,
} from "../src/domain.ts";
import {
  passages,
  chosenTiming,
  type Edition,
  differenceType,
} from "../src/import/reconcile.ts";
import {
  refineImported,
  roughBoundary,
} from "../src/timing/import-refinement.ts";
const song = (id: number, texts: string[], times?: number[]): Edition => ({
  credit: {
    id,
    provider: "LRCLIB",
    url: "https://lrclib.net/api/get/" + id,
    track: "Song",
    artist: "Artist",
    album: "",
    fetchedAt: new Date(0).toISOString(),
    duration: 20,
  },
  text: texts.join("\n"),
  cues: times ? texts.map((text, i) => ({ text, startMs: times[i] })) : [],
});
test("reconciliation aligns moved breaks, insertions and repeated appearances", () => {
  const rows = [
    song(
      1,
      ["如果明天下雨", "我们一起走", "晚安", "晚安"],
      [1000, 3500, 9000, 14000],
    ),
    song(
      2,
      ["开场", "如果明天", "下雨我们一起走", "晚安", "晚安"],
      [0, 1050, 2000, 9010, 14010],
    ),
    song(3, ["如果明天", "下雨我们一起走", "晚安", "晚安"]),
  ];
  const blocks = passages(rows);
  assert.deepEqual(
    blocks.map((b) => b.variants[0].length),
    [0, 2, 1, 1],
  );
  assert.equal(
    differenceType(blocks[1].variants[0], blocks[1].variants[1]),
    "Different line breaks",
  );
  const timing = chosenTiming(
    blocks,
    blocks.map((b, i) => ({
      edition: i === 1 ? 2 : 0,
      text: b.variants[i === 1 ? 2 : 0].map((l) => l.text).join("\n"),
      useStarts: true,
    })),
    rows,
    "a".repeat(64),
  );
  assert.deepEqual(
    timing.pieces.map((p) => p.sourceStart),
    [1000, 2000, 9000, 14000],
  );
  assert.deepEqual(timing.pieces[0].alternativeStarts, [1000, 1050]);
  assert.equal(timing.pieces[0].acceptStart, false);
  assert.equal(timing.pieces[1].sourceId, 3);
  assert.equal(timing.pieces[1].timingSourceId, 2);
});
function baseline(): Project {
  const p = rawProject("甲乙\n丙丁\n戊己", "song", "artist");
  const texts = p.occurrences.map(
    (o) => p.phrases.find((ph) => ph.id === o.phraseId)!.lyricKey,
  );
  return parseProject(
    serializeProject({
      ...p,
      occurrences: p.occurrences.map((o, i) => ({
        ...o,
        startMs: [1000, null, 5000][i],
      })),
      editionTiming: {
        fingerprint: "a".repeat(64),
        editionId: 1,
        cues: [
          { text: "甲乙丙丁", startMs: 1000 },
          { text: "戊己", startMs: 5000 },
        ],
        pieces: p.occurrences.map((o, i) => ({
          id: o.id,
          text: texts[i],
          cue: i === 2 ? 1 : 0,
          sourceStart: i === 1 ? undefined : i === 0 ? 1000 : 5000,
        })),
      },
    }),
  );
}
test("rough bounds remain pending, strong refinement is applied for review and weak or conflicting runs preserve the baseline", () => {
  const p = baseline();
  assert.deepEqual(roughBoundary(p, 1, "startMs", 10000), {
    ms: 3000,
    basis: "Estimated from lyric length",
  });
  const lines = p.occurrences.map((o, i) => ({
    id: o.id,
    text: p.editionTiming!.pieces[i].text,
    refinementEvidence: true,
    matched: 2,
    total: 2,
    reasons: [] as string[],
    observedStartMs: [1100, 3200, 5100][i],
    observedEndMs: [2200, 4300, 6000][i],
  }));
  const strong = refineImported(p, { lines }, 10000);
  assert.equal(strong.project.occurrences[0].startMs, 1000);
  assert.equal(strong.project.occurrences[1].startMs, 3200);
  assert.equal(strong.project.occurrences[1].endMs, 4300);
  assert.equal(strong.project.occurrences[1].refinement, undefined);
  assert.equal(strong.project.occurrences[1].timingReview, "needs-review");
  assert.equal(refineImported(strong.project, { lines }, 10000).count, 0);
  assert.equal(
    refineImported(
      p,
      { lines: lines.map((l) => ({ ...l, matched: 1 })) },
      10000,
    ).project,
    p,
  );
  const conflicting = refineImported(
    p,
    {
      lines: lines.map((l, i) =>
        i === 1 ? { ...l, observedStartMs: 6000, observedEndMs: 6500 } : l,
      ),
    },
    10000,
  );
  assert.equal(conflicting.project.occurrences[1].refinement, undefined);
});
