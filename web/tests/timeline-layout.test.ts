import { test } from "node:test";
import assert from "node:assert/strict";
import { rawProject } from "../src/domain.ts";
import { createGroup } from "../src/lyric-groups.ts";
import { timelineLayout } from "../src/timeline-layout.ts";
function fixture() {
  const p = rawProject("你\n我\n他\n她\n它", "Test", "");
  p.occurrences = p.occurrences.map((cue, i) => ({
    ...cue,
    startMs: i * 1000,
    endMs: i * 1000 + 800,
  }));
  return createGroup(p, "Chorus", "line-1", "line-3");
}
test("group members occupy a contiguous band with room for their rail", () => {
  const p = fixture(),
    layout = timelineLayout(p);
  assert.equal(layout.tops.get("line-1"), layout.tops.get("line-3"));
  assert.equal(layout.tops.get("line-0"), layout.tops.get("line-1"));
  assert.equal(layout.tops.get("line-4"), layout.tops.get("line-1"));
  assert.equal(
    layout.rails.get(p.lyricGroups![0].id)! + 28,
    layout.tops.get("line-1"),
  );
});
test("nonoverlapping groups reuse vertical space and obsolete rows are reclaimed", () => {
  const p = fixture();
  const first = timelineLayout(p);
  const overlap = {
    ...p,
    occurrences: p.occurrences.map((cue) =>
      cue.id === "line-2" ? { ...cue, startMs: 1100, endMs: 1800 } : cue,
    ),
  };
  assert.ok(timelineLayout(overlap).height > first.height);
  assert.equal(timelineLayout(p).height, first.height);
  const two = createGroup(
    rawProject("你\n我\n他\n她", "Test", ""),
    "One",
    "line-0",
    "line-1",
  );
  two.occurrences = two.occurrences.map((cue, i) => ({
    ...cue,
    startMs: i * 1000,
    endMs: i * 1000 + 800,
  }));
  const grouped = createGroup(two, "Two", "line-2", "line-3");
  const packed = timelineLayout(grouped);
  assert.equal(
    packed.rails.get(grouped.lyricGroups![0].id),
    packed.rails.get(grouped.lyricGroups![1].id),
  );
  assert.ok(packed.height < 150);
});
test("internal overlap adds adjacent group subrows; unrelated blocks keep their rows", () => {
  const p = fixture(),
    first = timelineLayout(p);
  const next = {
    ...p,
    occurrences: p.occurrences.map((cue) =>
      cue.id === "line-2" ? { ...cue, startMs: 1100, endMs: 1800 } : cue,
    ),
  };
  const layout = timelineLayout(next);
  assert.equal(layout.tops.get("line-0"), first.tops.get("line-0"));
  assert.equal(layout.tops.get("line-4"), first.tops.get("line-4"));
  assert.equal(layout.tops.get("line-1"), first.tops.get("line-1"));
  assert.equal(layout.tops.get("line-2")! - layout.tops.get("line-1")!, 74);
});

test("arbitrary saved group IDs cannot collide with the standalone band", () => {
  const p = fixture();
  p.lyricGroups![0].id = "standalone";
  const layout = timelineLayout(p);
  assert.ok(layout.rails.has("standalone"));
});
