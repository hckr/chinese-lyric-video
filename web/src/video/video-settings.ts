import {
  designSchema,
  initialDesign,
  thumbnailSchema,
  assetSchema,
} from "./designs.ts";
import { z } from "zod";
import type { Project } from "../domain.ts";

export const videoVariants = {
  landscape: "Landscape · with Pinyin",
  "only-pinyin": "Landscape · only Pinyin (over Hanzi)",
  "no-pinyin": "Landscape · without Pinyin",
  short: "Portrait short · with Pinyin",
};
export const videoSettingsSchema = z
  .object({
    variant: z
      .enum(["landscape", "no-pinyin", "short", "only-pinyin"])
      .default("landscape"),
    designs: z
      .array(designSchema)
      .min(1)
      .refine((ds) => new Set(ds.map((d) => d.id)).size === ds.length)
      .default(() => [initialDesign()]),
    activeDesign: z.string().default("original"),
    selected: z.array(z.string()).default([]),
    thumbnail: thumbnailSchema.default(() => thumbnailSchema.parse({})),
    thumbnailModes: z.record(z.string(), thumbnailSchema).default({}),
    soundtrack: assetSchema.optional(),
    excerpt: z
      .object({
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().positive(),
      })
      .strict()
      .refine((r) => r.endMs > r.startMs)
      .optional(),
    showWatermark: z.boolean().default(true),
  })
  .strict()
  .superRefine((s, ctx) => {
    const modes = ["full", "only-pinyin", "title-only"];
    const jobs = new Set(modes.map((m) => "thumbnail/" + m));
    for (const design of s.designs) {
      for (const variant of Object.keys(videoVariants))
        jobs.add(design.id + "/" + variant);
      if (
        Object.keys(design.overrides).some(
          (v) => !Object.prototype.hasOwnProperty.call(videoVariants, v),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Unknown variant in design overrides",
        });
    }
    if (!s.designs.some((d) => d.id === s.activeDesign))
      ctx.addIssue({ code: "custom", message: "Unknown active video design" });
    if (
      s.selected.some((id) => !jobs.has(id)) ||
      new Set(s.selected).size !== s.selected.length
    )
      ctx.addIssue({ code: "custom", message: "Invalid export selection" });
    if (
      Object.entries(s.thumbnailModes).some(
        ([mode, t]) => !modes.includes(mode) || mode !== t.mode,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid thumbnail mode settings",
      });
  });
export type VideoSettings = z.infer<typeof videoSettingsSchema>;
export function resolveFootageJob(
  project: Project,
  designId?: string,
  variant?: keyof typeof videoVariants,
  outputFps?: number,
) {
  const settings = project.videoSettings ?? videoSettingsSchema.parse({});
  const design = settings.designs.find(
    (d) => d.id === (designId ?? settings.activeDesign),
  );
  if (!design) throw Error("Choose a visual design.");
  const selectedVariant = variant ?? settings.variant;
  const durationMs =
    settings.soundtrack?.durationMs ?? project.audio?.durationMs;
  if (!durationMs) throw Error("Attach the song media in Timing.");
  const portrait = selectedVariant === "short";
  const fps =
    outputFps ??
    (design.kind === "original" ? 23.976 : design.kind === "image" ? 30 : 25);
  const frame = (ms: number) => Math.round((ms * fps) / 1000);
  const range = portrait ? settings.excerpt : { startMs: 0, endMs: durationMs };
  if (
    !range ||
    range.endMs > durationMs ||
    frame(range.endMs) <= frame(range.startMs)
  )
    throw Error("Choose a short range within the soundtrack in Video.");
  const phrases = new Map(project.phrases.map((p) => [p.id, p]));
  if (!project.occurrences.length) throw Error("Add and time lyrics first.");
  const lines = project.occurrences.map((o) => {
    const phrase = phrases.get(o.phraseId);
    if (
      !phrase ||
      o.startMs === null ||
      o.endMs === null ||
      o.endMs <= o.startMs
    )
      throw Error("Set valid start and end times for every occurrence.");
    return {
      id: o.id,
      startMs: o.startMs,
      endMs: o.endMs,
      words: phrase.words,
      translation: phrase.translation,
    };
  });
  const count = frame(range.endMs) - frame(range.startMs);
  const override = design.overrides[selectedVariant];
  const part1Frames = Math.max(
    1,
    Math.round(((override?.outroPart1Ms ?? 3500) * fps) / 1000),
  );
  const part2Frames = Math.max(
    1,
    Math.round(((override?.outroPart2Ms ?? 4000) * fps) / 1000),
  );
  const totalOutroFrames = part1Frames + part2Frames;
  const isOutroFreeze = Boolean(override?.outro && override?.outroFreeze);
  let outro:
    | {
        outroStart: number;
        heartStart: number;
        firstLineEnd: number;
        secondLineStart: number;
        durationInFrames: number;
      }
    | undefined;
  let durationInFrames = count;

  if (override?.outro) {
    if (isOutroFreeze) {
      const overlapFrames = Math.max(
        0,
        Math.min(
          totalOutroFrames,
          Math.round(((override?.outroOverlapMs ?? 0) * fps) / 1000),
        ),
      );
      const extendFrames = totalOutroFrames - overlapFrames;
      const start = frame(range.endMs) - overlapFrames;
      const split = start + part1Frames;
      const end = start + totalOutroFrames;
      durationInFrames = count + extendFrames;
      outro = {
        outroStart: start,
        heartStart: start + Math.floor(part1Frames * 0.35),
        firstLineEnd: split,
        secondLineStart: split,
        durationInFrames: end,
      };
    } else if (count >= 3) {
      const length = Math.min(totalOutroFrames, count);
      const start = frame(range.endMs) - length;
      const effectivePart1 = Math.round(
        (part1Frames / totalOutroFrames) * length,
      );
      const split = start + effectivePart1;
      outro = {
        outroStart: start,
        heartStart: start + Math.floor(effectivePart1 * 0.35),
        firstLineEnd: split,
        secondLineStart: split,
        durationInFrames: frame(range.endMs),
      };
    }
  }
  return {
    outro,
    design: override?.fit ? { ...design, fit: override.fit } : design,
    fps,
    layout: design.overrides[selectedVariant],
    lines,
    durationMs,
    durationInFrames,
    sequenceOffset: -frame(range.startMs),
    portrait,
    lyricMode:
      selectedVariant === "only-pinyin"
        ? ("only-pinyin" as const)
        : ("full" as const),
    showPinyin:
      selectedVariant === "only-pinyin" ||
      (selectedVariant !== "no-pinyin" && (override?.pinyin ?? true)),
    showWatermark: override?.watermark ?? settings.showWatermark,
  };
}

