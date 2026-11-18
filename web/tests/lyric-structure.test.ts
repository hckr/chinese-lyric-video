import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addAppearance,
  repeatAppearance,
  addLyric,
  removeAppearance,
  conflictingLyrics,
  rawProject,
  parseProject,
  commit,
  undo,
  redo,
  type History,
} from "../src/domain.ts";
import { withTimingBaseline } from "../src/timing.ts";
import { importLegacy, exportLegacy } from "../src/legacy.ts";

function fixture() {
  const p = rawProject("你好\n世界\n你好", "Song", "Artist");
  p.occurrences = p.occurrences.map((o, i) => ({
    ...o,
    startMs: 1000 * i,
    endMs: 1000 * i + 500,
  }));
  p.phrases[0].review = "reviewed";
  p.phrases[0].segmentationApproved = true;
  p.phrases[0].translation = { en: "Hello", pl: "Cześć" };
  return withTimingBaseline(p);
}
test("adding a repeat inserts independently without altering shared annotations or original timings", () => {
  const p = fixture(),
    next = addAppearance(p, p.phrases[0].id, "line-0", "new-repeat");
  assert.deepEqual(
    next.occurrences.map((o) => o.id),
    ["line-0", "new-repeat", "line-1", "line-2"],
  );
  assert.equal(next.occurrences[1].startMs, null);
  assert.strictEqual(next.phrases, p.phrases);
  assert.deepEqual(
    next.occurrences.filter((o) => o.id !== "new-repeat"),
    p.occurrences,
  );
  assert.equal(next.timingBaseline, undefined);
  assert.deepEqual(parseProject(JSON.stringify(next)), next);
});
test("new lyrics get a first appearance; identical text reuses existing manual content", () => {
  const p = fixture(),
    phrase = { ...p.phrases[0], id: "new-phrase", lyricKey: "猫", words: [] };
  const next = addLyric(p, phrase, "line-1", "new-line");
  assert.equal(next.phrases.length, 3);
  assert.deepEqual(
    addLyric(p, phrase, "line-0", "inserted").phrases.map((p) => p.lyricKey),
    ["你好", "猫", "世界"],
  );
  assert.equal(next.occurrences[2].phraseId, "new-phrase");
  const repeated = addLyric(
    p,
    { ...phrase, lyricKey: p.phrases[0].lyricKey },
    undefined,
    "again",
  );
  assert.deepEqual(repeated.phrases, p.phrases);
  assert.equal(repeated.occurrences.at(-1)!.phraseId, p.phrases[0].id);
});
test("deleting a repeat keeps its phrase; deleting the last removes the phrase and baseline row", () => {
  const p = fixture(),
    next = removeAppearance(p, "line-0");
  assert.deepEqual(next.phrases, p.phrases);
  const last = removeAppearance(next, "line-2");
  assert.equal(last.phrases.length, 1);
  assert.equal(last.phrases[0].lyricKey, "世界");
  assert.equal(last.timingBaseline, undefined);
  const roundTrip = importLegacy(exportLegacy(last));
  const resolved = (project: typeof last) =>
    project.occurrences.map(({ phraseId, id, startMs, endMs }) => ({
      id,
      startMs,
      endMs,
      lyric: project.phrases.find((phrase) => phrase.id === phraseId)!.lyricKey,
    }));
  assert.deepEqual(resolved(roundTrip), resolved(last));
  const empty = removeAppearance(last, "line-1");
  assert.equal(parseProject(JSON.stringify(empty)).phrases.length, 0);
});
test("undo/redo restores an entire removed lyric with its translation, selection and timing", () => {
  const p = fixture(),
    h: History = {
      present: {
        project: p,
        phraseId: p.phrases[1].id,
        tokenId: "",
        occurrenceId: "line-1",
      },
      past: [],
      future: [],
    };
  const changed = commit(h, {
    ...h.present,
    project: removeAppearance(p, "line-1"),
    phraseId: p.phrases[0].id,
    occurrenceId: "line-0",
  });
  assert.deepEqual(undo(changed).present, h.present);
  assert.deepEqual(redo(undo(changed)).present, changed.present);
});

