import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rawProject,
  parseProject,
  serializeProject,
  repeatAppearance,
  commit,
  undo,
  type History,
  timingSettingsSchema,
} from "../src/domain.ts";
import {
  editTiming,
  reviewTiming,
  resetTiming,
  latestAutomatic,
  nextUnreviewed,
  moveProjectTiming,
  validTiming,
} from "../src/timing/timing.ts";
import {
  applyGeneration,
  addDetectedCandidate,
  applyWeakEstimate,
} from "../src/timing/automatic-timing.ts";
import {
  createGroup,
  duplicateGroup,
  shiftGroup,
  sidebarUnits,
} from "../src/lyric-groups.ts";
import { exportLegacy, importLegacy } from "../src/legacy.ts";
const run = {
  id: "run-1",
  model: "small",
  transcriptProvenance: "external-unverified" as const,
  audioIdentity: {
    sha256: "a".repeat(64),
    encoding: "mono-f32le-16000" as const,
  },
};
function fixture() {
  return rawProject("你好\n世界\n你好", "Review", "Test");
}
function result() {
  return {
    lines: fixture().occurrences.map((o, i) => ({
      id: o.id,
      text: i === 1 ? "世界" : "你好",
      observedStartMs: 1000 + i * 1000,
      observedEndMs: 2000 + i * 1000,
      reasons: ["test"],
    })),
    additions: [],
  };
}
function generated() {
  return applyGeneration(fixture(), result(), 10000, "preserve-reviewed", run);
}
test("metadata-aware legacy migration retires baseline without inventing automatic provenance", () => {
  const p = fixture();
  const legacy = {
    ...p,
    occurrences: p.occurrences.map((o, i) => ({
      id: o.id,
      phraseId: o.phraseId,
      startMs: i === 0 ? 12345 : i === 1 ? null : 50,
      endMs: i === 0 ? 12789 : i === 1 ? 40 : 10,
    })),
  };
  const next = parseProject(
    JSON.stringify({ ...legacy, timingBaseline: legacy.occurrences }),
  );
  assert.equal(next.occurrences[0].timingReview, "reviewed");
  assert.deepEqual(next.occurrences[0].reviewedTiming, {
    startMs: 12345,
    endMs: 12789,
  });
  assert.equal(next.occurrences[0].automaticTiming, undefined);
  assert.equal(next.occurrences[1].timingReview, "needs-review");
  assert.equal(next.occurrences[2].startMs, 50);
  assert.equal(next.occurrences[2].timingReview, "needs-review");
  assert.ok(!serializeProject(next).includes("timingBaseline"));
  const explicit = reviewTiming(next, new Set(["line-0"]), false);
  assert.equal(
    parseProject(serializeProject(explicit)).occurrences[0].timingReview,
    "needs-review",
  );
  assert.equal(next.schemaVersion, 1);
});
test("review and automatic reset precedence survives edits, exact returns, unreview and regeneration", () => {
  const p = generated();
  assert.equal(p.occurrences[0].timingReview, "needs-review");
  const edited = editTiming(p, "line-0", { startMs: 1234 });
  assert.equal(resetTiming(edited, "line-0").occurrences[0].startMs, 1000);
  assert.equal(
    resetTiming(edited, "line-0").occurrences[0].timingReview,
    "needs-review",
  );
  const reviewed = reviewTiming(edited, new Set(["line-0"]), true);
  assert.strictEqual(
    editTiming(reviewed, "line-0", { startMs: 1234 }),
    reviewed,
  );
  const changed = editTiming(reviewed, "line-0", { startMs: 1300 });
  assert.equal(changed.occurrences[0].timingReview, "needs-review");
  assert.equal(
    editTiming(changed, "line-0", { startMs: 1234 }).occurrences[0]
      .timingReview,
    "needs-review",
  );
  const unreviewed = reviewTiming(reviewed, new Set(["line-0"]), false);
  assert.equal(
    resetTiming(unreviewed, "line-0").occurrences[0].timingReview,
    "reviewed",
  );
  const regenerated = applyGeneration(
    reviewed,
    result(),
    10000,
    "preserve-reviewed",
    { ...run, id: "run-2" },
  );
  assert.equal(regenerated.occurrences[0].startMs, 1234);
  const machine = latestAutomatic(regenerated, "line-0", 10000);
  assert.equal(machine.occurrences[0].startMs, 1000);
  assert.equal(machine.occurrences[0].timingReview, "needs-review");
  assert.equal(resetTiming(machine, "line-0").occurrences[0].startMs, 1234);
  assert.doesNotThrow(() => parseProject(serializeProject(machine)));
  assert.deepEqual(machine.phrases, p.phrases);
});
test("replace-all preserves review on exact match and reviewed snapshot on change; missing/weak never erase current", () => {
  const reviewed = reviewTiming(
    generated(),
    new Set(["line-0", "line-1"]),
    true,
  );
  const equal = applyGeneration(reviewed, result(), 10000, "replace-all", run);
  assert.equal(equal.occurrences[0].timingReview, "reviewed");
  const r = result();
  r.lines[0].observedStartMs = 1100;
  const replaced = applyGeneration(reviewed, r, 10000, "replace-all", run);
  assert.equal(replaced.occurrences[0].timingReview, "needs-review");
  assert.equal(replaced.occurrences[0].reviewedTiming!.startMs, 1000);
  const weak = {
    lines: result().lines.map((l, i) =>
      i === 0
        ? {
            id: l.id,
            text: l.text,
            reasons: ["low match"],
            weakEstimate: { startMs: 1400, endMs: 1900 },
          }
        : i === 1
          ? { id: l.id, text: l.text, reasons: ["missing"] }
          : l,
    ),
  };
  const unresolved = applyGeneration(reviewed, weak, 10000, "replace-all", run);
  assert.equal(unresolved.occurrences[0].startMs, 1000);
  assert.equal(unresolved.occurrences[0].timingReview, "reviewed");
  assert.equal(unresolved.occurrences[1].startMs, 2000);
  const resumed = parseProject(serializeProject(unresolved));
  assert.deepEqual(resumed.occurrences[1].timingIssue?.reasons, ["missing"]);
  assert.deepEqual(resumed.occurrences[0].weakTiming?.reasons, ["low match"]);
  const opted = applyWeakEstimate(unresolved, "line-0", 10000);
  assert.equal(opted.occurrences[0].startMs, 1400);
  assert.equal(opted.occurrences[0].timingReview, "needs-review");
  assert.equal(opted.occurrences[0].reviewedTiming!.startMs, 1000);
  assert.equal(opted.occurrences[0].automaticTiming!.startMs, 1000);
});
test("linked edges, group shifts and copies invalidate only changed independent occurrences", () => {
  const p = reviewTiming(
    generated(),
    new Set(["line-0", "line-1", "line-2"]),
    true,
  );
  const linked = moveProjectTiming(p, "line-0", 100, "end", 10000, "off", true);
  assert.equal(linked.occurrences[0].timingReview, "needs-review");
  assert.equal(linked.occurrences[1].timingReview, "needs-review");
  assert.equal(linked.occurrences[2].timingReview, "reviewed");
  const g = createGroup(p, "Chorus", "line-0", "line-1");
  assert.deepEqual(shiftGroup(g, g.lyricGroups![0].id, 0), g);
  const shifted = shiftGroup(g, g.lyricGroups![0].id, 100);
  assert.equal(
    shifted.occurrences.find((o) => o.id === "line-0")!.timingReview,
    "needs-review",
  );
  const copy = duplicateGroup(g, g.lyricGroups![0].id, "Copy", 4000);
  for (const id of copy.group.occurrenceIds) {
    const cue = copy.project.occurrences.find((o) => o.id === id)!;
    assert.equal(cue.timingReview, "needs-review");
    assert.equal(cue.reviewedTiming, undefined);
    assert.equal(cue.automaticTiming, undefined);
    assert.throws(() => resetTiming(copy.project, id));
  }
  const repeated = repeatAppearance(p, "phrase-0", "line-0", "copy");
  assert.equal(
    repeated.occurrences.find((o) => o.id === "copy")!.reviewedTiming,
    undefined,
  );
});
test("bulk review undo, wrapped grouped selection and exact JSON/TS portability", () => {
  const p = generated(),
    selected = new Set(["line-0", "line-1"]);
  const reviewed = reviewTiming(p, selected, true);
  const h: History = {
    past: [],
    future: [],
    present: { project: p, phraseId: "phrase-0", tokenId: "" },
  };
  assert.deepEqual(
    undo(commit(h, { ...h.present, project: reviewed })).present.project,
    p,
  );
  const ordered = sidebarUnits(reviewed).flatMap((u) => u.members);
  assert.equal(nextUnreviewed(ordered, "line-1"), "line-2");
  assert.equal(nextUnreviewed(p.occurrences, "line-2"), "line-0");
  assert.equal(
    nextUnreviewed(
      reviewTiming(p, new Set(p.occurrences.map((o) => o.id)), true)
        .occurrences,
      "line-0",
    ),
    undefined,
  );
  assert.equal(
    reviewTiming(fixture(), selected, true).occurrences[0].timingReview,
    "needs-review",
  );
  assert.deepEqual(parseProject(serializeProject(reviewed)), reviewed);
  assert.deepEqual(
    importLegacy(exportLegacy(reviewed)).occurrences.map((o) => [
      o.id,
      o.startMs,
      o.endMs,
    ]),
    reviewed.occurrences.map((o) => [o.id, o.startMs, o.endMs]),
  );
});
test("pending candidates persist compactly, same-text passages remain distinct and add is idempotent", () => {
  const p = generated();
  p.timingRun!.candidates = [
    { id: "a", text: "你好", startMs: 100, endMs: 400 },
    { id: "b", text: "你好", startMs: 450, endMs: 800 },
  ];
  const reopened = parseProject(serializeProject(p));
  assert.throws(() => addDetectedCandidate(reopened, "b", 500));
  assert.equal(reopened.occurrences.length, 3);
  const a = addDetectedCandidate(reopened, "a", 10000);
  assert.equal(addDetectedCandidate(a, "a"), a);
  const b = addDetectedCandidate(a, "b", 10000);
  assert.equal(b.phrases.length, p.phrases.length);
  assert.equal(b.occurrences.length, 5);
  assert.equal(b.occurrences[0].timingReview, "needs-review");
  assert.equal(b.occurrences[0].detectedFromAudio, true);
  assert.equal(b.timingRun!.candidates.length, 0);
  assert.deepEqual(b.phrases, p.phrases);
});
test("portable settings validate padding and defaults without altering intervals", () => {
  const s = timingSettingsSchema.parse({});
  assert.equal(s.autoAdvance, true);
  assert.equal(s.preRollMs, 250);
  assert.equal(s.postRollMs, 250);
  for (const patch of [
    { preRollMs: -1 },
    { postRollMs: 5001 },
    { zoom: 3 },
    { autoAdvance: "true" },
  ])
    assert.equal(timingSettingsSchema.safeParse(patch).success, false);
  assert.equal(validTiming({ startMs: 0, endMs: 1 }), true);
});
