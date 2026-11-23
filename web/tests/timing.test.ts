import { rulerMarks, formatRulerTime } from "../src/timing/timing.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  rawProject,
  parseProject,
  commit,
  undo,
  redo,
  type History,
} from "../src/domain.ts";
import { importLegacy, exportLegacy } from "../src/legacy.ts";
import {
  attachAudioMetadata,
  cueLanes,
  editTiming,
  formatTime,
  followPlayhead,
  mediaMs,
  moveTiming,
  resetTiming,
  snappedTime,
  timingNotices,
  withTimingBaseline,
  reviewTiming,
} from "../src/timing/timing.ts";
import { waveformAllowed, waveformPeaks } from "../src/timing/waveform.ts";

function fixture() {
  const project = rawProject("你好\n世界\n你好", "Timing", "Test");
  project.occurrences = project.occurrences.map((o, i) => ({
    ...o,
    startMs: 10000 * (i + 1),
    endMs: 10000 * (i + 1) + 2000,
  }));
  return reviewTiming(
    withTimingBaseline(project),
    new Set(project.occurrences.map((o) => o.id)),
    true,
  );
}
test("exact authored milliseconds and baseline survive JSON and legacy TS round trips", () => {
  const project = fixture();
  const edited = editTiming(project, "line-2", {
    startMs: 12345,
    endMs: 12789,
  });
  const reopened = parseProject(JSON.stringify(edited));
  assert.deepEqual(reopened, edited);
  assert.deepEqual(
    importLegacy(exportLegacy(reopened)).occurrences.map(
      ({ startMs, endMs }) => ({ startMs, endMs }),
    ),
    edited.occurrences.map(({ startMs, endMs }) => ({ startMs, endMs })),
  );
  assert.deepEqual(resetTiming(reopened, "line-2"), project);
});
test("timing changes affect only one repeated occurrence; phrase review and IDs remain intact", () => {
  const project = fixture();
  const next = editTiming(project, "line-2", { startMs: 45000, endMs: 47000 });
  assert.strictEqual(next.phrases, project.phrases);
  assert.strictEqual(next.occurrences[0], project.occurrences[0]);
  assert.strictEqual(next.occurrences[1], project.occurrences[1]);
  assert.equal(next.occurrences[2].phraseId, next.occurrences[0].phraseId);
  assert.equal(next.occurrences[2].id, project.occurrences[2].id);
  const history: History = {
    present: {
      project,
      phraseId: project.phrases[0].id,
      tokenId: "",
      occurrenceId: "line-2",
    },
    past: [],
    future: [],
  };
  const committed = commit(history, { ...history.present, project: next });
  assert.deepEqual(undo(committed).present.project, project);
  assert.deepEqual(redo(undo(committed)).present.project, next);
  assert.equal(redo(undo(committed)).present.occurrenceId, "line-2");
});
test("capture allows partial assignment and rejects invalid or out-of-media edits atomically", () => {
  const project = withTimingBaseline(rawProject("你好", "", ""));
  const start = editTiming(project, "line-0", { startMs: mediaMs(23) }, 30000);
  assert.equal(start.occurrences[0].endMs, null);
  const end = editTiming(start, "line-0", { endMs: mediaMs(24.75) }, 30000);
  assert.equal(end.occurrences[0].startMs, 23000);
  assert.equal(end.occurrences[0].endMs, 24750);
  for (const patch of [
    { startMs: -1 },
    { startMs: NaN },
    { endMs: Infinity },
    { endMs: 12.3 },
    { endMs: 23000 },
    { startMs: 25000 },
    { endMs: 30001 },
  ])
    assert.throws(() => editTiming(end, "line-0", patch, 30000));
  assert.equal(end.occurrences[0].endMs, 24750);
  assert.throws(() => editTiming(end, "missing", { startMs: 1 }));
});
test("drag/trim clamp valid intervals without moving neighbors or quantizing milliseconds", () => {
  const cue = { id: "cue", phraseId: "phrase", startMs: 12345, endMs: 12789 };
  assert.deepEqual(moveTiming(cue, -99999, "both", 20000), {
    ...cue,
    startMs: 0,
    endMs: 444,
  });
  assert.deepEqual(moveTiming(cue, 99999, "both", 20000), {
    ...cue,
    startMs: 19556,
    endMs: 20000,
  });
  assert.equal(moveTiming(cue, 99999, "start", 20000).startMs, 12788);
  assert.equal(moveTiming(cue, -99999, "end", 20000).endMs, 12346);
  assert.equal(moveTiming(cue, 10, "both").startMs, 12355);
  assert.throws(() => moveTiming({ ...cue, startMs: null }, 10, "both"));
});
test("snapping is opt-in and uses neighboring cue edges", () => {
  assert.equal(snappedTime(12345, "off", []), 12345);
  const cues = fixture().occurrences;
  assert.equal(snappedTime(11980, "edges", cues), 12000);
  assert.equal(snappedTime(11500, "edges", cues), 11500);
});
test("overlap drafts remain editable and visible", () => {
  const project = fixture();
  assert.equal(
    editTiming(project, "line-2", { startMs: 11000, endMs: 13000 })
      .occurrences[2].startMs,
    11000,
  );
  const updated = {
    ...project,
    occurrences: project.occurrences.map((o) =>
      o.id === "line-2" ? { ...o, startMs: 11000, endMs: 13000 } : o,
    ),
  };
  assert.ok(
    timingNotices(updated.occurrences, 2).some((v) => v.includes("overlap")),
  );
  assert.deepEqual(timingNotices(project.occurrences, 1), []);
  const lanes = cueLanes(updated.occurrences);
  assert.notEqual(lanes.get("line-0"), lanes.get("line-2"));
  assert.ok(
    timingNotices([{ ...project.occurrences[0], startMs: null }], 0).includes(
      "Unassigned timing",
    ),
  );
});
test("imported legacy timings, placeholders and word structures remain unchanged until an explicit edit", () => {
  for (const filename of [
    "Angela_Zhang_Keep_Walking",
    "Macchiato_Special_Affection_for_You",
  ]) {
    const original = importLegacy(readFileSync(`src/${filename}.ts`, "utf8"));
    const project = withTimingBaseline(original);
    assert.deepEqual(project.occurrences, original.occurrences);
    assert.deepEqual(project.phrases, original.phrases);
    assert.deepEqual(
      importLegacy(exportLegacy(project)).occurrences,
      original.occurrences,
    );
  }
});
test("waveform bins include stereo peaks, remain bounded and do not omit final samples", () => {
  assert.deepEqual(
    waveformPeaks(
      [new Float32Array([0, 0.5, -1, 0]), new Float32Array([0.8, 0, 0, -0.75])],
      2,
    ),
    [Math.fround(0.8), 1],
  );
  assert.deepEqual(waveformPeaks([new Float32Array([0, 0, 1])], 2), [0, 1]);
  assert.deepEqual(waveformPeaks([]), []);
  assert.equal(waveformPeaks([new Float32Array(10000)]).length, 1600);
  assert.ok(waveformAllowed(180000));
  assert.ok(!waveformAllowed(Number.NaN));
  assert.ok(!waveformAllowed(9 * 60000));
  assert.equal(formatTime(12345), "0:12.345");
  assert.equal(formatTime(null), "Unassigned");
});
test("JSON validates audio metadata and retires old baseline", () => {
  const project = fixture();
  project.audio = {
    name: "local.wav",
    size: 100,
    lastModified: 1,
    durationMs: 60000,
  };
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
  assert.throws(() =>
    parseProject(
      JSON.stringify({
        ...project,
        audio: { ...project.audio, url: "blob:invalid" },
      }),
    ),
  );
  assert.equal(
    parseProject(
      JSON.stringify({
        ...project,
        timingBaseline: [{ ...project.occurrences[0], id: "wrong" }],
      }),
    ).timingBaseline,
    undefined,
  );
});