test("opening older projects discards personal notes", () => {
  const project = fixture();
  const legacy = {
    ...project,
    phrases: project.phrases.map((p) => ({ ...p, notes: "old reminder" })),
  };
  const loaded = parseProject(JSON.stringify(legacy));
  assert.ok(loaded.phrases.every((p) => !("notes" in p)));
});

test("new lyric timing follows its predecessor, fits available space, and stays unassigned when blocked", () => {
  const p = fixture();
  const phrase = { ...p.phrases[0], id: "new", lyricKey: "猫", words: [] };
  const insert = (project: typeof p, after = "line-2") =>
    addLyric(project, phrase, after, "new-cue");
  assert.deepEqual(insert(p).occurrences.at(-1), {
    id: "new-cue",
    phraseId: "new",
    timingReview: "needs-review",
    startMs: 2500,
    endMs: 4500,
  });
  assert.deepEqual(insert(p, "line-0").occurrences[1], {
    id: "new-cue",
    phraseId: "new",
    timingReview: "needs-review",
    startMs: 500,
    endMs: 1000,
  });
  const touching = {
    ...p,
    occurrences: p.occurrences.map((cue, i) =>
      i === 1 ? { ...cue, startMs: 500 } : cue,
    ),
  };
  assert.equal(insert(touching, "line-0").occurrences[1].startMs, null);
  const audio = {
    ...p,
    audio: { name: "song", size: 1, lastModified: 0, durationMs: 3000 },
  };
  assert.equal(insert(audio).occurrences.at(-1)!.endMs, 3000);
  const raw = {
    ...p,
    occurrences: p.occurrences.map((cue) => ({
      ...cue,
      startMs: null,
      endMs: null,
    })),
  };
  assert.equal(insert(raw).occurrences.at(-1)!.startMs, null);
  assert.equal(insert(p).timingBaseline, undefined);
});

test("older saved dictionary references are discarded without changing lyric edits", () => {
  const project = fixture();
  const old = {
    ...project,
    phrases: project.phrases.map((phrase) => ({
      ...phrase,
      dictionaryEntries: [{ hanzi: "你", pinyin: "nǐ", meanings: ["you"] }],
    })),
  };
  assert.deepEqual(parseProject(JSON.stringify(old)), project);
});

test("duplicate lyric drafts can save JSON and only conflicting content blocks TS export", () => {
  const p = fixture();
  p.phrases[1] = { ...p.phrases[1], lyricKey: p.phrases[0].lyricKey };
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  assert.deepEqual(conflictingLyrics(p), [p.phrases[0].lyricKey]);
  assert.throws(() => exportLegacy(p), /conflicting duplicate/);
  p.phrases[1] = {
    ...p.phrases[0],
    id: p.phrases[1].id,
    words: p.phrases[0].words.map((word) => ({
      ...word,
      id: "copy-" + word.id,
    })),
  };
  assert.deepEqual(conflictingLyrics(p), []);
  assert.doesNotThrow(() => exportLegacy(p));
});

test("repeats copy the chosen original's timing and insert immediately after it", () => {
  const p = fixture();
  const next = repeatAppearance(p, p.phrases[0].id, "line-2", "copy");
  assert.deepEqual(next.occurrences.at(-1), {
    ...p.occurrences[2],
    id: "copy",
  });
  const other = repeatAppearance(p, p.phrases[0].id, "line-1", "copy");
  assert.deepEqual(other.occurrences[1], { ...p.occurrences[0], id: "copy" });
  assert.deepEqual(other.phrases, p.phrases);
  assert.deepEqual(
    other.occurrences.filter((cue) => cue.id !== "copy"),
    p.occurrences,
  );
});