export function thumbnailModeSettings(
  s: VideoSettings,
  mode = s.thumbnail.mode,
) {
  return { ...(s.thumbnailModes[mode] ?? s.thumbnail), mode };
}

export function resolveThumbnail(
  project: Project,
  mode?: VideoSettings["thumbnail"]["mode"],
) {
  const thumbnail = thumbnailModeSettings(
    project.videoSettings ?? videoSettingsSchema.parse({}),
    mode,
  );
  const selected = mode ?? thumbnail.mode;
  const titleEn = thumbnail.title ?? project.metadata.title;
  if (!thumbnail.asset) throw Error("Choose thumbnail artwork in Video.");
  if (
    selected !== "title-only" &&
    (!thumbnail.words.length ||
      thumbnail.words.some((w) => !w.hanzi.trim() || !w.pinyin.trim()))
  )
    throw Error("Enter title characters and their readings.");
  if (selected !== "only-pinyin" && !titleEn.trim())
    throw Error("Enter a thumbnail title.");
  return {
    mode: selected,
    titleEn,
    titleWords: thumbnail.words,
    topLabel: thumbnail.top ?? project.metadata.artist,
    bottomLabel: thumbnail.bottom,
    musicNotesStyle: thumbnail.notesColor
      ? { color: thumbnail.notesColor }
      : undefined,
    musicNotesWatermark: thumbnail.notes,
    bgImageOpacity: thumbnail.opacity,
  };
}

export function jobMedia(
  project: Project,
  file: File | null,
  files: Map<string, File>,
  design: import("./designs.ts").Design,
) {
  const settings = project.videoSettings;
  const audio = settings?.soundtrack ? files.get(settings.soundtrack.id) : file;
  if (!settings?.soundtrack && project.audio?.hasAudio === false)
    throw Error("Choose a master soundtrack containing audio.");
  if (!audio)
    throw Error(
      "Relink soundtrack: " +
        (settings?.soundtrack?.name ?? project.audio?.name ?? "song media"),
    );
  const visual = design.asset
    ? files.get(design.asset.id)
    : design.kind === "original"
      ? file
      : null;
  if (!visual)
    throw Error(
      "Choose or relink " + (design.asset?.name ?? design.name + " background"),
    );
  if (
    design.kind === "original" &&
    !design.asset &&
    !(project.audio?.hasVideo ?? visual.type.startsWith("video/"))
  )
    throw Error("Choose original video for " + design.name);
  if (
    design.kind === "loop" &&
    (!design.asset?.durationMs ||
      (design.endMs ?? design.asset.durationMs) > design.asset.durationMs ||
      design.startMs >= (design.endMs ?? design.asset.durationMs))
  )
    throw Error("Correct the loop trim range.");
  return { audio, visual };
}
