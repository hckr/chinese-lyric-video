import { test } from "node:test";
import assert from "node:assert/strict";
import { rawProject, parseProject, removeAppearance } from "../src/domain.ts";
import { withTimingBaseline } from "../src/timing.ts";
import {
  createGroup,
  sidebarUnits,
  orderGroupedProject,
  groupRange,
  groupWarnings,
  groupOffset,
  shiftGroup,
  duplicateGroup,
} from "../src/lyric-groups.ts";
function fixture() {
  const p = withTimingBaseline(
    rawProject("你\n我\n他\n她\n它\n你", "Test", "Artist"),
  );
  p.occurrences = p.occurrences.map((cue, i) => ({
    ...cue,
    startMs: i * 1500,
    endMs: i * 1500 + 1000,
  }));
  return createGroup(p, "Chorus", "line-1", "line-4");
}
test("groups require two consecutive ungrouped rows; shared or missing membership is rejected", () => {
  const p = fixture();
  assert.throws(() => createGroup(p, "A", "line-0", "line-0"));
  assert.throws(() => createGroup(p, "A", "line-0", "line-2"));
  assert.throws(() => createGroup(p, "A", "missing", "line-0"));
  assert.throws(() =>
    parseProject(
      JSON.stringify({
        ...p,
        lyricGroups: [
          ...p.lyricGroups!,
          { id: "bad", name: "Bad", occurrenceIds: ["line-1"] },
        ],
      }),
    ),
  );
});
test("top-level chronology keeps groups contiguous and untimed rows at bottom with stable ties", () => {
  const p = fixture();
  p.occurrences[2] = { ...p.occurrences[2], startMs: 9000, endMs: 10000 };
  p.occurrences[0] = { ...p.occurrences[0], startMs: 2000, endMs: 2500 };
  p.occurrences[5] = { ...p.occurrences[5], startMs: null, endMs: null };
  const units = sidebarUnits(p);
  assert.equal(units[0].group?.name, "Chorus");
  assert.deepEqual(
    units[0].members.map((cue) => cue.id),
    ["line-1", "line-3", "line-4", "line-2"],
  );
  assert.equal(units[2].members[0].id, "line-5");
  assert.ok(
    groupWarnings(p, p.lyricGroups![0]).includes("Warning: interleaving"),
  );
  assert.deepEqual(
    parseProject(JSON.stringify(orderGroupedProject(p))),
    orderGroupedProject(p),
  );
});
test("group moves apply exactly one offset and allow overlap without changing baseline or content", () => {
  const p = fixture(),
    g = p.lyricGroups![0],
    next = shiftGroup(p, g.id, 10000);
  for (const id of g.occurrenceIds) {
    const old = p.occurrences.find((cue) => cue.id === id)!,
      moved = next.occurrences.find((cue) => cue.id === id)!;
    assert.equal(moved.startMs, old.startMs! + 10000);
    assert.equal(moved.endMs, old.endMs! + 10000);
  }
  assert.deepEqual(next.phrases, p.phrases);
  assert.equal(next.timingBaseline, undefined);
  assert.equal(
    next.occurrences.find((o) => o.id === "line-1")!.timingReview,
    "needs-review",
  );
  assert.doesNotThrow(() => shiftGroup(p, g.id, -1500));
  assert.equal(
    groupRange(
      shiftGroup(p, g.id, -999999).occurrences.filter((cue) =>
        g.occurrenceIds.includes(cue.id),
      ),
    ).start,
    0,
  );
});
test("shared snapping preserves fractional relative timing instead of snapping each member", () => {
  const p = fixture(),
    g = p.lyricGroups![0];
  p.occurrences[2] = { ...p.occurrences[2], startMs: 3123, endMs: 3917 };
  const delta = groupOffset(p, g, -480, "edges");
  assert.equal(delta, -500);
  const next = shiftGroup(p, g.id, delta);
  const cue = next.occurrences.find((cue) => cue.id === "line-2")!;
  assert.equal(cue.startMs, 2623);
  assert.equal(cue.endMs, 3417);
});
test("duplicate is atomic, assigns new IDs, retains membership order and untimed members, permits overlaps", () => {
  const p = fixture(),
    g = p.lyricGroups![0];
  p.occurrences[3] = { ...p.occurrences[3], startMs: null, endMs: null };
  const before = JSON.stringify(p);
  const copy = duplicateGroup(p, g.id, "Chorus B", 0);
  assert.equal(JSON.stringify(p), before);
  assert.equal(copy.group.name, "Chorus B");
  assert.notEqual(copy.group.id, g.id);
  assert.equal(copy.group.occurrenceIds.length, 4);
  assert.ok(
    copy.group.occurrenceIds.every(
      (id) => !p.occurrences.some((cue) => cue.id === id),
    ),
  );
  assert.deepEqual(
    copy.group.occurrenceIds.map((id) => {
      const cue = copy.project.occurrences.find((cue) => cue.id === id)!;
      return [cue.phraseId, cue.startMs, cue.endMs];
    }),
    g.occurrenceIds.map((id) => {
      const cue = p.occurrences.find((cue) => cue.id === id)!;
      return [cue.phraseId, cue.startMs, cue.endMs];
    }),
  );
  assert.deepEqual(parseProject(JSON.stringify(copy.project)), copy.project);
  assert.deepEqual(copy.project.phrases, p.phrases);
});
test("all-untimed duplication stays unassigned; removal updates membership", () => {
  const p = fixture(),
    g = p.lyricGroups![0];
  p.occurrences = p.occurrences.map((cue) => ({
    ...cue,
    startMs: null,
    endMs: null,
  }));
  const copy = duplicateGroup(p, g.id, "Copy", 999);
  assert.ok(copy.project.occurrences.every((cue) => cue.startMs === null));
  let removed = p;
  for (const id of g.occurrenceIds) removed = removeAppearance(removed, id);
  assert.deepEqual(removed.lyricGroups, []);
});
