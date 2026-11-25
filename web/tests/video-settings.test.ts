import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { importLegacy } from "../src/legacy.ts";
import { parseProject, serializeProject } from "../src/domain.ts";
import {
  resolveFootageJob,
  videoSettingsSchema,
} from "../src/video/video-settings.ts";

test("footage variants preserve authored data and round absolute excerpt edges", () => {
  const project = importLegacy(
    readFileSync("src/Angela_Zhang_Keep_Walking.ts", "utf8"),
  );
  project.audio = {
    name: "song.mp4",
    size: 1,
    lastModified: 0,
    durationMs: 220000,
  };
  const original = serializeProject(project);
  const full = resolveFootageJob(parseProject(original));
  assert.equal(full.showPinyin, true);
  project.videoSettings = videoSettingsSchema.parse({ variant: "no-pinyin" });
  const hidden = resolveFootageJob(parseProject(serializeProject(project)));
  assert.equal(hidden.showPinyin, false);
  assert.deepEqual(hidden.lines, full.lines);
  project.videoSettings.variant = "only-pinyin";
  const overlay = resolveFootageJob(parseProject(serializeProject(project)));
  assert.equal(overlay.lyricMode, "only-pinyin");
  assert.equal(overlay.portrait, false);
  assert.equal(hidden.lyricMode, "full");
  project.videoSettings.variant = "short";
  assert.throws(() => resolveFootageJob(project), /short range/);
  project.videoSettings.excerpt = { startMs: 1234, endMs: 5678 };
  const short = resolveFootageJob(project);
  assert.equal(short.sequenceOffset, -30);
  assert.equal(short.durationInFrames, 106);
  assert.equal(short.portrait, true);
  delete project.videoSettings;
  assert.equal(serializeProject(project), original);
});

import { designSchema, initialDesign } from "../src/video/designs.ts";
import { jobMedia, resolveThumbnail } from "../src/video/video-settings.ts";
import { loopFrame } from "../../src/remotion/backgrounds/loop-frame.ts";
import { parseVideoTime } from "../src/video/video-time.ts";

