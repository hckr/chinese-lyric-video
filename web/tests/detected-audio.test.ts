import assert from "node:assert/strict";
import { test } from "node:test";
import {
  rawProject,
  parseProject,
  serializeProject,
  repeatAppearance,
  commit,
  undo,
  redo,
  type History,
} from "../src/domain.ts";
import {
  editTiming,
  resetTiming,
  withTimingBaseline,
  reviewTiming,
} from "../src/timing/timing.ts";
import { createGroup, duplicateGroup } from "../src/lyric-groups.ts";
import { exportLegacy, importLegacy } from "../src/legacy.ts";
function fixture() {
  const p = rawProject("你好\n世界\n你好", "Origin", "Test");
  p.occurrences = p.occurrences.map((o, i) => ({
    ...o,
    startMs: i * 1000,
    endMs: i * 1000 + 500,
  }));
  return reviewTiming(
    withTimingBaseline(p),
    new Set(p.occurrences.map((o) => o.id)),
    true,
  );
}
test("optional appearance flag defaults to ordinary, validates booleans and omits false from all saved occurrences", () => {
  const p = fixture();
  assert.ok(p.occurrences.every((o) => o.detectedFromAudio === undefined));
  p.occurrences[0].detectedFromAudio = true;
  p.occurrences[2].detectedFromAudio = false;
  const q = parseProject(serializeProject(p, 2));
  assert.equal(q.occurrences[0].detectedFromAudio, true);
  assert.ok(!("detectedFromAudio" in q.occurrences[2]));
  assert.equal(q.timingBaseline, undefined);
  assert.equal(p.occurrences[2].detectedFromAudio, false);
  for (const bad of ["true", 1, null])
    assert.throws(() =>
      parseProject(
        JSON.stringify({
          ...p,
          occurrences: p.occurrences.map((o, i) =>
            i === 0 ? { ...o, detectedFromAudio: bad } : o,
          ),
        }),
      ),
    );
  assert.ok(!exportLegacy(p).includes("detectedFromAudio"));
  assert.ok(
    importLegacy(exportLegacy(p)).occurrences.every(
      (o) => o.detectedFromAudio === undefined,
    ),
  );
});
test("timing reset, phrase edits, repeats, group copies and history preserve independent origin", () => {
  const p = fixture();
  p.occurrences[0].detectedFromAudio = true;
  const edited = editTiming(p, "line-0", { startMs: 100, endMs: 600 });
  const reset = resetTiming(edited, "line-0");
  assert.equal(reset.occurrences[0].detectedFromAudio, true);
  const revised = {
    ...reset,
    phrases: reset.phrases.map((r, i) =>
      i === 0 ? { ...r, translation: { en: "Revised", pl: "" } } : r,
    ),
  };
  assert.equal(revised.occurrences[0].detectedFromAudio, true);
  assert.equal(revised.occurrences[2].detectedFromAudio, undefined);
  const copy = repeatAppearance(revised, p.phrases[0].id, "line-0", "copy");
  assert.equal(
    copy.occurrences.find((o) => o.id === "copy")!.detectedFromAudio,
    true,
  );
  const ordinary = repeatAppearance(
    revised,
    p.phrases[0].id,
    "line-2",
    "ordinary",
  );
  assert.equal(
    ordinary.occurrences.find((o) => o.id === "ordinary")!.detectedFromAudio,
    undefined,
  );
  const grouped = createGroup(p, "Group", "line-0", "line-1");
  const duplicated = duplicateGroup(
    grouped,
    grouped.lyricGroups![0].id,
    "Copy",
    5000,
  );
  assert.equal(
    duplicated.project.occurrences.filter((o) => o.detectedFromAudio === true)
      .length,
    2,
  );
  const snapshot = {
    project: p,
    phraseId: p.phrases[0].id,
    tokenId: "",
    occurrenceId: "line-0",
  };
  const h: History = commit(
    { present: snapshot, past: [], future: [] },
    { ...snapshot, project: copy },
  );
  assert.deepEqual(undo(h).present.project, p);
  assert.deepEqual(redo(undo(h)).present.project, copy);
});
