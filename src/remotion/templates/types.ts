import { z } from "zod";
import { TimedLineData } from "../lyrics/types";
import { OutroProps } from "../overlays/Outro";

export const WordDataSchema = z.object({
  hanzi: z.string(),
  pinyin: z.string(),
  translation: z.object({
    en: z.string(),
  }),
});

export const LineDataSchema = z.object({
  id: z.string(),
  words: z.array(WordDataSchema),
  translation: z.object({
    en: z.string(),
    pl: z.string(),
  }),
});

export const TimedLineDataSchema = LineDataSchema.extend({
  startMs: z.number(),
  endMs: z.number(),
});

export const LyricModeSchema = z.enum(["full", "only-pinyin"]);
export type LyricMode = z.infer<typeof LyricModeSchema>;

export const VideoVariantSchema = z.enum(["landscape", "short"]);
export type VideoVariant = z.infer<typeof VideoVariantSchema>;

export const OutroConfigSchema = z.object({
  outroStart: z.number(),
  heartStart: z.number(),
  firstLineEnd: z.number(),
  secondLineStart: z.number(),
  durationInFrames: z.number().optional(),
});
export type OutroConfig = OutroProps;

export const VideoLyricTemplateSchema = z.object({
  videoSrc: z.string().default("Angela_Zhang_Keep_Walking.mp4"),
  lyricMode: LyricModeSchema.default("full"),
  variant: VideoVariantSchema.default("landscape"),
  sequenceOffset: z.number().default(0),
  showWatermark: z.boolean().default(true),
  watermarkText: z.string().default("@SingInMandarin"),
  showDimOverlay: z.boolean().default(true),
});
export type VideoLyricTemplateProps = {
  renderScene?: (lyrics: React.ReactNode) => React.ReactNode;
  layout?: import("../../../web/src/designs").Design["overrides"][string];
  showPinyin?: boolean;
  lines?: TimedLineData[];
  videoSrc?: string;
  lyricMode?: LyricMode;
  variant?: VideoVariant;
  sequenceOffset?: number;
  showWatermark?: boolean;
  watermarkText?: string;
  showDimOverlay?: boolean;
  outro?: OutroConfig | null;
};

export const ImageVisualizerTemplateSchema = z.object({
  imageSrc: z.string().default("macchiato_cover.png"),
  audioSrc: z.string().default("Macchiato_Special_Affection_for_You.mp4"),
  lyricMode: LyricModeSchema.default("full"),
  variant: VideoVariantSchema.default("landscape"),
  sequenceOffset: z.number().default(0),
  showWatermark: z.boolean().default(true),
  watermarkText: z.string().default("@SingInMandarin"),
  showDimOverlay: z.boolean().default(false),
  bassPulse: z.boolean().default(true),
  showVisualizer: z.boolean().default(true),
});
export type ImageVisualizerTemplateProps = {
  lines?: TimedLineData[];
  imageSrc?: string;
  audioSrc?: string;
  lyricMode?: LyricMode;
  variant?: VideoVariant;
  sequenceOffset?: number;
  showWatermark?: boolean;
  watermarkText?: string;
  showDimOverlay?: boolean;
  bassPulse?: boolean;
  showVisualizer?: boolean;
};

export const UniversalLyricVideoSchema = z.object({
  lines: z.array(TimedLineDataSchema).default([]),
  lyricMode: LyricModeSchema.default("full"),
  variant: VideoVariantSchema.default("landscape"),
  sequenceOffset: z.number().default(0),
  showWatermark: z.boolean().default(true),
  watermarkText: z.string().default("@SingInMandarin"),
  showDimOverlay: z.boolean().optional(),
  outro: OutroConfigSchema.nullable().optional(),
  background: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("video"),
      videoSrc: z.string(),
    }),
    z.object({
      type: z.literal("image-visualizer"),
      imageSrc: z.string(),
      audioSrc: z.string(),
      bassPulse: z.boolean().default(true),
      showVisualizer: z.boolean().default(true),
    }),
  ]),
});
export type UniversalLyricVideoProps = {
  lines?: TimedLineData[];
  lyricMode?: LyricMode;
  variant?: VideoVariant;
  sequenceOffset?: number;
  showWatermark?: boolean;
  watermarkText?: string;
  showDimOverlay?: boolean;
  outro?: OutroConfig | null;
  background:
    | {
        type: "video";
        videoSrc: string;
      }
    | {
        type: "image-visualizer";
        imageSrc: string;
        audioSrc: string;
        bassPulse?: boolean;
        showVisualizer?: boolean;
      };
};

// ========================================================
// Thumbnail Template Schemas & Types
// ========================================================

export const TitleWordSchema = z.object({
  hanzi: z.string(),
  pinyin: z.string(),
  translation: z.string().optional(),
});
export type TitleWord = z.infer<typeof TitleWordSchema>;

export const ThumbnailModeSchema = z.enum([
  "full",
  "only-pinyin",
  "title-only",
]);
export type ThumbnailMode = z.infer<typeof ThumbnailModeSchema>;

export const ThumbnailTemplateSchema = z.object({
  titleWords: z.array(TitleWordSchema).optional(),
  musicNotesStyle: z
    .object({
      color: z.string().optional(),
      opacity: z.number().min(0).max(1).optional(),
    })
    .optional(),
  bgImageSrc: z.string().default("thumbnail-bg-369.png"),
  bgImageOpacity: z.number().default(0.6),
  musicNotesWatermark: z.string().default("♪♬"),
  topLabel: z
    .string()
    .default("Mandarin song lyrics\nPinyin · English · Polish"),
  bottomLabel: z.string().default("characters with pinyin"),
  titleEn: z.string().default("Keep Walking in the Rain"),
  mode: ThumbnailModeSchema.default("full"),
});
export type ThumbnailTemplateProps = {
  bgImageSrc?: string;
  bgImageOpacity?: number;
  musicNotesWatermark?: string;
  musicNotesStyle?: React.CSSProperties;
  topLabel?: string;
  bottomLabel?: string;
  titleEn?: string;
  titleWords?: TitleWord[];
  mode?: ThumbnailMode;
};
