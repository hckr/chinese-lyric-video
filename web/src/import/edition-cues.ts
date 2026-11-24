import { z } from "zod";
import { suggestPieces } from "../lyric-length.ts";

export const editionTimingSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  editionId: z.number().int(),
  cues: z.array(
    z.object({ startMs: z.number().int().nonnegative(), text: z.string() }),
  ),
  credits: z
    .array(
      z.object({
        provider: z.literal("LRCLIB"),
        id: z.number(),
        url: z.string().url(),
        track: z.string(),
        artist: z.string(),
        album: z.string(),
        duration: z.number(),
        fetchedAt: z.string(),
        cues: z
          .array(
            z.object({
              startMs: z.number().int().nonnegative(),
              text: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  pieces: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      cue: z.number().int().min(-1),
      sourceId: z.number().optional(),
      timingSourceId: z.number().optional(),
      alternativeStarts: z.array(z.number().int().nonnegative()).optional(),
      sourceStart: z.number().int().nonnegative().optional(),
      acceptStart: z.boolean().optional(),
    }),
  ),
});
export type EditionTiming = z.infer<typeof editionTimingSchema>;
export type SourceCue = EditionTiming["cues"][number];
export function parseLrc(value: string) {
  const cues: SourceCue[] = [];
  const offset = Number(value.match(/^\s*\[offset:([+-]?\d+)\]/im)?.[1] ?? 0);
  for (const line of value.split(/\r?\n/)) {
    const prefix = line.match(
      /^\s*((?:\[\d+:[0-5]\d(?:[.:]\d{1,3})?\]\s*)+)/,
    )?.[0];
    if (!prefix) continue;
    const text = line.slice(prefix.length).trim();
    for (const m of prefix.matchAll(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)) {
      const startMs = Math.max(
        0,
        (Number(m[1]) * 60 + Number(m[2])) * 1000 +
          Number((m[3] ?? "").padEnd(3, "0")) -
          offset,
      );
      if (Number.isSafeInteger(startMs)) cues.push({ startMs, text });
    }
  }
  return cues.sort((a, b) => a.startMs - b.startMs);
}
export function editionPieces(cues: SourceCue[]) {
  return cues.flatMap(({ text }, cue) =>
    suggestPieces(text)
      .map((piece) => piece.trim())
      .filter(Boolean)
      .map((piece, i) => ({
        text: piece,
        id: crypto.randomUUID(),
        cue,
        ...(i === 0
          ? { sourceStart: cues[cue].startMs, acceptStart: true }
          : {}),
      })),
  );
}
export function cueTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return (
    Math.floor(seconds / 60) +
    ":" +
    String(seconds % 60).padStart(2, "0") +
    "." +
    String(Math.floor((ms % 1000) / 10)).padStart(2, "0")
  );
}