test("undo across different occurrence edits restores each independently", () => {
  const project = fixture();
  let history: History = {
    present: {
      project,
      phraseId: project.phrases[0].id,
      tokenId: "",
      occurrenceId: "line-0",
    },
    past: [],
    future: [],
  };
  const first = editTiming(project, "line-0", { startMs: 10123 });
  history = commit(history, { ...history.present, project: first });
  const second = editTiming(first, "line-2", { startMs: 30123 });
  history = commit(history, {
    ...history.present,
    project: second,
    occurrenceId: "line-2",
  });
  history = undo(history);
  assert.deepEqual(history.present.project, first);
  assert.equal(history.present.occurrenceId, "line-0");
  assert.deepEqual(undo(history).present.project, project);
  assert.deepEqual(redo(history).present.project, second);
});

test("timing undo and redo retain the current soundtrack metadata", () => {
  const project = fixture();
  let history: History = {
    present: { project, phraseId: project.phrases[0].id, tokenId: "" },
    past: [],
    future: [],
  };
  history = commit(history, {
    ...history.present,
    project: editTiming(project, "line-1", { startMs: 20123 }),
  });
  const audio = {
    name: "current.wav",
    size: 1000,
    lastModified: 1,
    durationMs: 60000,
  };
  history = attachAudioMetadata(history, audio);
  assert.equal(history.past.length, 1);
  assert.deepEqual(undo(history).present.project.audio, audio);
  assert.deepEqual(redo(undo(history)).present.project.audio, audio);
  assert.equal(undo(history).present.project.occurrences[1].startMs, 20000);
  assert.equal(
    redo(undo(history)).present.project.occurrences[1].startMs,
    20123,
  );
  assert.equal(project.audio, undefined);
});

