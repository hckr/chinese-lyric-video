import { test } from "node:test";
import assert from "node:assert/strict";
import { rawProject, commit, undo, redo, type History } from "../src/domain.ts";
import {
  acceptTiming,
  applyEnglishRetry,
  parseWhisperTranscript,
  validateTimingResult,
} from "../src/timing/automatic-timing.ts";
import { resetTiming, withTimingBaseline } from "../src/timing/timing.ts";
function fixture() {
  const p = withTimingBaseline(rawProject("你好\n世界\n你好", "Test", "Test"));
  return p;
}
const line = {
  id: "line-1",
  text: "世界",
  observedStartMs: 2000,
  observedEndMs: 3000,
  reasons: [],
};
test("partial acceptance preserves other repeated identities, resets to accepted baseline and undoes atomically", () => {
  const p = fixture(),
    result = validateTimingResult({ lines: [line] }, p, ["line-1"], 5000);
  const next = acceptTiming(p, result, new Set(["line-1"]), new Set(), 5000);
  assert.deepEqual(next.occurrences[0], p.occurrences[0]);
  assert.deepEqual(next.phrases, p.phrases);
  assert.equal(resetTiming(next, "line-1").occurrences[1].startMs, 2000);
  const h: History = {
    past: [],
    present: {
      project: p,
      occurrenceId: "line-1",
      phraseId: "phrase-1",
      tokenId: "",
    },
    future: [],
  };
  const applied = commit(h, {
    project: next,
    occurrenceId: "line-1",
    phraseId: "phrase-1",
    tokenId: "",
  });
  assert.deepEqual(undo(applied).present.project, p);
  assert.deepEqual(redo(undo(applied)).present.project, next);
});
test("invalid IDs, mismatched text and impossible bounds cannot be applied", () => {
  const p = fixture();
  for (const value of [
    { ...line, id: "line-0" },
    { ...line, text: "wrong" },
    { ...line, observedEndMs: 9000 },
    { ...line, observedEndMs: undefined },
  ])
    assert.throws(() =>
      validateTimingResult({ lines: [value] }, p, ["line-1"], 5000),
    );
});
test("unselected suggestions are unchanged and additions retain origin without replacing shared reviewed text", () => {
  const p = fixture(),
    phrase = { ...p.phrases[0], id: "new-phrase" };
  const occurrence = {
    id: "detected",
    phraseId: phrase.id,
    startMs: 100,
    endMs: 500,
    detectedFromAudio: true,
  };
  const r = validateTimingResult(
    { lines: [line], additions: [{ phrase, occurrence }] },
    p,
    ["line-1"],
    5000,
  );
  assert.equal(acceptTiming(p, r, new Set(), new Set(), 5000), p);
  const next = acceptTiming(p, r, new Set(), new Set(["detected"]), 5000);
  assert.equal(next.phrases.length, p.phrases.length);
  assert.equal(next.occurrences[0].phraseId, p.phrases[0].id);
  assert.equal(
    next.occurrences.find((o) => o.id === "detected")!.detectedFromAudio,
    true,
  );
  assert.deepEqual(
    next.occurrences.filter((o) => o.id !== "detected"),
    p.occurrences,
  );
});

test("weak estimates require separate opt-in and preserve normal undo/reset behavior", () => {
  const p = fixture();
  const weak = {
    id: "line-1",
    text: "世界",
    matched: 0,
    total: 2,
    reasons: ["Unresolved: low match"],
    weakEstimate: { startMs: 1000, endMs: 2000 },
  };
  const r = validateTimingResult({ lines: [weak] }, p, ["line-1"], 5000);
  assert.equal(acceptTiming(p, r, new Set(["line-1"]), new Set(), 5000), p);
  const next = acceptTiming(
    p,
    r,
    new Set(["line-1"]),
    new Set(),
    5000,
    new Set(["line-1"]),
  );
  assert.equal(next.occurrences[1].startMs, 1000);
  assert.equal(resetTiming(next, "line-1").occurrences[1].endMs, 2000);
  assert.equal(r.lines[0].reasons[0], "Unresolved: low match");
  assert.throws(() =>
    validateTimingResult(
      { lines: [{ ...weak, weakEstimate: { startMs: 2000, endMs: 1000 } }] },
      p,
      ["line-1"],
      5000,
    ),
  );
  const history: History = {
    past: [],
    future: [],
    present: { project: p, phraseId: "phrase-1", tokenId: "" },
  };
  const applied = commit(history, { ...history.present, project: next });
  assert.deepEqual(undo(applied).present.project, p);
});

test("ETA formats a frontend deadline, counts down and clamps expired estimates", async () => {
  const { formatTimingEta } = await import("../src/timing/automatic-timing.ts");
  assert.equal(formatTimingEta(65000, 0), "ETA ~1:05");
  assert.equal(formatTimingEta(65000, 1000), "ETA ~1:04");
  assert.equal(formatTimingEta(65000, 70000), "ETA ~0:00");
  assert.equal(formatTimingEta(95000, 30000), "ETA ~1:05");
});

test("transcript import accepts word timings and rejects JSON that cannot drive alignment", () => {
  const words = [{ word: "你好", start: 0, end: 0.5 }];
  assert.deepEqual(
    parseWhisperTranscript(JSON.stringify({ segments: [{ words }] })),
    { segments: [{ words }] },
  );
  for (const invalid of [
    null,
    {},
    { segments: [null] },
    { segments: [{ text: "你好" }] },
    { segments: [{ words: [{ word: "你好", start: 1, end: 0 }] }] },
  ]) {
    assert.throws(
      () => parseWhisperTranscript(JSON.stringify(invalid)),
      /word timestamps/,
    );
  }
});

test("English retry updates only safe untimed lyrics and retains the original run", () => {
  const project = rawProject("你好\nDon't go\nMonday\n再见", "Mixed", "Test");
  project.occurrences[0] = {
    ...project.occurrences[0],
    startMs: 0,
    endMs: 1000,
    timingReview: "reviewed",
  };
  project.occurrences[2].startMs = 3000;
  project.timingRun = {
    id: "first-pass",
    model: "base",
    transcriptProvenance: "generated",
    candidates: [{ id: "candidate", text: "intro", startMs: 50, endMs: 100 }],
  };
  const lines = project.occurrences.map((o, index) => ({
    id: o.id,
    text: project.phrases[index].lyricKey,
    observedStartMs: 1200,
    observedEndMs: 2500,
    reasons: [],
  }));
  const next = applyEnglishRetry(project, { lines }, 5000, "local", "base");
  assert.equal(next.occurrences[1].automaticTiming?.language, "en");
  assert.equal(next.occurrences[1].timingReview, "needs-review");
  assert.deepEqual(next.timingRun, project.timingRun);
  assert.deepEqual(
    next.occurrences.filter((_, i) => i !== 1),
    project.occurrences.filter((_, i) => i !== 1),
  );
  lines[1].observedEndMs = 3100;
  assert.equal(
    applyEnglishRetry(project, { lines }, 5000, "local", "base"),
    project,
  );
});
