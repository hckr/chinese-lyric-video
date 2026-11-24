import { editionPieces } from "../src/import/edition-cues.ts";
import { lyricCount } from "../src/lyric-length.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { cachedRecording, findLyrics } from "../src/import/song-source.ts";
import { parseProject, rawProject, serializeProject } from "../src/domain.ts";

test("reviewed LRCLIB credits and original recording metadata survive project export", async (t) => {
  const common = {
    trackName: "歌",
    artistName: "演唱者",
    albumName: "专辑",
    plainLyrics: "你好\n你好",
    instrumental: false,
  };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json([
      { ...common, id: 1, duration: 260 },
      { ...common, id: 2, duration: 200 },
      { ...common, id: 3, duration: 199, instrumental: true },
    ]),
  );
  const matches = await findLyrics("歌", "演唱者", 199);
  assert.deepEqual(
    matches.map((x) => x.credit.id),
    [2, 1],
  );
  assert.equal(matches[0].text, "你好\n你好");
  const recording = {
    id: "abcdefghijk",
    title: "Original video title",
    url: "https://youtu.be/abcdefghijk",
    fingerprint: "a".repeat(64),
    fetchedAt: new Date().toISOString(),
  };
  const project = {
    ...rawProject(matches[0].text, "Corrected title", "Corrected artist"),
    recordingSource: recording,
    lyricsSource: matches[0].credit,
  };
  const saved = parseProject(serializeProject(project));
  assert.deepEqual(saved.recordingSource, recording);
  assert.deepEqual(saved.lyricsSource, matches[0].credit);
  assert.equal(saved.metadata.title, "Corrected title");
});
test("restore checks recording bytes and preserves its original file identity", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("media"));
  const recording = {
    id: "abcdefghijk",
    title: "Title",
    url: "https://youtu.be/abcdefghijk",
    fingerprint: createHash("sha256").update("media").digest("hex"),
    fetchedAt: new Date().toISOString(),
  };
  const file = await cachedRecording(recording);
  assert.equal(file.name, "abcdefghijk.mp4");
  assert.equal(file.lastModified, Date.parse(recording.fetchedAt));
  await assert.rejects(
    cachedRecording({ ...recording, fingerprint: "0".repeat(64) }),
    /changed/,
  );
});

test("synced-only editions keep repeated starts, blank breaks and original split-line cues", async (t) => {
  const source =
    "[offset:100]\n[01:15.05][00:05.00]長長的一句歌詞需要分成兩個部分\n[00:09.3]\n[ar:artist]";
  t.mock.method(globalThis, "fetch", async () =>
    Response.json([
      {
        id: 5,
        trackName: "Song",
        artistName: "Artist",
        albumName: null,
        duration: 80,
        syncedLyrics: source,
        plainLyrics: null,
        instrumental: false,
      },
    ]),
  );
  const [edition] = await findLyrics("Song", "Artist");
  assert.deepEqual(
    edition.cues.map((c) => c.startMs),
    [4900, 9200, 74950],
  );
  assert.equal(edition.cues[1].text, "");
  assert.equal(edition.text, Array(2).fill(edition.cues[0].text).join("\n"));
  const pieces = editionPieces(edition.cues);
  assert.deepEqual(
    pieces.map((p) => p.cue),
    [0, 0, 2, 2],
  );
  assert.equal(new Set(pieces.map((p) => p.id)).size, 4);
  assert.ok(pieces.every((p) => lyricCount(p.text) <= 11));
});