test("loop frame order and time inputs agree at both turnarounds", () => {
  const cycle = (length: number, mode: "once" | "repeat" | "ping-pong") =>
    Array.from({ length: 9 }, (_, i) => loopFrame(i, length, mode));
  assert.deepEqual(cycle(4, "ping-pong"), [0, 1, 2, 3, 2, 1, 0, 1, 2]);
  assert.deepEqual(cycle(3, "repeat"), [0, 1, 2, 0, 1, 2, 0, 1, 2]);
  assert.deepEqual(cycle(2, "once"), [0, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(cycle(1, "ping-pong"), Array(9).fill(0));
  assert.equal(parseVideoTime("1:02.03"), 62030);
  assert(Number.isNaN(parseVideoTime("1:60.00")));
});
test("two designs share occurrence timing, resolve separate assets and report job-specific relinks", () => {
  const p = importLegacy(
    readFileSync("src/Angela_Zhang_Keep_Walking.ts", "utf8"),
  );
  const song = new File(["song"], "song.mp4", { type: "video/mp4" });
  const art = new File(["art"], "art.png", { type: "image/png" });
  p.audio = {
    name: song.name,
    size: song.size,
    lastModified: song.lastModified,
    durationMs: 220000,
    hasAudio: true,
    hasVideo: true,
  };
  p.videoSettings = videoSettingsSchema.parse({});
  const settings = p.videoSettings;
  const asset = { id: "art", name: art.name, size: art.size };
  settings.designs.push(
    designSchema.parse({
      id: "artwork",
      name: "Artwork",
      kind: "image",
      asset,
      overrides: { short: { scale: 0.8, watermark: false } },
    }),
  );
  settings.selected = [
    "original/no-pinyin",
    "artwork/short",
    "thumbnail/title-only",
  ];
  settings.thumbnail.asset = asset;
  settings.excerpt = { startMs: 2000, endMs: 3000 };
  const restored = parseProject(serializeProject(p));
  const original = resolveFootageJob(restored, "original", "no-pinyin"),
    short = resolveFootageJob(restored, "artwork", "short");
  assert.equal(original.fps, 23.976);
  assert.equal(short.fps, 30);
  assert.deepEqual(original.lines, short.lines);
  assert.equal(short.showWatermark, false);
  assert.equal(short.sequenceOffset, -60);
  assert.equal(short.durationInFrames, 30);
  assert.deepEqual(jobMedia(restored, song, new Map(), original.design), {
    audio: song,
    visual: song,
  });
  assert.throws(
    () => jobMedia(restored, song, new Map(), short.design),
    /art.png/,
  );
  assert.deepEqual(
    jobMedia(restored, song, new Map([["art", art]]), short.design),
    { audio: song, visual: art },
  );
  assert.equal(
    resolveThumbnail(restored, "title-only").titleEn,
    p.metadata.title,
  );
  assert.throws(() => resolveThumbnail(restored, "full"), /readings/);
  assert.deepEqual(restored.videoSettings?.selected, settings.selected);
});

test("muted original footage requires one playable master and stores no session URLs", () => {
  const p = importLegacy(
    readFileSync("src/Angela_Zhang_Keep_Walking.ts", "utf8"),
  );
  const silent = new File(["clip"], "silent.mp4", { type: "video/mp4" });
  p.audio = {
    name: silent.name,
    size: silent.size,
    durationMs: 12000,
    lastModified: 0,
    hasVideo: true,
    hasAudio: false,
  };
  const s = videoSettingsSchema.parse({});
  p.videoSettings = s;
  assert.throws(
    () => jobMedia(p, silent, new Map(), s.designs[0]),
    /soundtrack containing audio/,
  );
  const audio = new File(["music"], "song.wav", { type: "audio/wav" });
  s.soundtrack = {
    id: "master",
    name: audio.name,
    size: audio.size,
    durationMs: 6000,
    hasAudio: true,
  };
  const media = jobMedia(p, silent, new Map([["master", audio]]), s.designs[0]);
  assert.equal(media.audio, audio);
  assert.equal(media.visual, silent);
  assert.equal(resolveFootageJob(p).durationMs, 6000);
  assert.doesNotMatch(serializeProject(p), /blob:|127\.0\.0\.1/);
});

test("designSchema supports freezeStartMs with round-trip preservation", () => {
  const initial = initialDesign();
  assert.equal(initial.freezeStartMs, 0);

  const custom = designSchema.parse({
    id: "delayed-bg",
    name: "Delayed Background",
    freezeStartMs: 2000,
  });
  assert.equal(custom.freezeStartMs, 2000);

  assert.throws(
    () =>
      designSchema.parse({
        id: "invalid-freeze",
        name: "Invalid",
        freezeStartMs: -100,
      }),
    /too_small|nonnegative/,
  );

  const p = importLegacy(
    readFileSync("src/Angela_Zhang_Keep_Walking.ts", "utf8"),
  );
  p.audio = {
    name: "song.mp4",
    size: 1,
    durationMs: 120000,
    lastModified: 0,
    hasVideo: true,
    hasAudio: true,
  };
  p.videoSettings = videoSettingsSchema.parse({});
  p.videoSettings.designs[0].freezeStartMs = 2000;

  const restored = parseProject(serializeProject(p));
  const activeDesign = restored.videoSettings?.designs.find(
    (d) => d.id === restored.videoSettings?.activeDesign,
  );
  assert.equal(activeDesign?.freezeStartMs, 2000);

  const job = resolveFootageJob(restored);
  assert.equal(job.design.freezeStartMs, 2000);
});

test("resolveFootageJob handles outro with custom part timings and freeze frame extension", () => {
  const p = importLegacy(
    readFileSync("src/Angela_Zhang_Keep_Walking.ts", "utf8"),
  );
  p.audio = {
    name: "song.mp4",
    size: 1,
    durationMs: 100000,
    lastModified: 0,
    hasVideo: true,
    hasAudio: true,
  };
  p.videoSettings = videoSettingsSchema.parse({});
  const fps = 25;

  // 1. Outro overlapping song end (default outroFreeze = false)
  p.videoSettings.designs[0].overrides.landscape = {
    scale: 1,
    vertical: 0,
    english: true,
    polish: true,
    gloss: true,
    hanzi: true,
    outro: true,
    outroFreeze: false,
    outroOverlapMs: 0,
    outroPart1Ms: 2000,
    outroPart2Ms: 3000,
  };
  const overlapJob = resolveFootageJob(p, undefined, "landscape", fps);
  assert(overlapJob.outro !== undefined);
  // Total 5s = 125 frames at 25 fps; song is 100s = 2500 frames
  assert.equal(overlapJob.durationInFrames, 2500);
  assert.equal(overlapJob.outro?.outroStart, 2500 - 125);
  assert.equal(overlapJob.outro?.firstLineEnd, 2500 - 125 + 50); // part 1 = 2s = 50 frames
  assert.equal(overlapJob.outro?.secondLineStart, 2500 - 125 + 50);
  assert.equal(overlapJob.outro?.durationInFrames, 2500);

  // 2. Outro extending after song with freeze frame (outroFreeze = true)
  p.videoSettings.designs[0].overrides.landscape.outroFreeze = true;
  const freezeJob = resolveFootageJob(p, undefined, "landscape", fps);
  assert(freezeJob.outro !== undefined);
  // Total composition extended by 125 frames = 2625 frames
  assert.equal(freezeJob.durationInFrames, 2500 + 125);
  assert.equal(freezeJob.outro?.outroStart, 2500);
  assert.equal(freezeJob.outro?.firstLineEnd, 2500 + 50);
  assert.equal(freezeJob.outro?.secondLineStart, 2500 + 50);
  assert.equal(freezeJob.outro?.durationInFrames, 2500 + 125);

  // 3. Outro with freeze frame and overlap (Part 1 overlaps song, Part 2 on freeze frame)
  p.videoSettings.designs[0].overrides.landscape.outroOverlapMs = 2000; // 50 frames overlap
  const partialFreezeJob = resolveFootageJob(p, undefined, "landscape", fps);
  assert(partialFreezeJob.outro !== undefined);
  // Total composition extended by 125 - 50 = 75 frames (2575 frames)
  assert.equal(partialFreezeJob.durationInFrames, 2500 + 75);
  // Outro starts 50 frames before song end (frame 2450)
  assert.equal(partialFreezeJob.outro?.outroStart, 2450);
  // Part 1 ends exactly as song ends (frame 2500)
  assert.equal(partialFreezeJob.outro?.firstLineEnd, 2500);
  assert.equal(partialFreezeJob.outro?.secondLineStart, 2500);
  // Entire outro ends at 2575
  assert.equal(partialFreezeJob.outro?.durationInFrames, 2575);
});