test("moving and trimming stop at neighboring cues without introducing overlaps", () => {
  const project = fixture(),
    cue = project.occurrences[1];
  const others = project.occurrences.filter((o) => o.id !== cue.id);
  assert.equal(
    moveTiming(cue, -99999, "both", undefined, "off", others).startMs,
    12000,
  );
  assert.equal(
    moveTiming(cue, 99999, "both", undefined, "off", others).endMs,
    30000,
  );
  assert.equal(
    moveTiming(cue, 99999, "end", undefined, "off", others).endMs,
    30000,
  );
  assert.equal(
    moveTiming(cue, -99999, "start", undefined, "off", others).startMs,
    12000,
  );
  assert.doesNotThrow(() => editTiming(project, cue.id, { endMs: 30001 }));
  assert.doesNotThrow(() => editTiming(project, cue.id, { endMs: 30000 }));
});

test("playback follows at fifteen sixteenths and resets to one sixteenth, clamped at song boundaries", () => {
  assert.equal(followPlayhead(749, 0, 800, 4000), 0);
  assert.equal(followPlayhead(750, 0, 800, 4000), 0);
  assert.equal(followPlayhead(751, 0, 800, 4000), 701);
  assert.equal(751 - followPlayhead(751, 0, 800, 4000), 50);
  assert.equal(followPlayhead(25, 600, 800, 4000), 0);
  assert.equal(followPlayhead(3990, 3000, 800, 4000), 3200);
});

test("drag previews can cross neighbors in separate lanes without committing overlaps", () => {
  const project = fixture();
  const cue = project.occurrences[1],
    others = project.occurrences.filter((o) => o.id !== cue.id);
  const preview = moveTiming(
    cue,
    -9000,
    "both",
    undefined,
    "off",
    others,
    false,
  );
  assert.equal(preview.startMs, 11000);
  const lanes = cueLanes(
    project.occurrences.map((o) => (o.id === cue.id ? preview : o)),
  );
  assert.notEqual(lanes.get(cue.id), lanes.get(project.occurrences[0].id));
  assert.doesNotThrow(() => editTiming(project, cue.id, preview));
  assert.equal(project.occurrences[1].startMs, 20000);
  const clearPreview = moveTiming(
    cue,
    3000,
    "both",
    undefined,
    "off",
    others,
    false,
  );
  assert.doesNotThrow(() => editTiming(project, cue.id, clearPreview));
});

test("ruler density increases with zoom using readable regular intervals", () => {
  const wide = rulerMarks(184516, 800 * 32).major,
    normal = rulerMarks(184516, 800 * 8).major;
  assert.ok(wide.length > normal.length);
  for (const width of [560, 800, 6400, 25600]) {
    const { major: ticks } = rulerMarks(184516, width);
    assert.equal(ticks[0], 0);
    assert.equal(ticks.at(-1), 184516);
    assert.equal(new Set(ticks).size, ticks.length);
    for (let i = 1; i < ticks.length; i++)
      assert.ok(((ticks[i] - ticks[i - 1]) / 184516) * width >= 60);
  }
  const endTicks = rulerMarks(6000, 4800).major;
  assert.ok(((6000 - endTicks.at(-2)!) / 6000) * 4800 >= 128);
  assert.deepEqual(rulerMarks(0, 800), { major: [], minor: [] });
});

test("the seek ruler continues subdivisions past the last regular label", () => {
  const { major, minor } = rulerMarks(254144, 856, { endLabel: false });
  assert.deepEqual(major.slice(-3).map(formatRulerTime), [
    "3:20",
    "3:40",
    "4:00",
  ]);
  assert.deepEqual(minor.slice(-3), [235000, 245000, 250000]);
});

test("dense ruler labels omit unnecessary precision but retain fractional times", () => {
  assert.equal(formatRulerTime(60000), "1:00");
  assert.equal(formatRulerTime(12500), "0:12.5");
  assert.equal(formatRulerTime(184516), "3:04.516");
  for (const zoom of [1, 2, 4, 8, 16, 32])
    assert.ok(
      rulerMarks(184516, 800 * zoom).major.length >
        rulerMarks(184516, 800 * zoom, { spacing: 110 }).major.length,
    );
});

test("overlapping repeats can be nudged in either direction", () => {
  const cue = { ...fixture().occurrences[0], startMs: 1000, endMs: 2000 };
  const repeat = { ...cue, id: "repeat" };
  for (const delta of [-10, 10, 100]) {
    const moved = moveTiming(
      repeat,
      delta,
      "both",
      undefined,
      "off",
      [cue],
      false,
    );
    assert.equal(moved.startMs, 1000 + delta);
    assert.equal(moved.endMs, 2000 + delta);
  }
  assert.equal(
    moveTiming(
      { ...repeat, startMs: 0, endMs: 1000 },
      10,
      "both",
      undefined,
      "off",
      [cue],
      false,
    ).startMs,
    10,
  );
});

test("reset retains the reviewed reference when shorter linked audio cannot contain it", () => {
  const project = editTiming(fixture(), "line-0", {
    startMs: 1000,
    endMs: 2000,
  });
  assert.throws(
    () => resetTiming(project, "line-0", 3000),
    /outside the loaded audio/,
  );
  assert.equal(project.occurrences[0].endMs, 2000);
  assert.equal(
    resetTiming(project, "line-0", 13000).occurrences[0].endMs,
    12000,
  );
});
