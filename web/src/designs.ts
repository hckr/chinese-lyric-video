import { z } from "zod";
export const assetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    size: z.number().int().nonnegative(),
    durationMs: z.number().positive().optional(),
    hasAudio: z.boolean().optional(),
    hasVideo: z.boolean().optional(),
  })
  .strict();
export type Asset = z.infer<typeof assetSchema>;
export const designSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,64}$/)
      .refine((id) => id !== "thumbnail"),
    name: z.string().trim().min(1),
    kind: z.enum(["original", "image", "loop"]).default("original"),
    asset: assetSchema.optional(),
    fit: z.enum(["cover", "contain"]).default("cover"),
    dim: z.boolean().default(true),
    bars: z.enum(["both", "top", "bottom"]).default("both"),
    visualizer: z.boolean().default(false),
    bassPulse: z.boolean().default(false),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .default("#ffffff"),
    intensity: z.number().min(0).max(2).default(1),
    loop: z.enum(["repeat", "once", "ping-pong"]).default("repeat"),
    startMs: z.number().int().nonnegative().default(0),
    endMs: z.number().int().positive().optional(),
    speed: z.number().positive().max(4).default(1),
    overrides: z
      .record(
        z.string(),
        z
          .object({
            fit: z.enum(["cover", "contain"]).optional(),
            margin: z.number().min(0).max(20).optional(),
            pinyin: z.boolean().optional(),
            watermark: z.boolean().optional(),
            outro: z.boolean().optional(),
            scale: z.number().min(0.4).max(1.5).default(1),
            vertical: z.number().min(-40).max(40).default(0),
            english: z.boolean().default(true),
            polish: z.boolean().default(true),
            gloss: z.boolean().default(true),
            hanzi: z.boolean().default(true),
          })
          .strict(),
      )
      .default({}),
  })
  .strict();
export const thumbnailSchema = z
  .object({
    mode: z.enum(["full", "only-pinyin", "title-only"]).default("title-only"),
    asset: assetSchema.optional(),
    opacity: z.number().min(0).max(1).default(0.6),
    title: z.string().optional(),
    top: z.string().optional(),
    bottom: z.string().default("characters with pinyin"),
    notesColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    notes: z.string().default("♪♬"),
    words: z
      .array(
        z.object({
          hanzi: z.string(),
          pinyin: z.string(),
          translation: z.string(),
        }),
      )
      .default([]),
  })
  .strict();
export type Design = z.infer<typeof designSchema>;
export const initialDesign = () =>
  designSchema.parse({ id: "original", name: "Original footage" });
