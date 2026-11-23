import { test } from "node:test";
import assert from "node:assert/strict";
import { rawProject } from "../src/domain.ts";
import { createGroup, sidebarUnits } from "../src/lyric-groups.ts";
import {
  provisionalPlacements,
  timelineLayout,
} from "../src/timeline-layout.ts";
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

test("provisional placements omit zero matches and display weak estimates for at least one second", () => {
  const project = rawProject("先\n甲\n乙\n丙\n后", "Test", "");
  const unresolved = {
    runId: "run",
    matched: 0,
    total: 4,
    reasons: [
      "Unresolved: fewer than half of expected units have matching anchors.",
    ],
  };
  project.occurrences[0] = {
    ...project.occurrences[0],
    startMs: 500,
    endMs: 1000,
  };
  for (const index of [1, 2])
    project.occurrences[index].timingIssue = unresolved;
  project.occurrences[3].weakTiming = {
    ...unresolved,
    matched: 1,
    startMs: 3100,
    endMs: 3300,
  };
  project.occurrences[4] = {
    ...project.occurrences[4],
    startMs: 3200,
    endMs: 4000,
  };

  project.occurrences[2].weakTiming = {
    ...unresolved,
    startMs: 1800,
    endMs: 2200,
  };
  const placements = provisionalPlacements(project, 4000);
  assert.deepEqual([...placements.keys()], ["line-3"]);
  assert.deepEqual(placements.get("line-3"), {
    startMs: 3100,
    endMs: 4100,
    sidebarMs: 3100,
  });
  assert.deepEqual(
    sidebarUnits(project, placements).map(({ id }) => id),
    ["line-0", "line-3", "line-4", "line-1", "line-2"],
  );
  assert.equal(project.occurrences[1].startMs, null);
  assert.equal(project.occurrences[3].weakTiming?.endMs, 3300);
});
