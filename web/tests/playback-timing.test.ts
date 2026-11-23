import assert from "node:assert/strict";
import { test } from "node:test";
import { rawProject } from "../src/domain.ts";
import { activeLyrics, moveProjectTiming } from "../src/timing/timing.ts";
function fixture() {
  const p = rawProject("你好\n世界\n天空", "Timing", "Test");
  p.occurrences = p.occurrences.map((o, i) => ({
    ...o,
    startMs: 1000 + i * 1000,
    endMs: 2000 + i * 1000,
  }));
  p.occurrences[0].detectedFromAudio = true;
  return p;
}
test("playback uses half-open intervals, preserves overlaps, excludes gaps and unassigned lyrics", () => {
  const p = fixture();
  assert.deepEqual(
    activeLyrics(p.occurrences, 2000).map((o) => o.id),
    ["line-1"],
  );
  assert.equal(activeLyrics(p.occurrences, 4000).length, 0);
  p.occurrences[0].endMs = 2500;
  assert.equal(activeLyrics(p.occurrences, 2200).length, 2);
  p.occurrences[1].startMs = null;
  assert.equal(activeLyrics(p.occurrences, 2200).length, 1);
});
test("either touching handle moves the same shared edge and preserves metadata and baseline", () => {
  const p = fixture();
  const left = moveProjectTiming(p, "line-0", 150, "end", 4000, "edges", true);
  const right = moveProjectTiming(
    p,
    "line-1",
    150,
    "start",
    4000,
    "edges",
    true,
  );
  assert.deepEqual(left, right);
  assert.equal(left.occurrences[0].endMs, 2150);
  assert.equal(left.occurrences[1].startMs, 2150);
  assert.equal(left.timingBaseline, undefined);
  assert.equal(left.occurrences[0].detectedFromAudio, true);
  assert.equal(left.phrases, p.phrases);
  assert.equal(left.occurrences[2], p.occurrences[2]);
  assert.equal(
    moveProjectTiming(p, "line-0", 10000, "end", 4000, "off", true)
      .occurrences[0].endMs,
    2999,
  );
  assert.equal(
    moveProjectTiming(p, "line-1", -10000, "start", 4000, "off", true)
      .occurrences[1].startMs,
    1001,
  );
});
test("off, body moves, gaps and ambiguous touching edges do not edit a neighbor", () => {
  const p = fixture();
  assert.equal(
    moveProjectTiming(p, "line-0", 100, "end").occurrences[1],
    p.occurrences[1],
  );
  assert.equal(
    moveProjectTiming(p, "line-0", 100, "both", undefined, "off", true)
      .occurrences[1],
    p.occurrences[1],
  );
  p.occurrences[1].startMs = 2001;
  assert.equal(
    moveProjectTiming(p, "line-0", 100, "end", undefined, "off", true)
      .occurrences[1],
    p.occurrences[1],
  );
  p.occurrences[1].startMs = 2000;
  p.occurrences[2].startMs = 2000;
  const edited = moveProjectTiming(
    p,
    "line-0",
    100,
    "end",
    undefined,
    "off",
    true,
  );
  assert.deepEqual(edited.occurrences.slice(1), p.occurrences.slice(1));
});
